import { frequenceVeille, prochaineVeille, type CategoriePiste } from '@/domain/prospection'
import { normaliserTelephone } from '@/domain/telephone'
import { db as dbDefaut, type LinkimmoDB } from '../db'
import { deriverPiste } from '../derives'
import type { Adresse, Piste, SourceContact, TypeBien } from '../types'
import { RepositoryBase, type Donnees } from './base'
import { BienRepository, bienVide } from './biens'
import { ContactRepository, contactVide } from './contacts'
import { PhotoRepository, type PhotoCompressee } from './photos'

export type DonneesPiste = Donnees<Piste>

/** Tout ce qu'on saisit sur le terrain, en quelques secondes. Seule la catégorie est choisie d'office. */
export interface SaisieTerrain {
  categorie: CategoriePiste
  source: SourceContact | null
  telephone: string
  nomProprietaire: string
  adresse: Adresse | null
  position: { lat: number; lng: number; precision: number } | null
  /** Adresse à retrouver plus tard (repérage hors ligne). */
  adresseAChercher: boolean
  typeBien: TypeBien | null
  prix: number | null
  sourceUrl: string | null
  indices: string[]
  notes: string
  photos: PhotoCompressee[]
  /** Bien déjà connu (doublon confirmé par l'utilisateur) : on ajoute une piste sur ce bien. */
  bienExistantId?: string | null
  /** Contact déjà connu (même téléphone) : on le relie au lieu d'en créer un autre. */
  contactExistantId?: string | null
}

export function pisteVide(categorie: CategoriePiste, bienId: string): DonneesPiste {
  return {
    categorie,
    bienId,
    contactId: null,
    statut: 'a_contacter',
    source: null,
    sourceUrl: null,
    prix: null,
    historiquePrix: [],
    enVenteDepuis: null,
    indices: [],
    datesCles: [],
    veilleProchaine: null,
    veilleEtat: 'actif',
    alerte: null,
    temperature: null,
    dernierContactAt: null,
    prochaineRelanceAt: null,
    dernierResultatPositif: false,
    dernierResultat: null,
    tentatives: 0,
    notes: '',
    collaborateurId: null,
  }
}

export class PisteRepository extends RepositoryBase<Piste> {
  private readonly biens: BienRepository
  private readonly contacts: ContactRepository
  private readonly photos: PhotoRepository

  constructor(db: LinkimmoDB = dbDefaut) {
    super(db, db.pistes, 'pistes')
    this.biens = new BienRepository(db)
    this.contacts = new ContactRepository(db)
    this.photos = new PhotoRepository(db)
  }

  protected deriver(p: Piste): Piste {
    return deriverPiste(p)
  }

  /**
   * Repérage terrain : crée (ou réutilise) le bien, le propriétaire s'il a un numéro,
   * la piste et les photos, en une seule opération — y compris sans réseau.
   * Relance : à appeler aujourd'hui s'il y a un numéro ; sinon (propriétaire inconnu),
   * rechercher le propriétaire dans 14 jours.
   */
  async creerDepuisTerrain(s: SaisieTerrain, options: { demo?: boolean; maintenant?: Date } = {}): Promise<Piste> {
    const maintenant = options.maintenant ?? new Date()
    const demo = !!options.demo
    const tables = [this.db.biens, this.db.pistes, this.db.contacts, this.db.photos, this.db.photosLocales, this.db.journal, this.db.outbox]
    return this.db.transaction('rw', tables, async () => {
      const bienId =
        s.bienExistantId ??
        (
          await this.biens.creer(
            {
              ...bienVide(),
              adresse: s.adresse,
              lat: s.position?.lat ?? null,
              lng: s.position?.lng ?? null,
              precisionGps: s.position ? Math.round(s.position.precision) : null,
              adresseAChercher: s.adresseAChercher,
              type: s.typeBien,
            },
            { demo },
          )
        ).id

      let contactId = s.contactExistantId ?? null
      const tel = s.telephone.trim()
      if (!contactId && (tel || s.nomProprietaire.trim())) {
        const nom = s.nomProprietaire.trim()
        const contact = await this.contacts.creer(
          {
            ...contactVide(),
            nom,
            telephones: tel ? [{ numero: tel, libelle: s.source === 'affiche' ? 'Lu sur l’affiche' : undefined }] : [],
            adresse: s.categorie === 'maison_vide' ? null : s.adresse,
            statuts: ['prospect_vendeur'],
            source: s.source,
          },
          { demo },
        )
        contactId = contact.id
      }

      // Bien déjà suivi par une piste en cours du même type : on complète cette piste
      // au lieu d'en créer une deuxième (un seul suivi par bien).
      if (s.bienExistantId) {
        const enCours = (await this.duBien(s.bienExistantId)).find(
          (p) => p.categorie === s.categorie && !p.archivedAt && p.statut !== 'gagne' && p.statut !== 'perdu',
        )
        if (enCours) {
          const note = s.notes.trim()
          const complement: Partial<DonneesPiste> = {}
          if (!enCours.contactId && contactId) complement.contactId = contactId
          if (!enCours.sourceUrl && s.sourceUrl) complement.sourceUrl = s.sourceUrl
          if (!enCours.prix && s.prix) {
            complement.prix = s.prix
            complement.historiquePrix = [...enCours.historiquePrix, { date: maintenant.toISOString(), prix: s.prix }]
          }
          const indices = [...new Set([...enCours.indices, ...s.indices])]
          if (indices.length !== enCours.indices.length) complement.indices = indices
          if (note) complement.notes = enCours.notes ? `${enCours.notes}\n${note}` : note
          const piste = Object.keys(complement).length ? await this.modifier(enCours.id, complement) : enCours
          if (s.photos.length) await this.photos.ajouter(s.bienExistantId, piste.id, s.photos, { demo })
          return piste
        }
      }

      const avecLien = !!s.sourceUrl
      const joignable = !!contactId && (!!tel || !!s.contactExistantId)
      const relance = joignable ? maintenant : new Date(maintenant.getTime() + 14 * 86_400_000)
      if (relance.getHours() < 9) relance.setHours(9, 0, 0, 0) // pas d'appel avant 9 h
      const veille = s.categorie === 'annonce' && (avecLien || s.source === 'affiche' || s.source === 'reperage')

      const piste = await this.creer(
        {
          ...pisteVide(s.categorie, bienId),
          contactId,
          source: s.source,
          sourceUrl: s.sourceUrl,
          prix: s.prix,
          historiquePrix: s.prix ? [{ date: maintenant.toISOString(), prix: s.prix }] : [],
          enVenteDepuis: s.categorie === 'annonce' ? maintenant.toISOString() : null,
          indices: s.indices,
          veilleProchaine: veille ? prochaineVeille(avecLien, maintenant) : null,
          prochaineRelanceAt: relance.toISOString(),
          notes: s.notes.trim(),
        },
        { demo },
      )
      if (s.photos.length) await this.photos.ajouter(bienId, piste.id, s.photos, { demo })
      return piste
    })
  }

  /** Pistes reliées à ce téléphone (via le contact) ou à cette annonce. */
  async parAnnonce(cle: string): Promise<Piste[]> {
    return this.db.pistes.where('_cleAnnonce').equals(cle).toArray()
  }

  async duBien(bienId: string): Promise<Piste[]> {
    return this.db.pistes.where('bienId').equals(bienId).toArray()
  }

  async duContact(contactId: string): Promise<Piste[]> {
    return this.db.pistes.where('contactId').equals(contactId).toArray()
  }

  // ─── Veille des annonces et des affiches ──────────────────────────────────
  async veilleToujoursLa(p: Piste, maintenant = new Date()): Promise<Piste> {
    return this.modifier(p.id, { veilleProchaine: prochaineVeille(!!p.sourceUrl, maintenant), veilleEtat: 'actif' })
  }

  /** Nouveau prix : historique complété ; une baisse déclenche un appel aujourd'hui. */
  async veillePrix(p: Piste, prix: number, maintenant = new Date()): Promise<Piste> {
    const baisse = p.prix != null && prix < p.prix
    const patch: Partial<DonneesPiste> = {
      prix,
      historiquePrix: [...p.historiquePrix, { date: maintenant.toISOString(), prix }],
      veilleProchaine: prochaineVeille(!!p.sourceUrl, maintenant),
      veilleEtat: 'actif',
    }
    if (baisse) {
      patch.alerte = `Prix baissé de ${new Intl.NumberFormat('fr-BE').format(p.prix! - prix)} €`
      patch.prochaineRelanceAt = maintenant.toISOString()
    }
    return this.modifier(p.id, patch)
  }

  /** Annonce retirée, affiche disparue ou panneau d'agence apparu : à appeler aujourd'hui. */
  async veilleChangement(p: Piste, etat: 'retiree' | 'disparue' | 'agence', maintenant = new Date()): Promise<Piste> {
    const alerte = { retiree: 'Annonce retirée', disparue: 'Affiche disparue', agence: 'Panneau d’agence apparu' }[etat]
    return this.modifier(p.id, {
      veilleEtat: etat,
      veilleProchaine: null,
      alerte,
      prochaineRelanceAt: maintenant.toISOString(),
      ...(etat === 'agence' ? { source: 'autre_agence' as const } : {}),
    })
  }
}

export { frequenceVeille }
export const pistes = new PisteRepository()

/** Téléphone saisi → contacts existants avec ce numéro (doublon). */
export async function contactsAvecTelephone(tel: string, db: LinkimmoDB = dbDefaut) {
  const n = normaliserTelephone(tel)
  return n ? db.contacts.where('_telNorm').equals(n).toArray() : []
}
