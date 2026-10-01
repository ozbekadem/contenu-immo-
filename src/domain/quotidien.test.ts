import { describe, expect, it } from 'vitest'
import { aMaturite, anniversaires, entonnoir, messageAnniversaire, quandLisible } from './quotidien'

const maintenant = new Date(2026, 9, 1, 10) // jeudi 1er octobre 2026

describe('Entonnoir', () => {
  it('compte les pistes par étape et le taux de réussite', () => {
    const e = entonnoir([
      { statut: 'a_contacter', archivedAt: null },
      { statut: 'a_contacter', archivedAt: null },
      { statut: 'en_cours', archivedAt: null },
      { statut: 'rdv', archivedAt: null },
      { statut: 'gagne', archivedAt: null },
      { statut: 'perdu', archivedAt: null },
      { statut: 'perdu', archivedAt: null },
      { statut: 'en_cours', archivedAt: '2026-09-01' },
    ])
    expect(e.etapes).toMatchObject({ a_contacter: 2, en_cours: 1, rdv: 1, gagne: 1 })
    expect(e.total).toBe(5)
    expect(e.tauxReussite).toBe(33)
    expect(entonnoir([]).tauxReussite).toBeNull()
  })
})

describe('Anniversaires', () => {
  it('naissances des 7 prochains jours, avec l’âge', () => {
    const liste = anniversaires(
      [
        { quoi: 'Marc', type: 'naissance', date: '1971-10-01' },
        { quoi: 'Sophie', type: 'naissance', date: '1985-10-06' },
        { quoi: 'Paul', type: 'naissance', date: '1990-10-20' },
        { quoi: 'Inconnu', type: 'naissance', date: null },
      ],
      maintenant,
    )
    expect(liste.map((a) => [a.quoi, a.dans, a.annees])).toEqual([
      ['Marc', 0, 55],
      ['Sophie', 5, 41],
    ])
  })

  it('fin décembre : les anniversaires de début janvier sont vus', () => {
    const liste = anniversaires([{ quoi: 'Lea', type: 'naissance', date: '2000-01-02' }], new Date(2026, 11, 29, 10))
    expect(liste[0]).toMatchObject({ dans: 4, annees: 27 })
  })

  it('29 février fêté le 28 les années non bissextiles', () => {
    const liste = anniversaires([{ quoi: 'X', type: 'naissance', date: '1980-02-29' }], new Date(2027, 1, 25, 10))
    expect(liste[0]!.date.getDate()).toBe(28)
  })

  it('signature : à partir d’un an seulement', () => {
    const liste = anniversaires(
      [
        { quoi: 'cette année', type: 'signature', date: '2026-10-03T10:00:00.000Z' },
        { quoi: 'il y a 2 ans', type: 'signature', date: '2024-10-03T10:00:00.000Z' },
      ],
      maintenant,
    )
    expect(liste.map((a) => [a.quoi, a.annees])).toEqual([['il y a 2 ans', 2]])
    expect(messageAnniversaire(liste[0]!, 'Marc', '— Adem')).toContain('il y a 2 ans, nous signions')
    expect(messageAnniversaire({ type: 'naissance', annees: 55 }, '', '')).toBe('Bonjour, je vous souhaite un très joyeux anniversaire !')
    expect(messageAnniversaire({ type: 'naissance', annees: 55 }, 'Marc', '', 'Agence du Centre')).toMatch(/^Bonjour Marc, toute l’équipe de Agence du Centre/)
  })
})

describe('À maturité', () => {
  it('la date clé entre dans son préavis : c’est le moment de rappeler', () => {
    const liste = aMaturite(
      [
        { quoi: 'projet dans 45 j', datesCles: [{ id: '1', type: 'projet_vente', date: '2026-11-15', note: '' }] },
        { quoi: 'bail dans 6 mois', datesCles: [{ id: '2', type: 'fin_bail', date: '2027-03-31', note: '' }] },
        { quoi: 'pension passée de 10 j', datesCles: [{ id: '3', type: 'pension', date: '2026-09-21', note: '' }] },
        { quoi: 'trop ancien', datesCles: [{ id: '4', type: 'autre', date: '2026-08-01', note: '' }] },
      ],
      maintenant,
    )
    expect(liste.map((m) => [m.quoi, m.jours])).toEqual([
      ['pension passée de 10 j', -10],
      ['projet dans 45 j', 45],
    ])
    expect(quandLisible(0)).toBe('aujourd’hui')
    expect(quandLisible(-3)).toBe('il y a 3 j')
  })
})
