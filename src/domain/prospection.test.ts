import { describe, expect, it } from 'vitest'
import {
  baisseRecente,
  cleAnnonce,
  dimensionsReduites,
  distanceMetres,
  prochaineDateCle,
  relanceAvecDateCle,
  scoreInoccupation,
  statutApres,
  type DateCle,
} from './prospection'

const maintenant = new Date(2026, 8, 30, 10)

describe('entonnoir des pistes', () => {
  it('avance selon le résultat, sans reculer', () => {
    expect(statutApres('a_contacter', 'pas_reponse')).toBe('a_contacter')
    expect(statutApres('a_contacter', 'rappeler')).toBe('en_cours')
    expect(statutApres('en_cours', 'visite')).toBe('rdv')
    expect(statutApres('rdv', 'rappeler')).toBe('rdv')
    expect(statutApres('rdv', 'accord')).toBe('gagne')
    expect(statutApres('en_cours', 'ne_pas_rappeler')).toBe('perdu')
  })
})

describe('dates clés', () => {
  const finBail: DateCle = { id: '1', type: 'fin_bail', date: '2027-03-31', note: '' }
  it('rappel 6 semaines avant la fin du bail', () => {
    const r = new Date(relanceAvecDateCle(null, finBail, maintenant)!)
    expect(r).toEqual(new Date(2027, 1, 17, 9))
  })
  it('n’avance la relance que si la date clé arrive plus tôt', () => {
    const tot = new Date(2026, 10, 1).toISOString()
    expect(relanceAvecDateCle(tot, finBail, maintenant)).toBe(tot)
    const tard = new Date(2027, 5, 1).toISOString()
    expect(new Date(relanceAvecDateCle(tard, finBail, maintenant)!)).toEqual(new Date(2027, 1, 17, 9))
  })
  it('ignore une date passée ; trouve la prochaine date à venir', () => {
    const passee: DateCle = { id: '2', type: 'autre', date: '2026-01-01', note: '' }
    expect(relanceAvecDateCle(null, passee, maintenant)).toBeNull()
    expect(prochaineDateCle([passee, finBail], maintenant)?.dc.id).toBe('1')
  })
})

describe('veille des annonces', () => {
  it('repère une baisse de prix récente', () => {
    const h = [
      { date: new Date(2026, 5, 1).toISOString(), prix: 235000 },
      { date: new Date(2026, 8, 25).toISOString(), prix: 219000 },
    ]
    expect(baisseRecente(h, maintenant)).toEqual({ montant: 16000, il_y_a: 5 })
    expect(baisseRecente(h, new Date(2026, 11, 1))).toBeNull() // trop ancienne
    expect(baisseRecente([h[0]!], maintenant)).toBeNull()
  })

  it('reconnaît la même annonce même si le lien diffère', () => {
    expect(cleAnnonce('https://www.immoweb.be/fr/annonce/maison/a-vendre/charleroi/6000/20123456')).toBe('immoweb:20123456')
    expect(cleAnnonce('https://m.immoweb.be/nl/zoekertje/huis/te-koop/charleroi/6000/20123456/')).toBe('immoweb:20123456')
    expect(cleAnnonce('https://www.2ememain.be/v/immo/maisons-a-vendre/m2154879632-maison-jumet?c=1')).toBe('2ememain:m2154879632')
    expect(cleAnnonce('https://agence-exemple.be/bien/42/')).toBe('agence-exemple.be/bien/42')
  })
})

describe('divers', () => {
  it('score « maison vide probable »', () => {
    expect(scoreInoccupation([])).toBe(0)
    expect(scoreInoccupation(['boite_pleine', 'volets_fermes', 'jardin', 'lumiere'])).toBe(50)
  })
  it('distance entre deux points (même maison à moins de 25 m)', () => {
    const a = { lat: 50.4108, lng: 4.4446 }
    expect(distanceMetres(a, { lat: 50.41098, lng: 4.4446 })).toBeLessThan(25)
    expect(Math.round(distanceMetres(a, { lat: 50.4198, lng: 4.4446 }) / 100)).toBe(10) // ± 1 km
  })
  it('photos réduites à 1600 px sans agrandissement', () => {
    expect(dimensionsReduites(4032, 3024, 1600)).toEqual({ largeur: 1600, hauteur: 1200 })
    expect(dimensionsReduites(800, 600, 1600)).toEqual({ largeur: 800, hauteur: 600 })
  })
})
