import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { LinkimmoDB } from '../db'
import { ContactRepository, contactVide } from './contacts'

let db: LinkimmoDB
let repo: ContactRepository

beforeEach(() => {
  db = new LinkimmoDB(`test-${crypto.randomUUID()}`)
  repo = new ContactRepository(db)
})

const marie = () => ({
  ...contactVide(),
  prenom: 'Marie',
  nom: 'Dubois',
  telephones: [{ numero: '0476 12 34 56' }],
  adresse: { rue: 'Rue de la Station', numero: '5', boite: '', cp: '6000', ville: 'Charleroi' },
})

describe('ContactRepository', () => {
  it('crée un contact avec index de recherche, tri et numéro normalisé', async () => {
    const c = await repo.creer(marie())
    expect(c._telNorm).toEqual(['+32476123456'])
    expect(c._tri).toBe('dubois marie')
    expect(c._recherche).toContain('charleroi')
    expect(c._recherche).toContain('0476123456')
    expect(Object.keys(c._ts)).toContain('nom')
    expect(c._empreinte.phonNom).toBe('duboi')
    expect(c._empreinte.adresse).toBe('rue station|5||6000')
    expect(c._rechPhon).toContain('charleroi')
  })

  it("prépare l'envoi au serveur et journalise la création", async () => {
    const c = await repo.creer(marie())
    expect(await db.outbox.count()).toBe(1)
    const [op] = await db.outbox.toArray()
    expect(op!.rowId).toBe(c.id)
    expect(op!.champs).not.toHaveProperty('_recherche')
    expect((await repo.journal(c.id))[0]!.champ).toBe('creation')
  })

  it("ne journalise et n'envoie que les champs réellement modifiés", async () => {
    const c = await repo.creer(marie())
    await repo.modifier(c.id, { prenom: 'Marie', nom: 'Dubois-Leroy' })
    const ops = await db.outbox.toArray()
    expect(ops).toHaveLength(2)
    expect(ops[1]!.champs).toEqual({ nom: 'Dubois-Leroy' })
    const j = await repo.journal(c.id)
    expect(j.find((e) => e.champ === 'nom')).toMatchObject({ avant: 'Dubois', apres: 'Dubois-Leroy' })
    expect((await repo.get(c.id))!._ts.nom! > c._ts.nom!).toBe(true)
  })

  it("archive l'ancienne adresse au lieu de l'effacer", async () => {
    const c = await repo.creer(marie())
    const maj = await repo.modifier(c.id, {
      adresse: { rue: 'Avenue Meurée', numero: '20', boite: '', cp: '6001', ville: 'Marcinelle' },
    })
    expect(maj.adresse?.ville).toBe('Marcinelle')
    expect(maj.anciennesAdresses).toHaveLength(1)
    expect(maj.anciennesAdresses[0]).toMatchObject({ ville: 'Charleroi', rue: 'Rue de la Station' })
  })

  it('détecte un doublon de téléphone, quel que soit le format', async () => {
    const c = await repo.creer(marie())
    expect(await repo.trouverParTelephones(['+32 476/12.34.56'])).toHaveLength(1)
    expect(await repo.trouverParTelephones(['0476123456'], c.id)).toHaveLength(0)
    expect(await repo.trouverParTelephones(['0499 99 99 99'])).toHaveLength(0)
  })

  it('archive et restaure sans supprimer', async () => {
    const c = await repo.creer(marie())
    expect((await repo.archiver(c.id)).archivedAt).not.toBeNull()
    expect((await repo.restaurer(c.id)).archivedAt).toBeNull()
    expect(await repo.compter()).toBe(1)
  })

  it('les données de démo ne sont pas synchronisées et se suppriment en un clic', async () => {
    await repo.creer(marie(), { demo: true })
    const vrai = await repo.creer({ ...marie(), prenom: 'Paul' })
    expect(await db.outbox.count()).toBe(1)
    expect(await repo.supprimerDemo()).toBe(1)
    expect((await repo.tous()).map((c) => c.id)).toEqual([vrai.id])
  })
})
