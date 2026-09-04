import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { STORAGE_ROOT } from "@/lib/storage";

const MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

export async function GET(_req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path: segments } = await params;
  const relative = segments.join("/");
  const resolved = path.normalize(path.join(STORAGE_ROOT, relative));

  // prevent path traversal outside the storage root
  if (!resolved.startsWith(STORAGE_ROOT)) {
    return NextResponse.json({ error: "Chemin invalide" }, { status: 400 });
  }

  try {
    const data = await fs.readFile(resolved);
    const ext = path.extname(resolved).toLowerCase();
    const contentType = MIME[ext] || "application/octet-stream";
    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=60",
      },
    });
  } catch {
    return NextResponse.json({ error: "Fichier introuvable" }, { status: 404 });
  }
}
