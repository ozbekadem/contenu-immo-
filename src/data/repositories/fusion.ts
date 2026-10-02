import { fusionnerDonnees } from '@/domain/fusion'
import { db as dbDefaut, type LinkimmoDB } from '../db'
import { EnvoiRepository } from './communication'
import { ContactRepository } from './contacts'
import { EvenementRepository } from './evenements'
import { InteractionRepository } from './interactions'
import { PieceJointeRepository } from './piecesJointes'
import { PisteRepository } from './pistes'

/**
 * Fusionne deux fiches contact en une seule : la fiche gardée est complétée (rien n'est perdu),
 * tout ce qui était relié à l'autre fiche lui est rattaché, puis l'autre fiche est archivée
 * (jamais effacée) avec une note. Chaque changement passe par le journal et la synchronisation.
 */
export async function fusionnerContacts(gardeId: string, autreId: string, db: LinkimmoDB = dbDefaut): Promise<void> {
  if (gardeId === autreId) return
  const contacts = new ContactRepository(db)
  const repos = {
    interactions: new InteractionRepository(db),
    pistes: new PisteRepository(db),
    evenements: new EvenementRepository(db),
    pieces: new PieceJointeRepository(db),
    envois: new EnvoiRepository(db),
  }
  const tables = [db.contacts, db.interactions, db.pistes, db.evenements, db.piecesJointes, db.envois, db.journal, db.outbox]
  await db.transaction('rw', tables, async () => {
    const [garde, autre] = await Promise.all([contacts.get(gardeId), contacts.get(autreId)])
    if (!garde || !autre) throw new Error('Fiche introuvable')
    await contacts.modifier(gardeId, fusionnerDonnees(garde, autre))
    for (const i of await db.interactions.where('contactId').equals(autreId).toArray()) await repos.interactions.modifier(i.id, { contactId: gardeId })
    for (const p of await db.pistes.where('contactId').equals(autreId).toArray()) await repos.pistes.modifier(p.id, { contactId: gardeId })
    for (const e of await db.evenements.where('contactId').equals(autreId).toArray()) await repos.evenements.modifier(e.id, { contactId: gardeId })
    for (const e of await db.envois.where('contactId').equals(autreId).toArray()) await repos.envois.modifier(e.id, { contactId: gardeId })
    for (const d of await db.piecesJointes.where('[entite+entiteId]').equals(['contacts', autreId]).toArray()) await repos.pieces.modifier(d.id, { entiteId: gardeId })
    const nom = [garde.prenom, garde.nom].filter(Boolean).join(' ') || 'une autre fiche'
    await contacts.modifier(autreId, { notes: [autre.notes.trim(), `Fiche fusionnée avec ${nom} le ${new Date().toLocaleDateString('fr-BE')}.`].filter(Boolean).join('\n\n') })
    await contacts.archiver(autreId)
  })
}
