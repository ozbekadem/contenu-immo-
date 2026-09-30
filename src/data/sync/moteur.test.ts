import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Horloge } from '@/domain/hlc'
import { LinkimmoDB } from '../db'
import { ContactRepository, contactVide } from '../repositories/contacts'
import { BienRepository, bienVide } from '../repositories/biens'
import { PhotoRepository } from '../repositories/photos'
import { PieceJointeRepository } from '../repositories/piecesJointes'
import { ENTITES_SYNC } from './entites'
import { FauxServeur } from './fauxServeur'
import { MoteurSync } from './moteur'

interface Appareil {
  db: LinkimmoDB
  contacts: ContactRepository
  pieces: PieceJointeRepository
  moteur: MoteurSync
}

let serveur: FauxServeur

function appareil(id: string, surRevoque = () => {}): Appareil {
  const db = new LinkimmoDB(`test-${id}-${crypto.randomUUID()}`)
  const moteur = new MoteurSync(db, serveur.transport(`user-${id}`), ENTITES_SYNC, new Horloge(id), { id, nom: `Appareil ${id}` }, surRevoque)
  return { db, contacts: new ContactRepository(db), pieces: new PieceJointeRepository(db), moteur }
}

beforeEach(() => {
  serveur = new FauxServeur()
})

describe('Synchronisation entre appareils', () => {
  it('une fiche créée sur le téléphone apparaît sur l’ordinateur', async () => {
    const tel = appareil('tel')
    const pc = appareil('pc')
    const c = await tel.contacts.creer({ ...contactVide(), prenom: 'Marc', nom: 'Dupont', telephones: [{ numero: '0472 18 90 33' }] })
    await tel.moteur.synchroniser()
    expect(await tel.db.outbox.count()).toBe(0)

    await pc.moteur.synchroniser()
    const recu = await pc.contacts.get(c.id)
    expect(recu).toMatchObject({ prenom: 'Marc', nom: 'Dupont' })
    // Champs locaux recalculés sur l'appareil qui reçoit (recherche, doublons)
    expect(recu!._telNorm).toEqual(['+32472189033'])
    expect(recu!._recherche).toContain('dupont')
    expect(pc.moteur.obtenirEtat().statut).toBe('a_jour')
  })

  it('modifications hors ligne de champs différents : les deux sont gardées', async () => {
    const a = appareil('a')
    const b = appareil('b')
    const c = await a.contacts.creer({ ...contactVide(), nom: 'Dupont', notes: 'Maison 3 façades' })
    await a.moteur.synchroniser()
    await b.moteur.synchroniser()

    await a.contacts.modifier(c.id, { temperature: 'chaud' })
    await b.contacts.modifier(c.id, { notes: 'Veut vendre avant l’hiver' })
    await a.moteur.synchroniser()
    await b.moteur.synchroniser()
    await a.moteur.synchroniser()

    for (const x of [a, b]) {
      expect(await x.contacts.get(c.id)).toMatchObject({ temperature: 'chaud', notes: 'Veut vendre avant l’hiver' })
    }
  })

  it('même champ modifié des deux côtés : la plus récente gagne, l’autre est au journal', async () => {
    const a = appareil('a')
    const b = appareil('b')
    const c = await a.contacts.creer({ ...contactVide(), nom: 'Dupont' })
    await a.moteur.synchroniser()
    await b.moteur.synchroniser()

    await a.contacts.modifier(c.id, { nom: 'Dupond' }) // plus ancienne
    await new Promise((r) => setTimeout(r, 5))
    await b.contacts.modifier(c.id, { nom: 'Dupont-Leroy' }) // plus récente
    await b.moteur.synchroniser()
    await a.moteur.synchroniser() // A envoie sa valeur plus ancienne : refusée et journalisée

    expect((await a.contacts.get(c.id))!.nom).toBe('Dupont-Leroy')
    await b.moteur.synchroniser()
    expect((await b.contacts.get(c.id))!.nom).toBe('Dupont-Leroy')

    const conflits = (await b.contacts.journal(c.id)).filter((e) => e.conflit)
    expect(conflits).toHaveLength(1)
    expect(conflits[0]).toMatchObject({ champ: 'nom', avant: 'Dupond', apres: 'Dupont-Leroy' })
  })

  it('le journal est partagé entre appareils, sans doublon', async () => {
    const a = appareil('a')
    const b = appareil('b')
    const c = await a.contacts.creer({ ...contactVide(), nom: 'Claes' })
    await a.contacts.modifier(c.id, { prenom: 'Sophie' })
    await a.moteur.synchroniser()
    await a.moteur.synchroniser()
    await b.moteur.synchroniser()
    expect((await b.contacts.journal(c.id)).map((e) => e.champ).sort()).toEqual(['creation', 'prenom'])
    expect(await a.db.journal.count()).toBe(2)
  })

  it('hors ligne : rien n’est perdu, tout part au retour du réseau', async () => {
    const a = appareil('a')
    serveur.horsLigne = true
    await a.contacts.creer({ ...contactVide(), nom: 'Rossi' })
    await a.moteur.synchroniser()
    expect(await a.db.outbox.count()).toBe(1)
    expect(a.moteur.obtenirEtat().statut).not.toBe('a_jour')

    serveur.horsLigne = false
    await a.moteur.synchroniser()
    expect(await a.db.outbox.count()).toBe(0)
    expect(serveur.lignes.size).toBe(1)
  })

  it('les données de démonstration ne partent jamais au serveur', async () => {
    const a = appareil('a')
    await a.contacts.creer({ ...contactVide(), nom: 'Démo' }, { demo: true })
    await a.moteur.synchroniser()
    expect(serveur.lignes.size).toBe(0)
    expect(serveur.journal).toHaveLength(0)
  })

  it('un document joint est envoyé puis téléchargeable sur l’autre appareil', async () => {
    const a = appareil('a')
    const b = appareil('b')
    const c = await a.contacts.creer({ ...contactVide(), nom: 'Lambert' })
    const p = await a.pieces.ajouterFichier('contacts', c.id, new File(['%PDF annonce'], 'Annonce Immoweb é.pdf', { type: 'application/pdf' }))
    await a.moteur.synchroniser()
    expect([...serveur.fichiers.keys()]).toEqual([`${p.id}/Annonce_Immoweb_e.pdf`])

    await b.moteur.synchroniser()
    const recue = await b.pieces.get(p.id)
    expect(recue!.cheminStockage).toBe(`${p.id}/Annonce_Immoweb_e.pdf`)
    expect(await b.db.fichiers.get(p.id)).toBeUndefined()
    // (La base simulée des tests ne conserve pas le contenu binaire ; un vrai navigateur, si.)
    const blob = await b.moteur.telechargerFichier(recue!)
    expect(blob).toBeDefined()
    expect(await b.db.fichiers.get(p.id)).toBeDefined() // gardé pour la consultation hors ligne
  })

  it('une photo de terrain est envoyée (pleine taille + miniature) puis récupérable ailleurs', async () => {
    const a = appareil('a')
    const b = appareil('b')
    const bien = await new BienRepository(a.db).creer({ ...bienVide(), lat: 50.41, lng: 4.44 })
    const [photo] = await new PhotoRepository(a.db).ajouter(bien.id, null, [
      { image: new Blob(['grande'], { type: 'image/webp' }), miniature: new Blob(['mini'], { type: 'image/webp' }), largeur: 1600, hauteur: 1200 },
    ])
    await a.moteur.synchroniser()
    // (L'extension dépend du format gardé par le navigateur : webp, ou jpg en repli.)
    const chemins = [...serveur.fichiers.keys()].map((c) => c.replace(/\.(webp|jpg)$/, '')).sort()
    expect(chemins).toEqual([`photos/${bien.id}/${photo!.id}`, `photos/${bien.id}/${photo!.id}-mini`])
    expect(await a.db.outbox.count()).toBe(0)

    await b.moteur.synchroniser()
    const recue = await b.db.photos.get(photo!.id)
    expect(recue).toMatchObject({ bienId: bien.id })
    expect(recue!.cheminStockage).toMatch(new RegExp(`^photos/${bien.id}/${photo!.id}\\.`))
    expect(await b.moteur.telechargerPhoto(recue!, true)).toBeDefined()
    expect((await b.db.photosLocales.get(photo!.id))!.miniature).toBeDefined()
  })

  it('un appareil déconnecté à distance est prévenu', async () => {
    const surRevoque = vi.fn()
    const a = appareil('perdu', surRevoque)
    serveur.appareilsRevoques.add('perdu')
    await a.moteur.synchroniser()
    expect(surRevoque).toHaveBeenCalledOnce()
    expect(a.moteur.obtenirEtat().statut).toBe('revoque')
  })

  it('une seule synchronisation à la fois, les demandes pendant un tour relancent un tour', async () => {
    const a = appareil('a')
    await a.contacts.creer({ ...contactVide(), nom: 'Un' })
    const p1 = a.moteur.synchroniser()
    const p2 = a.moteur.synchroniser()
    expect(p1).toBe(p2)
    await p1
    expect(serveur.lignes.size).toBe(1)
  })
})
