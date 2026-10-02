import { describe, expect, it } from 'vitest'
import { annuels, communePour, corrigerInflation, dernierAnnuel, evolution, nomLisible, positionPrix, serie, trimestres, typePourBien, type DonneesMarche } from './marche'

const d: DonneesMarche = {
  source: 'test',
  derniere: '2026 T2',
  baseIndice: 2025,
  indice: { '2015': 75, '2025': 100 },
  zones: { '52011': { nom: 'CHARLEROI', niveau: 5 }, '52021': { nom: 'FLEURUS', niveau: 5 }, '52000': { nom: 'ARRONDISSEMENT DE CHARLEROI', niveau: 4 } },
  series: {
    '52011': {
      m23: [
        [2015, 'Y', 1500, 90000, 120000, 150000],
        [2024, 'Y', 1747, 100000, 140000, 190000],
        [2025, 'Q4', 506, 110000, 158500, 200500],
        [2025, 'Y', 1845, 100000, 150000, 199000],
        [2026, 'Q1', 451, 106500, 159500, 205000],
        [2026, 'Q2', 12, null, null, null],
      ],
    },
  },
}

describe('Marché local (Statbel)', () => {
  it('chiffres annuels, dernier trimestre et évolution', () => {
    const s = serie(d, '52011', 'm23')
    expect(annuels(s).map((p) => p.annee)).toEqual([2015, 2024, 2025])
    expect(dernierAnnuel(s)).toMatchObject({ annee: 2025, mediane: 150000, ventes: 1845 })
    expect(trimestres(s).map((p) => `${p.annee} ${p.periode}`)).toEqual(['2025 Q4', '2026 Q1', '2026 Q2'])
    expect(evolution(s, 1)).toBe(7.1)
    expect(evolution(s, 10)).toBe(25)
    expect(evolution(s, 5)).toBeNull() // 2020 absent : pas d'invention
  })

  it('corrige l’inflation avec l’indice des prix', () => {
    expect(corrigerInflation(120000, 2015, 2025, d.indice)).toBe(160000)
    expect(corrigerInflation(120000, 2010, 2025, d.indice)).toBeNull()
  })

  it('retrouve la commune par le code postal (sections comprises) ou la localité', () => {
    expect(communePour(d, { cp: '6001', ville: 'Marcinelle' })).toBe('52011')
    expect(communePour(d, { cp: '6060', ville: '' })).toBe('52011')
    expect(communePour(d, { cp: '6224', ville: 'Wanfercée-Baulet' })).toBe('52021')
    expect(communePour(d, { cp: '', ville: 'fleurus' })).toBe('52021')
    expect(communePour(d, { cp: '9999', ville: 'Ailleurs' })).toBeNull()
  })

  it('situe un prix demandé par rapport aux ventes réelles', () => {
    const p = dernierAnnuel(serie(d, '52011', 'm23'))!
    expect(positionPrix(219000, p)).toEqual({ ecart: 46, tranche: 'haut' })
    expect(positionPrix(150000, p)).toEqual({ ecart: 0, tranche: 'milieu' })
    expect(positionPrix(90000, p)).toEqual({ ecart: -40, tranche: 'bas' })
  })

  it('type de bien et noms lisibles', () => {
    expect(typePourBien('maison', 3)).toBe('m23')
    expect(typePourBien('maison', 4)).toBe('m4')
    expect(typePourBien('maison', null)).toBe('maisons')
    expect(typePourBien('appartement', null)).toBe('apparts')
    expect(typePourBien('terrain', null)).toBeNull()
    expect(nomLisible('CHAPELLE-LEZ-HERLAIMONT')).toBe('Chapelle-lez-Herlaimont')
    expect(nomLisible('ARRONDISSEMENT DE CHARLEROI')).toBe('Arrondissement de Charleroi')
    expect(nomLisible("FONTAINE-L'EVEQUE")).toBe('Fontaine-l’Évêque')
    expect(nomLisible('HAM-SUR-HEURE-NALINNES')).toBe('Ham-sur-Heure-Nalinnes')
    expect(nomLisible('LES BONS VILLERS')).toBe('Les Bons Villers')
  })
})
