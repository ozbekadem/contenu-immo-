"use client";

import type { Job, JobType, Photo, Project } from "./types";
import type { Rect, OutlineStyle } from "./engine/outline";
import type { CropSuggestion } from "./engine/pipeline";
import type { LotRecommendation, DuplicatePair } from "./engine/recommendations";

async function jsonFetch<T>(input: string, init?: RequestInit): Promise<T> {
  const res = await fetch(input, init);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Erreur ${res.status}`);
  return body as T;
}

export const api = {
  listProjects: () => jsonFetch<{ projects: Project[] }>("/api/projects"),
  createProject: (data: Partial<Project>) =>
    jsonFetch<{ project: Project }>("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }),
  getProject: (id: string) => jsonFetch<{ project: Project }>(`/api/projects/${id}`),
  patchProject: (id: string, data: Record<string, unknown>) =>
    jsonFetch<{ project: Project }>(`/api/projects/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }),
  deleteProject: (id: string) => jsonFetch<{ ok: boolean }>(`/api/projects/${id}`, { method: "DELETE" }),

  uploadPhotos: (id: string, files: File[]) => {
    const form = new FormData();
    for (const f of files) form.append("photos", f);
    return jsonFetch<{ photos: Photo[] }>(`/api/projects/${id}/photos`, { method: "POST", body: form });
  },
  replacePhoto: (id: string, photoId: string, file: File) => {
    const form = new FormData();
    form.append("photo", file);
    return jsonFetch<{ photo: Photo }>(`/api/projects/${id}/photos/${photoId}/replace`, { method: "POST", body: form });
  },
  patchPhoto: (id: string, photoId: string, data: { selected?: boolean; locked?: boolean }) =>
    jsonFetch<{ photo: Photo }>(`/api/projects/${id}/photos/${photoId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }),
  deletePhoto: (id: string, photoId: string) =>
    jsonFetch<{ ok: boolean }>(`/api/projects/${id}/photos/${photoId}`, { method: "DELETE" }),
  reorderPhotos: (id: string, order: string[]) =>
    jsonFetch<{ project: Project }>(`/api/projects/${id}/photos/reorder`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order }),
    }),

  analyze: (id: string, photoIds?: string[]) =>
    jsonFetch<{ job: Job }>(`/api/projects/${id}/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ photoIds }),
    }),

  enhance: (id: string, tool: JobType, scope: "this" | "selected" | "all", params: Record<string, unknown> = {}, photoId?: string) =>
    jsonFetch<{ job: Job }>(`/api/projects/${id}/enhance`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tool, scope, params, photoId }),
    }),

  getJob: (jobId: string) => jsonFetch<{ job: Job }>(`/api/jobs/${jobId}`),
  retryJob: (jobId: string) => jsonFetch<{ job: Job }>(`/api/jobs/${jobId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "retry" }),
  }),

  history: (id: string, photoId: string, action: "undo" | "redo" | "revert", extra?: Record<string, unknown>) =>
    jsonFetch<{ photo: Photo }>(`/api/projects/${id}/photos/${photoId}/history`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...extra }),
    }),

  recommendations: (id: string) =>
    jsonFetch<{ recommendations: LotRecommendation[]; bestPhotoIds: string[]; coverPhotoId: string | null; duplicates: DuplicatePair[] }>(
      `/api/projects/${id}/recommendations`
    ),

  suggestOutline: (id: string, photoId: string) => jsonFetch<{ rect: Rect }>(`/api/projects/${id}/photos/${photoId}/suggest?type=outline`),
  suggestCrop: (id: string, photoId: string) =>
    jsonFetch<{ crop: CropSuggestion }>(`/api/projects/${id}/photos/${photoId}/suggest?type=crop`),

  exportUrl: (id: string, scope: "this" | "selected" | "all", quality: "web" | "haute" | "max", photoId?: string) => {
    const params = new URLSearchParams({ scope, quality });
    if (photoId) params.set("photoId", photoId);
    return `/api/projects/${id}/export?${params.toString()}`;
  },

  fileUrl: (relPath: string) => `/api/files/${relPath}`,
};

export type { OutlineStyle };
