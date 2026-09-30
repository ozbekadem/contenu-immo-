import { ajouterJours, ecartJours } from './dates'
import type { CodeResultat } from './resultats'

// ─── Pistes ────────────────────────────────────────────────────────────────
export type CategoriePiste = 'annonce' | 'maison_vide'

/** Étape de la piste dans l'entonnoir : Repéré → Appelé → RDV/Visite → Signé (ou perdu). */
export type StatutPiste = 'a_contacter' | 'en_cours' | 'rdv' | 'gagne' | 'perdu'

export const LIBELLE_STATUT: Record<StatutPiste, string> = {
  a_contacter: 'Repéré',
  en_cours: 'Appelé',
  rdv: 'RDV / visite',
  gagne: 'Signé',
  perdu: 'Abandonné',
}

/** Nouvelle étape de la piste après un résultat (on n'avance jamais « à reculons », sauf abandon). */
export function statutApres(statut: StatutPiste, resultat: CodeResultat): StatutPiste {
  if (resultat === 'mandat' || resultat === 'accord') return 'gagne'
  if (resultat === 'ne_pas_rappeler') return 'perdu'
  if (statut === 'gagne' || statut === 'perdu') return statut
  if (resultat === 'rdv' || resultat === 'visite') return 'rdv'
  const joint = ['interesse', 'rappeler', 'pas_interesse', 'pas_vendeur', 'message_envoye'].includes(resultat)
  if (joint && statut === 'a_contacter') return 'en_cours'
  return statut
}

// ─── Indices d'inoccupation (maisons vides) ─────────────────────────────────
export const INDICES_INOCCUPATION: { code: string; libelle: string }[] = [
  { code: 'boite_pleine', libelle: 'Boîte aux lettres pleine' },
  { code: 'volets_fermes', libelle: 'Volets toujours fermés' },
  { code: 'jardin', libelle: 'Jardin à l’abandon' },
  { code: 'lumiere', libelle: 'Jamais de lumière le soir' },
  { code: 'vitres', libelle: 'Vitres sales ou cassées' },
  { code: 'facade', libelle: 'Façade ou toiture abîmée' },
  { code: 'compteurs', libelle: 'Compteurs coupés / scellés' },
  { code: 'affiche_ancienne', libelle: 'Vieille affiche « à vendre / à louer »' },
]

/** « Maison vide probable » : de 0 à 100 selon le nombre d'indices observés. */
export function scoreInoccupation(indices: string[]): number {
  const connus = indices.filter((i) => INDICES_INOCCUPATION.some((x) => x.code === i))
  return Math.round((connus.length / INDICES_INOCCUPATION.length) * 100)
}

// ─── Dates clés (fin de bail, fin de mandat…) ───────────────────────────────
export type TypeDateCle = 'fin_bail' | 'fin_mandat' | 'succession' | 'pension' | 'travaux' | 'separation' | 'autre'

export interface DateCle {
  id: string
  type: TypeDateCle
  /** « AAAA-MM-JJ » */
  date: string
  note: string
}

/** Libellé et préavis : combien de jours AVANT la date il faut rappeler. */
export const TYPES_DATE_CLE: Record<TypeDateCle, { libelle: string; preavisJours: number }> = {
  fin_bail: { libelle: 'Fin de bail', preavisJours: 42 },
  fin_mandat: { libelle: 'Fin du mandat d’une autre agence', preavisJours: 7 },
  succession: { libelle: 'Succession réglée', preavisJours: 14 },
  pension: { libelle: 'Départ à la pension', preavisJours: 60 },
  travaux: { libelle: 'Fin de travaux', preavisJours: 7 },
  separation: { libelle: 'Séparation / divorce', preavisJours: 30 },
  autre: { libelle: 'Autre date importante', preavisJours: 14 },
}

function jourLocal(d: string): Date {
  const [a, m, j] = d.split('-').map(Number)
  return new Date(a!, m! - 1, j!, 9)
}

/** Date de rappel d'une date clé (préavis avant la date), jamais dans le passé. */
export function rappelDateCle(dc: DateCle, maintenant: Date): Date {
  const rappel = ajouterJours(jourLocal(dc.date), -TYPES_DATE_CLE[dc.type].preavisJours)
  return rappel < maintenant ? maintenant : rappel
}

/**
 * Prochaine relance après l'ajout d'une date clé : la date clé avance la relance
 * si elle arrive plus tôt (ou s'il n'y en avait pas). Les dates passées sont ignorées.
 */
export function relanceAvecDateCle(prochaineRelanceAt: string | null, dc: DateCle, maintenant: Date): string | null {
  if (jourLocal(dc.date) < maintenant) return prochaineRelanceAt
  const rappel = rappelDateCle(dc, maintenant)
  if (!prochaineRelanceAt || rappel < new Date(prochaineRelanceAt)) return rappel.toISOString()
  return prochaineRelanceAt
}

/** Date clé à venir la plus proche (pour « Qui appeler en premier »). */
export function prochaineDateCle(dates: DateCle[] | undefined, maintenant: Date): { dc: DateCle; jours: number } | null {
  const futures = (dates ?? [])
    .map((dc) => ({ dc, jours: ecartJours(maintenant, jourLocal(dc.date)) }))
    .filter((x) => x.jours >= 0)
    .sort((a, b) => a.jours - b.jours)
  return futures[0] ?? null
}

// ─── Veille des annonces et des affiches ────────────────────────────────────
export type EtatVeille = 'actif' | 'retiree' | 'disparue' | 'agence'

/** Fréquence de revérification : annonce en ligne toutes les 2 semaines, affiche tous les mois. */
export function frequenceVeille(avecLien: boolean): number {
  return avecLien ? 14 : 30
}

export function prochaineVeille(avecLien: boolean, depuis: Date): string {
  return ajouterJours(depuis, frequenceVeille(avecLien)).toISOString()
}

export interface PointPrix {
  date: string
  prix: number
}

/** Dernière baisse de prix (montant et date), si elle date de moins de `jours` jours. */
export function baisseRecente(historique: PointPrix[] | undefined, maintenant: Date, jours = 30): { montant: number; il_y_a: number } | null {
  const h = [...(historique ?? [])].sort((a, b) => a.date.localeCompare(b.date))
  if (h.length < 2) return null
  const dernier = h[h.length - 1]!
  const precedent = h[h.length - 2]!
  const ilYa = ecartJours(new Date(dernier.date), maintenant)
  if (dernier.prix >= precedent.prix || ilYa > jours) return null
  return { montant: precedent.prix - dernier.prix, il_y_a: ilYa }
}

export function prixLisible(p: number | null | undefined): string {
  if (p == null) return ''
  return `${new Intl.NumberFormat('fr-BE', { maximumFractionDigits: 0 }).format(p)} €`
}

// ─── Identifiant d'annonce (doublon « même annonce collée deux fois ») ─────
/** Identifiant stable d'une annonce à partir de son lien (Immoweb, 2ememain, Zimmo…), sinon le lien nettoyé. */
export function cleAnnonce(url: string | null | undefined): string | null {
  if (!url) return null
  let u: URL
  try {
    u = new URL(url)
  } catch {
    return null
  }
  const hote = u.hostname.replace(/^www\./, '').replace(/^m\./, '')
  const chemin = u.pathname.replace(/\/+$/, '')
  if (hote.endsWith('immoweb.be')) {
    const id = chemin.match(/\/(\d{6,})$/)?.[1]
    if (id) return `immoweb:${id}`
  }
  if (hote.endsWith('2ememain.be')) {
    const id = chemin.match(/\/(m\d{6,})/)?.[1]
    if (id) return `2ememain:${id}`
  }
  if (hote.endsWith('zimmo.be')) {
    const id = chemin.match(/\/([A-Z0-9]{5,})$/i)?.[1]
    if (id) return `zimmo:${id.toUpperCase()}`
  }
  return `${hote}${chemin}`.toLowerCase()
}

// ─── Distance (« Autour de moi », même bien à moins de 25 m) ───────────────
export function distanceMetres(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6_371_000
  const rad = (x: number) => (x * Math.PI) / 180
  const dLat = rad(b.lat - a.lat)
  const dLng = rad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

export function distanceLisible(m: number): string {
  return m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(1).replace('.', ',')} km`
}

// ─── Photos ────────────────────────────────────────────────────────────────
/** Dimensions après réduction : le plus grand côté ne dépasse pas `max` (1600 px), jamais d'agrandissement. */
export function dimensionsReduites(largeur: number, hauteur: number, max: number): { largeur: number; hauteur: number } {
  const plusGrand = Math.max(largeur, hauteur)
  if (plusGrand <= max) return { largeur, hauteur }
  const f = max / plusGrand
  return { largeur: Math.round(largeur * f), hauteur: Math.round(hauteur * f) }
}
