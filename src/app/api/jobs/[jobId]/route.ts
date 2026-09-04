import { NextRequest, NextResponse } from "next/server";
import { getJob, retryFailedItems } from "@/lib/jobQueue";
import { readProject } from "@/lib/storage";
import { updateProject, findPhoto } from "@/lib/photoOps";
import { applyTool } from "@/lib/engine/dispatch";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const job = getJob(jobId);
  if (!job) return NextResponse.json({ error: "Tâche introuvable" }, { status: 404 });
  return NextResponse.json({ job });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const body = await req.json().catch(() => ({}));
  const job = getJob(jobId);
  if (!job) return NextResponse.json({ error: "Tâche introuvable" }, { status: 404 });
  if (body.action !== "retry") return NextResponse.json({ error: "Action inconnue." }, { status: 400 });

  const projectId = job.projectId;
  const toolParams = (job.params as Record<string, unknown>) ?? {};

  retryFailedItems(job, async (photoId) => {
    const current = await readProject(projectId);
    if (!current) throw new Error("Projet introuvable");
    const photo = findPhoto(current, photoId);
    if (job.type === "analyze") {
      const { analyzePhoto } = await import("@/lib/engine/analyze");
      const { absPath } = await import("@/lib/storage");
      const analysis = await analyzePhoto(absPath(photo.previewFile));
      await updateProject(projectId, (p) => {
        findPhoto(p, photoId).analysis = analysis;
      });
      return;
    }
    await applyTool(current, photo, job.type, toolParams);
    await updateProject(projectId, (p) => {
      const livePhoto = findPhoto(p, photoId);
      livePhoto.history = photo.history;
      livePhoto.historyIndex = photo.historyIndex;
      livePhoto.currentFile = photo.currentFile;
      livePhoto.naturalness = photo.naturalness;
      if (photo.analysis) livePhoto.analysis = photo.analysis;
      livePhoto.updatedAt = new Date().toISOString();
    });
  }).catch(() => {});

  return NextResponse.json({ job }, { status: 202 });
}
