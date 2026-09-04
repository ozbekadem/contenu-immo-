import type { ToneParams } from "./color";
import type { HdrMode, ColorStyle, LightAuto, Environment } from "../types";

export interface DetailParams {
  sharpen: number; // 0..1
  denoise: number; // 0..1
}

const HDR_BASE: Record<HdrMode, Partial<ToneParams>> = {
  naturel: { shadowLift: 0.25, highlightRecover: 0.25, clarity: 0.1, contrast: 0.05 },
  immobilier: { shadowLift: 0.4, highlightRecover: 0.4, clarity: 0.18, contrast: 0.1 },
  premium: { shadowLift: 0.5, highlightRecover: 0.5, clarity: 0.24, contrast: 0.14 },
  intense: { shadowLift: 0.65, highlightRecover: 0.6, clarity: 0.32, contrast: 0.2 },
};

const COLOR_STYLE_BASE: Record<ColorStyle, Partial<ToneParams>> = {
  naturel: { saturation: 0.02, warmth: 0, exposure: 0 },
  lumineux: { saturation: 0.06, warmth: 0.02, exposure: 0.15 },
  chaleureux: { saturation: 0.08, warmth: 0.18, exposure: 0.05 },
  immobilier_premium: { saturation: 0.1, warmth: 0.08, exposure: 0.1 },
  style_agence: { saturation: 0.12, warmth: 0.1, exposure: 0.12 },
};

const LIGHT_AUTO_SHADOW: Record<Exclude<LightAuto, "manuel">, number> = {
  faible: 0.2,
  moyenne: 0.4,
  forte: 0.6,
};

export interface RetouchProInputs {
  intensity: number; // 0..100
  hdrMode: HdrMode;
  colorStyle: ColorStyle;
  lightAuto: LightAuto;
  manualBrightness?: number; // used when lightAuto === 'manuel', -1..1
  environment: Environment;
  /** per-photo measured gray-world gains and exposure delta from analysis, for real per-image adaptation */
  measured: {
    wbGain: [number, number, number];
    exposureDelta: number; // EV
    noise: number; // 0..1
    windowOverexposure: number; // 0..1
    skyFraction: number; // 0..1
  };
  /** shared harmonization target across the lot (averages), blended in when harmonizeLot is on */
  harmonize?: {
    wbGain: [number, number, number];
    exposureDelta: number;
    blend: number; // 0..1 how strongly to pull this photo toward the lot average
  };
}

/**
 * Builds the final ToneParams for the "Retouche Pro" 1-click pipeline.
 * Each photo is analyzed individually (measured.*) so the same button never
 * applies identical raw values to every image, while HDR mode / color style
 * / intensity / harmonization keep a single shared artistic direction.
 */
export function buildRetouchProParams(inputs: RetouchProInputs): { tone: ToneParams; detail: DetailParams } {
  const strength = Math.max(0, Math.min(100, inputs.intensity)) / 100;
  const hdr = HDR_BASE[inputs.hdrMode];
  const style = COLOR_STYLE_BASE[inputs.colorStyle];

  let wbGain: [number, number, number] = [...inputs.measured.wbGain] as [number, number, number];
  let exposureDelta = inputs.measured.exposureDelta;

  if (inputs.harmonize && inputs.harmonize.blend > 0) {
    const b = inputs.harmonize.blend;
    wbGain = [
      wbGain[0] * (1 - b) + inputs.harmonize.wbGain[0] * b,
      wbGain[1] * (1 - b) + inputs.harmonize.wbGain[1] * b,
      wbGain[2] * (1 - b) + inputs.harmonize.wbGain[2] * b,
    ];
    exposureDelta = exposureDelta * (1 - b) + inputs.harmonize.exposureDelta * b;
  }

  const shadowBase =
    inputs.lightAuto === "manuel"
      ? Math.max(0, inputs.manualBrightness ?? 0)
      : LIGHT_AUTO_SHADOW[inputs.lightAuto];

  const isInterior = inputs.environment === "interieur";

  const tone: ToneParams = {
    exposure: (exposureDelta + (style.exposure ?? 0)) * strength,
    wbGain,
    shadowLift: Math.min(1, ((hdr.shadowLift ?? 0.3) * 0.6 + shadowBase * 0.4)) * strength,
    highlightRecover: Math.min(1, (hdr.highlightRecover ?? 0.3) + inputs.measured.windowOverexposure * 0.4) * strength,
    contrast: (hdr.contrast ?? 0.08) * strength,
    saturation: (style.saturation ?? 0.05) * strength,
    warmth: (style.warmth ?? 0) * strength,
    clarity: (hdr.clarity ?? 0.15) * strength * (isInterior ? 1 : 0.8),
    skyBoost: !isInterior ? Math.min(1, inputs.measured.skyFraction * 1.6) * strength * 0.8 : 0,
    windowRecover: isInterior ? Math.min(1, inputs.measured.windowOverexposure * 1.4) * strength : 0,
  };

  const detail: DetailParams = {
    sharpen: 0.35 + 0.25 * strength,
    denoise: Math.min(1, inputs.measured.noise * 1.3) * (0.4 + 0.6 * strength),
  };

  return { tone, detail };
}

export const HDR_LABELS: Record<HdrMode, string> = {
  naturel: "HDR Naturel",
  immobilier: "HDR Immobilier",
  premium: "HDR Premium",
  intense: "HDR Intense",
};

export const COLOR_STYLE_LABELS: Record<ColorStyle, string> = {
  naturel: "Naturel",
  lumineux: "Lumineux",
  chaleureux: "Chaleureux",
  immobilier_premium: "Immobilier Premium",
  style_agence: "Style Agence",
};

export function buildHdrOnlyTone(hdrMode: HdrMode, intensity: number): Partial<ToneParams> {
  const strength = Math.max(0, Math.min(100, intensity)) / 100;
  const hdr = HDR_BASE[hdrMode];
  return {
    shadowLift: (hdr.shadowLift ?? 0.3) * strength,
    highlightRecover: (hdr.highlightRecover ?? 0.3) * strength,
    clarity: (hdr.clarity ?? 0.15) * strength,
    contrast: (hdr.contrast ?? 0.08) * strength,
  };
}

export function buildLuminositeTone(lightAuto: LightAuto, manualBrightness: number | undefined, intensity: number): Partial<ToneParams> {
  const strength = Math.max(0, Math.min(100, intensity)) / 100;
  const base = lightAuto === "manuel" ? Math.max(-1, Math.min(1, manualBrightness ?? 0)) : LIGHT_AUTO_SHADOW[lightAuto];
  return {
    exposure: (lightAuto === "manuel" ? base * 0.6 : base * 0.3) * strength,
    shadowLift: Math.max(0, base) * strength,
    highlightRecover: 0.25 * strength,
    windowRecover: 0.2 * strength,
  };
}

export function buildWhiteBalanceTone(wbGain: [number, number, number], intensity: number): Partial<ToneParams> {
  const strength = Math.max(0, Math.min(100, intensity)) / 100;
  return {
    wbGain: [1 + (wbGain[0] - 1) * strength, 1 + (wbGain[1] - 1) * strength, 1 + (wbGain[2] - 1) * strength],
  };
}

/** "Style Immo Vision" — the saved agency preset from the brief (section 36). */
export const STYLE_IMMO_VISION: { hdrMode: HdrMode; colorStyle: ColorStyle; intensity: number } = {
  hdrMode: "immobilier",
  colorStyle: "immobilier_premium",
  intensity: 55,
};
