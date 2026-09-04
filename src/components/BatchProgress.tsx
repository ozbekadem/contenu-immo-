"use client";

import type { Job } from "@/lib/types";

export default function BatchProgress({ job, onRetry, photoLabel }: { job: Job; onRetry: () => void; photoLabel: (id: string) => string }) {
  const total = job.items.length;
  const done = job.items.filter((i) => i.status === "termine").length;
  const failed = job.items.filter((i) => i.status === "echec").length;
  const processing = job.items.filter((i) => i.status === "traitement").length;
  const waiting = job.items.filter((i) => i.status === "attente").length;

  return (
    <div className="rounded-2xl border border-studio-gray-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-bold text-studio-black">
          {done}/{total} TERMINÉES{processing ? ` · ${processing} en traitement` : ""}
          {waiting ? ` · ${waiting} en attente` : ""}
        </p>
        {failed > 0 && job.status !== "en_cours" && (
          <button onClick={onRetry} className="rounded-full bg-studio-black px-3 py-1 text-xs font-bold text-white">
            RÉESSAYER ({failed})
          </button>
        )}
      </div>
      <div className="mb-3 h-2 w-full overflow-hidden rounded-full bg-studio-gray-100">
        <div
          className="h-full bg-studio-yellow transition-all"
          style={{ width: `${total ? (done / total) * 100 : 0}%` }}
        />
      </div>
      <ul className="grid max-h-40 grid-cols-1 gap-1 overflow-y-auto text-xs sm:grid-cols-2">
        {job.items.map((item) => (
          <li key={item.photoId} className="flex items-center justify-between rounded px-2 py-1 odd:bg-studio-gray-100/60">
            <span className="truncate text-studio-gray-800/80">{photoLabel(item.photoId)}</span>
            <span
              className={
                item.status === "termine"
                  ? "font-semibold text-emerald-600"
                  : item.status === "echec"
                  ? "font-semibold text-red-600"
                  : item.status === "traitement"
                  ? "animate-studio-pulse font-semibold text-studio-yellow-deep"
                  : "text-studio-gray-800/40"
              }
            >
              {item.status === "termine" ? "Terminée ✓" : item.status === "echec" ? "Échec" : item.status === "traitement" ? "Traitement…" : "En attente"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
