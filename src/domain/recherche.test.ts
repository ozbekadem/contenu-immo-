import { describe, expect, it } from 'vitest'
import { construireIndex, correspond, normaliserTexte, preparerRequete } from './recherche'

const index = construireIndex(['Élodie', 'Lefèvre', 'Rue de la Montagne 12', 'Charleroi', 'elodie@exemple.be'], ['+32476123456'])
const cherche = (q: string) => correspond(index, preparerRequete(q))

describe('recherche', () => {
  it('ignore accents et majuscules', () => {
    expect(normaliserTexte('Évêché de LIÈGE')).toBe('eveche de liege')
    expect(cherche('lefevre')).toBe(true)
    expect(cherche('ELODIE')).toBe(true)
  })

  it('combine plusieurs mots (nom + ville)', () => {
    expect(cherche('elodie charl')).toBe(true)
    expect(cherche('elodie namur')).toBe(false)
  })

  it('trouve par téléphone, quel que soit le format tapé', () => {
    for (const q of ['0476', '0476 12 34', '0476/12.34.56', '+32 476 12', '0032476', '123456']) {
      expect(cherche(q)).toBe(true)
    }
    expect(cherche('0477')).toBe(false)
  })

  it('trouve par adresse et email', () => {
    expect(cherche('montagne')).toBe(true)
    expect(cherche('elodie@exemple')).toBe(true)
  })

  it('une requête vide ne filtre rien', () => {
    expect(preparerRequete('   ')).toEqual([])
    expect(correspond(index, [])).toBe(true)
  })
})
