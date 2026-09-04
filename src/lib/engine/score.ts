import type { Sharp } from "sharp";
import { toRaw, toLuminance } from "./raw";

/** Perceptual difference hash (dHash, 64-bit) for near-duplicate detection. */
export async function computePHash(input: Sharp): Promise<string> {
  const raw = await toRaw(input.clone().resize(9, 8, { fit: "fill" }));
  const { data } = toLuminance(raw);
  let bits = "";
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const left = data[y * 9 + x];
      const right = data[y * 9 + x + 1];
      bits += left > right ? "1" : "0";
    }
  }
  let hex = "";
  for (let i = 0; i < bits.length; i += 4) {
    hex += parseInt(bits.slice(i, i + 4), 2).toString(16);
  }
  return hex;
}

export function hammingDistanceHex(a: string, b: string): number {
  let dist = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    let v = parseInt(a[i], 16) ^ parseInt(b[i], 16);
    while (v) {
      dist += v & 1;
      v >>= 1;
    }
  }
  return dist;
}

/** 0..1 similarity from a 64-bit dHash hamming distance (0 = identical). */
export function phashSimilarity(a: string, b: string): number {
  return 1 - hammingDistanceHex(a, b) / 64;
}

export interface QualityInputs {
  sharpness: number; // 0..1
  isBlurry: boolean;
  exposure: "sous-expose" | "correct" | "surexpose";
  noise: number; // 0..1
  contrast: number; // 0..1
  windowOverexposure: number; // 0..1
}

/** Composite 0-100 "commercial impact" quality score used for AI selection & cover suggestion. */
export function computeQualityScore(q: QualityInputs): number {
  let score = 100;
  score -= q.isBlurry ? 35 : (1 - q.sharpness) * 15;
  if (q.exposure !== "correct") score -= 15;
  score -= q.noise * 20;
  score -= Math.abs(q.contrast - 0.5) * 20;
  score -= q.windowOverexposure * 15;
  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * Naturalness indicator: average per-pixel difference between the original
 * and the current working image, mapped to a 0-100 "how far from the
 * source photo" score. This is an internal heuristic, not a scientific
 * authenticity measure — presented as such in the UI (spec section 45).
 */
export async function computeNaturalness(originalPipeline: Sharp, currentPipeline: Sharp): Promise<number> {
  const size = 160;
  const [a, b] = await Promise.all([
    toRaw(originalPipeline.clone().resize(size, size, { fit: "fill" })),
    toRaw(currentPipeline.clone().resize(size, size, { fit: "fill" })),
  ]);
  const len = Math.min(a.data.length, b.data.length);
  let diffSum = 0;
  let count = 0;
  for (let i = 0; i < len; i += 4) {
    diffSum += Math.abs(a.data[i] - b.data[i]) + Math.abs(a.data[i + 1] - b.data[i + 1]) + Math.abs(a.data[i + 2] - b.data[i + 2]);
    count += 3;
  }
  const meanDiff = diffSum / count; // 0..255
  const normalized = Math.min(1, meanDiff / 60); // 60/255 mean diff ~= heavy edit
  return Math.round(100 - normalized * 100);
}
