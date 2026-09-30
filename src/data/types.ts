import type { Canal } from '@/domain/telephone'
import type { Temperature } from '@/domain/relance'

/**
 * Champs communs à toutes les fiches synchronisées.
 * Les champs commençant par « _ » sont locaux (calculés sur l'appareil, jamais envoyés au serveur).
 */
export interface Enregistrement {
  id: string
  createdAt: string
  updatedAt: string
  createdBy: string | null
  updatedBy: string | null
  /** Archivage : la fiche est masquée mais jamais effacée. */
  archivedAt: string | null
  /** Horodatage HLC de la dernière modification de chaque champ (fusion champ par champ). */
  _ts: Record<string, string>
  /** Donnée de démonstration : locale, jamais synchronisée, supprimable en un clic. */
  _demo?: boolean
}

export type StatutContact =
  | 'prospect_vendeur'
  | 'vendeur'
  | 'acheteur'
  | 'locataire'
  | 'bailleur'
  | 'partenaire'
  | 'ancien_client'

export const STATUTS_CONTACT: { code: StatutContact; libelle: string }[] = [
  { code: 'prospect_vendeur', libelle: 'Prospect vendeur' },
  { code: 'vendeur', libelle: 'Vendeur' },
  { code: 'acheteur', libelle: 'Acheteur' },
  { code: 'locataire', libelle: 'Locataire' },
  { code: 'bailleur', libelle: 'Propriétaire bailleur' },
  { code: 'partenaire', libelle: 'Partenaire' },
  { code: 'ancien_client', libelle: 'Ancien client' },
]

export type Civilite = 'M.' | 'Mme' | 'M. et Mme' | ''

export interface Telephone {
  numero: string
  libelle?: string
}

export interface Adresse {
  rue: string
  numero: string
  boite: string
  cp: string
  ville: string
}

export interface AdresseArchivee extends Adresse {
  /** Date à laquelle l'adresse a été remplacée. */
  jusquau: string
}

export interface Contact extends Enregistrement {
  civilite: Civilite
  prenom: string
  nom: string
  societe: string
  telephones: Telephone[]
  emails: string[]
  adresse: Adresse | null
  /** Historique des adresses : jamais effacé. */
  anciennesAdresses: AdresseArchivee[]
  /** « AAAA-MM-JJ » */
  dateNaissance: string | null
  statuts: StatutContact[]
  temperature: Temperature | null
  canalPrefere: Canal | null
  utilisationCanaux: Partial<Record<Canal, number>>
  collaborateurId: string | null
  tags: string[]
  notes: string
  nePasContacter: boolean
  dernierContactAt: string | null
  prochaineRelanceAt: string | null
  dernierResultatPositif: boolean
  // Champs locaux calculés
  _telNorm: string[]
  _recherche: string
  _tri: string
}

export interface EntreeJournal {
  id?: number
  table: string
  rowId: string
  /** « creation », « archivage », « restauration » ou nom du champ modifié. */
  champ: string
  avant: unknown
  apres: unknown
  auteur: string | null
  appareil: string
  at: string
  /** Rempli à l'étape 3 : valeur perdante lors d'un conflit de synchronisation. */
  conflit?: boolean
}

/** Modification en attente d'envoi au serveur. */
export interface OperationSortante {
  seq?: number
  table: string
  rowId: string
  /** Champs modifiés → nouvelle valeur. */
  champs: Record<string, unknown>
  /** Champ → horodatage HLC. */
  ts: Record<string, string>
  creeLe: string
}
