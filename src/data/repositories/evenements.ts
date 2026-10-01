import { db as dbDefaut, type LinkimmoDB } from '../db'
import type { Evenement } from '../types'
import { RepositoryBase, type Donnees } from './base'

export type DonneesEvenement = Donnees<Evenement>

export function evenementVide(debut: Date, dureeMinutes = 60): DonneesEvenement {
  return {
    type: 'rdv',
    titre: '',
    debut: debut.toISOString(),
    fin: new Date(debut.getTime() + dureeMinutes * 60_000).toISOString(),
    journee: false,
    lieu: '',
    notes: '',
    contactId: null,
    pisteId: null,
    bienId: null,
    collaborateurId: null,
    googleEventId: null,
  }
}

export class EvenementRepository extends RepositoryBase<Evenement> {
  constructor(db: LinkimmoDB = dbDefaut) {
    super(db, db.evenements, 'evenements')
  }

  protected deriver(e: Evenement): Evenement {
    return e
  }

  /** Événements (non archivés) qui chevauchent la période [du, au[. */
  async entre(du: Date, au: Date): Promise<Evenement[]> {
    const liste = await this.db.evenements.where('debut').below(au.toISOString()).toArray()
    return liste.filter((e) => !e.archivedAt && new Date(e.fin) > du).sort((a, b) => a.debut.localeCompare(b.debut))
  }

  /** Rendez-vous à venir d'un contact ou d'une piste. */
  async aVenir(lien: { contactId?: string | null; pisteId?: string | null }, maintenant = new Date()): Promise<Evenement[]> {
    const liste = lien.pisteId
      ? await this.db.evenements.where('pisteId').equals(lien.pisteId).toArray()
      : lien.contactId
        ? await this.db.evenements.where('contactId').equals(lien.contactId).toArray()
        : []
    return liste.filter((e) => !e.archivedAt && new Date(e.fin) >= maintenant).sort((a, b) => a.debut.localeCompare(b.debut))
  }
}

export const evenements = new EvenementRepository()
