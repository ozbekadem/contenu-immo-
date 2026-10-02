import { describe, expect, it } from 'vitest'
import { cleJour, debutSemaine, decaler, grilleMois, plageVue, titrePeriode } from './calendrier'

const j = (a: number, m: number, d: number) => new Date(a, m - 1, d)

describe('calendrier de l’agenda', () => {
  it('la semaine commence le lundi', () => {
    expect(debutSemaine(j(2026, 10, 2))).toEqual(j(2026, 9, 28)) // vendredi → lundi 28 sept.
    expect(debutSemaine(j(2026, 10, 4))).toEqual(j(2026, 9, 28)) // dimanche → même semaine
    expect(debutSemaine(j(2026, 10, 5))).toEqual(j(2026, 10, 5))
  })

  it('donne la période de chaque vue', () => {
    const d = j(2026, 11, 18)
    expect(plageVue('jour', d)).toEqual({ du: j(2026, 11, 18), au: j(2026, 11, 19) })
    expect(plageVue('semaine', d)).toEqual({ du: j(2026, 11, 16), au: j(2026, 11, 23) })
    expect(plageVue('mois', d)).toEqual({ du: j(2026, 11, 1), au: j(2026, 12, 1) })
    expect(plageVue('trimestre', d)).toEqual({ du: j(2026, 10, 1), au: j(2027, 1, 1) })
  })

  it('passe à la période suivante ou précédente', () => {
    expect(decaler('jour', j(2026, 12, 31), 1)).toEqual(j(2027, 1, 1))
    expect(decaler('semaine', j(2026, 10, 2), 1)).toEqual(j(2026, 10, 5))
    expect(decaler('mois', j(2026, 1, 31), 1)).toEqual(j(2026, 2, 1))
    expect(decaler('trimestre', j(2026, 11, 18), -1)).toEqual(j(2026, 7, 1))
    expect(decaler('trimestre', j(2026, 11, 18), 1)).toEqual(j(2027, 1, 1))
  })

  it('construit la grille d’un mois en semaines complètes', () => {
    const g = grilleMois(j(2026, 10, 15)) // octobre 2026 : commence un jeudi
    expect(g).toHaveLength(5)
    expect(g[0]![0]).toEqual(j(2026, 9, 28))
    expect(g[4]![6]).toEqual(j(2026, 11, 1))
    expect(grilleMois(j(2027, 2, 10))).toHaveLength(4) // février 2027 : commence un lundi, 28 jours
  })

  it('écrit le titre de la période', () => {
    expect(titrePeriode('mois', j(2026, 10, 2))).toBe('octobre 2026')
    expect(titrePeriode('semaine', j(2026, 10, 7))).toBe('5 – 11 oct. 2026')
    expect(titrePeriode('semaine', j(2026, 10, 2))).toBe('28 sept. – 4 oct. 2026')
    expect(titrePeriode('trimestre', j(2026, 10, 2))).toBe('4e trimestre 2026 (oct – déc)')
    expect(titrePeriode('trimestre', j(2026, 2, 2))).toBe('1er trimestre 2026 (janv – mars)')
  })

  it('clé de jour indépendante de l’heure', () => {
    expect(cleJour(new Date(2026, 9, 2, 23, 59))).toBe(cleJour(j(2026, 10, 2)))
  })
})
