"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { api } from "@/lib/apiClient";
import type { Photo } from "@/lib/types";
import { useProjectWorkspace } from "@/hooks/useProjectWorkspace";
import PhotoCard from "@/components/PhotoCard";
import BatchProgress from "@/components/BatchProgress";
import BeforeAfterSlider from "@/components/BeforeAfterSlider";
import AmeliorerPanel from "@/components/panels/AmeliorerPanel";
import ModifierPanel from "@/components/panels/ModifierPanel";
import ExporterPanel from "@/components/panels/ExporterPanel";
import RecommendationsPanel from "@/components/panels/RecommendationsPanel";

type Tab = "importer" | "ameliorer" | "modifier" | "avant-apres" | "exporter";

const TABS: { id: Tab; label: string }[] = [
  { id: "importer", label: "IMPORTER" },
  { id: "ameliorer", label: "AMÉLIORER" },
  { id: "modifier", label: "MODIFIER" },
  { id: "avant-apres", label: "AVANT/APRÈS" },
  { id: "exporter", label: "EXPORTER" },
];

const MAX_PHOTOS = 10;

export default function ProjectWorkspace({ projectId }: { projectId: string }) {
  const {
    project,
    loading,
    activeJob,
    recommendations,
    error,
    setError,
    refreshProject,
    refreshRecommendations,
    runTool,
    runAnalyze,
    retryJob,
  } = useProjectWorkspace(projectId);

  const [tab, setTab] = useState<Tab>("importer");
  const [focusedPhotoId, setFocusedPhotoId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const dragIndexRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const photos = useMemo(() => project?.photos.slice().sort((a, b) => a.order - b.order) ?? [], [project]);
  const selectedCount = photos.filter((p) => p.selected).length;
  const focusedPhoto = photos.find((p) => p.id === focusedPhotoId) ?? photos[0] ?? null;

  const handleFiles = useCallback(
    async (fileList: FileList | File[]) => {
      const files = Array.from(fileList);
      if (!files.length) return;
      setUploading(true);
      setError(null);
      try {
        await api.uploadPhotos(projectId, files);
        const updated = await refreshProject();
        await refreshRecommendations();
        // Auto-analyze right after import so recommendations & Retouche Pro are ready (step 3 of the workflow).
        const unanalyzed = updated.photos.filter((p) => !p.analysis).map((p) => p.id);
        if (unanalyzed.length) await runAnalyze(unanalyzed);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setUploading(false);
      }
    },
    [projectId, refreshProject, refreshRecommendations, runAnalyze, setError]
  );

  async function toggleSelect(photoId: string, selected: boolean) {
    await api.patchPhoto(projectId, photoId, { selected });
    refreshProject();
  }

  async function selectAll(selected: boolean) {
    await Promise.all(photos.map((p) => api.patchPhoto(projectId, p.id, { selected })));
    refreshProject();
  }

  async function deletePhoto(photoId: string) {
    await api.deletePhoto(projectId, photoId);
    if (focusedPhotoId === photoId) setFocusedPhotoId(null);
    refreshProject();
    refreshRecommendations();
  }

  async function replacePhoto(photoId: string, file: File) {
    await api.replacePhoto(projectId, photoId, file);
    const updated = await refreshProject();
    const photo = updated.photos.find((p) => p.id === photoId);
    if (photo) await runAnalyze([photoId]);
  }

  async function commitReorder(newOrderIds: string[]) {
    await api.reorderPhotos(projectId, newOrderIds);
    refreshProject();
  }

  if (loading) {
    return <div className="p-10 text-studio-gray-800/50">Chargement du projet…</div>;
  }
  if (!project) {
    return <div className="p-10 text-studio-gray-800/50">Projet introuvable.</div>;
  }

  return (
    <div className="mx-auto flex w-full max-w-[1500px] flex-1 flex-col px-4 py-6 sm:px-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-studio-black">{project.name}</h1>
          <p className="text-sm text-studio-gray-800/50">
            {project.address || "Adresse non renseignée"} {project.reference ? `· Réf. ${project.reference}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-studio-gray-200 bg-white p-1 text-xs font-bold">
          {(["simple", "pro"] as const).map((m) => (
            <button
              key={m}
              onClick={() => api.patchProject(projectId, { settings: { appMode: m } }).then(() => refreshProject())}
              className={`rounded-full px-3 py-1.5 transition ${
                project.settings.appMode === m ? "bg-studio-black text-white" : "text-studio-gray-800/50 hover:text-studio-black"
              }`}
            >
              MODE {m.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-5 flex gap-1 overflow-x-auto rounded-full border border-studio-gray-200 bg-white p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`whitespace-nowrap rounded-full px-4 py-2 text-xs font-bold tracking-wide transition ${
              tab === t.id ? "bg-studio-yellow text-studio-black" : "text-studio-gray-800/60 hover:bg-studio-gray-100"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
          <button onClick={() => setError(null)} className="ml-3 font-bold">
            ✕
          </button>
        </div>
      )}

      {activeJob && (
        <div className="mb-5">
          <BatchProgress job={activeJob} onRetry={retryJob} photoLabel={(id) => photos.find((p) => p.id === id)?.filename ?? id} />
        </div>
      )}

      {tab === "importer" && (
        <div className="flex flex-col gap-5">
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
            }}
            onClick={() => fileInputRef.current?.click()}
            className="cursor-pointer rounded-2xl border-2 border-dashed border-studio-gray-200 bg-white px-6 py-14 text-center transition hover:border-studio-yellow-deep"
          >
            <p className="text-lg font-bold text-studio-black">Glissez jusqu&apos;à 10 photos ici</p>
            <p className="mt-1 text-sm text-studio-gray-800/50">JPG, PNG, WEBP — {photos.length}/{MAX_PHOTOS} importées</p>
            <button
              onClick={(e) => {
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
              disabled={uploading || photos.length >= MAX_PHOTOS}
              className="mt-4 rounded-full bg-studio-yellow px-6 py-2.5 text-sm font-bold text-studio-black disabled:opacity-40"
            >
              {uploading ? "Import en cours…" : `IMPORTER JUSQU'À ${MAX_PHOTOS} PHOTOS`}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => e.target.files && handleFiles(e.target.files)}
            />
          </div>

          {photos.length > 0 && (
            <>
              <div className="flex items-center justify-between">
                <div className="flex gap-2">
                  <button onClick={() => selectAll(true)} className="rounded-full border border-studio-gray-200 bg-white px-3 py-1.5 text-xs font-bold hover:border-studio-black">
                    TOUT SÉLECTIONNER
                  </button>
                  <button onClick={() => selectAll(false)} className="rounded-full border border-studio-gray-200 bg-white px-3 py-1.5 text-xs font-bold hover:border-studio-black">
                    TOUT DÉSÉLECTIONNER
                  </button>
                </div>
                <p className="text-xs font-semibold text-studio-gray-800/50">{selectedCount} sélectionnée{selectedCount > 1 ? "s" : ""}</p>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                {photos.map((photo, i) => (
                  <PhotoCard
                    key={photo.id}
                    photo={photo}
                    index={i}
                    dragOver={dragOverIndex === i}
                    onToggleSelect={() => toggleSelect(photo.id, !photo.selected)}
                    onDelete={() => deletePhoto(photo.id)}
                    onReplace={(file) => replacePhoto(photo.id, file)}
                    onEnlarge={() => {
                      setFocusedPhotoId(photo.id);
                      setTab("avant-apres");
                    }}
                    onDragStart={() => (dragIndexRef.current = i)}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragOverIndex(i);
                    }}
                    onDrop={() => {
                      const from = dragIndexRef.current;
                      setDragOverIndex(null);
                      if (from === null || from === i) return;
                      const reordered = photos.map((p) => p.id);
                      const [moved] = reordered.splice(from, 1);
                      reordered.splice(i, 0, moved);
                      commitReorder(reordered);
                    }}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {tab === "ameliorer" && (
        <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
          <AmeliorerPanel project={project} photos={photos} runTool={runTool} runAnalyze={runAnalyze} refreshProject={refreshProject} />
          <RecommendationsPanel
            recommendations={recommendations}
            photos={photos}
            onApplySelection={async (ids) => {
              await Promise.all(ids.map((id) => api.patchPhoto(projectId, id, { selected: true })));
              await Promise.all(photos.filter((p) => !ids.includes(p.id)).map((p) => api.patchPhoto(projectId, p.id, { selected: false })));
              await refreshProject();
              await runTool("retouche_pro", "selected");
            }}
          />
        </div>
      )}

      {tab === "modifier" && (
        <ModifierPanel
          projectId={projectId}
          project={project}
          photos={photos}
          focusedPhoto={focusedPhoto}
          setFocusedPhotoId={setFocusedPhotoId}
          runTool={runTool}
          refreshProject={refreshProject}
        />
      )}

      {tab === "avant-apres" && (
        <div className="flex flex-col gap-5">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {photos.map((p) => (
              <button
                key={p.id}
                onClick={() => setFocusedPhotoId(p.id)}
                className={`shrink-0 overflow-hidden rounded-lg border-2 ${focusedPhoto?.id === p.id ? "border-studio-yellow-deep" : "border-transparent"}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={api.fileUrl(p.currentFile)} alt={p.filename} className="h-16 w-20 object-cover" />
              </button>
            ))}
          </div>
          {focusedPhoto ? (
            <div className="grid gap-5 lg:grid-cols-[1fr_280px]">
              <BeforeAfterSlider
                beforeSrc={api.fileUrl(focusedPhoto.history[0].file)}
                afterSrc={api.fileUrl(focusedPhoto.currentFile)}
                alt={focusedPhoto.filename}
              />
              <HistoryPanel projectId={projectId} photo={focusedPhoto} refreshProject={refreshProject} />
            </div>
          ) : (
            <p className="text-studio-gray-800/50">Importez des photos pour comparer avant/après.</p>
          )}
        </div>
      )}

      {tab === "exporter" && <ExporterPanel projectId={projectId} photos={photos} selectedCount={selectedCount} />}
    </div>
  );
}

function HistoryPanel({
  projectId,
  photo,
  refreshProject,
}: {
  projectId: string;
  photo: Photo;
  refreshProject: () => Promise<unknown>;
}) {
  const canUndo = photo.historyIndex > 0;
  const canRedo = photo.historyIndex < photo.history.length - 1;

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-studio-gray-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-studio-black">Historique</p>
        <p className="text-xs font-semibold text-studio-gray-800/50">Naturalité : {photo.naturalness}%</p>
      </div>
      {photo.naturalness < 70 && (
        <p className="rounded bg-amber-50 px-2 py-1 text-[11px] text-amber-700">
          ⚠ Cette version s&apos;éloigne sensiblement de la photographie originale.
        </p>
      )}
      <div className="flex gap-2">
        <button
          disabled={!canUndo}
          onClick={() => api.history(projectId, photo.id, "undo").then(refreshProject)}
          className="flex-1 rounded-full border border-studio-gray-200 py-1.5 text-xs font-bold disabled:opacity-30"
        >
          ↶ ANNULER
        </button>
        <button
          disabled={!canRedo}
          onClick={() => api.history(projectId, photo.id, "redo").then(refreshProject)}
          className="flex-1 rounded-full border border-studio-gray-200 py-1.5 text-xs font-bold disabled:opacity-30"
        >
          ↷ RÉTABLIR
        </button>
      </div>
      <ul className="flex max-h-72 flex-col gap-1 overflow-y-auto">
        {photo.history.map((step, i) => (
          <li key={step.id}>
            <button
              onClick={() => api.history(projectId, photo.id, "revert", { index: i }).then(refreshProject)}
              className={`flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-xs ${
                i === photo.historyIndex ? "bg-studio-yellow/30 font-bold text-studio-black" : "text-studio-gray-800/70 hover:bg-studio-gray-100"
              }`}
            >
              <span className="truncate">{step.label}</span>
              <span className={`ml-2 shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${step.category === "modification_ia" ? "bg-purple-100 text-purple-700" : "bg-studio-gray-100 text-studio-gray-800/60"}`}>
                {step.category === "modification_ia" ? "IA" : "Retouche"}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
