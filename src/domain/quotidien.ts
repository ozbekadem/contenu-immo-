import { ajouterJours, debutJour, ecartJours } from './dates'
import { jourLocal, TYPES_DATE_CLE, type DateCle, type StatutPiste } from './prospection'

// ─── Entonnoir ───────────────────────────────────────────────────────────────
export const ETAPES_ENTONNOIR: StatutPiste[] = ['a_contacter', 'en_cours', 'rdv', 'gagne']

export interface Entonnoir {
  /** Nombre de pistes à chaque étape (hors abandonnées et archivées). */
  etapes: Record<StatutPiste, number>
  total: number
  /** Part des pistes terminées qui ont abouti (signées / signées + abandonnées), en %. */
  tauxReussite: number | null
}

export function entonnoir(pistes: { statut: StatutPiste; archivedAt: string | null }[]): Entonnoir {
  const etapes: Record<StatutPiste, number> = { a_contacter: 0, en_cours: 0, rdv: 0, gagne: 0, perdu: 0 }
  for (const p of pistes) if (!p.archivedAt) etapes[p.statut]++
  const terminees = etapes.gagne + etapes.perdu
  return {
    etapes,
    total: etapes.a_contacter + etapes.en_cours + etapes.rdv + etapes.gagne,
    tauxReussite: terminees ? Math.round((etapes.gagne / terminees) * 100) : null,
  }
}

// ─── Anniversaires ───────────────────────────────────────────────────────────
export type TypeAnniversaire = 'naissance' | 'signature'

export interface Anniversaire<T> {
  type: TypeAnniversaire
  quoi: T
  /** Jour de l'anniversaire (cette année ou l'an prochain), à 9 h. */
  date: Date
  /** 0 = aujourd'hui. */
  dans: number
  /** Âge atteint ou nombre d'années depuis la signature (null si l'année est inconnue). */
  annees: number | null
}

/** Prochaine occurrence d'un « MM-JJ » à partir d'aujourd'hui (le 29 février est fêté le 28 les autres années). */
function prochaineOccurrence(mois: number, jour: number, maintenant: Date): Date {
  const aujourdhui = debutJour(maintenant)
  for (const annee of [aujourdhui.getFullYear(), aujourdhui.getFullYear() + 1]) {
    const bissextile = new Date(annee, 1, 29).getMonth() === 1
    const j = mois === 2 && jour === 29 && !bissextile ? 28 : jour
    const d = new Date(annee, mois - 1, j, 9)
    if (debutJour(d) >= aujourdhui) return d
  }
  return new Date(aujourdhui.getFullYear() + 1, mois - 1, jour, 9)
}

/**
 * Anniversaires des 7 prochains jours : naissance des contacts (« AAAA-MM-JJ »)
 * et anniversaires de signature (mandat, vente) — de belles occasions de reprendre contact.
 */
export function anniversaires<T>(
  elements: { quoi: T; type: TypeAnniversaire; date: string | null | undefined }[],
  maintenant: Date,
  jours = 7,
): Anniversaire<T>[] {
  const liste: Anniversaire<T>[] = []
  for (const { quoi, type, date } of elements) {
    const m = date?.match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (!m) continue
    const annee = Number(m[1])
    const d = prochaineOccurrence(Number(m[2]), Number(m[3]), maintenant)
    const dans = ecartJours(maintenant, d)
    if (dans > jours) continue
    const annees = annee > 1900 ? d.getFullYear() - annee : null
    // Une signature de cette année n'est pas encore un anniversaire.
    if (type === 'signature' && (annees === null || annees < 1)) continue
    liste.push({ type, quoi, date: d, dans, annees })
  }
  return liste.sort((a, b) => a.dans - b.dans)
}

/** Message de vœux proposé (modifiable avant l'envoi). */
export function messageAnniversaire(a: { type: TypeAnniversaire; annees: number | null }, prenom: string, signature: string, agence?: string | null): string {
  const bonjour = prenom ? `Bonjour ${prenom}` : 'Bonjour'
  if (a.type === 'naissance')
    return `${bonjour}, ${agence ? `toute l’équipe de ${agence} vous souhaite` : 'je vous souhaite'} un très joyeux anniversaire ! ${signature}`.trim()
  const duree = a.annees === 1 ? 'un an' : `${a.annees} ans`
  return `${bonjour}, il y a ${duree}, nous signions ensemble. Merci encore pour votre confiance ! Si un proche a un projet immobilier, nous serons ravis de l’aider. ${signature}`.trim()
}

// ─── À maturité ──────────────────────────────────────────────────────────────
export interface Maturite<T> {
  quoi: T
  dc: DateCle
  /** Jours avant la date clé (négatif : passée depuis peu). */
  jours: number
}

/**
 * « Prospects à maturité » : la date clé (projet de vente, fin de bail, pension…) entre
 * dans sa période de préavis — c'est le bon moment pour rappeler. Les dates passées
 * depuis moins de 14 jours restent visibles.
 */
export function aMaturite<T>(elements: { quoi: T; datesCles: DateCle[] | undefined }[], maintenant: Date): Maturite<T>[] {
  const liste: Maturite<T>[] = []
  for (const { quoi, datesCles } of elements) {
    for (const dc of datesCles ?? []) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dc.date)) continue
      const date = jourLocal(dc.date)
      const jours = ecartJours(maintenant, date)
      const debut = ajouterJours(date, -TYPES_DATE_CLE[dc.type].preavisJours)
      if (debutJour(debut) <= debutJour(maintenant) && jours >= -14) liste.push({ quoi, dc, jours })
    }
  }
  return liste.sort((a, b) => a.jours - b.jours)
}

/** « dans 12 j », « aujourd'hui », « il y a 3 j ». */
export function quandLisible(jours: number): string {
  if (jours === 0) return 'aujourd’hui'
  if (jours === 1) return 'demain'
  if (jours > 0) return `dans ${jours} j`
  return `il y a ${-jours} j`
}
