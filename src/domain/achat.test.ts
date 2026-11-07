import { describe, expect, it } from 'vitest'
import { arrondiOffre, bilan, calculerAchat, cloreOffresOuvertes, hypothesesVides, objectifParDefaut, offreEnCours, prixMaximum, relanceOffre, rendement, reventeSuggeree, valeurs, type Offre } from './achat'

const bien = { surface: 120, etat: 'a_renover' as const, prixDemande: 150_000, commissionApporteur: 0 }

describe('objectif par défaut', () => {
  it('suit l’activité', () => {
    expect(objectifParDefaut('annonce', 'agence')).toBe('mandat')
    expect(objectifParDefaut('maison_vide', 'agence')).toBe('achat')
    expect(objectifParDefaut('annonce', 'marchand')).toBe('achat')
    expect(objectifParDefaut('annonce', 'les_deux')).toBe('mandat')
  })
})

describe('calculette prix maximum', () => {
  it('a besoin d’un prix de revente', () => {
    expect(calculerAchat(hypothesesVides(), bien)).toBeNull()
  })

  it('déduit les travaux de l’état et de la surface', () => {
    const v = valeurs({ ...hypothesesVides(), revente: 280_000 }, bien)!
    expect(v.travaux).toBe(120_000) // 120 m² × 1 000 €
    expect(v.droitsPct).toBe(12.5)
    expect(valeurs({ ...hypothesesVides(), revente: 280_000, travauxForfait: 50_000 }, bien)!.travaux).toBe(50_000)
    expect(valeurs({ ...hypothesesVides(), revente: 280_000 }, { ...bien, droitsParDefaut: 5 })!.droitsPct).toBe(5)
  })

  it('au prix maximum, la marge est exactement la marge visée', () => {
    const r = calculerAchat({ ...hypothesesVides(), revente: 280_000 }, bien)!
    expect(r.auMax.margePct).toBeCloseTo(15, 6)
    expect(r.auMax.marge).toBeCloseTo(42_000, 2)
    // Prix réaliste : revente 280 k, travaux 120 k → on peut payer environ 80 k
    expect(r.prixMax).toBeGreaterThan(70_000)
    expect(r.prixMax).toBeLessThan(90_000)
    expect(r.ecart).toBeCloseTo(150_000 - r.prixMax, 6)
    expect(r.auPrixDemande!.margePct).toBeLessThan(0)
  })

  it('un taux de droits réduit permet de payer plus cher', () => {
    const h = { ...hypothesesVides(), revente: 280_000 }
    const normal = prixMaximum(valeurs(h, bien)!)
    const reduit = prixMaximum(valeurs({ ...h, droitsPct: 5 }, bien)!)
    expect(reduit).toBeGreaterThan(normal)
  })

  it('compte la commission de l’apporteur et ne descend jamais sous zéro', () => {
    const h = { ...hypothesesVides(), revente: 280_000 }
    expect(prixMaximum(valeurs(h, { ...bien, commissionApporteur: 5_000 })!)).toBeLessThan(prixMaximum(valeurs(h, bien)!))
    expect(prixMaximum(valeurs({ ...h, revente: 50_000 }, bien)!)).toBe(0)
  })

  it('détaille le bilan', () => {
    const v = valeurs({ ...hypothesesVides(), revente: 200_000, travauxForfait: 0, portageMois: 12, tauxAnnuelPct: 10 }, bien)!
    const b = bilan(100_000, v)
    expect(b.frais).toBeCloseTo(15_000)
    expect(b.portage).toBeCloseTo(11_500) // (100 k + 15 k) × 10 %
    expect(b.fraisRevente).toBeCloseTo(6_000)
    expect(b.marge).toBeCloseTo(200_000 - 6_000 - 126_500)
  })

  it('arrondit l’offre au millier inférieur', () => {
    expect(arrondiOffre(143_987)).toBe(143_000)
  })
})

describe('rendement locatif', () => {
  it('rapporte les loyers au coût total', () => {
    const r = rendement(200_000, 1_500, 3_000, { droitsPct: 12.5, notairePct: 2.5, travaux: 20_000 })!
    expect(r.coutTotal).toBeCloseTo(250_000)
    expect(r.brutPct).toBeCloseTo(7.2)
    expect(r.netPct).toBeCloseTo(6)
    expect(rendement(200_000, 0, 0, { droitsPct: 12.5, notairePct: 2.5, travaux: 0 })).toBeNull()
  })
})

describe('offres', () => {
  const o = (id: string, date: string, etat: Offre['etat']): Offre => ({ id, date, montant: 100_000, valableJusquau: null, etat, contreOffre: null, note: '' })

  it('retrouve l’offre en discussion', () => {
    expect(offreEnCours([o('a', '2026-11-01', 'refusee'), o('b', '2026-11-03', 'contre_offre'), o('c', '2026-11-02', 'en_attente')])!.id).toBe('b')
    expect(offreEnCours([o('a', '2026-11-01', 'acceptee')])).toBeNull()
    expect(offreEnCours(undefined)).toBeNull()
  })

  it('remplace les offres encore ouvertes', () => {
    const r = cloreOffresOuvertes([o('a', '2026-11-01', 'contre_offre'), o('b', '2026-11-02', 'en_attente'), o('c', '2026-10-01', 'refusee')], 'b')
    expect(r.map((x) => x.etat)).toEqual(['remplacee', 'en_attente', 'refusee'])
  })

  it('relance la veille de la fin de validité', () => {
    const depuis = new Date(2026, 10, 7, 10)
    expect(relanceOffre({ valableJusquau: '2026-11-14' }, depuis)).toEqual(new Date(2026, 10, 13, 9))
    expect(relanceOffre({ valableJusquau: '2026-11-08' }, depuis)).toEqual(new Date(2026, 10, 8, 9))
    expect(relanceOffre({ valableJusquau: null }, depuis)).toEqual(new Date(2026, 10, 12, 9))
  })
})

it('suggère le haut de la fourchette Statbel comme prix de revente', () => {
  expect(reventeSuggeree({ mediane: 150_000, p75: 199_000 })).toBe(199_000)
  expect(reventeSuggeree({ mediane: 150_000, p75: null })).toBe(150_000)
  expect(reventeSuggeree(null)).toBeNull()
})
