import { describe, expect, it } from 'vitest'
import { clePhonetique } from './phonetique'
import { cleAdresse, cpPourLocalite, localitesPourCp, memeImmeuble, normaliserRue } from './adresse'

describe('clePhonetique', () => {
  it.each([
    ['Dupont', 'Dupond'],
    ['Lefèvre', 'Lefebvre'],
    ['Mathieu', 'Matthieu'],
    ['Rossi', 'Rosi'],
    ['El Amrani', 'Elamrani'],
    ['Philippe', 'Filip'],
    ['Stéphane', 'Stefan'],
    ['Mohamed', 'Mohammed'],
    ['Claes', 'Claes'],
    ['Lambert', 'Lambèrt'],
  ])('%s ≈ %s', (a, b) => {
    expect(clePhonetique(a)).toBe(clePhonetique(b))
  })

  it.each([
    ['Dupont', 'Durand'],
    ['Lambert', 'Leroy'],
    ['Martin', 'Maes'],
    ['Rossi', 'Russo'],
  ])('%s ≠ %s', (a, b) => {
    expect(clePhonetique(a)).not.toBe(clePhonetique(b))
  })
})

describe('adresses', () => {
  it('développe les abréviations et ignore les petits mots', () => {
    expect(normaliserRue('Av. Paul-Pastur')).toBe('avenue paul pastur')
    expect(normaliserRue('Chée de Bruxelles')).toBe('chaussee bruxelles')
    expect(normaliserRue('R. de la Station')).toBe('rue station')
  })

  it('même adresse écrite autrement → même clé', () => {
    const a = cleAdresse({ rue: 'Rue Puissant', numero: '7', cp: '6060', ville: 'Gilly' })
    const b = cleAdresse({ rue: 'r. puissant', numero: ' 7 ', cp: '6060', ville: 'GILLY' })
    expect(a).not.toBeNull()
    expect(a).toBe(b)
  })

  it('sans code postal, compare la localité', () => {
    expect(cleAdresse({ rue: 'Rue Puissant', numero: '7', cp: '', ville: 'Gilly' })).toBe(
      cleAdresse({ rue: 'Rue Puissant', numero: '7', cp: '', ville: 'gilly' }),
    )
  })

  it('adresse incomplète → pas de comparaison', () => {
    expect(cleAdresse({ rue: 'Rue Puissant', numero: '', cp: '6060', ville: '' })).toBeNull()
  })

  it('même immeuble, boîtes différentes', () => {
    const a = cleAdresse({ rue: 'Av. Paul Pastur', numero: '301', boite: '2', cp: '6032', ville: '' })
    const b = cleAdresse({ rue: 'Avenue Paul Pastur', numero: '301', boite: 'bte 5', cp: '6032', ville: '' })
    expect(a).not.toBe(b)
    expect(memeImmeuble(a, b)).toBe(true)
  })

  it('code postal ↔ localité', () => {
    expect(localitesPourCp('6001')).toEqual(['Marcinelle'])
    expect(localitesPourCp('6200')).toContain('Châtelineau')
    expect(cpPourLocalite('gosselies')).toBe('6041')
    expect(cpPourLocalite('Mont sur Marchienne')).toBe('6032')
  })
})
