import type { RawImage } from "./raw";
import { clamp8 } from "./raw";

export interface ToneParams {
  /** Exposure in EV stops, e.g. 0.3 = +0.3 stop. */
  exposure: number;
  /** Per-channel multiplicative white-balance gain, gray-world derived. */
  wbGain: [number, number, number];
  /** 0..1 strength of shadow lift (recover dark areas). */
  shadowLift: number;
  /** 0..1 strength of highlight recovery (tame blown areas, e.g. windows). */
  highlightRecover: number;
  /** -1..1 contrast adjustment. */
  contrast: number;
  /** -1..1 saturation/vibrance adjustment (protects near-neutral tones). */
  saturation: number;
  /** -1..1 warmth shift, positive = warmer (golden hour / chaleureux). */
  warmth: number;
  /** 0..1 subtle midtone local-contrast push (HDR "clarity"-like, kept mild to stay natural). */
  clarity: number;
  /** 0..1 strength of sky-region grading (only applied to sky-classified pixels). */
  skyBoost: number;
  /** 0..1 strength of extra recovery specifically targeted at near-blown window/highlight pixels. */
  windowRecover: number;
}

export const NEUTRAL_TONE: ToneParams = {
  exposure: 0,
  wbGain: [1, 1, 1],
  shadowLift: 0,
  highlightRecover: 0,
  contrast: 0,
  saturation: 0,
  warmth: 0,
  clarity: 0,
  skyBoost: 0,
  windowRecover: 0,
};

function luminance(r: number, g: number, b: number): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Is this pixel plausibly "sky": bright, blue/neutral dominant, low texture proxy via brightness alone. */
function isSkyLike(r: number, g: number, b: number, yFrac: number): boolean {
  if (yFrac > 0.6) return false; // sky is virtually never in the lower 40% of a real-estate photo
  const bright = (r + g + b) / 3;
  if (bright < 90) return false;
  const blueDominant = b >= r - 6 && b >= g - 10;
  return blueDominant && bright > 120 || (bright > 210 && Math.abs(r - g) < 18 && Math.abs(g - b) < 22);
}

function isBlownHighlight(r: number, g: number, b: number): boolean {
  return r > 233 && g > 233 && b > 225;
}

/**
 * Single-pass, per-pixel tone & colour pipeline: white balance, exposure,
 * shadow/highlight recovery, contrast, saturation, warmth, plus a light
 * sky-region and blown-highlight (window) targeted grade. Runs once over
 * the buffer for speed instead of chaining many sharp() round trips.
 */
export function applyTonePipeline(img: RawImage, p: ToneParams): RawImage {
  const { data, width, height } = img;
  const expMul = Math.pow(2, p.exposure);
  const contrastFactor = 1 + p.contrast; // >1 punchier, <1 flatter
  const [gr, gg, gb] = p.wbGain;

  for (let y = 0; y < height; y++) {
    const yFrac = y / height;
    const rowBase = y * width * 4;
    for (let x = 0; x < width; x++) {
      const i = rowBase + x * 4;
      let r = data[i];
      let g = data[i + 1];
      let b = data[i + 2];

      // 1. White balance (gray-world gain) + exposure
      r = r * gr * expMul;
      g = g * gg * expMul;
      b = b * gb * expMul;

      // 2. Shadow lift / highlight recovery based on luminance
      const L = luminance(r, g, b);
      if (p.shadowLift > 0 && L < 128) {
        const amt = p.shadowLift * ((128 - L) / 128) * 70;
        r += amt;
        g += amt;
        b += amt;
      }
      if (p.highlightRecover > 0 && L > 150) {
        const amt = p.highlightRecover * ((L - 150) / 105) * 70;
        r -= amt;
        g -= amt;
        b -= amt;
      }

      // 3. Targeted window/blown-highlight recovery (stronger, localized)
      if (p.windowRecover > 0 && isBlownHighlight(data[i], data[i + 1], data[i + 2])) {
        const amt = p.windowRecover * 55;
        r -= amt;
        g -= amt;
        b -= amt * 0.9;
      }

      // 4. Sky grading (only sky-like pixels, upper region)
      if (p.skyBoost > 0 && isSkyLike(data[i], data[i + 1], data[i + 2], yFrac)) {
        // gently deepen blue, lift brightness a touch, avoid an artificial flat blue
        b += p.skyBoost * 14;
        g += p.skyBoost * 4;
        r -= p.skyBoost * 4;
      }

      // 5. Warmth (temperature shift)
      if (p.warmth !== 0) {
        r += p.warmth * 12;
        b -= p.warmth * 12;
      }

      // 6. Contrast (pivot at mid-gray)
      r = (r - 128) * contrastFactor + 128;
      g = (g - 128) * contrastFactor + 128;
      b = (b - 128) * contrastFactor + 128;

      // 7. Mild local/midtone clarity push (S-curve emphasis near mid tones only)
      if (p.clarity > 0) {
        const Lc = luminance(r, g, b);
        const mid = 1 - Math.abs(Lc - 128) / 128; // 1 at mid, 0 at extremes
        const push = p.clarity * mid * 18 * (Lc >= 128 ? 1 : -1);
        r += push;
        g += push;
        b += push;
      }

      // 8. Saturation / vibrance (protects near-neutral tones a bit)
      if (p.saturation !== 0) {
        const gray = luminance(r, g, b);
        const sat = 1 + p.saturation;
        r = gray + (r - gray) * sat;
        g = gray + (g - gray) * sat;
        b = gray + (b - gray) * sat;
      }

      data[i] = clamp8(r);
      data[i + 1] = clamp8(g);
      data[i + 2] = clamp8(b);
    }
  }
  return img;
}

/** Gray-world white balance gain estimate from average channel means. */
export function grayWorldGains(meanR: number, meanG: number, meanB: number, strength: number): [number, number, number] {
  const gray = (meanR + meanG + meanB) / 3;
  if (gray <= 0) return [1, 1, 1];
  const clampGain = (g: number) => Math.min(1.25, Math.max(0.8, g));
  const targetR = clampGain(gray / Math.max(1, meanR));
  const targetG = clampGain(gray / Math.max(1, meanG));
  const targetB = clampGain(gray / Math.max(1, meanB));
  // blend toward neutral (1) by `strength` so the effect is subtle at low intensity
  return [
    1 + (targetR - 1) * strength,
    1 + (targetG - 1) * strength,
    1 + (targetB - 1) * strength,
  ];
}
