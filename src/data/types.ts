import type { Empreinte } from '@/domain/doublons'
import type { CategoriePiste, DateCle, EtatVeille, PointPrix, StatutPiste } from '@/domain/prospection'
import type { CasArgumentaire, Objection } from '@/domain/argumentaires'
import type { CodeResultat } from '@/domain/resultats'
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
  /** Appels consécutifs sans réponse (remis à zéro dès que la personne est jointe). */
  tentatives?: number
  /** Dates importantes (fin de bail, pension…) qui déclenchent une relance au bon moment. */
  datesCles?: DateCle[]
  // Champs locaux calculés
  _telNorm: string[]
  _recherche: string
  _rechPhon: string
  _tri: string
  _empreinte: Empreinte
}

export type TypeInteraction = Canal | 'note' | 'visite' | 'rdv' | 'courrier'

/** Échange avec un contact (appel, SMS, WhatsApp, email, note…), daté et signé. */
export interface Interaction extends Enregistrement {
  /** Contact concerné (null pour une piste dont le propriétaire est encore inconnu). */
  contactId: string | null
  type: TypeInteraction
  resultat: CodeResultat
  commentaire: string
  /** Date de l'échange (ISO). */
  date: string
  /** Relance planifiée à l'issue de l'échange (ISO), pour l'historique. */
  relanceAt: string | null
  /** Numéro utilisé (E.164) le cas échéant. */
  numero: string | null
  /** Piste de prospection concernée (annonce, maison vide), le cas échéant. */
  pisteId?: string | null
}

export type TypeBien = 'maison' | 'appartement' | 'immeuble' | 'terrain' | 'commerce' | 'autre'

export const TYPES_BIEN: { code: TypeBien; libelle: string }[] = [
  { code: 'maison', libelle: 'Maison' },
  { code: 'appartement', libelle: 'Appartement' },
  { code: 'immeuble', libelle: 'Immeuble de rapport' },
  { code: 'terrain', libelle: 'Terrain' },
  { code: 'commerce', libelle: 'Commerce' },
  { code: 'autre', libelle: 'Autre' },
]

/** Bien immobilier (une seule fiche par bien, même s'il arrive par plusieurs sources). */
export interface Bien extends Enregistrement {
  adresse: Adresse | null
  lat: number | null
  lng: number | null
  /** Précision du GPS en mètres. */
  precisionGps: number | null
  /** Adresse à retrouver automatiquement dès que le réseau revient (repérage hors ligne). */
  adresseAChercher: boolean
  type: TypeBien | null
  facades: number | null
  chambres: number | null
  notes: string
  // Champs locaux calculés
  _cleAdresse: string | null
}

/** Piste de prospection : une annonce de particulier ou une maison vide, suivie dans le temps. */
export interface Piste extends Enregistrement {
  categorie: CategoriePiste
  bienId: string
  /** Propriétaire / vendeur (peut être encore inconnu). */
  contactId: string | null
  statut: StatutPiste
  source: SourceContact | null
  /** Lien de l'annonce en ligne, le cas échéant. */
  sourceUrl: string | null
  prix: number | null
  historiquePrix: PointPrix[]
  /** Première fois que le bien a été vu en vente (« en vente depuis X jours »). */
  enVenteDepuis: string | null
  indices: string[]
  datesCles: DateCle[]
  /** Veille : prochaine vérification de l'annonce ou de l'affiche, et son état. */
  veilleProchaine: string | null
  veilleEtat: EtatVeille
  /** Raison d'une relance urgente (« Annonce retirée », « Prix baissé »…). */
  alerte: string | null
  temperature: Temperature | null
  dernierContactAt: string | null
  prochaineRelanceAt: string | null
  dernierResultatPositif: boolean
  dernierResultat: CodeResultat | null
  tentatives: number
  notes: string
  collaborateurId: string | null
  // Champs locaux calculés
  _cleAnnonce: string | null
}

/** Photo d'un bien (compressée sur l'appareil, envoyée ensuite au serveur). */
export interface Photo extends Enregistrement {
  bienId: string
  pisteId: string | null
  largeur: number
  hauteur: number
  prisLe: string
  cheminStockage: string | null
  miniatureStockage: string | null
}

/** Contenu d'une photo gardé sur l'appareil (fonctionne hors ligne). */
export interface PhotoLocale {
  id: string
  image: Blob | null
  miniature: Blob | null
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

/** Argumentaire d'appel modifié par l'agence (remplace le texte d'origine, partagé avec l'équipe). */
export interface ArgumentairePerso extends Enregistrement {
  cas: CasArgumentaire
  accroche: string
  points: string[]
  objections: Objection[]
}

export type TypeEvenement = 'rdv' | 'visite' | 'estimation' | 'signature' | 'autre'

export const TYPES_EVENEMENT: { code: TypeEvenement; libelle: string }[] = [
  { code: 'rdv', libelle: 'Rendez-vous' },
  { code: 'estimation', libelle: 'Estimation' },
  { code: 'visite', libelle: 'Visite' },
  { code: 'signature', libelle: 'Signature' },
  { code: 'autre', libelle: 'Autre' },
]

/** Rendez-vous, visite, estimation… (les relances, elles, viennent des fiches). */
export interface Evenement extends Enregistrement {
  type: TypeEvenement
  titre: string
  /** ISO */
  debut: string
  /** ISO */
  fin: string
  /** Toute la journée (événement créé dans Google sans heure). */
  journee: boolean
  lieu: string
  notes: string
  contactId: string | null
  pisteId: string | null
  bienId: string | null
  collaborateurId: string | null
  /** Identifiant de l'événement dans Google Agenda, s'il y a été créé à l'origine. */
  googleEventId: string | null
}

/** Lien local entre un élément de l'application et son événement Google Agenda (jamais synchronisé). */
export interface LienGoogle {
  /** « relance:contacts:<id> », « relance:pistes:<id> » ou « evenement:<id> » */
  cle: string
  eventId: string
  /** Empreinte du contenu envoyé (pour n'envoyer que ce qui a changé). */
  signature: string
  /** Champ « updated » de Google après notre dernier envoi ou import. */
  majGoogle: string
}
