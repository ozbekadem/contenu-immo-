import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { LinkimmoDB } from '../db'
import { ContactRepository, contactVide } from '../repositories/contacts'
import { EvenementRepository, evenementVide } from '../repositories/evenements'
import { FauxGoogle } from './faux'
import { SyncGoogle } from './moteur'
import { idGoogle } from './souhaites'

const maintenant = new Date('2026-10-01T08:00:00Z')
let google: FauxGoogle

function appareil() {
  const db = new LinkimmoDB(`test-${crypto.randomUUID()}`)
  const sync = new SyncGoogle(db, google.transport(), { origine: 'https://linkimmo.test', utilisateur: () => null, maintenant: () => maintenant })
  return { db, sync, contacts: new ContactRepository(db), evenements: new EvenementRepository(db) }
}

beforeEach(() => {
  google = new FauxGoogle()
})

describe('Google Agenda (dans les deux sens)', () => {
  it('une relance devient un événement « Linkimmo », mis à jour quand elle change', async () => {
    const a = appareil()
    const c = await a.contacts.creer({ ...contactVide(), prenom: 'Marc', nom: 'Dupont', telephones: [{ numero: '0472 18 90 33' }], prochaineRelanceAt: '2026-10-02T08:00:00.000Z' })
    expect(await a.sync.synchroniser()).toMatchObject({ envoyes: 1 })
    const ev = google.evenements.get(idGoogle('rc', c.id))!
    expect(ev).toMatchObject({ summary: '📞 Relancer Marc Dupont', start: { dateTime: '2026-10-02T08:00:00.000Z', timeZone: 'Europe/Brussels' } })
    expect(ev.description).toContain('+32472189033')
    expect(ev.description).toContain(`https://linkimmo.test/contacts/${c.id}`)

    expect(await a.sync.synchroniser()).toEqual({ envoyes: 0, supprimes: 0, recus: 0 }) // rien de changé : rien envoyé
    await a.contacts.modifier(c.id, { prochaineRelanceAt: '2026-10-05T07:00:00.000Z' })
    await a.sync.synchroniser()
    expect(google.evenements.get(idGoogle('rc', c.id))!.start!.dateTime).toBe('2026-10-05T07:00:00.000Z')
    await a.contacts.modifier(c.id, { prochaineRelanceAt: null })
    expect(await a.sync.synchroniser()).toMatchObject({ supprimes: 1 })
    expect(google.actifs()).toHaveLength(0)
  })

  it('relance déplacée ou supprimée dans Google : la fiche suit', async () => {
    const a = appareil()
    const c = await a.contacts.creer({ ...contactVide(), nom: 'Lambert', prochaineRelanceAt: '2026-10-02T08:00:00.000Z' })
    await a.sync.synchroniser()
    const id = idGoogle('rc', c.id)
    google.modifierDansGoogle(id, { start: { dateTime: '2026-10-09T12:30:00+02:00' }, end: { dateTime: '2026-10-09T12:45:00+02:00' } })
    expect(await a.sync.synchroniser()).toMatchObject({ recus: 1, envoyes: 0 })
    expect((await a.contacts.get(c.id))!.prochaineRelanceAt).toBe('2026-10-09T10:30:00.000Z')

    google.modifierDansGoogle(id, { status: 'cancelled' })
    await a.sync.synchroniser()
    expect((await a.contacts.get(c.id))!.prochaineRelanceAt).toBeNull() // → « Sans prochaine action »
    expect(await a.db.journal.filter((j) => j.champ === 'prochaineRelanceAt').count()).toBeGreaterThan(0) // tracé
  })

  it('modifié des deux côtés : la version de l’application gagne', async () => {
    const a = appareil()
    const c = await a.contacts.creer({ ...contactVide(), nom: 'Claes', prochaineRelanceAt: '2026-10-02T08:00:00.000Z' })
    await a.sync.synchroniser()
    google.modifierDansGoogle(idGoogle('rc', c.id), { start: { dateTime: '2026-10-20T08:00:00Z' } })
    await a.contacts.modifier(c.id, { prochaineRelanceAt: '2026-10-03T08:00:00.000Z' })
    await a.sync.synchroniser()
    expect((await a.contacts.get(c.id))!.prochaineRelanceAt).toBe('2026-10-03T08:00:00.000Z')
    expect(google.evenements.get(idGoogle('rc', c.id))!.start!.dateTime).toBe('2026-10-03T08:00:00.000Z')
  })

  it('un rendez-vous ajouté à la main dans Google entre dans l’agenda ; supprimé dans l’app, il disparaît de Google', async () => {
    const a = appareil()
    await a.sync.synchroniser()
    google.creerDansGoogle({ id: 'abc123googleid', summary: 'Visite notaire Rossi', location: 'Rue Puissant 7, Gilly', description: 'Apporter le PEB', start: { dateTime: '2026-10-06T09:00:00Z' }, end: { dateTime: '2026-10-06T10:00:00Z' } })
    expect(await a.sync.synchroniser()).toMatchObject({ recus: 1, envoyes: 0 })
    const [e] = await a.db.evenements.toArray()
    expect(e).toMatchObject({ titre: 'Visite notaire Rossi', lieu: 'Rue Puissant 7, Gilly', notes: 'Apporter le PEB', debut: '2026-10-06T09:00:00.000Z', googleEventId: 'abc123googleid' })

    await a.evenements.archiver(e!.id)
    await a.sync.synchroniser()
    expect(google.evenements.get('abc123googleid')!.status).toBe('cancelled')
  })

  it('deux appareils du même utilisateur : un seul événement, jamais de doublon', async () => {
    const tel = appareil()
    const pc = appareil()
    const r = await tel.evenements.creer({ ...evenementVide(new Date('2026-10-07T08:00:00Z')), titre: 'Estimation Hermans' })
    // Le même rendez-vous arrive sur l'ordinateur (via le serveur Linkimmo) avant sa synchro Google.
    await pc.db.evenements.put(structuredClone((await tel.db.evenements.get(r.id))!))
    await tel.sync.synchroniser()
    await pc.sync.synchroniser()
    expect(google.actifs()).toHaveLength(1)
    expect(google.actifs()[0]!.summary).toBe('Estimation Hermans')
  })

  it('les données de démonstration ne vont jamais dans Google', async () => {
    const a = appareil()
    await a.contacts.creer({ ...contactVide(), nom: 'Démo', prochaineRelanceAt: '2026-10-02T08:00:00.000Z' }, { demo: true })
    await a.evenements.creer(evenementVide(new Date('2026-10-02T08:00:00Z')), { demo: true })
    await a.sync.synchroniser()
    expect(google.actifs()).toHaveLength(0)
  })
})
