import type { Sharp } from "sharp";
import type { DetailParams } from "./presets";

/**
 * Selective sharpening + noise reduction using sharp's native (libvips)
 * operators. Denoise uses a small median filter (kills speckle/ISO grain
 * without the heavy smearing of a plain gaussian blur); sharpening uses an
 * unsharp-mask style operator biased toward mid/high frequency detail
 * (architecture, furniture) while leaving flat surfaces alone.
 */
export function applyDetail(pipeline: Sharp, params: DetailParams): Sharp {
  let out = pipeline;
  if (params.denoise > 0.08) {
    const size = params.denoise > 0.55 ? 5 : 3;
    out = out.median(size);
  }
  if (params.sharpen > 0.02) {
    out = out.sharpen({
      sigma: 1 + params.sharpen * 0.8,
      m1: 0.6 + params.sharpen * 0.8, // flat-area threshold (keeps skies/walls clean)
      m2: 1.2 + params.sharpen * 1.6, // jagged-area threshold (edges/detail get more)
      x1: 2,
      y2: 10,
      y3: 20,
    });
  }
  return out;
}
