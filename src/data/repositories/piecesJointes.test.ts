import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { LinkimmoDB } from '../db'
import { ContactRepository, contactVide } from './contacts'
import { PieceJointeRepository } from './piecesJointes'

let db: LinkimmoDB
let repo: PieceJointeRepository
let contactsRepo: ContactRepository

beforeEach(() => {
  db = new LinkimmoDB(`test-${crypto.randomUUID()}`)
  repo = new PieceJointeRepository(db)
  contactsRepo = new ContactRepository(db)
})

describe('PieceJointeRepository', () => {
  it('ajoute un lien d’annonce avec https:// complété', async () => {
    const c = await contactsRepo.creer(contactVide())
    const p = await repo.ajouterLien('contacts', c.id, { url: 'www.immoweb.be/fr/annonce/123', note: 'Prix baissé' })
    expect(p.url).toBe('https://www.immoweb.be/fr/annonce/123')
    expect(p.note).toBe('Prix baissé')
    expect(await repo.pour('contacts', c.id)).toHaveLength(1)
  })

  it('refuse un lien invalide', async () => {
    await expect(repo.ajouterLien('contacts', 'x', { url: 'pas un lien' })).rejects.toThrow('valide')
  })

  it('enregistre un PDF sur l’appareil avec sa description', async () => {
    const c = await contactsRepo.creer(contactVide())
    const fichier = new File(['%PDF-1.4 annonce'], 'annonce_rue-puissant.pdf', { type: 'application/pdf' })
    const p = await repo.ajouterFichier('contacts', c.id, fichier)
    expect(p).toMatchObject({ type: 'fichier', titre: 'annonce rue puissant', mime: 'application/pdf', taille: fichier.size })
    expect(await db.fichiers.get(p.id)).toBeDefined()
    // La description part au serveur, le contenu sera envoyé par la file des fichiers (étape 3).
    const op = (await db.outbox.toArray()).find((o) => o.rowId === p.id)
    expect(op?.champs).not.toHaveProperty('blob')
  })

  it('refuse un fichier trop volumineux', async () => {
    const gros = new File([new Uint8Array(26 * 1024 * 1024)], 'enorme.pdf')
    await expect(repo.ajouterFichier('contacts', 'x', gros)).rejects.toThrow('trop volumineux')
  })

  it('les documents d’un contact de démo sont supprimés avec lui', async () => {
    const demo = await contactsRepo.creer(contactVide(), { demo: true })
    await repo.ajouterFichier('contacts', demo.id, new File(['x'], 'a.pdf'))
    await repo.ajouterLien('contacts', demo.id, { url: 'https://2ememain.be/v/1' })
    expect(await db.outbox.count()).toBe(0)
    expect(await repo.supprimerDemo()).toBe(2)
    expect(await db.fichiers.count()).toBe(0)
  })
})
