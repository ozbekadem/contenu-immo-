import { randomUUID } from "crypto";
import path from "path";
import sharp from "sharp";
import { promises as fs } from "fs";
import {
  absPath,
  relPath,
  ensurePhotoDirs,
  photoDir,
  photoVersionsDir,
  readProject,
  writeProject,
} from "./storage";
import { withLock } from "./lock";
import { computeNaturalness } from "./engine/score";
import type { HistoryStep, HistoryStepKind, Photo, Project } from "./types";

export const WORKING_MAX_DIMENSION = 1600;

const CATEGORY_BY_KIND: Record<HistoryStepKind, HistoryStep["category"]> = {
  original: "retouche",
  retouche_pro: "retouche",
  hdr: "retouche",
  luminosite: "retouche",
  balance_blancs: "retouche",
  perspective: "retouche",
  grand_angle: "retouche",
  nettete: "retouche",
  debruitage: "retouche",
  ciel: "retouche",
  cadrage: "retouche",
  contour: "retouche",
  suppression_objet: "modification_ia",
  ajout_objet: "modification_ia",
  desencombrement: "modification_ia",
  virtual_staging: "modification_ia",
  instruction: "modification_ia",
  preset: "retouche",
  custom: "retouche",
};

export function findPhoto(project: Project, photoId: string): Photo {
  const photo = project.photos.find((p) => p.id === photoId);
  if (!photo) throw new Error(`Photo introuvable: ${photoId}`);
  return photo;
}

export async function ingestUpload(project: Project, filename: string, buffer: Buffer): Promise<Photo> {
  const photoId = randomUUID();
  await ensurePhotoDirs(project.id, photoId);

  const ext = (path.extname(filename) || ".jpg").toLowerCase();
  const originalAbs = path.join(photoDir(project.id, photoId), `original${ext}`);
  await fs.writeFile(originalAbs, buffer);

  const previewAbs = path.join(photoDir(project.id, photoId), "preview.jpg");
  const info = await sharp(originalAbs)
    .rotate()
    .resize({ width: WORKING_MAX_DIMENSION, height: WORKING_MAX_DIMENSION, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 92, mozjpeg: true })
    .toFile(previewAbs);

  const now = new Date().toISOString();
  const originalStep: HistoryStep = {
    id: randomUUID(),
    kind: "original",
    label: "Original",
    file: relPath(previewAbs),
    category: "retouche",
    createdAt: now,
  };

  const photo: Photo = {
    id: photoId,
    projectId: project.id,
    order: project.photos.length,
    filename,
    width: info.width,
    height: info.height,
    originalFile: relPath(originalAbs),
    previewFile: relPath(previewAbs),
    currentFile: relPath(previewAbs),
    selected: true,
    locked: true,
    status: "idle",
    history: [originalStep],
    historyIndex: 0,
    naturalness: 100,
    createdAt: now,
    updatedAt: now,
  };
  return photo;
}

/**
 * Registers a newly generated working file as the next non-destructive
 * history step for a photo: truncates any "redo" branch past the current
 * pointer (standard undo/redo semantics), appends the step, and recomputes
 * the naturalness indicator against the untouched original.
 */
export async function commitStep(
  project: Project,
  photo: Photo,
  kind: HistoryStepKind,
  label: string,
  newAbsFile: string,
  params?: Record<string, unknown>,
  categoryOverride?: HistoryStep["category"]
): Promise<Photo> {
  const versionsDir = photoVersionsDir(project.id, photo.id);
  await fs.mkdir(versionsDir, { recursive: true });
  const destAbs = path.join(versionsDir, `${Date.now()}_${randomUUID().slice(0, 8)}_${kind}.jpg`);
  await fs.copyFile(newAbsFile, destAbs);
  await fs.unlink(newAbsFile).catch(() => {});

  const step: HistoryStep = {
    id: randomUUID(),
    kind,
    label,
    file: relPath(destAbs),
    category: categoryOverride ?? CATEGORY_BY_KIND[kind],
    createdAt: new Date().toISOString(),
    params,
  };

  photo.history = photo.history.slice(0, photo.historyIndex + 1);
  photo.history.push(step);
  photo.historyIndex = photo.history.length - 1;
  photo.currentFile = step.file;
  photo.updatedAt = new Date().toISOString();

  try {
    photo.naturalness = await computeNaturalness(sharp(absPath(photo.previewFile)), sharp(absPath(photo.currentFile)));
  } catch {
    // non-critical indicator; keep previous value on failure
  }

  return photo;
}

export function setHistoryIndex(photo: Photo, index: number): Photo {
  const clamped = Math.max(0, Math.min(photo.history.length - 1, index));
  photo.historyIndex = clamped;
  photo.currentFile = photo.history[clamped].file;
  photo.updatedAt = new Date().toISOString();
  return photo;
}

/** Read-modify-write a project's manifest under a per-project lock so
 * concurrent batch workers never clobber each other's updates. */
export async function updateProject<T>(projectId: string, fn: (project: Project) => Promise<T> | T): Promise<T> {
  return withLock(projectId, async () => {
    const project = await readProject(projectId);
    if (!project) throw new Error("Projet introuvable");
    const result = await fn(project);
    await writeProject(project);
    return result;
  });
}
