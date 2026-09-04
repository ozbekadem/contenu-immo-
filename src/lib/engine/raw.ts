import sharp from "sharp";
import type { Sharp } from "sharp";

export interface RawImage {
  data: Buffer; // RGBA, row-major
  width: number;
  height: number;
}

/**
 * Decode any sharp pipeline (already EXIF-rotated) to a raw RGBA buffer.
 * Forces the sRGB colourspace before adding the alpha channel so the
 * output is always exactly 4 channels/pixel — without this, a pipeline
 * that called `.grayscale()` upstream would raw-encode as 1-2 channels
 * (gray[+alpha]) and silently corrupt every consumer that indexes pixels
 * with a hardcoded stride of 4.
 */
export async function toRaw(input: Sharp): Promise<RawImage> {
  const { data, info } = await input
    .toColourspace("srgb")
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

/** Wrap a raw RGBA buffer back into a sharp pipeline. */
export function fromRaw(img: RawImage): Sharp {
  return sharp(img.data, {
    raw: { width: img.width, height: img.height, channels: 4 },
  });
}

export function cloneRaw(img: RawImage): RawImage {
  return { data: Buffer.from(img.data), width: img.width, height: img.height };
}

export interface LuminanceImage {
  data: Uint8Array; // single channel, row-major
  width: number;
  height: number;
}

/**
 * Flattens an RGBA RawImage to single-channel luminance. Used instead of
 * sharp's `.grayscale()` upstream of `toRaw`: sharp's grayscale flag forces
 * a 1-channel raw encode that survives even a later `.toColourspace()`
 * call, which would silently break every consumer here that assumes a
 * 4-byte-per-pixel stride. Computing luminance ourselves from the
 * guaranteed-RGBA buffer sidesteps that entirely.
 */
export function toLuminance(img: RawImage): LuminanceImage {
  const { data, width, height } = img;
  const out = new Uint8Array(width * height);
  for (let p = 0, i = 0; p < out.length; p++, i += 4) {
    out[p] = (data[i] * 0.2126 + data[i + 1] * 0.7152 + data[i + 2] * 0.0722) | 0;
  }
  return { data: out, width, height };
}

export function clamp8(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : v | 0;
}

/** Bilinear sample of an RGBA buffer at (x,y); returns [r,g,b,a]. Out-of-bounds -> edge clamp. */
export function sampleBilinear(img: RawImage, x: number, y: number): [number, number, number, number] {
  const { data, width, height } = img;
  const cx = x < 0 ? 0 : x > width - 1 ? width - 1 : x;
  const cy = y < 0 ? 0 : y > height - 1 ? height - 1 : y;
  const x0 = Math.floor(cx);
  const y0 = Math.floor(cy);
  const x1 = Math.min(x0 + 1, width - 1);
  const y1 = Math.min(y0 + 1, height - 1);
  const fx = cx - x0;
  const fy = cy - y0;
  const i00 = (y0 * width + x0) * 4;
  const i10 = (y0 * width + x1) * 4;
  const i01 = (y1 * width + x0) * 4;
  const i11 = (y1 * width + x1) * 4;
  const out: [number, number, number, number] = [0, 0, 0, 0];
  for (let c = 0; c < 4; c++) {
    const top = data[i00 + c] * (1 - fx) + data[i10 + c] * fx;
    const bot = data[i01 + c] * (1 - fx) + data[i11 + c] * fx;
    out[c] = top * (1 - fy) + bot * fy;
  }
  return out;
}
