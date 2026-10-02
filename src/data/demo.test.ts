import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from './db'
import { initialiserDemo, supprimerDemo } from './demo'
import { contacts, contactVide } from './repositories/contacts'

beforeEach(async () => {
  await db.delete()
  await db.open()
})

const demo = () => db.contacts.filter((c) => c._demo === true).toArray()

describe('données de démonstration', () => {
  it('premier lancement : 8 contacts, dont l’affiche, l’annonce Internet et le contact à suivre', async () => {
    await initialiserDemo()
    const liste = await demo()
    expect(liste).toHaveLength(9) // dont un doublon à fusionner
    const affiche = liste.find((c) => c.source === 'affiche' && !c.nom)!
    expect(affiche._telNorm).toEqual(['+32477315286'])
    const hermans = liste.find((c) => c.nom === 'Hermans')!
    const liens = await db.piecesJointes.where('[entite+entiteId]').equals(['contacts', hermans.id]).toArray()
    expect(liens[0]).toMatchObject({ type: 'lien', _demo: true })
    expect(liens[0]!.url).toContain('2ememain.be')
    expect(liste.find((c) => c.nom === 'Renard')!.source).toBe('recommandation')
    // Pistes de prospection de démonstration
    const lesPistes = await db.pistes.toArray()
    expect(lesPistes.map((p) => p.categorie).sort()).toEqual(['annonce', 'annonce', 'maison_vide', 'maison_vide'])
    expect(lesPistes.every((p) => p._demo)).toBe(true)
    expect(lesPistes.filter((p) => !p.contactId)).toHaveLength(1) // propriétaire inconnu
    expect(await db.outbox.count()).toBe(0) // rien ne part au serveur
    // Étape 6 : anniversaire, signature d'il y a 2 ans, projet de vente
    expect(liste.find((c) => c.nom === 'Dupont')!.dateNaissance).toMatch(/^1971-/)
    expect(await db.interactions.filter((i) => i.resultat === 'mandat').count()).toBe(1)
    expect(await db.evenements.count()).toBe(4) // rendez-vous d'exemple, dont une estimation « à encoder »
  })

  it('« supprimer la démo » efface aussi pistes, biens et photos', async () => {
    await initialiserDemo()
    await supprimerDemo()
    expect(await db.pistes.count()).toBe(0)
    expect(await db.biens.count()).toBe(0)
    expect(await db.contacts.count()).toBe(0)
    expect(await db.photos.count()).toBe(0)
    expect(await db.photosLocales.count()).toBe(0)
    expect(await db.evenements.count()).toBe(0)
  })

  it('aucun doublon au redémarrage', async () => {
    await initialiserDemo()
    await initialiserDemo()
    expect(await demo()).toHaveLength(9)
  })

  it('un appareil qui a déjà la première série reçoit les nouveaux exemples', async () => {
    await db.meta.put({ cle: 'demo.initialise', valeur: 'ancien' })
    await contacts.creer({ ...contactVide(), nom: 'Ancien' }, { demo: true })
    await initialiserDemo()
    expect(await demo()).toHaveLength(5)
    expect(await db.pistes.count()).toBeGreaterThan(0)
  })

  it('rien n’est ajouté si la démonstration a été supprimée', async () => {
    await initialiserDemo()
    await supprimerDemo()
    await db.meta.delete('demo.serie2')
    await db.meta.delete('demo.serie3')
    await db.meta.delete('demo.serie4')
    await db.meta.delete('demo.serie5')
    await db.meta.delete('demo.serie6')
    await db.meta.delete('demo.serie7')
    await db.meta.delete('demo.serie8')
    await initialiserDemo()
    expect(await demo()).toHaveLength(0)
    expect(await db.pistes.count()).toBe(0)
  })
})
