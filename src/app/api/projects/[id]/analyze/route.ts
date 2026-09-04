import { NextRequest, NextResponse } from "next/server";
import { readProject } from "@/lib/storage";
import { updateProject, findPhoto } from "@/lib/photoOps";
import { absPath } from "@/lib/storage";
import { analyzePhoto } from "@/lib/engine/analyze";
import { createJob, runJob } from "@/lib/jobQueue";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const project = await readProject(id);
  if (!project) return NextResponse.json({ error: "Projet introuvable" }, { status: 404 });

  const photoIds: string[] = Array.isArray(body.photoIds) && body.photoIds.length ? body.photoIds : project.photos.map((p) => p.id);
  const job = createJob(id, "analyze", photoIds, {});

  runJob(job, async (photoId) => {
    const current = await readProject(id);
    if (!current) throw new Error("Projet introuvable");
    const photo = findPhoto(current, photoId);
    const analysis = await analyzePhoto(absPath(photo.previewFile));
    await updateProject(id, (p) => {
      findPhoto(p, photoId).analysis = analysis;
      findPhoto(p, photoId).updatedAt = new Date().toISOString();
    });
  }).catch(() => {
    // errors are already recorded per-item on the job; nothing else to do
  });

  return NextResponse.json({ job }, { status: 202 });
}
