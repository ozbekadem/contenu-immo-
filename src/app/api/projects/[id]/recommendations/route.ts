import { NextRequest, NextResponse } from "next/server";
import { readProject } from "@/lib/storage";
import { buildRecommendations, suggestBestPhotos, suggestCoverPhoto, findDuplicates } from "@/lib/engine/recommendations";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await readProject(id);
  if (!project) return NextResponse.json({ error: "Projet introuvable" }, { status: 404 });

  return NextResponse.json({
    recommendations: buildRecommendations(project.photos),
    bestPhotoIds: suggestBestPhotos(project.photos),
    coverPhotoId: suggestCoverPhoto(project.photos),
    duplicates: findDuplicates(project.photos),
  });
}
