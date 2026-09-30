/**
 * Horloge logique hybride (HLC) : horodatage qui reste ordonné même si l'horloge
 * d'un appareil est en retard ou en avance. Format comparable comme du texte :
 *   « 000001759222800000-00000-a1b2c3d4 » (millisecondes - compteur - appareil)
 */
export interface EtatHlc {
  ms: number
  compteur: number
  appareil: string
}

export function formaterHlc({ ms, compteur, appareil }: EtatHlc): string {
  return `${String(ms).padStart(15, '0')}-${String(compteur).padStart(5, '0')}-${appareil}`
}

export function lireHlc(texte: string): EtatHlc {
  const [ms, compteur, appareil] = texte.split('-')
  return { ms: Number(ms), compteur: Number(compteur), appareil: appareil ?? '' }
}

export class Horloge {
  private dernier: EtatHlc

  constructor(
    appareil: string,
    private readonly maintenant: () => number = Date.now,
  ) {
    this.dernier = { ms: 0, compteur: 0, appareil }
  }

  /** Nouvel horodatage pour une modification locale. */
  tic(): string {
    const phys = this.maintenant()
    if (phys > this.dernier.ms) this.dernier = { ...this.dernier, ms: phys, compteur: 0 }
    else this.dernier = { ...this.dernier, compteur: this.dernier.compteur + 1 }
    return formaterHlc(this.dernier)
  }

  /** Intègre un horodatage reçu d'un autre appareil pour ne jamais « revenir en arrière ». */
  recevoir(distant: string): void {
    const d = lireHlc(distant)
    const phys = this.maintenant()
    const ms = Math.max(phys, this.dernier.ms, d.ms)
    let compteur = 0
    if (ms === this.dernier.ms && ms === d.ms) compteur = Math.max(this.dernier.compteur, d.compteur) + 1
    else if (ms === this.dernier.ms) compteur = this.dernier.compteur + 1
    else if (ms === d.ms) compteur = d.compteur + 1
    this.dernier = { ms, compteur, appareil: this.dernier.appareil }
  }
}
