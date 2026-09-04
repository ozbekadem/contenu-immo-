import { promises as fs } from "fs";
import path from "path";
import type { Project } from "./types";

// All uploaded/generated assets and JSON manifests live under STORAGE_ROOT,
// outside of `public/`, and are served through /api/files/[...] so we keep
// control over access (needed once this becomes multi-tenant SaaS).
export const STORAGE_ROOT = path.join(process.cwd(), "storage");
export const PROJECTS_DIR = path.join(STORAGE_ROOT, "projects");

async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true });
}

export function projectDir(projectId: string) {
  return path.join(PROJECTS_DIR, projectId);
}

export function projectManifestPath(projectId: string) {
  return path.join(projectDir(projectId), "manifest.json");
}

export function photoDir(projectId: string, photoId: string) {
  return path.join(projectDir(projectId), "photos", photoId);
}

export function photoVersionsDir(projectId: string, photoId: string) {
  return path.join(photoDir(projectId, photoId), "versions");
}

export async function listProjects(): Promise<Project[]> {
  await ensureDir(PROJECTS_DIR);
  const ids = await fs.readdir(PROJECTS_DIR).catch(() => []);
  const projects: Project[] = [];
  for (const id of ids) {
    const p = await readProject(id).catch(() => null);
    if (p) projects.push(p);
  }
  projects.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  return projects;
}

export async function readProject(projectId: string): Promise<Project | null> {
  try {
    const raw = await fs.readFile(projectManifestPath(projectId), "utf-8");
    return JSON.parse(raw) as Project;
  } catch {
    return null;
  }
}

export async function writeProject(project: Project): Promise<void> {
  await ensureDir(projectDir(project.id));
  project.updatedAt = new Date().toISOString();
  await fs.writeFile(projectManifestPath(project.id), JSON.stringify(project, null, 2), "utf-8");
}

export async function deleteProject(projectId: string): Promise<void> {
  await fs.rm(projectDir(projectId), { recursive: true, force: true });
}

export async function ensurePhotoDirs(projectId: string, photoId: string) {
  await ensureDir(photoDir(projectId, photoId));
  await ensureDir(photoVersionsDir(projectId, photoId));
}

/** Absolute path on disk for a storage-relative path (as stored in manifest fields). */
export function absPath(relPath: string): string {
  return path.join(STORAGE_ROOT, relPath);
}

/** Storage-relative path for building manifest fields from an absolute path. */
export function relPath(absolute: string): string {
  return path.relative(STORAGE_ROOT, absolute);
}

export { ensureDir };
