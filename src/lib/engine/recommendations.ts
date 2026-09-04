import type { Photo } from "../types";
import { phashSimilarity } from "./score";
import { grayWorldGains } from "./color";

export interface LotRecommendation {
  message: string;
  photoIds: string[];
  action?: "corriger_expo" | "corriger_perspective" | "ameliorer_ciel" | "netteté" | "doublons";
}

export interface DuplicatePair {
  a: string;
  b: string;
  similarity: number;
}

export function findDuplicates(photos: Photo[], threshold = 0.9): DuplicatePair[] {
  const pairs: DuplicatePair[] = [];
  for (let i = 0; i < photos.length; i++) {
    for (let j = i + 1; j < photos.length; j++) {
      const pa = photos[i].analysis?.phash;
      const pb = photos[j].analysis?.phash;
      if (!pa || !pb) continue;
      const sim = phashSimilarity(pa, pb);
      if (sim >= threshold) pairs.push({ a: photos[i].id, b: photos[j].id, similarity: sim });
    }
  }
  return pairs;
}

export function buildRecommendations(photos: Photo[]): LotRecommendation[] {
  const recs: LotRecommendation[] = [];
  const analyzed = photos.filter((p) => p.analysis);

  const dark = analyzed.filter((p) => p.analysis!.exposure === "sous-expose");
  if (dark.length) {
    recs.push({
      message: `${dark.length} photo${dark.length > 1 ? "s sont" : " est"} trop sombre${dark.length > 1 ? "s" : ""}.`,
      photoIds: dark.map((p) => p.id),
      action: "corriger_expo",
    });
  }

  const tilted = analyzed.filter((p) => Math.abs(p.analysis!.verticalTiltDeg) > 1.2);
  if (tilted.length) {
    recs.push({
      message: `${tilted.length} photo${tilted.length > 1 ? "s nécessitent" : " nécessite"} une correction des verticales.`,
      photoIds: tilted.map((p) => p.id),
      action: "corriger_perspective",
    });
  }

  const dullSky = analyzed.filter((p) => p.analysis!.environment === "exterieur" && p.analysis!.skyFraction > 0.08 && p.analysis!.skyQuality < 0.55);
  if (dullSky.length) {
    recs.push({
      message: `${dullSky.length} photo${dullSky.length > 1 ? "s extérieures bénéficieraient" : " extérieure bénéficierait"} d'une amélioration du ciel.`,
      photoIds: dullSky.map((p) => p.id),
      action: "ameliorer_ciel",
    });
  }

  const blurry = analyzed.filter((p) => p.analysis!.isBlurry);
  if (blurry.length) {
    recs.push({
      message: `${blurry.length} photo${blurry.length > 1 ? "s semblent" : " semble"} floue${blurry.length > 1 ? "s" : ""}.`,
      photoIds: blurry.map((p) => p.id),
      action: "netteté",
    });
  }

  const dupes = findDuplicates(photos);
  if (dupes.length) {
    const ids = Array.from(new Set(dupes.flatMap((d) => [d.a, d.b])));
    const message =
      dupes.length === 1
        ? "2 photos sont presque identiques."
        : `${dupes.length} paires de photos presque identiques détectées.`;
    recs.push({ message, photoIds: ids, action: "doublons" });
  }

  return recs;
}

/** "Sélection IA": photos worth recommending for publication, ranked by
 * composite quality score, excluding the weaker photo of any near-duplicate
 * pair. The user always keeps the final say (section 38). */
export function suggestBestPhotos(photos: Photo[], keepFraction = 0.8): string[] {
  const analyzed = photos.filter((p) => p.analysis);
  const dupes = findDuplicates(photos);
  const loserOfDupe = new Set<string>();
  for (const d of dupes) {
    const a = photos.find((p) => p.id === d.a)!;
    const b = photos.find((p) => p.id === d.b)!;
    const loser = (a.analysis?.qualityScore ?? 0) >= (b.analysis?.qualityScore ?? 0) ? b.id : a.id;
    loserOfDupe.add(loser);
  }
  const ranked = [...analyzed].sort((a, b) => (b.analysis!.qualityScore) - (a.analysis!.qualityScore));
  const targetCount = Math.max(1, Math.round(photos.length * keepFraction));
  const keep = ranked.filter((p) => !loserOfDupe.has(p.id)).slice(0, targetCount);
  return keep.map((p) => p.id);
}

/** Best candidate for the listing's cover photo: highest quality score,
 * with a bonus for wide/bright, high-impact shots (front facade, living
 * room) inferred from environment + brightness + contrast. */
export function suggestCoverPhoto(photos: Photo[]): string | null {
  const analyzed = photos.filter((p) => p.analysis);
  if (!analyzed.length) return null;
  const scored = analyzed.map((p) => {
    const a = p.analysis!;
    let impact = a.qualityScore;
    if (a.scene === "facade" || a.scene === "salon") impact += 8;
    if (a.brightness > 0.35 && a.brightness < 0.7) impact += 5;
    if (a.contrast > 0.3 && a.contrast < 0.75) impact += 4;
    return { id: p.id, impact };
  });
  scored.sort((a, b) => b.impact - a.impact);
  return scored[0].id;
}

/** Average white-balance gain & exposure delta across a lot, used to pull
 * every photo's Retouche Pro toward one shared, coherent look (section 34). */
export function computeHarmonizationTarget(photos: Photo[]): { wbGain: [number, number, number]; exposureDelta: number } | null {
  const analyzed = photos.filter((p) => p.analysis);
  if (analyzed.length < 2) return null;
  let sumR = 0, sumG = 0, sumB = 0, sumExp = 0;
  for (const p of analyzed) {
    const a = p.analysis!;
    const [mr, mg, mb] = a.channelMeans;
    const gains = grayWorldGains(mr, mg, mb, 1);
    sumR += gains[0];
    sumG += gains[1];
    sumB += gains[2];
    sumExp += 0.45 - a.brightness; // pull toward a shared mid-target exposure
  }
  const n = analyzed.length;
  return {
    wbGain: [sumR / n, sumG / n, sumB / n],
    exposureDelta: sumExp / n,
  };
}
