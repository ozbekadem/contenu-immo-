import { randomUUID } from "crypto";
import type { Job, JobItem, JobType } from "./types";

// Module-level in-memory job store. Good enough for a single-instance MVP;
// swapping this for Redis/BullMQ later only touches this file.
const jobs = new Map<string, Job>();
const CONCURRENCY = Number(process.env.BATCH_CONCURRENCY || 3);

export function createJob(projectId: string, type: JobType, photoIds: string[], params: Record<string, unknown>): Job {
  const job: Job = {
    id: randomUUID(),
    projectId,
    type,
    params,
    items: photoIds.map((photoId): JobItem => ({ photoId, status: "attente" })),
    createdAt: new Date().toISOString(),
    status: "en_cours",
  };
  jobs.set(job.id, job);
  return job;
}

export function getJob(jobId: string): Job | undefined {
  return jobs.get(jobId);
}

function updateJobItem(jobId: string, photoId: string, patch: Partial<JobItem>) {
  const job = jobs.get(jobId);
  if (!job) return;
  const item = job.items.find((i) => i.photoId === photoId);
  if (item) Object.assign(item, patch);
  const allDone = job.items.every((i) => i.status === "termine" || i.status === "echec");
  if (allDone) {
    job.status = job.items.every((i) => i.status === "echec") ? "echec" : "termine";
    job.finishedAt = new Date().toISOString();
  }
}

/**
 * Runs `worker` for every queued item with bounded concurrency. One
 * photo's failure never blocks the rest of the lot (section 54) — it's
 * recorded on the job item so the UI can offer a per-photo "Réessayer".
 */
export async function runJob(job: Job, worker: (photoId: string) => Promise<void>): Promise<void> {
  const ids = job.items.map((i) => i.photoId);
  let cursor = 0;

  async function pullNext(): Promise<void> {
    const i = cursor++;
    if (i >= ids.length) return;
    const photoId = ids[i];
    updateJobItem(job.id, photoId, { status: "traitement" });
    try {
      await worker(photoId);
      updateJobItem(job.id, photoId, { status: "termine" });
    } catch (err) {
      updateJobItem(job.id, photoId, { status: "echec", error: (err as Error).message });
    }
    return pullNext();
  }

  const runners = Array.from({ length: Math.min(CONCURRENCY, ids.length) }, () => pullNext());
  await Promise.all(runners);
}

/** Re-queue only the failed items of a job and re-run them with `worker`. */
export async function retryFailedItems(job: Job, worker: (photoId: string) => Promise<void>): Promise<void> {
  const failedIds = job.items.filter((i) => i.status === "echec").map((i) => i.photoId);
  for (const item of job.items) {
    if (item.status === "echec") {
      item.status = "attente";
      item.error = undefined;
    }
  }
  job.status = "en_cours";
  job.finishedAt = undefined;

  let cursor = 0;
  async function pullNext(): Promise<void> {
    const i = cursor++;
    if (i >= failedIds.length) return;
    const photoId = failedIds[i];
    updateJobItem(job.id, photoId, { status: "traitement" });
    try {
      await worker(photoId);
      updateJobItem(job.id, photoId, { status: "termine" });
    } catch (err) {
      updateJobItem(job.id, photoId, { status: "echec", error: (err as Error).message });
    }
    return pullNext();
  }
  const runners = Array.from({ length: Math.min(CONCURRENCY, failedIds.length) }, () => pullNext());
  await Promise.all(runners);
}
