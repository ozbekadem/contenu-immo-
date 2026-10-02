import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { LinkimmoDB } from '../db'
import { ContactRepository, contactVide } from './contacts'
import { EvenementRepository, evenementVide } from './evenements'
import { fusionnerContacts } from './fusion'
import { InteractionRepository } from './interactions'
import { PieceJointeRepository } from './piecesJointes'

let db: LinkimmoDB
beforeEach(() => {
  db = new LinkimmoDB(`test-${crypto.randomUUID()}`)
})

describe('Fusion de deux fiches', () => {
  it('tout est rattaché à la fiche gardée, l’autre est archivée avec une note', async () => {
    const contacts = new ContactRepository(db)
    const garde = await contacts.creer({ ...contactVide(), prenom: 'Marc', nom: 'Dupont', telephones: [{ numero: '0472 18 90 33' }] })
    const autre = await contacts.creer({ ...contactVide(), nom: 'Dupond', telephones: [{ numero: '0472189033' }], emails: ['marc@x.be'] })
    const i = await new InteractionRepository(db).creer({ contactId: autre.id, pisteId: null, type: 'appel', resultat: 'interesse', commentaire: 'Veut vendre', date: new Date().toISOString(), relanceAt: null, numero: null })
    const e = await new EvenementRepository(db).creer({ ...evenementVide(new Date()), contactId: autre.id })
    const doc = await new PieceJointeRepository(db).ajouterLien('contacts', autre.id, { url: 'https://www.immoweb.be/fr/annonce/1' })

    await fusionnerContacts(garde.id, autre.id, db)

    const g = (await contacts.get(garde.id))!
    expect(g.emails).toEqual(['marc@x.be'])
    expect(g.telephones).toHaveLength(1)
    expect((await db.interactions.get(i.id))!.contactId).toBe(garde.id)
    expect((await db.evenements.get(e.id))!.contactId).toBe(garde.id)
    expect((await db.piecesJointes.get(doc.id))!.entiteId).toBe(garde.id)
    const a = (await contacts.get(autre.id))!
    expect(a.archivedAt).not.toBeNull()
    expect(a.notes).toMatch(/fusionnée avec Marc Dupont/)
    expect(await db.contacts.count()).toBe(2) // jamais effacée
  })
})
