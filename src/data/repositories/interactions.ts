import { appliquerResultat, type CodeResultat } from '@/domain/resultats'
import { db as dbDefaut, type LinkimmoDB } from '../db'
import type { Interaction, TypeInteraction } from '../types'
import { RepositoryBase } from './base'
import { ContactRepository } from './contacts'

export interface SaisieResultat {
  contactId: string
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

  constructor(db: LinkimmoDB = dbDefaut) {
    super(db, db.interactions, 'interactions')
    this.contacts = new ContactRepository(db)
  }

  protected deriver(i: Interaction): Interaction {
    return i
  }

  /** Historique d'un contact, du plus récent au plus ancien. */
  async pour(contactId: string): Promise<Interaction[]> {
    const liste = await this.db.interactions.where('contactId').equals(contactId).toArray()
    return liste.filter((i) => !i.archivedAt).sort((a, b) => b.date.localeCompare(a.date))
  }

  /**
   * Enregistre le résultat d'un échange en une seule fois : l'interaction dans l'historique
   * et la mise à jour du suivi du contact (dernier contact, prochaine relance, tentatives…).
   */
  async enregistrerResultat(s: SaisieResultat): Promise<Interaction> {
    return this.db.transaction('rw', [this.db.contacts, this.db.interactions, this.db.journal, this.db.outbox], async () => {
      const contact = await this.db.contacts.get(s.contactId)
      if (!contact) throw new Error('Contact introuvable')
      const quand = s.quand ?? new Date()
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
        s.relance,
      )
      const interaction = await this.creer(
        {
          contactId: s.contactId,
          type: s.type,
          resultat: s.resultat,
          commentaire: (s.commentaire ?? '').trim(),
          date: quand.toISOString(),
          relanceAt: suivi.prochaineRelanceAt,
          numero: s.numero ?? null,
        },
        { demo: !!contact._demo },
      )
      await this.contacts.modifier(s.contactId, suivi as never)
      return interaction
    })
  }
}

export const interactions = new InteractionRepository()
