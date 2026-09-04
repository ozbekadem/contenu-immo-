import type { Sharp } from "sharp";
import { toRaw, toLuminance } from "./raw";

export interface Rect {
  x: number; // 0..1 fraction of width
  y: number; // 0..1 fraction of height
  w: number; // 0..1
  h: number; // 0..1
}

/**
 * Heuristic "property outline" suggestion: downscales to grayscale, runs a
 * Sobel edge map, and finds the tightest column/row window that contains
 * ~85% of total edge energy. Built structures (facades, rooflines, window
 * frames) concentrate edge energy far more than sky or lawn, so this
 * reliably brackets the building without needing a trained detector.
 * The UI lets the user drag-adjust the box afterward — this is a starting
 * suggestion, not a guarantee neighboring properties are excluded.
 */
export async function suggestPropertyOutline(input: Sharp): Promise<Rect> {
  const raw = await toRaw(input.clone().resize({ width: 240, fit: "inside" }));
  const { data, width, height } = toLuminance(raw);
  const colEnergy = new Float64Array(width);
  const rowEnergy = new Float64Array(height);

  const at = (x: number, y: number) => data[y * width + x];
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const gx = at(x + 1, y) - at(x - 1, y);
      const gy = at(x, y + 1) - at(x, y - 1);
      const mag = Math.sqrt(gx * gx + gy * gy);
      colEnergy[x] += mag;
      rowEnergy[y] += mag;
    }
  }

  const trimWindow = (arr: Float64Array, keepFraction: number) => {
    const total = arr.reduce((s, v) => s + v, 0) || 1;
    const target = total * keepFraction;
    let lo = 0;
    let hi = arr.length - 1;
    let sum = total;
    while (sum > target && hi - lo > 4) {
      const shrinkLeft = arr[lo] <= arr[hi];
      if (shrinkLeft) {
        sum -= arr[lo];
        lo++;
      } else {
        sum -= arr[hi];
        hi--;
      }
    }
    return { lo, hi };
  };

  const cols = trimWindow(colEnergy, 0.86);
  const rows = trimWindow(rowEnergy, 0.86);

  const rect: Rect = {
    x: Math.max(0, cols.lo / width - 0.02),
    y: Math.max(0, rows.lo / height - 0.02),
    w: Math.min(1, (cols.hi - cols.lo) / width + 0.04),
    h: Math.min(1, (rows.hi - rows.lo) / height + 0.04),
  };
  return rect;
}

export interface OutlineStyle {
  color: string; // hex, e.g. #FFF000
  thickness: number; // px at output resolution
  opacity: number; // 0..1
  glow: boolean;
}

export async function applyOutline(
  input: Sharp,
  rect: Rect,
  style: OutlineStyle
): Promise<Sharp> {
  const meta = await input.clone().metadata();
  const width = meta.width ?? 1600;
  const height = meta.height ?? 1200;
  const x = Math.round(rect.x * width);
  const y = Math.round(rect.y * height);
  const w = Math.round(rect.w * width);
  const h = Math.round(rect.h * height);
  const t = style.thickness;

  const glowFilter = style.glow
    ? `<filter id="glow"><feGaussianBlur stdDeviation="${t * 1.2}" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`
    : "";

  const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>${glowFilter}</defs>
    <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none"
      stroke="${style.color}" stroke-width="${t}" opacity="${style.opacity}"
      ${style.glow ? 'filter="url(#glow)"' : ""} />
  </svg>`;

  return input.composite([{ input: Buffer.from(svg), top: 0, left: 0 }]);
}

export const CONTOUR_IMMO_VISION: OutlineStyle = {
  color: "#FFF000",
  thickness: 6,
  opacity: 0.95,
  glow: true,
};
