import type { Empreinte } from '@/domain/doublons'
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

/** Origine du contact : d'où vient le numéro (utile pour le suivi et exigé par le RGPD). */
export type SourceContact =
  | 'affiche'
  | 'reperage'
  | 'immoweb'
  | '2ememain'
  | 'autre_site'
  | 'autre_agence'
  | 'recommandation'
  | 'ancien_client'
  | 'autre'

export const SOURCES_CONTACT: { code: SourceContact; libelle: string }[] = [
  { code: 'affiche', libelle: 'Affiche « à vendre » (fenêtre, panneau)' },
  { code: 'reperage', libelle: 'Repérage dans la rue' },
  { code: 'immoweb', libelle: 'Annonce Immoweb' },
  { code: '2ememain', libelle: 'Annonce 2ememain' },
  { code: 'autre_site', libelle: 'Autre site d’annonces' },
  { code: 'autre_agence', libelle: 'Bien chez une autre agence' },
  { code: 'recommandation', libelle: 'Recommandation' },
  { code: 'ancien_client', libelle: 'Ancien client' },
  { code: 'autre', libelle: 'Autre' },
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
  /** Origine du contact (facultatif). */
  source?: SourceContact | null
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
  _rechPhon: string
  _tri: string
  _empreinte: Empreinte
}

/** Fiches auxquelles on peut joindre des documents et des liens. */
export type EntiteLiee = 'contacts' | 'biens' | 'pistes'

/** Document (PDF, Word…) ou lien Internet (annonce Immoweb, site d'agence…) joint à une fiche. */
export interface PieceJointe extends Enregistrement {
  entite: EntiteLiee
  entiteId: string
  type: 'fichier' | 'lien'
  titre: string
  note: string
  /** Lien : adresse web. */
  url: string | null
  /** Fichier : nom d'origine, type et taille. */
  nomFichier: string | null
  mime: string | null
  taille: number | null
  /** Chemin dans le stockage serveur, rempli après l'envoi (étape 3). */
  cheminStockage: string | null
}

/** Contenu d'un fichier, conservé sur l'appareil (fonctionne hors ligne). */
export interface FichierLocal {
  id: string
  blob: Blob
}

export interface EntreeJournal {
  id?: number
  /** Identifiant unique partagé avec le serveur. */
  uid: string
  /** 1 = déjà envoyé au serveur (ou donnée de démo, jamais envoyée). */
  envoye: 0 | 1
  table: string
  rowId: string
  /** « creation », « archivage », « restauration » ou nom du champ modifié. */
  champ: string
  avant: unknown
  apres: unknown
  auteur: string | null
  appareil: string
  at: string
  /** Conflit de synchronisation : « avant » = valeur perdante, « après » = valeur gardée. */
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
