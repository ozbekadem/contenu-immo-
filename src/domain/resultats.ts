import { ajouterJours, ajouterMois } from './dates'
import type { Canal } from './telephone'

export type CodeResultat =
  | 'interesse'
  | 'rdv'
  | 'mandat'
  | 'rappeler'
  | 'pas_reponse'
  | 'messagerie'
  | 'pas_interesse'
  | 'numero_errone'
  | 'ne_pas_rappeler'
  | 'message_envoye'
  | 'note'
  // Maisons vides
  | 'visite'
  | 'accord'
  | 'introuvable'
  | 'pas_vendeur'

export interface DefinitionResultat {
  code: CodeResultat
  libelle: string
  /** La personne a été jointe (met à jour « Dernier contact »). */
  joint: boolean
  positif: boolean
  /** Tentative sans réponse (compteur de tentatives). */
  tentative: boolean
  /** Prochaine relance proposée par défaut (null = aucune). */
  relanceParDefaut: ((depuis: Date) => Date) | null
  ton: 'positif' | 'neutre' | 'negatif'
}

const demain9h = (d: Date) => {
  const r = ajouterJours(d, 1)
  r.setHours(9, 0, 0, 0)
  return r
}

export const RESULTATS: Record<CodeResultat, DefinitionResultat> = {
  interesse: { code: 'interesse', libelle: 'Intéressé', joint: true, positif: true, tentative: false, relanceParDefaut: (d) => ajouterJours(d, 7), ton: 'positif' },
  rdv: { code: 'rdv', libelle: 'RDV obtenu', joint: true, positif: true, tentative: false, relanceParDefaut: (d) => ajouterJours(d, 7), ton: 'positif' },
  mandat: { code: 'mandat', libelle: 'Mandat signé', joint: true, positif: true, tentative: false, relanceParDefaut: (d) => ajouterMois(d, 1), ton: 'positif' },
  rappeler: { code: 'rappeler', libelle: 'Rappeler plus tard', joint: true, positif: false, tentative: false, relanceParDefaut: (d) => ajouterMois(d, 1), ton: 'neutre' },
  pas_reponse: { code: 'pas_reponse', libelle: 'Pas de réponse', joint: false, positif: false, tentative: true, relanceParDefaut: demain9h, ton: 'neutre' },
  messagerie: { code: 'messagerie', libelle: 'Message laissé', joint: false, positif: false, tentative: true, relanceParDefaut: (d) => ajouterJours(d, 2), ton: 'neutre' },
  pas_interesse: { code: 'pas_interesse', libelle: 'Pas intéressé', joint: true, positif: false, tentative: false, relanceParDefaut: (d) => ajouterMois(d, 6), ton: 'negatif' },
  numero_errone: { code: 'numero_errone', libelle: 'Numéro erroné', joint: false, positif: false, tentative: false, relanceParDefaut: null, ton: 'negatif' },
  ne_pas_rappeler: { code: 'ne_pas_rappeler', libelle: 'Ne plus rappeler', joint: true, positif: false, tentative: false, relanceParDefaut: null, ton: 'negatif' },
  message_envoye: { code: 'message_envoye', libelle: 'Message envoyé', joint: true, positif: false, tentative: false, relanceParDefaut: (d) => ajouterJours(d, 3), ton: 'neutre' },
  note: { code: 'note', libelle: 'Note', joint: false, positif: false, tentative: false, relanceParDefaut: null, ton: 'neutre' },
  visite: { code: 'visite', libelle: 'Visite obtenue', joint: true, positif: true, tentative: false, relanceParDefaut: (d) => ajouterJours(d, 7), ton: 'positif' },
  accord: { code: 'accord', libelle: 'Accord d’achat', joint: true, positif: true, tentative: false, relanceParDefaut: (d) => ajouterMois(d, 1), ton: 'positif' },
  introuvable: { code: 'introuvable', libelle: 'Propriétaire introuvable', joint: false, positif: false, tentative: false, relanceParDefaut: (d) => ajouterJours(d, 14), ton: 'neutre' },
  pas_vendeur: { code: 'pas_vendeur', libelle: 'Pas vendeur', joint: true, positif: false, tentative: false, relanceParDefaut: (d) => ajouterMois(d, 6), ton: 'negatif' },
}

/**
 * Résultats proposés après une action, dans l'ordre d'affichage, selon la catégorie de prospection :
 * annonces (objectif mandat) ou maisons vides (objectif achat en privé).
 */
export function resultatsPour(canal: Canal | 'note', categorie: 'portefeuille' | 'annonce' | 'maison_vide' = 'portefeuille'): CodeResultat[] {
  if (categorie === 'maison_vide') {
    if (canal === 'appel') return ['visite', 'rappeler', 'pas_reponse', 'messagerie', 'accord', 'introuvable', 'pas_vendeur', 'numero_errone', 'ne_pas_rappeler']
    if (canal === 'note') return ['note', 'visite', 'rappeler', 'accord', 'introuvable', 'pas_vendeur', 'ne_pas_rappeler']
    return ['message_envoye', 'visite', 'rappeler', 'accord', 'pas_vendeur', 'numero_errone', 'ne_pas_rappeler']
  }
  if (canal === 'appel') return ['rdv', 'interesse', 'rappeler', 'pas_reponse', 'messagerie', 'pas_interesse', 'mandat', 'numero_errone', 'ne_pas_rappeler']
  if (canal === 'note') return ['note', 'rdv', 'interesse', 'rappeler', 'pas_interesse', 'mandat', 'ne_pas_rappeler']
  return ['message_envoye', 'rdv', 'interesse', 'rappeler', 'pas_interesse', 'mandat', 'numero_errone', 'ne_pas_rappeler']
}

export interface EtatSuiviContact {
  dernierContactAt: string | null
  prochaineRelanceAt: string | null
  dernierResultatPositif: boolean
  nePasContacter: boolean
  tentatives: number
  temperature: 'chaud' | 'tiede' | 'froid' | null
  statuts: string[]
}

/**
 * Nouvel état de suivi d'un contact après un résultat.
 * `relance` : choisie par l'utilisateur (undefined = proposition par défaut, null = aucune).
 */
export function appliquerResultat(
  etat: EtatSuiviContact,
  code: CodeResultat,
  quand: Date,
  relance?: Date | null,
): EtatSuiviContact {
  const r = RESULTATS[code]
  const prochaine = relance === undefined ? (r.relanceParDefaut?.(quand) ?? etat.prochaineRelanceAt) : relance
  const suivant: EtatSuiviContact = {
    ...etat,
    prochaineRelanceAt: prochaine instanceof Date ? prochaine.toISOString() : (prochaine ?? null),
  }
  if (code === 'note') return suivant
  if (r.joint) {
    suivant.dernierContactAt = quand.toISOString()
    suivant.tentatives = 0
    suivant.dernierResultatPositif = r.positif
  }
  if (r.tentative) suivant.tentatives = etat.tentatives + 1
  if (code === 'pas_interesse' || code === 'pas_vendeur') suivant.temperature = 'froid'
  if (code === 'rdv' || code === 'mandat' || code === 'visite' || code === 'accord') suivant.temperature = 'chaud'
  // Mandat signé ou accord d'achat : le prospect devient client (vendeur), sans ressaisie.
  if ((code === 'mandat' || code === 'accord') && !etat.statuts.includes('vendeur'))
    suivant.statuts = [...etat.statuts.filter((s) => s !== 'prospect_vendeur'), 'vendeur']
  if (code === 'ne_pas_rappeler') {
    suivant.nePasContacter = true
    suivant.prochaineRelanceAt = null
  }
  return suivant
}
