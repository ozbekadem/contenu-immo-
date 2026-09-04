import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import { updateProject, findPhoto } from "@/lib/photoOps";
import { photoDir } from "@/lib/storage";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; photoId: string }> }) {
  const { id, photoId } = await params;
  const body = await req.json().catch(() => ({}));
  try {
    const photo = await updateProject(id, (project) => {
      const photo = findPhoto(project, photoId);
      if (body.selected !== undefined) photo.selected = !!body.selected;
      if (body.locked !== undefined) photo.locked = !!body.locked;
      photo.updatedAt = new Date().toISOString();
      return photo;
    });
    return NextResponse.json({ photo });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 404 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; photoId: string }> }) {
  const { id, photoId } = await params;
  try {
    await updateProject(id, (project) => {
      findPhoto(project, photoId);
      project.photos = project.photos.filter((p) => p.id !== photoId);
      project.photos.forEach((p, i) => (p.order = i));
      if (project.coverPhotoId === photoId) project.coverPhotoId = project.photos[0]?.id;
      return project;
    });
    await fs.rm(photoDir(id, photoId), { recursive: true, force: true });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 404 });
  }
}
