"use client";

import type { Photo } from "@/lib/types";
import { api } from "@/lib/apiClient";

const STATUS_LABEL: Record<Photo["status"], string> = {
  idle: "",
  queued: "En attente",
  processing: "Traitement…",
  done: "Terminée ✓",
  error: "Échec",
};

export default function PhotoCard({
  photo,
  index,
  onToggleSelect,
  onDelete,
  onEnlarge,
  onReplace,
  onDragStart,
  onDragOver,
  onDrop,
  dragOver,
}: {
  photo: Photo;
  index: number;
  onToggleSelect: () => void;
  onDelete: () => void;
  onEnlarge: () => void;
  onReplace: (file: File) => void;
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: () => void;
  dragOver: boolean;
}) {
  const flags = photo.analysis?.flags ?? [];

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      className={`group relative overflow-hidden rounded-xl border bg-white transition ${
        dragOver ? "border-studio-yellow-deep ring-2 ring-studio-yellow" : "border-studio-gray-200"
      } ${photo.selected ? "ring-2 ring-studio-yellow" : ""}`}
    >
      <button
        onClick={onEnlarge}
        className="block aspect-[4/3] w-full overflow-hidden bg-studio-gray-100"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={api.fileUrl(photo.currentFile)} alt={photo.filename} className="h-full w-full object-cover" />
      </button>

      <label className="absolute top-2 left-2 z-10">
        <input type="checkbox" checked={photo.selected} onChange={onToggleSelect} className="sr-only peer" />
        <span className="grid h-6 w-6 place-items-center rounded-md border-2 border-white bg-studio-black/40 text-[11px] font-bold text-white backdrop-blur peer-checked:border-studio-yellow peer-checked:bg-studio-yellow peer-checked:text-studio-black">
          {photo.selected ? "✓" : index + 1}
        </span>
      </label>

      {photo.status !== "idle" && (
        <span
          className={`absolute top-2 right-2 z-10 rounded-full px-2 py-0.5 text-[10px] font-bold ${
            photo.status === "processing"
              ? "animate-studio-pulse bg-studio-yellow text-studio-black"
              : photo.status === "error"
              ? "bg-red-600 text-white"
              : "bg-emerald-600 text-white"
          }`}
        >
          {STATUS_LABEL[photo.status]}
        </span>
      )}

      {flags.length > 0 && (
        <div className="absolute bottom-9 left-2 right-2 z-10 line-clamp-1 rounded bg-studio-black/70 px-1.5 py-0.5 text-[10px] text-white">
          ⚠ {flags[0]}
        </div>
      )}

      <div className="flex items-center justify-between gap-1 border-t border-studio-gray-200 px-2 py-1.5 text-[11px]">
        <span className="truncate text-studio-gray-800/60">{photo.analysis ? sceneLabel(photo.analysis.scene) : "…"}</span>
        <div className="flex items-center gap-2 opacity-0 transition group-hover:opacity-100">
          <label className="cursor-pointer text-studio-gray-800/60 hover:text-studio-black">
            ⟲
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && onReplace(e.target.files[0])}
            />
          </label>
          <button onClick={onDelete} className="text-studio-gray-800/60 hover:text-red-600">
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}

function sceneLabel(scene: string) {
  const labels: Record<string, string> = {
    salon: "Salon",
    salle_a_manger: "Salle à manger",
    cuisine: "Cuisine",
    chambre: "Chambre",
    salle_de_bains: "Salle de bains",
    wc: "WC",
    hall: "Hall",
    garage: "Garage",
    cave: "Cave",
    grenier: "Grenier",
    commerce: "Commerce",
    bureau: "Bureau",
    facade: "Façade",
    jardin: "Jardin",
    terrasse: "Terrasse",
    autre: "Autre",
  };
  return labels[scene] ?? scene;
}
