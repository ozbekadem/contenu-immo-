import type { AIProvider } from "./provider";
import { OpenAIProvider } from "./openaiProvider";
import { NoopProvider } from "./noopProvider";

let cached: AIProvider | null = null;

/** Selects the active generative-AI provider. Add new providers here (e.g.
 * Replicate/Stability for inpainting, Anthropic for vision) without
 * touching any call site — everything talks to the AIProvider interface. */
export function getAIProvider(): AIProvider {
  if (cached) return cached;
  cached = process.env.OPENAI_API_KEY ? new OpenAIProvider() : new NoopProvider();
  return cached;
}
