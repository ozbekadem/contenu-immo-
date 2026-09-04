import os from "os";
import path from "path";
import { randomUUID } from "crypto";
import sharp from "sharp";
import { promises as fs } from "fs";
import type { Project, Photo, JobType } from "../types";
import { absPath } from "../storage";
import { commitStep } from "../photoOps";
import { analyzePhoto } from "./analyze";
import { getAIProvider } from "../ai";
import { grayWorldGains } from "./color";
import {
  runRetouchePro,
  runToneOnly,
  runDetailOnly,
  runVerticalOnly,
  runWideAngleOnly,
  runOutlineOnly,
  runCrop,
} from "./pipeline";
import {
  buildRetouchProParams,
  buildHdrOnlyTone,
  buildLuminositeTone,
  buildWhiteBalanceTone,
  STYLE_IMMO_VISION,
} from "./presets";
import { computeHarmonizationTarget } from "./recommendations";
import { suggestPropertyOutline, CONTOUR_IMMO_VISION, type Rect, type OutlineStyle } from "./outline";
import { parseInstruction } from "./instructionParser";
import type { DeclutterLevel } from "../ai/provider";

function tmpFile(): string {
  return path.join(os.tmpdir(), `retouche-${randomUUID()}.jpg`);
}

function requiresNonStrict(project: Project, action: string) {
  if (project.settings.fidelityMode === "strict") {
    throw new Error(
      `"${action}" est une modification IA et nécessite le mode Commercial ou Virtual Staging (mode Fidélité actuel : Strict).`
    );
  }
}

// Analysis always reads the untouched working baseline (previewFile), never
// the current edited state — otherwise a photo already brightened by a
// manual tool would read as "already correct" and Retouche Pro would stop
// correcting the original exposure problem.
async function ensureAnalysis(photo: Photo): Promise<void> {
  if (photo.analysis) return;
  photo.analysis = await analyzePhoto(absPath(photo.previewFile));
}

async function aiStep(
  project: Project,
  photo: Photo,
  kind: "suppression_objet" | "ajout_objet" | "desencombrement" | "virtual_staging" | "instruction" | "ciel",
  label: string,
  run: (imgPath: string) => Promise<{ ok: boolean; buffer?: Buffer; message: string }>,
  params?: Record<string, unknown>
): Promise<string> {
  const result = await run(absPath(photo.currentFile));
  if (!result.ok || !result.buffer) {
    throw new Error(result.message);
  }
  const out = tmpFile();
  await sharp(result.buffer).jpeg({ quality: 92, mozjpeg: true }).toFile(out);
  await commitStep(project, photo, kind, label, out, params, "modification_ia");
  return result.message;
}

/**
 * Executes one tool (JobType) against one photo, appending a non-destructive
 * history step. This is the single dispatch point shared by the batch job
 * worker and any direct single-photo API call, so "apply to this photo" /
 * "apply to selection" / "apply to the whole lot" all funnel through the
 * exact same logic.
 */
export async function applyTool(project: Project, photo: Photo, type: JobType, params: Record<string, unknown>): Promise<void> {
  const intensity = (params.intensity as number | undefined) ?? project.settings.intensity;

  switch (type) {
    case "retouche_pro":
    case "preset": {
      await ensureAnalysis(photo);
      const a = photo.analysis!;
      const wbGain = grayWorldGains(a.channelMeans[0], a.channelMeans[1], a.channelMeans[2], 1);
      const exposureDelta = 0.45 - a.brightness;

      let harmonize: ReturnType<typeof computeHarmonizationTarget> | null = null;
      if (project.settings.harmonizeLot) {
        harmonize = computeHarmonizationTarget(project.photos);
      }

      const hdrMode = type === "preset" ? STYLE_IMMO_VISION.hdrMode : project.settings.hdrMode;
      const colorStyle = type === "preset" ? STYLE_IMMO_VISION.colorStyle : project.settings.colorStyle;
      const effectiveIntensity = type === "preset" ? STYLE_IMMO_VISION.intensity : intensity;

      const { tone, detail } = buildRetouchProParams({
        intensity: effectiveIntensity,
        hdrMode,
        colorStyle,
        lightAuto: project.settings.lightAuto,
        manualBrightness: params.manualBrightness as number | undefined,
        environment: a.environment,
        measured: {
          wbGain,
          exposureDelta,
          noise: a.noise,
          windowOverexposure: a.windowOverexposure,
          skyFraction: a.skyFraction,
        },
        harmonize: harmonize ? { ...harmonize, blend: 0.4 } : undefined,
      });

      const out = tmpFile();
      const autoVertical = Math.abs(a.verticalTiltDeg) > 0.4;
      const autoWideAngle = a.wideAngleDistortion !== "faible";
      await runRetouchePro(absPath(photo.previewFile), out, {
        tone,
        detail,
        autoVertical,
        autoWideAngle,
        wideAngleStrength: a.wideAngleDistortion === "fort" ? 0.5 : a.wideAngleDistortion === "moyen" ? 0.3 : 0,
        quality: 90,
      });
      await commitStep(
        project,
        photo,
        type,
        type === "preset" ? "Style Immo Vision" : "Retouche Pro",
        out,
        { intensity: effectiveIntensity, hdrMode, colorStyle }
      );
      return;
    }

    case "hdr": {
      const hdrMode = (params.hdrMode as Project["settings"]["hdrMode"]) ?? project.settings.hdrMode;
      const tone = buildHdrOnlyTone(hdrMode, intensity);
      const out = tmpFile();
      await runToneOnly(absPath(photo.currentFile), out, tone);
      await commitStep(project, photo, "hdr", `HDR (${hdrMode})`, out, { hdrMode, intensity });
      return;
    }

    case "luminosite": {
      const lightAuto = (params.lightAuto as Project["settings"]["lightAuto"]) ?? project.settings.lightAuto;
      const manualBrightness = params.manualBrightness as number | undefined;
      const tone = buildLuminositeTone(lightAuto, manualBrightness, intensity);
      const out = tmpFile();
      await runToneOnly(absPath(photo.currentFile), out, tone);
      await commitStep(project, photo, "luminosite", "Luminosité", out, { lightAuto, manualBrightness, intensity });
      return;
    }

    case "balance_blancs": {
      await ensureAnalysis(photo);
      const a = photo.analysis!;
      const wbGain = grayWorldGains(a.channelMeans[0], a.channelMeans[1], a.channelMeans[2], 1);
      const tone = buildWhiteBalanceTone(wbGain, intensity);
      const out = tmpFile();
      await runToneOnly(absPath(photo.currentFile), out, tone);
      await commitStep(project, photo, "balance_blancs", "Balance des blancs", out, { intensity });
      return;
    }

    case "nettete": {
      const out = tmpFile();
      await runDetailOnly(absPath(photo.currentFile), out, { sharpen: 0.4 + 0.5 * (intensity / 100), denoise: 0 });
      await commitStep(project, photo, "nettete", "Netteté intelligente", out, { intensity });
      return;
    }

    case "debruitage": {
      const out = tmpFile();
      await runDetailOnly(absPath(photo.currentFile), out, { sharpen: 0.1, denoise: 0.3 + 0.6 * (intensity / 100) });
      await commitStep(project, photo, "debruitage", "Débruitage", out, { intensity });
      return;
    }

    case "perspective": {
      const mode = (params.mode as "auto" | "manuel") ?? "auto";
      let rollDeg = params.rollDeg as number | undefined;
      let keystone = params.keystone as number | undefined;
      if (mode === "auto") {
        const { estimateVerticalCorrection } = await import("./geometry");
        const est = await estimateVerticalCorrection(sharp(absPath(photo.currentFile)).rotate());
        rollDeg = est.rollDeg;
        keystone = est.keystone;
      }
      const out = tmpFile();
      await runVerticalOnly(absPath(photo.currentFile), out, rollDeg ?? 0, keystone ?? 0);
      await commitStep(project, photo, "perspective", "Redresser l'architecture", out, { mode, rollDeg, keystone });
      return;
    }

    case "grand_angle": {
      const strength = (params.strength as number | undefined) ?? 0.35;
      const out = tmpFile();
      await runWideAngleOnly(absPath(photo.currentFile), out, strength);
      await commitStep(project, photo, "grand_angle", "Correction grand-angle", out, { strength });
      return;
    }

    case "ciel": {
      const mode = (params.mode as "ameliorer" | "remplacer") ?? "ameliorer";
      if (mode === "ameliorer") {
        const out = tmpFile();
        await runToneOnly(absPath(photo.currentFile), out, { skyBoost: 0.5 + 0.5 * (intensity / 100) });
        await commitStep(project, photo, "ciel", "Ciel amélioré", out, { mode, intensity }, "retouche");
      } else {
        requiresNonStrict(project, "Remplacer le ciel");
        const style = (params.style as string) ?? "clear natural blue sky";
        await aiStep(project, photo, "ciel", `Ciel remplacé (${style})`, (p) => getAIProvider().replaceSky(p, style), {
          mode,
          style,
        });
      }
      return;
    }

    case "cadrage": {
      const rect = params.rect as Rect;
      if (!rect) throw new Error("Zone de recadrage manquante.");
      const out = tmpFile();
      await runCrop(absPath(photo.currentFile), out, rect);
      await commitStep(project, photo, "cadrage", "Cadrage amélioré", out, { rect });
      return;
    }

    case "contour": {
      let rect = params.rect as Rect | undefined;
      if (!rect) rect = await suggestPropertyOutline(sharp(absPath(photo.currentFile)).rotate());
      const style: OutlineStyle = (params.style as OutlineStyle) ?? CONTOUR_IMMO_VISION;
      const out = tmpFile();
      await runOutlineOnly(absPath(photo.currentFile), out, rect, style);
      await commitStep(project, photo, "contour", "Contour mis en évidence", out, { rect, style });
      return;
    }

    case "suppression_objet": {
      requiresNonStrict(project, "Supprimer un objet");
      const rect = params.rect as Rect;
      const instruction = params.instruction as string | undefined;
      if (!rect) throw new Error("Zone à traiter manquante.");
      await aiStep(
        project,
        photo,
        "suppression_objet",
        "Objet supprimé",
        (p) => getAIProvider().removeObject(p, rect, instruction),
        { rect, instruction }
      );
      return;
    }

    case "ajout_objet": {
      requiresNonStrict(project, "Ajouter un objet");
      const rect = params.rect as Rect;
      const instruction = params.instruction as string;
      if (!rect || !instruction) throw new Error("Zone et description requises.");
      await aiStep(
        project,
        photo,
        "ajout_objet",
        `Objet ajouté : ${instruction}`,
        (p) => getAIProvider().addObject(p, rect, instruction),
        { rect, instruction }
      );
      return;
    }

    case "desencombrement": {
      requiresNonStrict(project, "Ranger la pièce");
      const level = (params.level as DeclutterLevel) ?? "standard";
      await aiStep(
        project,
        photo,
        "desencombrement",
        `Pièce rangée (${level})`,
        (p) => getAIProvider().declutter(p, level),
        { level }
      );
      return;
    }

    case "virtual_staging": {
      if (project.settings.fidelityMode !== "virtual_staging") {
        throw new Error('Le Virtual Staging nécessite le mode Fidélité "Virtual Staging".');
      }
      const style = (params.style as string) ?? "moderne";
      const roomType = (params.roomType as string) ?? "salon";
      await aiStep(
        project,
        photo,
        "virtual_staging",
        `Virtual Staging (${style})`,
        (p) => getAIProvider().virtualStaging(p, style, roomType),
        { style, roomType }
      );
      return;
    }

    case "custom": {
      // Mode Pro: direct, honest sliders mapped onto the real tone/detail/
      // geometry engine (exposition, ombres, hautes lumières, contraste,
      // saturation, température, netteté, débruitage, verticales, grand-angle).
      const tone = (params.tone as Record<string, number>) ?? {};
      const detail = params.detail as { sharpen?: number; denoise?: number } | undefined;
      const geometry = params.geometry as { rollDeg?: number; keystone?: number; wideAngle?: number } | undefined;

      let out = tmpFile();
      let workingPath = absPath(photo.currentFile);
      let touched = false;

      if (geometry && (geometry.rollDeg || geometry.keystone)) {
        await runVerticalOnly(workingPath, out, geometry.rollDeg ?? 0, geometry.keystone ?? 0);
        workingPath = out;
        out = tmpFile();
        touched = true;
      }
      if (geometry?.wideAngle) {
        await runWideAngleOnly(workingPath, out, geometry.wideAngle);
        if (workingPath !== absPath(photo.currentFile)) await fs.unlink(workingPath).catch(() => {});
        workingPath = out;
        out = tmpFile();
        touched = true;
      }
      if (Object.keys(tone).length) {
        await runToneOnly(workingPath, out, tone);
        if (workingPath !== absPath(photo.currentFile)) await fs.unlink(workingPath).catch(() => {});
        workingPath = out;
        out = tmpFile();
        touched = true;
      }
      if (detail && (detail.sharpen || detail.denoise)) {
        await runDetailOnly(workingPath, out, { sharpen: detail.sharpen ?? 0, denoise: detail.denoise ?? 0 });
        if (workingPath !== absPath(photo.currentFile)) await fs.unlink(workingPath).catch(() => {});
        workingPath = out;
        touched = true;
      }

      if (!touched) throw new Error("Aucun réglage à appliquer.");
      await commitStep(project, photo, "custom", "Réglages Pro", workingPath, params, "retouche");
      return;
    }

    case "instruction": {
      const text = params.text as string;
      if (!text?.trim()) throw new Error("Instruction vide.");
      const actions = parseInstruction(text);
      for (const action of actions) {
        if (action.type === "tone") {
          const out = tmpFile();
          await runToneOnly(absPath(photo.currentFile), out, action.tone);
          await commitStep(project, photo, "instruction", action.label, out, { text }, "retouche");
        } else if (action.type === "sky_enhance") {
          const out = tmpFile();
          await runToneOnly(absPath(photo.currentFile), out, { skyBoost: 0.6 });
          await commitStep(project, photo, "instruction", action.label, out, { text }, "retouche");
        } else if (action.type === "sky_replace") {
          requiresNonStrict(project, "Remplacer le ciel (instruction)");
          await aiStep(project, photo, "instruction", action.label, (p) => getAIProvider().replaceSky(p, action.style), { text });
        } else if (action.type === "contour") {
          const rect = await suggestPropertyOutline(sharp(absPath(photo.currentFile)).rotate());
          const out = tmpFile();
          await runOutlineOnly(absPath(photo.currentFile), out, rect, CONTOUR_IMMO_VISION);
          await commitStep(project, photo, "instruction", action.label, out, { text }, "retouche");
        } else if (action.type === "declutter") {
          requiresNonStrict(project, "Ranger la pièce (instruction)");
          await aiStep(project, photo, "instruction", action.label, (p) => getAIProvider().declutter(p, action.level), { text });
        } else {
          requiresNonStrict(project, "Modification libre par instruction");
          await aiStep(project, photo, "instruction", action.label, (p) => getAIProvider().freeformEdit(p, action.instruction), {
            text,
          });
        }
      }
      return;
    }

    default:
      throw new Error(`Type d'opération inconnu: ${type}`);
  }
}
