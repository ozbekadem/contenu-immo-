import { statutApres } from '@/domain/prospection'
import { appliquerResultat, RESULTATS, type CodeResultat } from '@/domain/resultats'
import { db as dbDefaut, type LinkimmoDB } from '../db'
import type { Interaction, TypeInteraction } from '../types'
import { RepositoryBase } from './base'
import { ContactRepository } from './contacts'
import { PisteRepository } from './pistes'

export interface SaisieResultat {
  /** Contact concerné (null pour une piste dont le propriétaire est inconnu). */
  contactId: string | null
  /** Piste de prospection concernée : c'est elle qui porte le suivi (relance, étape). */
  pisteId?: string | null
  type: TypeInteraction
  resultat: CodeResultat
  commentaire?: string
  /** undefined = relance proposée par défaut pour ce résultat ; null = aucune relance. */
  relance?: Date | null
  numero?: string | null
  quand?: Date
}

export class InteractionRepository extends RepositoryBase<Interaction> {
  private readonly contacts: ContactRepository
  private readonly pistes: PisteRepository

  constructor(db: LinkimmoDB = dbDefaut) {
    super(db, db.interactions, 'interactions')
    this.contacts = new ContactRepository(db)
    this.pistes = new PisteRepository(db)
  }

  protected deriver(i: Interaction): Interaction {
    return i
  }

  /** Historique d'un contact (toutes ses pistes comprises), du plus récent au plus ancien. */
  async pour(contactId: string): Promise<Interaction[]> {
    const liste = await this.db.interactions.where('contactId').equals(contactId).toArray()
    return liste.filter((i) => !i.archivedAt).sort((a, b) => b.date.localeCompare(a.date))
  }

  /** Historique d'une piste. */
  async pourPiste(pisteId: string): Promise<Interaction[]> {
    const liste = await this.db.interactions.where('pisteId').equals(pisteId).toArray()
    return liste.filter((i) => !i.archivedAt).sort((a, b) => b.date.localeCompare(a.date))
  }

  /**
   * Enregistre le résultat d'un échange en une seule fois : l'interaction dans l'historique
   * et la mise à jour du suivi du contact (dernier contact, prochaine relance, tentatives…).
   */
  async enregistrerResultat(s: SaisieResultat): Promise<Interaction> {
    const tables = [this.db.contacts, this.db.pistes, this.db.interactions, this.db.journal, this.db.outbox]
    return this.db.transaction('rw', tables, async () => {
      const quand = s.quand ?? new Date()
      const contact = s.contactId ? await this.db.contacts.get(s.contactId) : undefined
      if (s.contactId && !contact) throw new Error('Contact introuvable')
      const piste = s.pisteId ? await this.db.pistes.get(s.pisteId) : undefined
      if (s.pisteId && !piste) throw new Error('Piste introuvable')
      const demo = !!(contact?._demo || piste?._demo)

      let relanceFinale: string | null = null

      if (piste) {
        // La piste porte le suivi de la prospection : relance, étape, tentatives.
        const suivi = appliquerResultat(
          {
            dernierContactAt: piste.dernierContactAt,
            prochaineRelanceAt: piste.prochaineRelanceAt,
            dernierResultatPositif: piste.dernierResultatPositif,
            nePasContacter: false,
            tentatives: piste.tentatives,
            temperature: piste.temperature,
            statuts: [],
          },
          s.resultat,
          quand,
          s.relance,
        )
        relanceFinale = suivi.prochaineRelanceAt
        if (s.resultat !== 'note')
          await this.pistes.modifier(piste.id, {
            dernierContactAt: suivi.dernierContactAt,
            prochaineRelanceAt: suivi.prochaineRelanceAt,
            dernierResultatPositif: suivi.dernierResultatPositif,
            tentatives: suivi.tentatives,
            temperature: suivi.temperature,
            dernierResultat: s.resultat,
            statut: statutApres(piste.statut, s.resultat),
            alerte: null,
          })
        else if (s.relance !== undefined) await this.pistes.modifier(piste.id, { prochaineRelanceAt: suivi.prochaineRelanceAt })
      }

      if (contact) {
        // Sans piste : le contact porte son propre suivi (portefeuille).
        // Avec une piste : on met seulement à jour le dernier contact et le statut (client).
        const suivi = appliquerResultat(
          {
            dernierContactAt: contact.dernierContactAt,
            prochaineRelanceAt: contact.prochaineRelanceAt,
            dernierResultatPositif: contact.dernierResultatPositif,
            nePasContacter: contact.nePasContacter,
            tentatives: contact.tentatives ?? 0,
            temperature: contact.temperature,
            statuts: contact.statuts,
          },
          s.resultat,
          quand,
          piste ? (contact.prochaineRelanceAt ? new Date(contact.prochaineRelanceAt) : null) : s.relance,
        )
        if (!piste) relanceFinale = suivi.prochaineRelanceAt
        const patch = piste
          ? {
              dernierContactAt: suivi.dernierContactAt,
              tentatives: suivi.tentatives,
              statuts: suivi.statuts,
              nePasContacter: suivi.nePasContacter,
              ...(RESULTATS[s.resultat].joint ? { temperature: suivi.temperature } : {}),
            }
          : suivi
        await this.contacts.modifier(contact.id, patch as never)
      }

      return this.creer(
        {
          contactId: s.contactId,
          pisteId: s.pisteId ?? null,
          type: s.type,
          resultat: s.resultat,
          commentaire: (s.commentaire ?? '').trim(),
          date: quand.toISOString(),
          relanceAt: relanceFinale,
          numero: s.numero ?? null,
        },
        { demo },
      )
    })
  }
}

export const interactions = new InteractionRepository()
