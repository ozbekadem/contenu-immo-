import sharp from "sharp";
import type { AIProvider, DeclutterLevel, GenerativeResult, SceneGuess } from "./provider";
import type { Rect } from "../engine/outline";
import { classifySceneHeuristic } from "./heuristics";
import { fromRaw, toRaw } from "../engine/raw";
import type { SceneType, Environment } from "../types";

const API_BASE = "https://api.openai.com/v1";
const EDIT_MODEL = process.env.OPENAI_IMAGE_MODEL || "gpt-image-1";
const VISION_MODEL = process.env.OPENAI_VISION_MODEL || "gpt-4o-mini";

const SCENE_TYPES: SceneType[] = [
  "salon", "salle_a_manger", "cuisine", "chambre", "salle_de_bains", "wc", "hall",
  "garage", "cave", "grenier", "commerce", "bureau", "facade", "jardin", "terrasse", "autre",
];

async function buildEditMask(imagePath: string, area: Rect | null): Promise<Buffer> {
  const meta = await sharp(imagePath).metadata();
  const width = meta.width ?? 1024;
  const height = meta.height ?? 1024;
  const data = Buffer.alloc(width * height * 4, 0);
  for (let i = 0; i < data.length; i += 4) data[i + 3] = 255; // opaque = protected

  if (area) {
    const x0 = Math.max(0, Math.round(area.x * width));
    const y0 = Math.max(0, Math.round(area.y * height));
    const x1 = Math.min(width, Math.round((area.x + area.w) * width));
    const y1 = Math.min(height, Math.round((area.y + area.h) * height));
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        data[(y * width + x) * 4 + 3] = 0; // transparent = editable region
      }
    }
  } else {
    data.fill(0); // fully transparent -> entire frame editable
  }
  return fromRaw({ data, width, height }).png().toBuffer();
}

async function buildSkyMask(imagePath: string): Promise<Buffer> {
  const raw = await toRaw(sharp(imagePath));
  const { data, width, height } = raw;
  const mask = Buffer.alloc(width * height * 4, 0);
  for (let i = 0; i < data.length; i += 4) mask[i + 3] = 255;
  for (let y = 0; y < height; y++) {
    const yFrac = y / height;
    if (yFrac > 0.65) continue;
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const bright = (r + g + b) / 3;
      const skyLike = (b >= r - 6 && b >= g - 10 && bright > 110) || (bright > 215 && Math.abs(r - g) < 18);
      if (skyLike) mask[i + 3] = 0;
    }
  }
  return fromRaw({ data: mask, width, height }).png().toBuffer();
}

async function callImagesEdit(
  imagePath: string,
  prompt: string,
  mask: Buffer | null
): Promise<GenerativeResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return { ok: false, message: "OPENAI_API_KEY manquant." };
  try {
    const imageBuffer = await sharp(imagePath).png().toBuffer();
    const form = new FormData();
    form.set("model", EDIT_MODEL);
    form.set("prompt", prompt);
    form.set("size", "1024x1024");
    form.set("n", "1");
    form.set("image", new Blob([new Uint8Array(imageBuffer)], { type: "image/png" }), "image.png");
    if (mask) form.set("mask", new Blob([new Uint8Array(mask)], { type: "image/png" }), "mask.png");

    const res = await fetch(`${API_BASE}/images/edits`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      return { ok: false, message: `Erreur fournisseur IA (${res.status}): ${text.slice(0, 300)}` };
    }
    const json = (await res.json()) as { data?: { b64_json?: string; url?: string }[] };
    const item = json.data?.[0];
    if (!item) return { ok: false, message: "Réponse du fournisseur IA vide." };

    let outBuffer: Buffer;
    if (item.b64_json) {
      outBuffer = Buffer.from(item.b64_json, "base64");
    } else if (item.url) {
      const imgRes = await fetch(item.url);
      outBuffer = Buffer.from(await imgRes.arrayBuffer());
    } else {
      return { ok: false, message: "Format de réponse IA inattendu." };
    }
    return { ok: true, buffer: outBuffer, message: "Modification IA appliquée." };
  } catch (err) {
    return { ok: false, message: `Échec de l'appel au fournisseur IA: ${(err as Error).message}` };
  }
}

export class OpenAIProvider implements AIProvider {
  readonly name = "openai";
  readonly configured = !!process.env.OPENAI_API_KEY;

  async classifyScene(imagePath: string): Promise<SceneGuess> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return classifySceneHeuristic(sharp(imagePath));
    try {
      const buf = await sharp(imagePath).resize({ width: 512, fit: "inside" }).jpeg({ quality: 70 }).toBuffer();
      const b64 = buf.toString("base64");
      const res = await fetch(`${API_BASE}/chat/completions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: VISION_MODEL,
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text:
                    "Classify this real-estate photo. Reply with strict JSON only: " +
                    `{"scene": one of [${SCENE_TYPES.join(",")}], "environment": "interieur" or "exterieur", "confidence": 0..1}.`,
                },
                { type: "image_url", image_url: { url: `data:image/jpeg;base64,${b64}` } },
              ],
            },
          ],
          temperature: 0,
        }),
      });
      if (!res.ok) return classifySceneHeuristic(sharp(imagePath));
      const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const content = json.choices?.[0]?.message?.content ?? "{}";
      const match = content.match(/\{[\s\S]*\}/);
      const parsed = JSON.parse(match ? match[0] : content) as {
        scene: SceneType;
        environment: Environment;
        confidence: number;
      };
      if (!SCENE_TYPES.includes(parsed.scene)) throw new Error("scene invalide");
      return { ...parsed, source: "vision-ai" };
    } catch {
      return classifySceneHeuristic(sharp(imagePath));
    }
  }

  async removeObject(imagePath: string, area: Rect, instruction?: string): Promise<GenerativeResult> {
    const mask = await buildEditMask(imagePath, area);
    const prompt =
      instruction?.trim() ||
      "Remove the object in the unmasked area, seamlessly reconstruct the background so it looks untouched. Photorealistic real-estate photography, keep everything else identical.";
    return callImagesEdit(imagePath, prompt, mask);
  }

  async addObject(imagePath: string, area: Rect, instruction: string): Promise<GenerativeResult> {
    const mask = await buildEditMask(imagePath, area);
    const prompt = `${instruction}. Match the room's real perspective, lighting and shadows. Photorealistic real-estate photography, keep everything outside the edited area identical.`;
    return callImagesEdit(imagePath, prompt, mask);
  }

  async replaceSky(imagePath: string, style: string): Promise<GenerativeResult> {
    const mask = await buildSkyMask(imagePath);
    const prompt = `Replace only the sky with: ${style}. Match the scene's existing light direction, color temperature and exposure so it reads as one natural photograph. Keep roofline, trees, chimneys, antennas and neighboring buildings untouched.`;
    return callImagesEdit(imagePath, prompt, mask);
  }

  async virtualStaging(imagePath: string, style: string, roomType: string): Promise<GenerativeResult> {
    const prompt = `Virtually stage this empty ${roomType} in a ${style} interior design style. Photorealistic furniture with correct scale, perspective, lighting and shadows. Keep walls, floor, windows, doors and fixed elements identical.`;
    return callImagesEdit(imagePath, prompt, null);
  }

  async declutter(imagePath: string, level: DeclutterLevel): Promise<GenerativeResult> {
    const scope: Record<DeclutterLevel, string> = {
      leger: "small loose items and visible trash only",
      standard: "clothes, boxes, small personal items and clutter on floors and surfaces",
      complet: "all clutter, boxes, clothes, personal items and temporary bulky items",
    };
    const prompt = `Tidy this room: remove ${scope[level]}. Keep furniture (sofas, tables, chairs, beds, cabinets), kitchen, sanitary fixtures, radiators, doors, windows, floors and walls exactly as they are. Do not remove visible damage, cracks, humidity or structural defects. Photorealistic result.`;
    return callImagesEdit(imagePath, prompt, null);
  }

  async freeformEdit(imagePath: string, instruction: string): Promise<GenerativeResult> {
    const prompt = `${instruction}. Photorealistic real-estate photography, keep the property's actual structure, fixed elements and proportions faithful to the original.`;
    return callImagesEdit(imagePath, prompt, null);
  }
}
