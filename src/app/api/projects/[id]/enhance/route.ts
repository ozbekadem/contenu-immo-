import { NextRequest, NextResponse } from "next/server";
import { readProject } from "@/lib/storage";
import { updateProject, findPhoto } from "@/lib/photoOps";
import { applyTool } from "@/lib/engine/dispatch";
import { createJob, runJob } from "@/lib/jobQueue";
import type { JobType } from "@/lib/types";

const TOOL_TYPES: JobType[] = [
  "retouche_pro",
  "hdr",
  "luminosite",
  "balance_blancs",
  "perspective",
  "grand_angle",
  "nettete",
  "debruitage",
  "ciel",
  "cadrage",
  "contour",
  "instruction",
  "preset",
  "suppression_objet",
  "ajout_objet",
  "desencombrement",
  "virtual_staging",
  "custom",
];

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const tool = body.tool as JobType;
  if (!TOOL_TYPES.includes(tool)) {
    return NextResponse.json({ error: "Outil inconnu." }, { status: 400 });
  }

  const project = await readProject(id);
  if (!project) return NextResponse.json({ error: "Projet introuvable" }, { status: 404 });

  const scope = (body.scope as "this" | "selected" | "all") ?? "selected";
  let photoIds: string[];
  if (scope === "this") {
    photoIds = body.photoId ? [body.photoId as string] : [];
  } else if (scope === "all") {
    photoIds = project.photos.map((p) => p.id);
  } else {
    photoIds = project.photos.filter((p) => p.selected).map((p) => p.id);
  }
  if (!photoIds.length) return NextResponse.json({ error: "Aucune photo ciblée." }, { status: 400 });

  const toolParams = (body.params as Record<string, unknown>) ?? {};
  const job = createJob(id, tool, photoIds, { scope, ...toolParams });

  // The image processing itself runs OUTSIDE any manifest lock so photos in
  // the batch are genuinely processed in parallel; only the (fast) manifest
  // update is serialized, keeping the batch fast without losing writes.
  runJob(job, async (photoId) => {
    const current = await readProject(id);
    if (!current) throw new Error("Projet introuvable");
    const photo = findPhoto(current, photoId);
    await applyTool(current, photo, tool, toolParams);
    await updateProject(id, (p) => {
      const livePhoto = findPhoto(p, photoId);
      livePhoto.history = photo.history;
      livePhoto.historyIndex = photo.historyIndex;
      livePhoto.currentFile = photo.currentFile;
      livePhoto.naturalness = photo.naturalness;
      if (photo.analysis) livePhoto.analysis = photo.analysis;
      livePhoto.updatedAt = new Date().toISOString();
    });
  }).catch(() => {
    // per-item errors are already recorded on the job
  });

  return NextResponse.json({ job }, { status: 202 });
}
