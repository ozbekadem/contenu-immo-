import { describe, expect, it } from 'vitest'
import {
  couleurSuivi,
  dateRelance,
  heureOuvrable,
  libelleDernierContact,
  libelleProchaineRelance,
  parametresPour,
} from './relance'

const maintenant = new Date(2026, 8, 30, 10, 0) // 30 septembre 2026, 10 h
const jour = (offset: number, heure = 12) => new Date(2026, 8, 30 + offset, heure, 0)
const annonce = parametresPour('annonce') // seuil rouge 30 j

describe('couleurSuivi', () => {
  it('gris si archivé ou « ne pas rappeler », quoi qu’il arrive', () => {
    expect(couleurSuivi({ archive: true, prochaineRelanceAt: jour(-10) }, annonce, maintenant)).toBe('gris')
    expect(couleurSuivi({ nePasRappeler: true }, annonce, maintenant)).toBe('gris')
  })

  it('rouge si la relance est dépassée', () => {
    expect(couleurSuivi({ prochaineRelanceAt: jour(-1) }, annonce, maintenant)).toBe('rouge')
  })

  it('rouge même si le dernier résultat était positif, quand la relance est dépassée', () => {
    expect(couleurSuivi({ prochaineRelanceAt: jour(-2), dernierResultatPositif: true }, annonce, maintenant)).toBe('rouge')
  })

  it('orange si la relance est due aujourd’hui, quelle que soit l’heure', () => {
    expect(couleurSuivi({ prochaineRelanceAt: jour(0, 8) }, annonce, maintenant)).toBe('orange')
    expect(couleurSuivi({ prochaineRelanceAt: jour(0, 23) }, annonce, maintenant)).toBe('orange')
  })

  it('jaune si la relance est dans les 7 prochains jours', () => {
    expect(couleurSuivi({ prochaineRelanceAt: jour(1) }, annonce, maintenant)).toBe('jaune')
    expect(couleurSuivi({ prochaineRelanceAt: jour(7) }, annonce, maintenant)).toBe('jaune')
  })

  it('vert si la relance est planifiée plus loin', () => {
    expect(couleurSuivi({ prochaineRelanceAt: jour(8) }, annonce, maintenant)).toBe('vert')
  })

  it('rouge sans relance si aucun contact depuis plus que le seuil de la catégorie', () => {
    expect(couleurSuivi({ dernierContactAt: jour(-31) }, annonce, maintenant)).toBe('rouge')
    expect(couleurSuivi({ dernierContactAt: jour(-30) }, annonce, maintenant)).toBe('vert')
    const portefeuille = parametresPour('portefeuille') // 90 j
    expect(couleurSuivi({ dernierContactAt: jour(-60) }, portefeuille, maintenant)).toBe('vert')
    expect(couleurSuivi({ dernierContactAt: jour(-91) }, portefeuille, maintenant)).toBe('rouge')
  })

  it('une relance future planifiée évite le rouge « sans contact » (ex. « rappeler dans 6 mois »)', () => {
    expect(couleurSuivi({ dernierContactAt: jour(-100), prochaineRelanceAt: jour(80) }, annonce, maintenant)).toBe('vert')
  })

  it('utilise la date de repérage si le prospect n’a jamais été contacté', () => {
    expect(couleurSuivi({ creeLe: jour(-45) }, annonce, maintenant)).toBe('rouge')
    expect(couleurSuivi({ creeLe: jour(-2) }, annonce, maintenant)).toBe('vert')
  })

  it('le seuil est paramétrable', () => {
    const p = parametresPour('annonce', { seuilRougeJours: 10 })
    expect(couleurSuivi({ dernierContactAt: jour(-11) }, p, maintenant)).toBe('rouge')
  })
})

describe('libellés', () => {
  it('dernier contact', () => {
    expect(libelleDernierContact(null, maintenant)).toBe('jamais')
    expect(libelleDernierContact(jour(0, 8), maintenant)).toBe("aujourd'hui")
    expect(libelleDernierContact(jour(-1, 22), maintenant)).toBe('hier')
    expect(libelleDernierContact(jour(-45), maintenant)).toBe('il y a 45 jours')
  })

  it('prochaine relance', () => {
    expect(libelleProchaineRelance(null, maintenant)).toBe('aucune')
    expect(libelleProchaineRelance(jour(-1), maintenant)).toBe('en retard de 1 jour')
    expect(libelleProchaineRelance(jour(-3), maintenant)).toBe('en retard de 3 jours')
    expect(libelleProchaineRelance(jour(0), maintenant)).toBe("aujourd'hui")
    expect(libelleProchaineRelance(jour(1), maintenant)).toBe('demain')
    expect(libelleProchaineRelance(jour(7), maintenant)).toMatch(/7 oct/)
  })
})

describe('dateRelance', () => {
  it('ajoute semaine et mois', () => {
    expect(dateRelance('1s', jour(0))).toEqual(jour(7))
    expect(dateRelance('3m', new Date(2026, 8, 30))).toEqual(new Date(2026, 11, 30))
    expect(dateRelance('6m', new Date(2026, 8, 30))).toEqual(new Date(2027, 2, 30))
  })

  it('reste sur la fin du mois (31 janvier + 1 mois = 28 février)', () => {
    expect(dateRelance('1m', new Date(2027, 0, 31))).toEqual(new Date(2027, 1, 28))
  })
})

describe('Heure des relances proposées', () => {
  it('jamais la nuit : 9 h si l’échange a lieu le soir ou tôt le matin', () => {
    expect(heureOuvrable(new Date(2026, 9, 1, 14, 20))).toBe(14)
    expect(heureOuvrable(new Date(2026, 9, 1, 22, 30))).toBe(9)
    expect(heureOuvrable(new Date(2026, 9, 1, 7, 0))).toBe(9)
  })
})
