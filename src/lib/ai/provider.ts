import type { Environment, SceneType } from "../types";
import type { Rect } from "../engine/outline";

export interface SceneGuess {
  scene: SceneType;
  environment: Environment;
  confidence: number; // 0..1
  source: "heuristic" | "vision-ai";
}

export type DeclutterLevel = "leger" | "standard" | "complet";

export interface GenerativeResult {
  ok: boolean;
  buffer?: Buffer;
  message: string;
}

/**
 * Pluggable interface for every generative / content-aware operation
 * (object removal, object addition, sky replacement, virtual staging,
 * decluttering, scene classification). Concrete implementations call out
 * to a real image AI API; when none is configured, `NoopProvider` returns a
 * clear "not configured" result instead of silently no-op'ing so the UI can
 * tell the user exactly what to set up.
 */
export interface AIProvider {
  readonly name: string;
  readonly configured: boolean;

  classifyScene(imagePath: string): Promise<SceneGuess>;

  removeObject(imagePath: string, area: Rect, instruction?: string): Promise<GenerativeResult>;

  addObject(imagePath: string, area: Rect, instruction: string): Promise<GenerativeResult>;

  replaceSky(imagePath: string, style: string): Promise<GenerativeResult>;

  virtualStaging(imagePath: string, style: string, roomType: string): Promise<GenerativeResult>;

  declutter(imagePath: string, level: DeclutterLevel): Promise<GenerativeResult>;

  /** Free-form instruction routed to the generative backend (used when the
   * text clearly requests a modification, not a photographic retouch). */
  freeformEdit(imagePath: string, instruction: string): Promise<GenerativeResult>;
}
