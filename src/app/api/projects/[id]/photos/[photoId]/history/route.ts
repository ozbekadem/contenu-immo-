import { NextRequest, NextResponse } from "next/server";
import { updateProject, findPhoto, setHistoryIndex } from "@/lib/photoOps";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; photoId: string }> }) {
  const { id, photoId } = await params;
  const body = await req.json().catch(() => ({}));
  const action = body.action as "undo" | "redo" | "revert";

  try {
    const photo = await updateProject(id, (project) => {
      const photo = findPhoto(project, photoId);
      if (action === "undo") {
        setHistoryIndex(photo, photo.historyIndex - 1);
      } else if (action === "redo") {
        setHistoryIndex(photo, photo.historyIndex + 1);
      } else if (action === "revert") {
        const stepId = body.stepId as string | undefined;
        const index = body.index as number | undefined;
        const target = stepId ? photo.history.findIndex((s) => s.id === stepId) : index;
        if (target === undefined || target < 0) throw new Error("Étape introuvable.");
        setHistoryIndex(photo, target);
      } else {
        throw new Error("Action inconnue.");
      }
      return photo;
    });
    return NextResponse.json({ photo });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
