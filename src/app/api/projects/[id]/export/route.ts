import { NextRequest, NextResponse } from "next/server";
import JSZip from "jszip";
import { readProject } from "@/lib/storage";
import { renderExportBuffer, exportFilename, type ExportQuality } from "@/lib/engine/export";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await readProject(id);
  if (!project) return NextResponse.json({ error: "Projet introuvable" }, { status: 404 });

  const url = new URL(req.url);
  const scope = url.searchParams.get("scope") ?? "selected"; // this|selected|all
  const photoId = url.searchParams.get("photoId");
  const quality = (url.searchParams.get("quality") as ExportQuality) ?? "haute";

  let photos = project.photos;
  if (scope === "this" && photoId) photos = photos.filter((p) => p.id === photoId);
  else if (scope === "selected") photos = photos.filter((p) => p.selected);
  // scope === "all" keeps every photo

  if (!photos.length) return NextResponse.json({ error: "Aucune photo à exporter." }, { status: 400 });

  if (photos.length === 1) {
    const buffer = await renderExportBuffer(photos[0], quality);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "image/jpeg",
        "Content-Disposition": `attachment; filename="${exportFilename(photos[0], 0)}"`,
      },
    });
  }

  const zip = new JSZip();
  for (let i = 0; i < photos.length; i++) {
    const buffer = await renderExportBuffer(photos[i], quality);
    zip.file(exportFilename(photos[i], i), buffer);
  }
  const zipBuffer = await zip.generateAsync({ type: "nodebuffer", compression: "STORE" });
  const zipName = `${project.name.replace(/[^a-z0-9-_]+/gi, "_") || "lot"}-${quality}.zip`;

  return new NextResponse(new Uint8Array(zipBuffer), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${zipName}"`,
    },
  });
}
