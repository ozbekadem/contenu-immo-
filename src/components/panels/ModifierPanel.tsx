"use client";

import { useState } from "react";
import { api } from "@/lib/apiClient";
import type { JobType, Photo, Project } from "@/lib/types";
import type { Rect } from "@/lib/engine/outline";
import RectSelector from "@/components/RectSelector";

const SKY_STYLES = [
  ["clear natural blue sky, a few soft clouds", "Ciel bleu naturel"],
  ["clear open sky, crisp and bright", "Ciel dégagé"],
  ["soft blue sky with light scattered clouds", "Légèrement nuageux"],
  ["bright luminous overcast-free sky", "Ciel lumineux"],
  ["improved even overcast sky, brighter and less flat", "Ciel couvert amélioré"],
  ["soft golden hour sky, warm light", "Golden hour légère"],
] as const;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-studio-gray-200 bg-white p-4">
      <p className="mb-3 text-xs font-bold uppercase tracking-wide text-studio-gray-800/60">{title}</p>
      {children}
    </div>
  );
}

function Btn({ children, onClick, disabled, variant = "primary" }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; variant?: "primary" | "ghost" }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`rounded-full px-4 py-2 text-xs font-bold transition disabled:opacity-30 ${
        variant === "primary" ? "bg-studio-black text-white hover:bg-studio-gray-900" : "border border-studio-gray-200 text-studio-black hover:border-studio-black"
      }`}
    >
      {children}
    </button>
  );
}

export default function ModifierPanel({
  projectId,
  project,
  photos,
  focusedPhoto,
  setFocusedPhotoId,
  runTool,
  refreshProject,
}: {
  projectId: string;
  project: Project;
  photos: Photo[];
  focusedPhoto: Photo | null;
  setFocusedPhotoId: (id: string) => void;
  runTool: (tool: JobType, scope: "this" | "selected" | "all", params?: Record<string, unknown>, photoId?: string) => Promise<unknown>;
  refreshProject: () => Promise<unknown>;
}) {
  const [rect, setRect] = useState<Rect | null>(null);
  const [instruction, setInstruction] = useState("");
  const [freeText, setFreeText] = useState("");
  const [freeScope, setFreeScope] = useState<"this" | "selected" | "all">("this");
  const [skyStyle, setSkyStyle] = useState<string>(SKY_STYLES[0][0]);
  const [applyToAllExterior, setApplyToAllExterior] = useState(false);
  const [rollDeg, setRollDeg] = useState(0);
  const [keystone, setKeystone] = useState(0);
  const [wideAngle, setWideAngle] = useState(0.35);
  const [declutterLevel, setDeclutterLevel] = useState<"leger" | "standard" | "complet">("standard");
  const [stagingStyle, setStagingStyle] = useState("moderne");
  const [stagingRoom, setStagingRoom] = useState("salon");
  const [busy, setBusy] = useState(false);
  const [pro, setPro] = useState({
    exposure: 0,
    shadowLift: 0,
    highlightRecover: 0,
    contrast: 0,
    saturation: 0,
    warmth: 0,
    sharpen: 0,
    denoise: 0,
  });

  const notStrict = project.settings.fidelityMode !== "strict";
  const stagingAllowed = project.settings.fidelityMode === "virtual_staging";

  async function withBusy(fn: () => Promise<unknown>) {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  }

  async function applyExteriorSky() {
    const exteriorIds = photos.filter((p) => p.analysis?.environment === "exterieur").map((p) => p.id);
    if (!exteriorIds.length) return;
    await Promise.all(photos.map((p) => api.patchPhoto(projectId, p.id, { selected: exteriorIds.includes(p.id) })));
    await refreshProject();
    await runTool("ciel", "selected", { mode: "remplacer", style: skyStyle });
  }

  if (!focusedPhoto) {
    return <p className="text-studio-gray-800/50">Importez des photos pour commencer à les modifier.</p>;
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
      <div className="flex flex-col gap-4">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {photos.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                setFocusedPhotoId(p.id);
                setRect(null);
              }}
              className={`shrink-0 overflow-hidden rounded-lg border-2 ${focusedPhoto.id === p.id ? "border-studio-yellow-deep" : "border-transparent"}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={api.fileUrl(p.currentFile)} alt={p.filename} className="h-16 w-20 object-cover" />
            </button>
          ))}
        </div>

        <RectSelector src={api.fileUrl(focusedPhoto.currentFile)} rect={rect} onChange={setRect} />

        <Section title="Instruction personnalisée — Que souhaitez-vous modifier ?">
          <textarea
            value={freeText}
            onChange={(e) => setFreeText(e.target.value)}
            placeholder='Ex : "Éclaircir sans modifier les meubles", "Ajouter un beau ciel dégagé", "Supprimer les cartons au sol"…'
            className="mb-2 w-full rounded-lg border border-studio-gray-200 p-2 text-sm outline-none focus:border-studio-yellow-deep"
            rows={2}
          />
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex gap-1 rounded-full border border-studio-gray-200 p-0.5 text-[11px] font-bold">
              {(["this", "selected", "all"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setFreeScope(s)}
                  className={`rounded-full px-3 py-1 ${freeScope === s ? "bg-studio-black text-white" : "text-studio-gray-800/60"}`}
                >
                  {s === "this" ? "CETTE PHOTO" : s === "selected" ? "SÉLECTION" : "LOT"}
                </button>
              ))}
            </div>
            <Btn
              disabled={!freeText.trim() || busy}
              onClick={() =>
                withBusy(() => runTool("instruction", freeScope, { text: freeText }, focusedPhoto.id).then(() => setFreeText("")))
              }
            >
              APPLIQUER
            </Btn>
          </div>
        </Section>
      </div>

      <div className="flex flex-col gap-4">
        <Section title="Ciel">
          <select value={skyStyle} onChange={(e) => setSkyStyle(e.target.value)} className="mb-2 w-full rounded-lg border border-studio-gray-200 px-2 py-2 text-sm">
            {SKY_STYLES.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
          <div className="flex flex-wrap gap-2">
            <Btn onClick={() => withBusy(() => runTool("ciel", "this", { mode: "ameliorer" }, focusedPhoto.id))}>AMÉLIORER LE CIEL</Btn>
            <Btn variant="ghost" disabled={!notStrict} onClick={() => withBusy(() => runTool("ciel", "this", { mode: "remplacer", style: skyStyle }, focusedPhoto.id))}>
              REMPLACER LE CIEL
            </Btn>
          </div>
          <label className="mt-2 flex items-center gap-2 text-xs text-studio-gray-800/70">
            <input type="checkbox" checked={applyToAllExterior} onChange={(e) => setApplyToAllExterior(e.target.checked)} className="accent-[#FFF000]" />
            Appliquer le même style de ciel aux photos extérieures
          </label>
          {applyToAllExterior && (
            <Btn variant="ghost" disabled={!notStrict || busy} onClick={() => withBusy(applyExteriorSky)}>
              APPLIQUER AU LOT EXTÉRIEUR
            </Btn>
          )}
          {!notStrict && <p className="mt-2 text-[11px] text-amber-700">Le remplacement du ciel nécessite le mode Commercial ou Virtual Staging.</p>}
        </Section>

        <Section title="Redresser l'architecture">
          <Btn onClick={() => withBusy(() => runTool("perspective", "this", { mode: "auto" }, focusedPhoto.id))}>AUTO</Btn>
          <div className="mt-3 space-y-2">
            <label className="block text-[11px] text-studio-gray-800/60">
              Inclinaison ({rollDeg.toFixed(1)}°)
              <input type="range" min={-6} max={6} step={0.1} value={rollDeg} onChange={(e) => setRollDeg(Number(e.target.value))} className="w-full accent-[#FFF000]" />
            </label>
            <label className="block text-[11px] text-studio-gray-800/60">
              Convergence verticale ({keystone.toFixed(2)})
              <input type="range" min={-0.15} max={0.15} step={0.01} value={keystone} onChange={(e) => setKeystone(Number(e.target.value))} className="w-full accent-[#FFF000]" />
            </label>
            <Btn variant="ghost" onClick={() => withBusy(() => runTool("perspective", "this", { mode: "manuel", rollDeg, keystone }, focusedPhoto.id))}>
              APPLIQUER MANUELLEMENT
            </Btn>
          </div>
        </Section>

        <Section title="Correction grand-angle">
          <label className="block text-[11px] text-studio-gray-800/60">
            Intensité ({Math.round(wideAngle * 100)}%)
            <input type="range" min={0} max={0.7} step={0.05} value={wideAngle} onChange={(e) => setWideAngle(Number(e.target.value))} className="w-full accent-[#FFF000]" />
          </label>
          <Btn onClick={() => withBusy(() => runTool("grand_angle", "this", { strength: wideAngle }, focusedPhoto.id))}>APPLIQUER</Btn>
        </Section>

        <Section title="Cadrage & contour (zone dessinée ci-contre)">
          <div className="flex flex-wrap gap-2">
            <Btn
              variant="ghost"
              onClick={async () => {
                const { crop } = await api.suggestCrop(projectId, focusedPhoto.id);
                setRect(crop);
              }}
            >
              PROPOSER UN CADRAGE
            </Btn>
            <Btn disabled={!rect} onClick={() => withBusy(() => runTool("cadrage", "this", { rect }, focusedPhoto.id))}>
              APPLIQUER LE CADRAGE
            </Btn>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <Btn
              variant="ghost"
              onClick={async () => {
                const { rect } = await api.suggestOutline(projectId, focusedPhoto.id);
                setRect(rect);
              }}
            >
              SUGGÉRER LE CONTOUR
            </Btn>
            <Btn
              disabled={!rect}
              onClick={() =>
                withBusy(() =>
                  runTool(
                    "contour",
                    "this",
                    { rect, style: { color: "#FFF000", thickness: 6, opacity: 0.95, glow: true } },
                    focusedPhoto.id
                  )
                )
              }
            >
              CONTOUR IMMO VISION
            </Btn>
          </div>
        </Section>

        <Section title="Modification IA — objets (zone dessinée ci-contre)">
          <textarea
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            placeholder="Décrire l'objet à ajouter ou l'instruction de suppression…"
            className="mb-2 w-full rounded-lg border border-studio-gray-200 p-2 text-sm"
            rows={2}
          />
          <div className="flex flex-wrap gap-2">
            <Btn disabled={!rect || !notStrict} onClick={() => withBusy(() => runTool("suppression_objet", "this", { rect, instruction }, focusedPhoto.id))}>
              SUPPRIMER UN OBJET
            </Btn>
            <Btn disabled={!rect || !instruction.trim() || !notStrict} onClick={() => withBusy(() => runTool("ajout_objet", "this", { rect, instruction }, focusedPhoto.id))}>
              AJOUTER UN OBJET
            </Btn>
          </div>
          {!notStrict && <p className="mt-2 text-[11px] text-amber-700">Nécessite le mode Commercial ou Virtual Staging.</p>}
        </Section>

        <Section title="Désencombrement">
          <select value={declutterLevel} onChange={(e) => setDeclutterLevel(e.target.value as typeof declutterLevel)} className="mb-2 w-full rounded-lg border border-studio-gray-200 px-2 py-2 text-sm">
            <option value="leger">Léger</option>
            <option value="standard">Standard</option>
            <option value="complet">Complet</option>
          </select>
          <Btn disabled={!notStrict} onClick={() => withBusy(() => runTool("desencombrement", "this", { level: declutterLevel }, focusedPhoto.id))}>
            RANGER LA PIÈCE
          </Btn>
        </Section>

        {project.settings.appMode === "pro" && (
          <Section title="Réglages Pro">
            <div className="flex flex-col gap-2">
              {(
                [
                  ["exposure", "Exposition", -1, 1],
                  ["shadowLift", "Ombres", 0, 1],
                  ["highlightRecover", "Hautes lumières", 0, 1],
                  ["contrast", "Contraste", -1, 1],
                  ["saturation", "Saturation", -1, 1],
                  ["warmth", "Température", -1, 1],
                  ["sharpen", "Netteté", 0, 1],
                  ["denoise", "Débruitage", 0, 1],
                ] as const
              ).map(([key, label, min, max]) => (
                <label key={key} className="block text-[11px] text-studio-gray-800/60">
                  {label} ({pro[key].toFixed(2)})
                  <input
                    type="range"
                    min={min}
                    max={max}
                    step={0.05}
                    value={pro[key]}
                    onChange={(e) => setPro((s) => ({ ...s, [key]: Number(e.target.value) }))}
                    className="w-full accent-[#FFF000]"
                  />
                </label>
              ))}
            </div>
            <div className="mt-2 flex gap-2">
              <Btn
                onClick={() =>
                  withBusy(() =>
                    runTool(
                      "custom",
                      "this",
                      {
                        tone: {
                          exposure: pro.exposure,
                          shadowLift: pro.shadowLift,
                          highlightRecover: pro.highlightRecover,
                          contrast: pro.contrast,
                          saturation: pro.saturation,
                          warmth: pro.warmth,
                        },
                        detail: { sharpen: pro.sharpen, denoise: pro.denoise },
                      },
                      focusedPhoto.id
                    )
                  )
                }
              >
                APPLIQUER LES RÉGLAGES PRO
              </Btn>
              <Btn variant="ghost" onClick={() => setPro({ exposure: 0, shadowLift: 0, highlightRecover: 0, contrast: 0, saturation: 0, warmth: 0, sharpen: 0, denoise: 0 })}>
                RÉINITIALISER
              </Btn>
            </div>
          </Section>
        )}

        <Section title="Virtual Staging">
          <div className="mb-2 grid grid-cols-2 gap-2">
            <select value={stagingStyle} onChange={(e) => setStagingStyle(e.target.value)} className="rounded-lg border border-studio-gray-200 px-2 py-2 text-sm">
              {["moderne", "contemporain", "chaleureux", "minimaliste", "haut de gamme", "scandinave", "neutre immobilier"].map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <select value={stagingRoom} onChange={(e) => setStagingRoom(e.target.value)} className="rounded-lg border border-studio-gray-200 px-2 py-2 text-sm">
              {["salon", "salle à manger", "chambre", "bureau", "cuisine"].map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <Btn disabled={!stagingAllowed} onClick={() => withBusy(() => runTool("virtual_staging", "this", { style: stagingStyle, roomType: stagingRoom }, focusedPhoto.id))}>
            APPLIQUER LE VIRTUAL STAGING
          </Btn>
          {!stagingAllowed && <p className="mt-2 text-[11px] text-amber-700">Nécessite le mode Fidélité &quot;Virtual Staging&quot;.</p>}
        </Section>
      </div>
    </div>
  );
}
