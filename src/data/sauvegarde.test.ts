import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { empreinte } from '@/domain/doublons'
import { preparerImport } from '@/domain/importation'
import { LinkimmoDB } from './db'
import { ContactRepository, contactVide } from './repositories/contacts'
import { annulerImport, importerContacts, importsPasses } from './repositories/importation'
import { InteractionRepository } from './repositories/interactions'
import { creerSauvegarde, lireSauvegarde, restaurer } from './sauvegarde'

let db: LinkimmoDB
beforeEach(() => {
  db = new LinkimmoDB(`test-${crypto.randomUUID()}`)
})

describe('Sauvegarde et restauration', () => {
  it('sauvegarde tout (sauf la démo) et restaure sans écraser ce qui est plus récent', async () => {
    const contacts = new ContactRepository(db)
    const marc = await contacts.creer({ ...contactVide(), prenom: 'Marc', nom: 'Dupont' })
    await new InteractionRepository(db).creer({ contactId: marc.id, pisteId: null, type: 'appel', resultat: 'interesse', commentaire: 'ok', date: new Date().toISOString(), relanceAt: null, numero: null })
    await contacts.creer({ ...contactVide(), nom: 'Démo' }, { demo: true })
    const s = lireSauvegarde(JSON.stringify(await creerSauvegarde(db)))
    expect(s.tables.contacts).toHaveLength(1)
    expect(s.tables.interactions).toHaveLength(1)
    expect(s.tables.contacts![0]).not.toHaveProperty('_recherche') // champs recalculés : pas sauvegardés
    expect(await db.meta.get('sauvegarde.derniere')).toBeDefined()

    // Sur un nouvel appareil vide : tout revient, avec la recherche recalculée, prêt à partir au serveur
    const neuf = new LinkimmoDB(`test-${crypto.randomUUID()}`)
    expect(await restaurer(neuf, s)).toEqual({ restaurees: 2, ignorees: 0 })
    expect((await neuf.contacts.get(marc.id))!._recherche).toContain('dupont')
    expect(await neuf.outbox.count()).toBe(2)
    expect(await neuf.journal.count()).toBeGreaterThan(0)

    // Une fiche modifiée depuis la sauvegarde n'est pas écrasée
    await new Promise((r) => setTimeout(r, 5))
    await contacts.modifier(marc.id, { nom: 'Dupont-Renard' })
    expect(await restaurer(db, s)).toMatchObject({ restaurees: 0 })
    expect((await contacts.get(marc.id))!.nom).toBe('Dupont-Renard')
  })

  it('refuse un fichier qui n’est pas une sauvegarde', () => {
    expect(() => lireSauvegarde('{"a":1}')).toThrow(/pas une sauvegarde/)
    expect(() => lireSauvegarde('pas du json')).toThrow(/illisible/)
  })
})

describe('Import de contacts', () => {
  it('importe, ignore les doublons, et peut être annulé', async () => {
    const contacts = new ContactRepository(db)
    const marc = await contacts.creer({ ...contactVide(), prenom: 'Marc', nom: 'Dupont', telephones: [{ numero: '0472 18 90 33' }] })
    const existants = (await db.contacts.toArray()).map((c) => ({ id: c.id, empreinte: c._empreinte ?? empreinte(c) }))
    const p = preparerImport(
      [
        ['Dupont', '0472189033'],
        ['Claes', '0478554433'],
        ['Lambert', '071456789'],
      ],
      ['nom', 'telephone'],
      existants,
    )
    const r = await importerContacts(p.lignes, { doublons: 'ignorer', etiquette: 'import 2026-10-02 14h00' }, db)
    expect(r).toMatchObject({ creees: 2, ignorees: 1 })
    expect(await importsPasses(db)).toEqual([{ etiquette: 'import 2026-10-02 14h00', fiches: 2 }])
    expect(await annulerImport('import 2026-10-02 14h00', db)).toBe(2)
    expect((await contacts.tous()).filter((c) => !c.archivedAt).map((c) => c.id)).toEqual([marc.id])
  })
})
