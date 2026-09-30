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
    expect(liste).toHaveLength(8)
    const affiche = liste.find((c) => c.source === 'affiche' && !c.nom)!
    expect(affiche._telNorm).toEqual(['+32477315286'])
    const hermans = liste.find((c) => c.nom === 'Hermans')!
    const liens = await db.piecesJointes.where('[entite+entiteId]').equals(['contacts', hermans.id]).toArray()
    expect(liens[0]).toMatchObject({ type: 'lien', _demo: true })
    expect(liens[0]!.url).toContain('2ememain.be')
    expect(liste.find((c) => c.nom === 'Renard')!.source).toBe('recommandation')
  })

  it('aucun doublon au redémarrage', async () => {
    await initialiserDemo()
    await initialiserDemo()
    expect(await demo()).toHaveLength(8)
  })

  it('un appareil qui a déjà la première série reçoit les 3 nouveaux exemples', async () => {
    await db.meta.put({ cle: 'demo.initialise', valeur: 'ancien' })
    await contacts.creer({ ...contactVide(), nom: 'Ancien' }, { demo: true })
    await initialiserDemo()
    expect(await demo()).toHaveLength(4)
  })

  it('rien n’est ajouté si la démonstration a été supprimée', async () => {
    await initialiserDemo()
    await supprimerDemo()
    await db.meta.delete('demo.serie2')
    await initialiserDemo()
    expect(await demo()).toHaveLength(0)
  })
})
