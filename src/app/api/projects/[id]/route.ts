import { NextRequest, NextResponse } from "next/server";
import { readProject, deleteProject } from "@/lib/storage";
import { updateProject } from "@/lib/photoOps";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await readProject(id);
  if (!project) return NextResponse.json({ error: "Projet introuvable" }, { status: 404 });
  return NextResponse.json({ project });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  try {
    const project = await updateProject(id, (project) => {
      if (body.name !== undefined) project.name = body.name;
      if (body.address !== undefined) project.address = body.address;
      if (body.propertyType !== undefined) project.propertyType = body.propertyType;
      if (body.reference !== undefined) project.reference = body.reference;
      if (body.date !== undefined) project.date = body.date;
      if (body.coverPhotoId !== undefined) project.coverPhotoId = body.coverPhotoId;
      if (body.settings) Object.assign(project.settings, body.settings);
      return project;
    });
    return NextResponse.json({ project });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 404 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await deleteProject(id);
  return NextResponse.json({ ok: true });
}
