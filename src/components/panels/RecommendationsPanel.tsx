"use client";

import { api } from "@/lib/apiClient";
import type { Photo } from "@/lib/types";
import type { RecommendationsState } from "@/hooks/useProjectWorkspace";

export default function RecommendationsPanel({
  recommendations,
  photos,
  onApplySelection,
}: {
  recommendations: RecommendationsState | null;
  photos: Photo[];
  onApplySelection: (photoIds: string[]) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl border border-studio-gray-200 bg-white p-4">
        <p className="mb-3 text-xs font-bold uppercase tracking-wide text-studio-gray-800/60">Recommandations IA</p>
        {!recommendations || recommendations.recommendations.length === 0 ? (
          <p className="text-sm text-studio-gray-800/50">Aucune recommandation pour l&apos;instant. Importez et analysez vos photos.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {recommendations.recommendations.map((rec, i) => (
              <li key={i} className="rounded-lg bg-studio-gray-100 px-3 py-2 text-xs text-studio-black">
                <p>{rec.message}</p>
                <button
                  onClick={() => onApplySelection(rec.photoIds)}
                  className="mt-1 font-bold text-studio-yellow-deep hover:underline"
                >
                  TOUT CORRIGER →
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-2xl border border-studio-gray-200 bg-white p-4">
        <p className="mb-3 text-xs font-bold uppercase tracking-wide text-studio-gray-800/60">Sélection IA</p>
        {recommendations ? (
          <>
            <p className="text-sm font-semibold text-studio-black">
              {recommendations.bestPhotoIds.length} PHOTO{recommendations.bestPhotoIds.length > 1 ? "S" : ""} RECOMMANDÉE
              {recommendations.bestPhotoIds.length > 1 ? "S" : ""} SUR {photos.length}
            </p>
            <p className="mt-1 text-xs text-studio-gray-800/50">La décision finale vous revient toujours.</p>
          </>
        ) : (
          <p className="text-sm text-studio-gray-800/50">—</p>
        )}
      </div>

      <div className="rounded-2xl border border-studio-gray-200 bg-white p-4">
        <p className="mb-3 text-xs font-bold uppercase tracking-wide text-studio-gray-800/60">Photo de couverture suggérée</p>
        {recommendations?.coverPhotoId ? (
          (() => {
            const cover = photos.find((p) => p.id === recommendations.coverPhotoId);
            return cover ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={api.fileUrl(cover.currentFile)} alt={cover.filename} className="aspect-[4/3] w-full rounded-lg object-cover" />
            ) : null;
          })()
        ) : (
          <p className="text-sm text-studio-gray-800/50">—</p>
        )}
      </div>
    </div>
  );
}
