import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { readProject, absPath } from "@/lib/storage";
import { findPhoto } from "@/lib/photoOps";
import { suggestPropertyOutline } from "@/lib/engine/outline";
import { suggestCrop } from "@/lib/engine/crop";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string; photoId: string }> }) {
  const { id, photoId } = await params;
  const url = new URL(req.url);
  const type = url.searchParams.get("type") ?? "outline";

  const project = await readProject(id);
  if (!project) return NextResponse.json({ error: "Projet introuvable" }, { status: 404 });
  try {
    const photo = findPhoto(project, photoId);
    const input = sharp(absPath(photo.currentFile)).rotate();
    if (type === "crop") {
      const crop = await suggestCrop(input);
      return NextResponse.json({ crop });
    }
    const rect = await suggestPropertyOutline(input);
    return NextResponse.json({ rect });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 404 });
  }
}
