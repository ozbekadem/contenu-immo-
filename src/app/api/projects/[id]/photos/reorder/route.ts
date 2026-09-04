import { NextRequest, NextResponse } from "next/server";
import { updateProject } from "@/lib/photoOps";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const order = body.order as string[] | undefined;
  if (!Array.isArray(order)) return NextResponse.json({ error: "Ordre invalide." }, { status: 400 });

  try {
    const project = await updateProject(id, (project) => {
      const byId = new Map(project.photos.map((p) => [p.id, p]));
      const reordered = order.map((pid) => byId.get(pid)).filter((p): p is NonNullable<typeof p> => !!p);
      for (const p of project.photos) if (!order.includes(p.id)) reordered.push(p);
      reordered.forEach((p, i) => (p.order = i));
      project.photos = reordered;
      return project;
    });
    return NextResponse.json({ project });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 404 });
  }
}
