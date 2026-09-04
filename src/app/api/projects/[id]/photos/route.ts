import { NextRequest, NextResponse } from "next/server";
import { updateProject, ingestUpload } from "@/lib/photoOps";

const ACCEPTED = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const MAX_BATCH = 10;

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Formulaire invalide." }, { status: 400 });

  const files = form.getAll("photos").filter((f): f is File => f instanceof File);
  if (!files.length) return NextResponse.json({ error: "Aucune photo reçue." }, { status: 400 });

  try {
    const photos = await updateProject(id, async (project) => {
      const room = MAX_BATCH - project.photos.length;
      if (room <= 0) {
        throw new Error(`Ce lot contient déjà ${MAX_BATCH} photos (maximum par lot).`);
      }
      const toIngest = files.slice(0, room);
      const created = [];
      for (const file of toIngest) {
        if (!ACCEPTED.includes(file.type) && !/\.(jpe?g|png|webp)$/i.test(file.name)) continue;
        const buffer = Buffer.from(await file.arrayBuffer());
        const photo = await ingestUpload(project, file.name, buffer);
        project.photos.push(photo);
        created.push(photo);
      }
      if (!project.coverPhotoId && project.photos.length) project.coverPhotoId = project.photos[0].id;
      return created;
    });
    return NextResponse.json({ photos }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
