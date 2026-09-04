"use client";

import { useState } from "react";
import { api } from "@/lib/apiClient";
import type { ColorStyle, HdrMode, JobType, LightAuto, Photo, Project } from "@/lib/types";
import { HDR_LABELS, COLOR_STYLE_LABELS } from "@/lib/engine/presets";

type Scope = "selected" | "all";

export default function AmeliorerPanel({
  project,
  photos,
  runTool,
  runAnalyze,
  refreshProject,
}: {
  project: Project;
  photos: Photo[];
  runTool: (tool: JobType, scope: "this" | "selected" | "all", params?: Record<string, unknown>) => Promise<unknown>;
  runAnalyze: (photoIds?: string[]) => Promise<unknown>;
  refreshProject: () => Promise<unknown>;
}) {
  const [scope, setScope] = useState<Scope>("selected");
  const [intensity, setIntensity] = useState(project.settings.intensity);
  const selectedCount = photos.filter((p) => p.selected).length;
  const targetCount = scope === "all" ? photos.length : selectedCount;

  function updateSettings(patch: Partial<Project["settings"]>) {
    api.patchProject(project.id, { settings: patch }).then(refreshProject);
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-2xl border border-studio-gray-200 bg-white p-5">
        <button
          disabled={!targetCount}
          onClick={() => runTool("retouche_pro", scope, { intensity })}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-studio-yellow py-5 text-lg font-black text-studio-black shadow-sm transition hover:bg-studio-yellow-deep disabled:opacity-40"
        >
          ✨ RETOUCHE PRO EN 1 CLIC
        </button>
        <p className="mt-2 text-center text-xs text-studio-gray-800/50">
          {targetCount} photo{targetCount > 1 ? "s" : ""} ciblée{targetCount > 1 ? "s" : ""} — analyse individuelle + direction artistique commune
        </p>

        <div className="mt-4 flex items-center justify-center gap-1 rounded-full border border-studio-gray-200 p-1 text-xs font-bold">
          <button
            onClick={() => setScope("selected")}
            className={`rounded-full px-4 py-1.5 ${scope === "selected" ? "bg-studio-black text-white" : "text-studio-gray-800/60"}`}
          >
            SÉLECTION ({selectedCount})
          </button>
          <button
            onClick={() => setScope("all")}
            className={`rounded-full px-4 py-1.5 ${scope === "all" ? "bg-studio-black text-white" : "text-studio-gray-800/60"}`}
          >
            TOUT LE LOT ({photos.length})
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <QuickButton icon="☀" label="LUMINOSITÉ" onClick={() => runTool("luminosite", scope, { lightAuto: project.settings.lightAuto })} disabled={!targetCount} />
        <QuickButton icon="" label="HDR" onClick={() => runTool("hdr", scope, { hdrMode: project.settings.hdrMode })} disabled={!targetCount} />
        <QuickButton icon="🏠" label="INTÉRIEUR PRO" onClick={() => runTool("retouche_pro", scope, { intensity })} disabled={!targetCount} />
        <QuickButton icon="🌤" label="EXTÉRIEUR / CIEL" onClick={() => runTool("ciel", scope, { mode: "ameliorer" })} disabled={!targetCount} />
        <QuickButton
          icon="🧹"
          label="DÉSENCOMBRER"
          disabled={!targetCount || project.settings.fidelityMode === "strict"}
          onClick={() => runTool("desencombrement", scope, { level: "standard" })}
        />
        <QuickButton icon="⭐" label="STYLE IMMO VISION" onClick={() => runTool("preset", scope, {})} disabled={!targetCount} />
        <QuickButton icon="🔎" label="RÉANALYSER LE LOT" onClick={() => runAnalyze(photos.map((p) => p.id))} disabled={!photos.length} />
      </div>

      <div className="rounded-2xl border border-studio-gray-200 bg-white p-5">
        <p className="mb-3 text-xs font-bold uppercase tracking-wide text-studio-gray-800/60">Intensité de la retouche</p>
        <input
          type="range"
          min={0}
          max={100}
          value={intensity}
          onChange={(e) => setIntensity(Number(e.target.value))}
          onMouseUp={() => updateSettings({ intensity })}
          onTouchEnd={() => updateSettings({ intensity })}
          className="w-full accent-[#FFF000]"
        />
        <div className="mt-1 flex justify-between text-[10px] text-studio-gray-800/40">
          <span>0% original</span>
          <span>50% pro naturel</span>
          <span>100% max</span>
        </div>
        <p className="mt-1 text-center text-xs font-bold text-studio-black">{intensity}%</p>
      </div>

      <div className="grid gap-4 rounded-2xl border border-studio-gray-200 bg-white p-5 sm:grid-cols-2">
        <Select
          label="Mode HDR"
          value={project.settings.hdrMode}
          onChange={(v) => updateSettings({ hdrMode: v as HdrMode })}
          options={Object.entries(HDR_LABELS)}
        />
        <Select
          label="Rendu couleur"
          value={project.settings.colorStyle}
          onChange={(v) => updateSettings({ colorStyle: v as ColorStyle })}
          options={Object.entries(COLOR_STYLE_LABELS)}
        />
        <Select
          label="Luminosité auto"
          value={project.settings.lightAuto}
          onChange={(v) => updateSettings({ lightAuto: v as LightAuto })}
          options={[
            ["faible", "Faible"],
            ["moyenne", "Moyenne"],
            ["forte", "Forte"],
            ["manuel", "Manuel"],
          ]}
        />
        <Select
          label="Mode fidélité"
          value={project.settings.fidelityMode}
          onChange={(v) => updateSettings({ fidelityMode: v as Project["settings"]["fidelityMode"] })}
          options={[
            ["strict", "Strict (retouche uniquement)"],
            ["commercial", "Commercial (suppr. encombrants)"],
            ["virtual_staging", "Virtual Staging"],
          ]}
        />
        <label className="flex items-center gap-2 text-sm font-medium text-studio-black sm:col-span-2">
          <input
            type="checkbox"
            checked={project.settings.harmonizeLot}
            onChange={(e) => updateSettings({ harmonizeLot: e.target.checked })}
            className="h-4 w-4 accent-[#FFF000]"
          />
          Harmoniser le lot (même séance photographique)
        </label>
      </div>
    </div>
  );
}

function QuickButton({ icon, label, onClick, disabled }: { icon: string; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex flex-col items-center gap-1 rounded-xl border border-studio-gray-200 bg-white py-4 text-xs font-bold text-studio-black transition hover:border-studio-yellow-deep disabled:opacity-30"
    >
      <span className="text-xl">{icon}</span>
      {label}
    </button>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
}) {
  return (
    <label className="text-xs font-bold uppercase tracking-wide text-studio-gray-800/60">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 block w-full rounded-lg border border-studio-gray-200 px-2 py-2 text-sm font-normal normal-case text-studio-black"
      >
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}
