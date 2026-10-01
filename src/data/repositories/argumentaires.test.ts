import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { LinkimmoDB } from '../db'
import { ArgumentaireRepository } from './argumentaires'

let db: LinkimmoDB
let repo: ArgumentaireRepository

beforeEach(() => {
  db = new LinkimmoDB(`test-${crypto.randomUUID()}`)
  repo = new ArgumentaireRepository(db)
})

describe('Argumentaires modifiables', () => {
  it('texte d’origine, version de l’agence (partagée), puis retour à l’origine', async () => {
    const origine = await repo.pour('affiche')
    expect(origine.modifie).toBe(false)

    await repo.enregistrer('affiche', { accroche: ' Bonjour, Adem, de l’agence [agence]. ', points: ['Toujours à vendre ?', '  '], objections: [{ objection: 'Je vends seul', reponse: 'Estimation gratuite' }] })
    const modifie = await repo.pour('affiche')
    expect(modifie).toMatchObject({ modifie: true, accroche: 'Bonjour, Adem, de l’agence [agence].', points: ['Toujours à vendre ?'], titre: origine.titre })
    expect(await db.outbox.count()).toBe(1) // envoyé à l'équipe

    await repo.enregistrer('affiche', { ...modifie, points: ['Autre point'] })
    expect(await db.argumentaires.count()).toBe(1)

    await repo.retablir('affiche')
    expect((await repo.pour('affiche')).accroche).toBe(origine.accroche)
    expect(await db.argumentaires.count()).toBe(1) // archivée, pas effacée
  })
})
