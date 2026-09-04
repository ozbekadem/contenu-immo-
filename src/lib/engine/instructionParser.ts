import type { ToneParams } from "./color";
import type { DeclutterLevel } from "../ai/provider";

export type ParsedAction =
  | { type: "tone"; tone: Partial<ToneParams>; label: string }
  | { type: "sky_enhance"; label: string }
  | { type: "sky_replace"; style: string; label: string }
  | { type: "contour"; label: string }
  | { type: "declutter"; level: DeclutterLevel; label: string }
  | { type: "freeform"; instruction: string; label: string };

/**
 * Keyword-based router for the free-form "Que souhaitez-vous modifier ?"
 * box: maps recognizable photographic requests onto the deterministic
 * pipeline (never invents pixels), and only falls back to the generative
 * AI provider for requests that genuinely require content changes. This
 * keeps the retouche/modification-IA distinction (section 46) honest even
 * for free text.
 */
export function parseInstruction(text: string): ParsedAction[] {
  const t = text.toLowerCase();
  const actions: ParsedAction[] = [];

  if (/(éclairc|plus lumineu|augmenter la lumin|plus clair)/.test(t)) {
    actions.push({ type: "tone", tone: { exposure: 0.35, shadowLift: 0.45 }, label: "Instruction : éclaircir" });
  }
  if (/(assombri|moins lumineu|trop clair)/.test(t)) {
    actions.push({ type: "tone", tone: { exposure: -0.3, highlightRecover: 0.4 }, label: "Instruction : assombrir" });
  }
  if (/(plus de contraste|augmenter le contraste)/.test(t)) {
    actions.push({ type: "tone", tone: { contrast: 0.18 }, label: "Instruction : contraste" });
  }
  if (/(hdr|professionnel et naturel|rendu professionnel)/.test(t)) {
    actions.push({
      type: "tone",
      tone: { shadowLift: 0.45, highlightRecover: 0.45, clarity: 0.2, contrast: 0.1 },
      label: "Instruction : rendu HDR immobilier",
    });
  }
  if (/(chaleureu|plus chaude|golden hour|lumière dorée)/.test(t)) {
    actions.push({ type: "tone", tone: { warmth: 0.25, saturation: 0.05 }, label: "Instruction : ambiance chaleureuse" });
  }
  if (/(contour|entourer|mettre en évidence|surligner)/.test(t) && /(maison|bien|façade|propriété)/.test(t)) {
    actions.push({ type: "contour", label: "Instruction : contour du bien" });
  }
  if (/(ranger|désencombr|enlever le désordre)/.test(t)) {
    const level: DeclutterLevel = /(complet|tout enlever)/.test(t) ? "complet" : /(léger|un peu)/.test(t) ? "leger" : "standard";
    actions.push({ type: "declutter", level, label: "Instruction : ranger la pièce" });
  }
  if (/(ciel).*(dégag|bleu|beau|ensoleill)|(ajouter).*(ciel)/.test(t)) {
    actions.push({ type: "sky_replace", style: "clear natural blue sky, a few soft clouds", label: "Instruction : ciel dégagé" });
  } else if (/(am[ée]liore).*(ciel)/.test(t)) {
    actions.push({ type: "sky_enhance", label: "Instruction : améliorer le ciel" });
  }

  const hasRecognized = actions.length > 0;
  const needsGenerative = /(supprim|enlever|retirer|ajouter un|ajoute une|ajoute des|remplacer)/.test(t);

  if (!hasRecognized || needsGenerative) {
    actions.push({ type: "freeform", instruction: text, label: `Instruction : "${text.slice(0, 60)}"` });
  }

  return actions;
}
