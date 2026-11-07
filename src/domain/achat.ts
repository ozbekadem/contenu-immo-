/**
 * Achat par un marchand de biens : combien peut-on payer un bien pour garder sa marge,
 * et quel rendement s'il est mis en location. Calculs purs, sans arrondi caché :
 * l'écran arrondit à l'affichage.
 */

/** Ce que l'agence veut obtenir d'une piste : un mandat de vente, ou acheter le bien elle-même. */
export type Objectif = 'mandat' | 'achat'

/** Activité réglée dans les Paramètres. « Les deux » : l'objectif se choisit piste par piste. */
export type Activite = 'agence' | 'marchand' | 'les_deux'

export const ACTIVITES: { code: Activite; libelle: string; detail: string }[] = [
  { code: 'agence', libelle: 'Agence', detail: 'Obtenir des mandats de vente (les maisons vides restent des achats possibles).' },
  { code: 'marchand', libelle: 'Marchand de biens', detail: 'Acheter, rénover et revendre ou louer.' },
  { code: 'les_deux', libelle: 'Les deux', detail: 'Choisir « mandat » ou « achat » pour chaque piste.' },
]

/** Objectif proposé pour une nouvelle piste. */
export function objectifParDefaut(categorie: 'annonce' | 'maison_vide', activite: Activite): Objectif {
  if (activite === 'marchand' || categorie === 'maison_vide') return 'achat'
  return 'mandat'
}

// ─── État du bien ──────────────────────────────────────────────────────────
export type EtatBien = 'a_renover' | 'a_rafraichir' | 'bon'

export const ETATS_BIEN: { code: EtatBien; libelle: string; travauxM2: number }[] = [
  // Ordres de grandeur 2026 en Wallonie, TVA comprise ; à ajuster dans la calculette.
  { code: 'a_renover', libelle: 'À rénover', travauxM2: 1000 },
  { code: 'a_rafraichir', libelle: 'À rafraîchir', travauxM2: 400 },
  { code: 'bon', libelle: 'Bon état', travauxM2: 100 },
]

export const CLASSES_PEB = ['A++', 'A+', 'A', 'B', 'C', 'D', 'E', 'F', 'G'] as const
export type ClassePeb = (typeof CLASSES_PEB)[number]

// ─── Calculette « prix maximum » ───────────────────────────────────────────
/** Hypothèses de la calculette (enregistrées sur la piste ; les vides prennent les valeurs par défaut). */
export interface HypothesesAchat {
  /** Prix de revente estimé après travaux (€). */
  revente: number | null
  /** Travaux au m² (€) ; à défaut, selon l'état du bien. */
  travauxM2: number | null
  /** Travaux au forfait (€) : remplace le calcul au m² quand il est rempli. */
  travauxForfait: number | null
  /** Droits d'enregistrement (% du prix d'achat). */
  droitsPct: number | null
  /** Notaire et frais d'acte (% du prix d'achat). */
  notairePct: number | null
  /** Frais de revente : commission, PEB, certificats (% du prix de revente). */
  fraisReventePct: number | null
  /** Durée entre l'achat et la revente (mois). */
  portageMois: number | null
  /** Coût annuel de l'argent (crédit ou fonds propres, %). */
  tauxAnnuelPct: number | null
  /** Marge visée (% du prix de revente). */
  margePct: number | null
}

export const HYPOTHESES_DEFAUT = {
  droitsPct: 12.5, // Wallonie, taux normal ; taux réduit des marchands de biens : à régler dans les Paramètres
  notairePct: 2.5,
  fraisReventePct: 3,
  portageMois: 9,
  tauxAnnuelPct: 5,
  margePct: 15,
} as const

export function hypothesesVides(): HypothesesAchat {
  return {
    revente: null,
    travauxM2: null,
    travauxForfait: null,
    droitsPct: null,
    notairePct: null,
    fraisReventePct: null,
    portageMois: null,
    tauxAnnuelPct: null,
    margePct: null,
  }
}

export interface DonneesBienAchat {
  surface: number | null
  etat: EtatBien | null
  /** Prix demandé par le vendeur (€), s'il est connu. */
  prixDemande: number | null
  /** Commission d'un apporteur d'affaires (€). */
  commissionApporteur: number
  /** Droits d'enregistrement par défaut (Paramètres), en %. */
  droitsParDefaut?: number
}

export interface Valeurs {
  revente: number
  travaux: number
  droitsPct: number
  notairePct: number
  fraisReventePct: number
  portageMois: number
  tauxAnnuelPct: number
  margePct: number
  commission: number
}

/** Hypothèses complétées par les valeurs par défaut ; null si le prix de revente manque. */
export function valeurs(h: HypothesesAchat, b: DonneesBienAchat): Valeurs | null {
  if (!h.revente || h.revente <= 0) return null
  const m2 = h.travauxM2 ?? (b.etat ? ETATS_BIEN.find((e) => e.code === b.etat)!.travauxM2 : 0)
  const travaux = h.travauxForfait ?? (b.surface ? b.surface * m2 : 0)
  return {
    revente: h.revente,
    travaux,
    droitsPct: h.droitsPct ?? b.droitsParDefaut ?? HYPOTHESES_DEFAUT.droitsPct,
    notairePct: h.notairePct ?? HYPOTHESES_DEFAUT.notairePct,
    fraisReventePct: h.fraisReventePct ?? HYPOTHESES_DEFAUT.fraisReventePct,
    portageMois: h.portageMois ?? HYPOTHESES_DEFAUT.portageMois,
    tauxAnnuelPct: h.tauxAnnuelPct ?? HYPOTHESES_DEFAUT.tauxAnnuelPct,
    margePct: h.margePct ?? HYPOTHESES_DEFAUT.margePct,
    commission: b.commissionApporteur,
  }
}

export interface Bilan {
  prixAchat: number
  frais: number
  travaux: number
  portage: number
  commission: number
  fraisRevente: number
  /** Tout ce qui est dépensé avant la revente (achat, frais, travaux, portage, commission). */
  coutTotal: number
  revente: number
  marge: number
  /** Marge en % du prix de revente. */
  margePct: number
}

/** Bilan complet si l'on achète au prix `prixAchat`. Le portage porte sur l'achat, ses frais et les travaux. */
export function bilan(prixAchat: number, v: Valeurs): Bilan {
  const frais = (prixAchat * (v.droitsPct + v.notairePct)) / 100
  const portage = ((prixAchat + frais + v.travaux) * v.tauxAnnuelPct * v.portageMois) / 1200
  const fraisRevente = (v.revente * v.fraisReventePct) / 100
  const coutTotal = prixAchat + frais + v.travaux + portage + v.commission
  const marge = v.revente - fraisRevente - coutTotal
  return { prixAchat, frais, travaux: v.travaux, portage, commission: v.commission, fraisRevente, coutTotal, revente: v.revente, marge, margePct: (marge / v.revente) * 100 }
}

/**
 * Prix d'achat maximum pour garder la marge visée :
 * revente − frais de revente − marge − travaux − commission − portage des travaux
 * = prix × (1 + frais d'achat) × (1 + coût du portage).
 */
export function prixMaximum(v: Valeurs): number {
  const fa = (v.droitsPct + v.notairePct) / 100
  const k = (v.tauxAnnuelPct * v.portageMois) / 1200
  const disponible = v.revente * (1 - v.fraisReventePct / 100 - v.margePct / 100) - v.travaux * (1 + k) - v.commission
  return Math.max(0, disponible / ((1 + fa) * (1 + k)))
}

export interface ResultatCalcul {
  valeurs: Valeurs
  prixMax: number
  /** Bilan au prix maximum (marge = marge visée). */
  auMax: Bilan
  /** Bilan au prix demandé, s'il est connu. */
  auPrixDemande: Bilan | null
  /** Écart entre le prix demandé et le prix maximum (€ ; positif = le vendeur demande trop). */
  ecart: number | null
}

export function calculerAchat(h: HypothesesAchat, b: DonneesBienAchat): ResultatCalcul | null {
  const v = valeurs(h, b)
  if (!v) return null
  const prixMax = prixMaximum(v)
  return {
    valeurs: v,
    prixMax,
    auMax: bilan(prixMax, v),
    auPrixDemande: b.prixDemande ? bilan(b.prixDemande, v) : null,
    ecart: b.prixDemande ? b.prixDemande - prixMax : null,
  }
}

/** Arrondi « à l'offre » : au millier inférieur (on n'offre pas 143 287 €). */
export function arrondiOffre(prix: number): number {
  return Math.floor(prix / 1000) * 1000
}

// ─── Location (immeuble de rapport, maison à louer) ────────────────────────
export interface Rendement {
  /** Loyers annuels / coût total. */
  brutPct: number
  /** (Loyers − charges) / coût total. */
  netPct: number
  loyersAnnuels: number
  coutTotal: number
}

/**
 * Rendement locatif pour un achat à `prixAchat` (frais d'achat et travaux compris dans le coût).
 * `charges` : précompte, assurance, entretien, gestion, vide locatif… par an.
 */
export function rendement(prixAchat: number, loyersMensuels: number, chargesAnnuelles: number, v: Pick<Valeurs, 'droitsPct' | 'notairePct' | 'travaux'>): Rendement | null {
  if (!loyersMensuels || prixAchat <= 0) return null
  const coutTotal = prixAchat * (1 + (v.droitsPct + v.notairePct) / 100) + v.travaux
  const loyersAnnuels = loyersMensuels * 12
  return { loyersAnnuels, coutTotal, brutPct: (loyersAnnuels / coutTotal) * 100, netPct: ((loyersAnnuels - chargesAnnuelles) / coutTotal) * 100 }
}

// ─── Offres ────────────────────────────────────────────────────────────────
export type EtatOffre = 'en_attente' | 'contre_offre' | 'acceptee' | 'refusee' | 'remplacee'

export const LIBELLE_ETAT_OFFRE: Record<EtatOffre, string> = {
  en_attente: 'En attente',
  contre_offre: 'Contre-offre',
  acceptee: 'Acceptée',
  refusee: 'Refusée',
  remplacee: 'Remplacée',
}

export interface Offre {
  id: string
  /** Date de l'offre (ISO). */
  date: string
  montant: number
  /** Fin de validité de l'offre (« AAAA-MM-JJ »), facultative. */
  valableJusquau: string | null
  etat: EtatOffre
  /** Montant demandé par le vendeur en retour. */
  contreOffre: number | null
  note: string
}

/** Dernière offre encore en discussion (en attente ou contre-offre), la plus récente d'abord. */
export function offreEnCours(offres: Offre[] | undefined): Offre | null {
  const ouvertes = (offres ?? []).filter((o) => o.etat === 'en_attente' || o.etat === 'contre_offre')
  return ouvertes.sort((a, b) => b.date.localeCompare(a.date))[0] ?? null
}

/** Nouvelle offre (ou offre acceptée) : les offres encore en discussion sont remplacées. */
export function cloreOffresOuvertes(offres: Offre[], saufId?: string): Offre[] {
  return offres.map((o) => (o.id !== saufId && (o.etat === 'en_attente' || o.etat === 'contre_offre') ? { ...o, etat: 'remplacee' as const } : o))
}

/** Relance proposée après une offre : la veille de sa fin de validité, sinon dans 5 jours (9 h). */
export function relanceOffre(offre: Pick<Offre, 'valableJusquau'>, depuis: Date): Date {
  let r: Date
  if (offre.valableJusquau) {
    const [a, m, j] = offre.valableJusquau.split('-').map(Number)
    r = new Date(a!, m! - 1, j! - 1, 9)
    if (r <= depuis) r = new Date(a!, m! - 1, j!, 9)
  } else {
    r = new Date(depuis.getFullYear(), depuis.getMonth(), depuis.getDate() + 5, 9)
  }
  return r
}

/** Suggestion de prix de revente : le haut de la fourchette Statbel (les biens en bon état se vendent dans le quart le plus cher). */
export function reventeSuggeree(p: { mediane: number | null; p75: number | null } | null): number | null {
  if (!p) return null
  return p.p75 ?? p.mediane ?? null
}
