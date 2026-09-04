import type { Sharp } from "sharp";
import { toRaw } from "../engine/raw";
import type { SceneGuess } from "./provider";

/**
 * No-training-data fallback for scene understanding: classifies
 * interior/exterior (reliable, color/luminance based) and takes a rough
 * guess at a handful of exterior sub-types from color composition. Interior
 * room types (salon/cuisine/chambre/...) genuinely need a vision model —
 * when no AI provider is configured this returns "autre" with low
 * confidence rather than pretending to know.
 */
export async function classifySceneHeuristic(input: Sharp): Promise<SceneGuess> {
  const raw = await toRaw(input.clone().resize({ width: 160, height: 160, fit: "inside" }));
  const { data, width, height } = raw;
  let skyPixels = 0;
  let greenPixels = 0;
  let total = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      total++;
      if (y < height * 0.45 && b > 140 && b >= r - 10 && b >= g - 15) skyPixels++;
      if (g > r + 12 && g > b + 6 && g > 70) greenPixels++;
    }
  }

  const skyFrac = skyPixels / total;
  const greenFrac = greenPixels / total;

  if (skyFrac > 0.12 || greenFrac > 0.12) {
    if (greenFrac > 0.22) {
      return { scene: "jardin", environment: "exterieur", confidence: 0.55, source: "heuristic" };
    }
    return { scene: "facade", environment: "exterieur", confidence: 0.5, source: "heuristic" };
  }

  return { scene: "autre", environment: "interieur", confidence: 0.4, source: "heuristic" };
}
