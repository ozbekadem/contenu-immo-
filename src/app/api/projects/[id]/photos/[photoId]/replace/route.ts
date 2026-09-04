import { NextRequest, NextResponse } from "next/server";
import path from "path";
import sharp from "sharp";
import { promises as fs } from "fs";
import { randomUUID } from "crypto";
import { updateProject, findPhoto, WORKING_MAX_DIMENSION } from "@/lib/photoOps";
import { photoDir, relPath } from "@/lib/storage";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; photoId: string }> }) {
  const { id, photoId } = await params;
  const form = await req.formData().catch(() => null);
  const file = form?.get("photo");
  if (!(file instanceof File)) return NextResponse.json({ error: "Aucune photo reçue." }, { status: 400 });

  try {
    const photo = await updateProject(id, async (project) => {
      const photo = findPhoto(project, photoId);
      const buffer = Buffer.from(await file.arrayBuffer());
      const ext = (path.extname(file.name) || ".jpg").toLowerCase();
      const originalAbs = path.join(photoDir(id, photoId), `original-${randomUUID().slice(0, 8)}${ext}`);
      await fs.writeFile(originalAbs, buffer);

      const previewAbs = path.join(photoDir(id, photoId), `preview-${randomUUID().slice(0, 8)}.jpg`);
      const info = await sharp(originalAbs)
        .rotate()
        .resize({ width: WORKING_MAX_DIMENSION, height: WORKING_MAX_DIMENSION, fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 92, mozjpeg: true })
        .toFile(previewAbs);

      photo.originalFile = relPath(originalAbs);
      photo.previewFile = relPath(previewAbs);
      photo.currentFile = relPath(previewAbs);
      photo.width = info.width;
      photo.height = info.height;
      photo.filename = file.name;
      photo.analysis = undefined;
      photo.history = [
        {
          id: randomUUID(),
          kind: "original",
          label: "Original (remplacé)",
          file: relPath(previewAbs),
          category: "retouche",
          createdAt: new Date().toISOString(),
        },
      ];
      photo.historyIndex = 0;
      photo.naturalness = 100;
      photo.updatedAt = new Date().toISOString();
      return photo;
    });
    return NextResponse.json({ photo });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 404 });
  }
}
