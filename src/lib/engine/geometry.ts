import sharp from "sharp";
import type { Sharp } from "sharp";
import { toRaw, toLuminance, fromRaw, sampleBilinear, clamp8, type RawImage } from "./raw";

/**
 * Estimate camera roll tilt (degrees) from the dominant orientation of
 * strong near-vertical edges (Sobel gradient), and a rough keystone
 * (converging-verticals) factor from how the horizontal spread of those
 * edges differs between the top and bottom of the frame.
 *
 * This is a lightweight, from-scratch heuristic (no external CV library) -
 * good enough to auto-suggest a correction; the UI also exposes manual
 * sliders seeded from this estimate so the user can fine tune.
 */
export async function estimateVerticalCorrection(
  input: Sharp
): Promise<{ rollDeg: number; keystone: number }> {
  const small = toLuminance(
    await toRaw(input.clone().resize({ width: 480, height: 480, fit: "inside", withoutEnlargement: true }))
  );
  const { data, width, height } = small;
  const gx = (x: number, y: number) => {
    const i = (yy: number, xx: number) => yy * width + xx;
    return (
      -data[i(y - 1, x - 1)] + data[i(y - 1, x + 1)] +
      -2 * data[i(y, x - 1)] + 2 * data[i(y, x + 1)] +
      -data[i(y + 1, x - 1)] + data[i(y + 1, x + 1)]
    );
  };
  const gy = (x: number, y: number) => {
    const i = (yy: number, xx: number) => yy * width + xx;
    return (
      -data[i(y - 1, x - 1)] - 2 * data[i(y - 1, x)] - data[i(y - 1, x + 1)] +
      data[i(y + 1, x - 1)] + 2 * data[i(y + 1, x)] + data[i(y + 1, x + 1)]
    );
  };

  const bins = new Map<number, number>(); // 0.25 deg buckets -> weight
  const topXs: { x: number; w: number }[] = [];
  const botXs: { x: number; w: number }[] = [];
  const threshold = 45;

  for (let y = 2; y < height - 2; y++) {
    for (let x = 2; x < width - 2; x++) {
      const dx = gx(x, y);
      const dy = gy(x, y);
      const mag = Math.sqrt(dx * dx + dy * dy);
      if (mag < threshold) continue;
      // edge (line) direction is perpendicular to the gradient
      let lineAngle = (Math.atan2(dx, dy) * 180) / Math.PI; // 0 = vertical line
      if (lineAngle > 90) lineAngle -= 180;
      if (lineAngle < -90) lineAngle += 180;
      if (Math.abs(lineAngle) > 20) continue; // keep near-vertical edges only
      const bucket = Math.round(lineAngle * 4) / 4;
      bins.set(bucket, (bins.get(bucket) || 0) + mag);
      if (y < height * 0.3) topXs.push({ x, w: mag });
      else if (y > height * 0.7) botXs.push({ x, w: mag });
    }
  }

  let bestAngle = 0;
  let bestWeight = 0;
  for (const [angle, weight] of bins) {
    if (weight > bestWeight) {
      bestWeight = weight;
      bestAngle = angle;
    }
  }

  const weightedSpread = (pts: { x: number; w: number }[]) => {
    if (pts.length < 8) return null;
    const totalW = pts.reduce((s, p) => s + p.w, 0);
    const mean = pts.reduce((s, p) => s + p.x * p.w, 0) / totalW;
    const variance = pts.reduce((s, p) => s + p.w * (p.x - mean) ** 2, 0) / totalW;
    return Math.sqrt(variance);
  };

  const topSpread = weightedSpread(topXs);
  const botSpread = weightedSpread(botXs);
  let keystone = 0;
  if (topSpread && botSpread && topSpread > 4 && botSpread > 4) {
    const ratio = botSpread / topSpread - 1;
    keystone = Math.max(-0.12, Math.min(0.12, ratio * 0.35));
  }

  return { rollDeg: Math.max(-6, Math.min(6, -bestAngle)), keystone };
}

/**
 * Correct camera roll (rotate) and a linear keystone approximation of
 * converging verticals (per-row horizontal rescale around the image
 * center). Keystone correction is a standard practical approximation of a
 * full homography and keeps the operation cheap enough to run per photo in
 * a batch.
 */
export async function correctVertical(
  input: Sharp,
  rollDeg: number,
  keystone: number
): Promise<Sharp> {
  let pipeline = input;
  if (Math.abs(rollDeg) > 0.05) {
    const baseMeta = await pipeline.clone().metadata();
    const baseWidth = baseMeta.width;
    const baseHeight = baseMeta.height;

    const rotatedBuf = await pipeline
      .rotate(rollDeg, { background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .toBuffer();
    let rotated = sharp(rotatedBuf);

    if (baseWidth && baseHeight) {
      // sharp's rotate() expands the canvas to fit the rotated rectangle,
      // exposing transparent corners; crop back to the pre-rotation size
      // from the center to drop those corners instead of leaving black
      // borders in the final image. An extra couple of percent of inset
      // (then resizing back up to the original dimensions) absorbs the
      // sub-pixel rounding between sharp's reported expanded canvas size
      // and the exact rotation geometry, which otherwise leaves a thin
      // residual black sliver on one edge.
      const rotMeta = await rotated.metadata();
      const rotWidth = rotMeta.width ?? baseWidth;
      const rotHeight = rotMeta.height ?? baseHeight;
      const marginX = Math.max(4, Math.round(baseWidth * 0.02));
      const marginY = Math.max(4, Math.round(baseHeight * 0.02));
      const cropWidth = Math.max(1, Math.min(baseWidth, rotWidth) - marginX);
      const cropHeight = Math.max(1, Math.min(baseHeight, rotHeight) - marginY);
      const left = Math.max(0, Math.round((rotWidth - cropWidth) / 2));
      const top = Math.max(0, Math.round((rotHeight - cropHeight) / 2));
      rotated = rotated
        .extract({
          left,
          top,
          width: Math.min(cropWidth, rotWidth - left),
          height: Math.min(cropHeight, rotHeight - top),
        })
        .resize(baseWidth, baseHeight, { fit: "fill" });
    }
    pipeline = rotated;
  }

  if (Math.abs(keystone) < 0.002) return pipeline;

  const raw = await toRaw(pipeline);
  const out = applyKeystone(raw, keystone);
  return fromRaw(out).flatten({ background: { r: 0, g: 0, b: 0 } });
}

function applyKeystone(img: RawImage, keystone: number): RawImage {
  const { width, height } = img;
  const out = Buffer.alloc(width * height * 4);
  const cx = width / 2;
  for (let y = 0; y < height; y++) {
    const yFrac = y / height - 0.5; // -0.5..0.5
    const scale = 1 + keystone * yFrac * 2; // wider/narrower per row
    for (let x = 0; x < width; x++) {
      const srcX = cx + (x - cx) / scale;
      const [r, g, b, a] = sampleBilinear(img, srcX, y);
      const i = (y * width + x) * 4;
      out[i] = clamp8(r);
      out[i + 1] = clamp8(g);
      out[i + 2] = clamp8(b);
      out[i + 3] = clamp8(a);
    }
  }
  return { data: out, width, height };
}

/**
 * Radial (barrel) distortion correction for wide-angle / smartphone shots.
 * `strength` in 0..1 pulls bulging straight lines back toward straight
 * (pincushion counter-warp); implemented as a manual inverse-mapping remap
 * with bilinear sampling since this isn't a native sharp operation.
 */
export async function correctWideAngle(input: Sharp, strength: number): Promise<Sharp> {
  if (strength <= 0.01) return input;
  const raw = await toRaw(input);
  const { width, height } = raw;
  const out = Buffer.alloc(width * height * 4);
  const cx = width / 2;
  const cy = height / 2;
  const maxR = Math.sqrt(cx * cx + cy * cy);
  const k = -0.28 * strength; // negative = pincushion correction of barrel distortion

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dx = (x - cx) / maxR;
      const dy = (y - cy) / maxR;
      const r2 = dx * dx + dy * dy;
      const factor = 1 + k * r2;
      const srcX = cx + dx * maxR * factor;
      const srcY = cy + dy * maxR * factor;
      const [r, g, b, a] = sampleBilinear(raw, srcX, srcY);
      const i = (y * width + x) * 4;
      out[i] = clamp8(r);
      out[i + 1] = clamp8(g);
      out[i + 2] = clamp8(b);
      out[i + 3] = clamp8(a);
    }
  }
  return fromRaw({ data: out, width, height }).flatten({ background: { r: 0, g: 0, b: 0 } });
}
