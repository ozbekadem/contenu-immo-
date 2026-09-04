import sharp from "sharp";
import { toRaw, fromRaw } from "./raw";
import { applyTonePipeline, NEUTRAL_TONE, type ToneParams } from "./color";
import { applyDetail } from "./detail";
import { correctVertical, correctWideAngle, estimateVerticalCorrection } from "./geometry";
import { applyOutline, type Rect, type OutlineStyle } from "./outline";
import type { DetailParams } from "./presets";

export interface RetoucheProOptions {
  tone: ToneParams;
  detail: DetailParams;
  autoVertical: boolean;
  autoWideAngle: boolean;
  wideAngleStrength: number;
  manualRollDeg?: number;
  manualKeystone?: number;
  quality: number;
}

export interface StepResult {
  width: number;
  height: number;
}

/**
 * The full "Retouche Pro en 1 clic" pipeline for a single photo: EXIF
 * auto-orient -> (optional) auto vertical straighten -> (optional)
 * wide-angle correction -> tone/colour pass (exposure, white balance,
 * shadows/highlights, contrast, saturation, warmth, sky & window grading)
 * -> sharpening/denoise -> encode. All in one traversal per photo so a
 * batch of 10 stays fast.
 */
export async function runRetouchePro(inputPath: string, outPath: string, opts: RetoucheProOptions): Promise<StepResult> {
  let pipeline = sharp(inputPath).rotate();

  if (opts.manualRollDeg !== undefined || opts.manualKeystone !== undefined) {
    pipeline = await correctVertical(pipeline, opts.manualRollDeg ?? 0, opts.manualKeystone ?? 0);
  } else if (opts.autoVertical) {
    const est = await estimateVerticalCorrection(pipeline.clone());
    pipeline = await correctVertical(pipeline, est.rollDeg, est.keystone);
  }

  if (opts.autoWideAngle && opts.wideAngleStrength > 0) {
    pipeline = await correctWideAngle(pipeline, opts.wideAngleStrength);
  }

  const raw = await toRaw(pipeline);
  applyTonePipeline(raw, opts.tone);
  pipeline = fromRaw(raw);
  pipeline = applyDetail(pipeline, opts.detail);

  const info = await pipeline.jpeg({ quality: opts.quality, mozjpeg: true }).toFile(outPath);
  return { width: info.width, height: info.height };
}

export async function runToneOnly(inputPath: string, outPath: string, tone: Partial<ToneParams>, quality = 90): Promise<StepResult> {
  const pipeline = sharp(inputPath).rotate();
  const raw = await toRaw(pipeline);
  applyTonePipeline(raw, { ...NEUTRAL_TONE, ...tone });
  const info = await fromRaw(raw).jpeg({ quality, mozjpeg: true }).toFile(outPath);
  return { width: info.width, height: info.height };
}

export async function runDetailOnly(inputPath: string, outPath: string, detail: DetailParams, quality = 90): Promise<StepResult> {
  const info = await applyDetail(sharp(inputPath).rotate(), detail)
    .jpeg({ quality, mozjpeg: true })
    .toFile(outPath);
  return { width: info.width, height: info.height };
}

export async function runVerticalOnly(
  inputPath: string,
  outPath: string,
  rollDeg: number,
  keystone: number,
  quality = 90
): Promise<StepResult> {
  const pipeline = await correctVertical(sharp(inputPath).rotate(), rollDeg, keystone);
  const info = await pipeline.jpeg({ quality, mozjpeg: true }).toFile(outPath);
  return { width: info.width, height: info.height };
}

export async function runWideAngleOnly(inputPath: string, outPath: string, strength: number, quality = 90): Promise<StepResult> {
  const pipeline = await correctWideAngle(sharp(inputPath).rotate(), strength);
  const info = await pipeline.jpeg({ quality, mozjpeg: true }).toFile(outPath);
  return { width: info.width, height: info.height };
}

export async function runOutlineOnly(
  inputPath: string,
  outPath: string,
  rect: Rect,
  style: OutlineStyle,
  quality = 92
): Promise<StepResult> {
  const pipeline = await applyOutline(sharp(inputPath).rotate(), rect, style);
  const info = await pipeline.jpeg({ quality, mozjpeg: true }).toFile(outPath);
  return { width: info.width, height: info.height };
}

/** Smart-crop suggestion: rule-of-thirds aware trim that avoids cutting
 * doors/windows too tight by keeping generous margins, and flags excess
 * ceiling/floor using simple sky/floor heuristics computed by the caller. */
export interface CropSuggestion extends Rect {
  reason: string;
}

export async function runCrop(inputPath: string, outPath: string, rect: Rect, quality = 92): Promise<StepResult> {
  const meta = await sharp(inputPath).rotate().metadata();
  const width = meta.width ?? 1600;
  const height = meta.height ?? 1200;
  const left = Math.round(rect.x * width);
  const top = Math.round(rect.y * height);
  const cropW = Math.max(1, Math.round(rect.w * width));
  const cropH = Math.max(1, Math.round(rect.h * height));
  const info = await sharp(inputPath)
    .rotate()
    .extract({ left, top, width: cropW, height: cropH })
    .jpeg({ quality, mozjpeg: true })
    .toFile(outPath);
  return { width: info.width, height: info.height };
}

export async function exportResized(
  inputPath: string,
  outPath: string,
  opts: { maxDimension?: number; quality: number; format: "jpeg" | "webp" }
): Promise<StepResult> {
  let pipeline = sharp(inputPath).rotate();
  if (opts.maxDimension) {
    pipeline = pipeline.resize({ width: opts.maxDimension, height: opts.maxDimension, fit: "inside", withoutEnlargement: true });
  }
  const encoded = opts.format === "webp" ? pipeline.webp({ quality: opts.quality }) : pipeline.jpeg({ quality: opts.quality, mozjpeg: true });
  const info = await encoded.toFile(outPath);
  return { width: info.width, height: info.height };
}
