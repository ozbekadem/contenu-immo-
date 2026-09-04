"use client";

import { useState } from "react";
import { api } from "@/lib/apiClient";
import type { Photo } from "@/lib/types";

const QUALITIES = [
  ["web", "WEB — optimisé pour publication rapide"],
  ["haute", "HAUTE QUALITÉ — pour portails immobiliers"],
  ["max", "QUALITÉ MAXIMALE — définition native"],
] as const;

export default function ExporterPanel({ projectId, photos, selectedCount }: { projectId: string; photos: Photo[]; selectedCount: number }) {
  const [quality, setQuality] = useState<"web" | "haute" | "max">("haute");

  function download(scope: "this" | "selected" | "all", photoId?: string) {
    const url = api.exportUrl(projectId, scope, quality, photoId);
    window.open(url, "_blank");
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <div className="rounded-2xl border border-studio-gray-200 bg-white p-5">
        <p className="mb-3 text-xs font-bold uppercase tracking-wide text-studio-gray-800/60">Qualité d&apos;exportation</p>
        <div className="flex flex-col gap-2">
          {QUALITIES.map(([v, l]) => (
            <label key={v} className="flex items-center gap-2 rounded-lg border border-studio-gray-200 px-3 py-2 text-sm has-[:checked]:border-studio-yellow-deep has-[:checked]:bg-studio-yellow/10">
              <input type="radio" name="quality" checked={quality === v} onChange={() => setQuality(v as typeof quality)} className="accent-[#FFF000]" />
              {l}
            </label>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-studio-gray-200 bg-white p-5">
        <p className="mb-3 text-xs font-bold uppercase tracking-wide text-studio-gray-800/60">Export du lot</p>
        <div className="flex flex-col gap-2">
          <button
            disabled={!selectedCount}
            onClick={() => download("selected")}
            className="rounded-full bg-studio-black py-3 text-sm font-bold text-white disabled:opacity-30"
          >
            TÉLÉCHARGER LA SÉLECTION ({selectedCount})
          </button>
          <button
            disabled={!photos.length}
            onClick={() => download("all")}
            className="rounded-full bg-studio-yellow py-3 text-sm font-bold text-studio-black disabled:opacity-30"
          >
            TÉLÉCHARGER LES {photos.length} PHOTOS (ZIP)
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-studio-gray-200 bg-white p-5">
        <p className="mb-3 text-xs font-bold uppercase tracking-wide text-studio-gray-800/60">Export individuel</p>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {photos.map((p) => (
            <button key={p.id} onClick={() => download("this", p.id)} className="group overflow-hidden rounded-lg border border-studio-gray-200">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={api.fileUrl(p.currentFile)} alt={p.filename} className="aspect-square w-full object-cover transition group-hover:scale-105" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
