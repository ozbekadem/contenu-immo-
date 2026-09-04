import sharp from "sharp";
import type { AIProvider, GenerativeResult, SceneGuess } from "./provider";
import { classifySceneHeuristic } from "./heuristics";

const NOT_CONFIGURED =
  "Aucun fournisseur IA générative n'est configuré (variable d'environnement OPENAI_API_KEY absente). " +
  "Cette fonction nécessite un moteur d'inpainting/génération d'image pour fonctionner réellement — " +
  "elle est prête côté architecture mais ne peut pas produire de résultat tant qu'un fournisseur n'est pas branché.";

/** Default provider: does not fabricate results for generative edits, but
 * still provides the honest heuristic scene classification. */
export class NoopProvider implements AIProvider {
  readonly name = "aucun";
  readonly configured = false;

  async classifyScene(imagePath: string): Promise<SceneGuess> {
    return classifySceneHeuristic(sharp(imagePath));
  }

  async removeObject(): Promise<GenerativeResult> {
    return { ok: false, message: NOT_CONFIGURED };
  }
  async addObject(): Promise<GenerativeResult> {
    return { ok: false, message: NOT_CONFIGURED };
  }
  async replaceSky(): Promise<GenerativeResult> {
    return { ok: false, message: NOT_CONFIGURED };
  }
  async virtualStaging(): Promise<GenerativeResult> {
    return { ok: false, message: NOT_CONFIGURED };
  }
  async declutter(): Promise<GenerativeResult> {
    return { ok: false, message: NOT_CONFIGURED };
  }
  async freeformEdit(): Promise<GenerativeResult> {
    return { ok: false, message: NOT_CONFIGURED };
  }
}
