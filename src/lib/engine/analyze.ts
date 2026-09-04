import sharp from "sharp";
import type { Sharp } from "sharp";
import { toRaw, toLuminance } from "./raw";
import { estimateVerticalCorrection } from "./geometry";
import { computeQualityScore, computePHash } from "./score";
import { getAIProvider } from "../ai";
import type { PhotoAnalysis, ExposureState, WhiteBalanceCast } from "../types";

/** Laplacian-variance blur/sharpness estimate on a downscaled grayscale copy. */
async function estimateSharpness(input: Sharp): Promise<{ sharpness: number; isBlurry: boolean }> {
  const raw = await toRaw(input.clone().resize({ width: 500, fit: "inside" }));
  const { data, width, height } = toLuminance(raw);
  let sum = 0;
  let sumSq = 0;
  let count = 0;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      const lap = -4 * data[i] + data[i - 1] + data[i + 1] + data[i - width] + data[i + width];
      sum += lap;
      sumSq += lap * lap;
      count++;
    }
  }
  const mean = sum / count;
  const variance = sumSq / count - mean * mean;
  // Empirically, downscaled (500px) real-estate photos: variance < ~35 reads
  // as visibly soft/blurry, > ~400 as crisp. Map onto a 0..1 sharpness score.
  const sharpness = Math.max(0, Math.min(1, Math.log10(variance + 1) / Math.log10(400)));
  return { sharpness, isBlurry: variance < 35 };
}

function detectWhiteBalanceCast(meanR: number, meanG: number, meanB: number): WhiteBalanceCast {
  const avg = (meanR + meanG + meanB) / 3;
  const dr = meanR - avg;
  const dg = meanG - avg;
  const db = meanB - avg;
  const threshold = 6;
  if (Math.abs(dr) < threshold && Math.abs(dg) < threshold && Math.abs(db) < threshold) return "neutre";
  if (dr > threshold && db < -threshold * 0.5) return dg > threshold * 0.4 ? "jaune" : "orange";
  if (db > threshold && dr < -threshold * 0.5) return "bleu";
  if (dg > threshold && dr < threshold * 0.3 && db < threshold * 0.3) return "vert";
  if (dr > threshold && dg < 0 && db < 0) return "rouge";
  return "neutre";
}

async function skyAndWindowFractions(input: Sharp): Promise<{ skyFraction: number; skyQuality: number; windowOverexposure: number }> {
  const raw = await toRaw(input.clone().resize({ width: 300, fit: "inside" }));
  const { data, width, height } = raw;
  let sky = 0;
  let skyBrightSum = 0;
  let blown = 0;
  let total = 0;
  for (let y = 0; y < height; y++) {
    const yFrac = y / height;
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      total++;
      const bright = (r + g + b) / 3;
      if (yFrac < 0.55 && ((b >= r - 6 && b >= g - 10 && bright > 110) || (bright > 215 && Math.abs(r - g) < 18))) {
        sky++;
        skyBrightSum += bright;
      }
      if (r > 245 && g > 245 && b > 240) blown++;
    }
  }
  const skyFraction = sky / total;
  const skyQuality = sky > 0 ? Math.max(0, Math.min(1, 1 - Math.abs(skyBrightSum / sky - 190) / 120)) : 0;
  return { skyFraction, skyQuality, windowOverexposure: blown / total };
}

export async function analyzePhoto(imagePath: string): Promise<PhotoAnalysis> {
  const base = sharp(imagePath).rotate();
  const [stats, sharpness, sky, tilt, sceneGuess, phash] = await Promise.all([
    base.clone().stats(),
    estimateSharpness(base.clone()),
    skyAndWindowFractions(base.clone()),
    estimateVerticalCorrection(base.clone()),
    getAIProvider().classifyScene(imagePath),
    computePHash(base.clone()),
  ]);

  const [rC, gC, bC] = stats.channels;
  const brightness = (rC.mean + gC.mean + bC.mean) / 3 / 255;

  let exposure: ExposureState = "correct";
  if (brightness < 0.32) exposure = "sous-expose";
  else if (brightness > 0.78) exposure = "surexpose";

  const contrast = Math.max(0, Math.min(1, ((rC.stdev + gC.stdev + bC.stdev) / 3) / 90));
  const whiteBalanceCast = detectWhiteBalanceCast(rC.mean, gC.mean, bC.mean);

  const noiseProxy = Math.max(0, Math.min(1, (rC.stdev + gC.stdev + bC.stdev) / 3 > 75 ? 0.15 : 0));
  // High local variance from the Laplacian pass combined with only moderate
  // global stdev is a decent proxy for sensor grain vs. real detail/edges.
  const noise = Math.max(noiseProxy, brightness < 0.25 ? 0.35 : 0.1);

  const wideAngleDistortion: PhotoAnalysis["wideAngleDistortion"] =
    Math.abs(tilt.keystone) > 0.06 ? "fort" : Math.abs(tilt.keystone) > 0.02 ? "moyen" : "faible";

  const flags: string[] = [];
  if (sharpness.isBlurry) flags.push("Cette photo semble légèrement floue.");
  if (exposure === "sous-expose") flags.push("Cette photo est sous-exposée.");
  if (exposure === "surexpose") flags.push("Cette photo est surexposée.");
  if (Math.abs(tilt.rollDeg) > 1.2) flags.push("Correction de perspective recommandée.");
  if (sky.windowOverexposure > 0.06) flags.push("Fenêtres surexposées détectées.");
  if (whiteBalanceCast !== "neutre") flags.push(`Dominante de couleur détectée (${whiteBalanceCast}).`);
  if (noise > 0.3) flags.push("Bruit numérique notable.");

  const qualityScore = computeQualityScore({
    sharpness: sharpness.sharpness,
    isBlurry: sharpness.isBlurry,
    exposure,
    noise,
    contrast,
    windowOverexposure: sky.windowOverexposure,
  });

  return {
    environment: sceneGuess.environment,
    scene: sceneGuess.scene,
    channelMeans: [rC.mean, gC.mean, bC.mean],
    brightness,
    exposure,
    sharpness: sharpness.sharpness,
    isBlurry: sharpness.isBlurry,
    noise,
    contrast,
    whiteBalanceCast,
    verticalTiltDeg: tilt.rollDeg,
    wideAngleDistortion,
    skyFraction: sky.skyFraction,
    skyQuality: sky.skyQuality,
    windowOverexposure: sky.windowOverexposure,
    qualityScore,
    flags,
    phash,
  };
}
