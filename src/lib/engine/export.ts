import sharp from "sharp";
import { absPath } from "../storage";
import type { Photo } from "../types";

export type ExportQuality = "web" | "haute" | "max";

const TIER_CONFIG: Record<ExportQuality, { maxDimension: number | null; quality: number }> = {
  web: { maxDimension: 1920, quality: 80 },
  haute: { maxDimension: 3000, quality: 92 },
  max: { maxDimension: null, quality: 96 },
};

/**
 * Renders the export buffer for a photo: starts from the edited working
 * file (preview resolution, reflects the full non-destructive history) and
 * upsamples to the original capture resolution for "haute qualité"/"qualité
 * maximale" tiers using a high quality (Lanczos3) resampler. Editing always
 * happens on the fast working preview (section 53); this is where the
 * final high-resolution deliverable gets produced, once, on export.
 */
export async function renderExportBuffer(photo: Photo, tier: ExportQuality): Promise<Buffer> {
  const cfg = TIER_CONFIG[tier];
  const srcAbs = absPath(photo.currentFile);

  if (tier === "web") {
    return sharp(srcAbs)
      .resize({ width: cfg.maxDimension!, height: cfg.maxDimension!, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: cfg.quality, mozjpeg: true })
      .toBuffer();
  }

  let targetW = photo.width;
  let targetH = photo.height;
  try {
    const originalMeta = await sharp(absPath(photo.originalFile)).rotate().metadata();
    targetW = originalMeta.width ?? targetW;
    targetH = originalMeta.height ?? targetH;
  } catch {
    // original missing/unreadable — fall back to the working resolution
  }

  let pipeline = sharp(srcAbs);
  if (tier === "max") {
    pipeline = pipeline.resize(targetW, targetH, { fit: "fill", kernel: "lanczos3" });
  } else {
    pipeline = pipeline.resize({ width: Math.min(cfg.maxDimension!, targetW), height: Math.min(cfg.maxDimension!, targetH), fit: "inside" });
  }
  return pipeline.jpeg({ quality: cfg.quality, mozjpeg: true }).toBuffer();
}

export function exportFilename(photo: Photo, index: number): string {
  const base = photo.filename.replace(/\.[^.]+$/, "");
  return `${String(index + 1).padStart(2, "0")}-${base || photo.id}.jpg`;
}
