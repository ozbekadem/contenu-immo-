import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { LinkimmoDB } from '../db'
import { ContactRepository, contactVide } from './contacts'
import { InteractionRepository } from './interactions'

let db: LinkimmoDB
let contacts: ContactRepository
let repo: InteractionRepository

beforeEach(() => {
  db = new LinkimmoDB(`test-${crypto.randomUUID()}`)
  contacts = new ContactRepository(db)
  repo = new InteractionRepository(db)
})

describe('InteractionRepository', () => {
  it('enregistre l’appel et met à jour le suivi du contact en une fois', async () => {
    const c = await contacts.creer({ ...contactVide(), nom: 'Hermans', telephones: [{ numero: '0468127740' }] })
    const quand = new Date(2026, 8, 30, 14)
    await repo.enregistrerResultat({ contactId: c.id, type: 'appel', resultat: 'pas_reponse', quand })
    await repo.enregistrerResultat({ contactId: c.id, type: 'appel', resultat: 'rdv', commentaire: 'RDV jeudi 10 h', quand: new Date(2026, 8, 30, 18) })

    const maj = (await contacts.get(c.id))!
    expect(maj.tentatives).toBe(0)
    expect(maj.dernierContactAt).toBe(new Date(2026, 8, 30, 18).toISOString())
    expect(maj.temperature).toBe('chaud')
    const histo = await repo.pour(c.id)
    expect(histo.map((i) => i.resultat)).toEqual(['rdv', 'pas_reponse'])
    expect(histo[0]!.commentaire).toBe('RDV jeudi 10 h')
    // Interaction + contact partent au serveur ; tout est au journal
    expect((await db.outbox.toArray()).map((o) => o.table)).toContain('interactions')
  })

  it('les échanges avec un contact de démo restent locaux', async () => {
    const c = await contacts.creer({ ...contactVide(), nom: 'Démo' }, { demo: true })
    await repo.enregistrerResultat({ contactId: c.id, type: 'appel', resultat: 'interesse' })
    expect(await db.outbox.count()).toBe(0)
  })
})
