import type { Sharp } from "sharp";
import { toRaw, toLuminance } from "./raw";
import type { CropSuggestion } from "./pipeline";

/**
 * Rule-based framing suggestion: measures row-wise edge energy (Sobel) to
 * find where meaningful content starts/ends vertically, then trims excess
 * flat ceiling/floor margin while keeping generous padding so doors,
 * windows and furniture are never cut. A real saliency/composition model
 * would refine this further; this stays honest, cheap, and always shows
 * the user the proposal before it's applied (section 16 requires review).
 */
export async function suggestCrop(input: Sharp): Promise<CropSuggestion> {
  const raw = await toRaw(input.clone().resize({ width: 200, fit: "inside" }));
  const { data, width, height } = toLuminance(raw);
  const rowEnergy = new Float64Array(height);
  const at = (x: number, y: number) => data[y * width + x];

  for (let y = 1; y < height - 1; y++) {
    let e = 0;
    for (let x = 1; x < width - 1; x++) {
      const gy = at(x, y + 1) - at(x, y - 1);
      const gx = at(x + 1, y) - at(x - 1, y);
      e += Math.sqrt(gx * gx + gy * gy);
    }
    rowEnergy[y] = e;
  }

  const total = rowEnergy.reduce((s, v) => s + v, 0) || 1;
  const mean = total / height;
  const flatThreshold = mean * 0.35;

  let top = 0;
  while (top < height * 0.25 && rowEnergy[top] < flatThreshold) top++;
  let bottom = height - 1;
  while (bottom > height * 0.75 && rowEnergy[bottom] < flatThreshold) bottom--;

  // keep generous padding so nothing important is cut too tight
  const padTop = Math.max(0, top - height * 0.04);
  const padBottom = Math.min(height, bottom + height * 0.04);

  const tooMuchCeiling = padTop / height > 0.12;
  const tooMuchFloor = (height - padBottom) / height > 0.1;

  const y = padTop / height;
  const h = (padBottom - padTop) / height;
  const reasons: string[] = [];
  if (tooMuchCeiling) reasons.push("trop de plafond");
  if (tooMuchFloor) reasons.push("trop de sol");

  return {
    x: 0,
    y: Math.max(0, y),
    w: 1,
    h: Math.min(1, h || 1),
    reason: reasons.length ? `Recadrage proposé : ${reasons.join(", ")}.` : "Cadrage déjà équilibré.",
  };
}
