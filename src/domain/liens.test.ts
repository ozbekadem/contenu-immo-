import { describe, expect, it } from 'vitest'
import { detecterSource, normaliserUrl, tailleLisible, titreDepuisNomFichier, typeFichier } from './liens'

describe('normaliserUrl', () => {
  it('ajoute https:// si absent', () => {
    expect(normaliserUrl('www.immoweb.be/fr/annonce/maison/a-vendre/charleroi/6000/123')).toBe(
      'https://www.immoweb.be/fr/annonce/maison/a-vendre/charleroi/6000/123',
    )
  })
  it('extrait le lien d’un texte partagé', () => {
    expect(normaliserUrl('Regarde cette maison ! https://www.2ememain.be/v/immo/123 à Jumet')).toBe('https://www.2ememain.be/v/immo/123')
  })
  it('refuse ce qui n’est pas un lien', () => {
    expect(normaliserUrl('')).toBeNull()
    expect(normaliserUrl('maison jumet')).toBeNull()
  })
})

describe('detecterSource', () => {
  it.each([
    ['https://www.immoweb.be/fr/annonce/123', 'Immoweb'],
    ['https://www.2ememain.be/v/immo/123', '2ememain'],
    ['https://m.facebook.com/marketplace/item/1', 'Facebook'],
    ['https://www.zimmo.be/fr/charleroi-6000/a-vendre/maison/ABC/', 'Zimmo'],
  ])('%s → %s', (url, libelle) => {
    expect(detecterSource(url).libelle).toBe(libelle)
  })
  it('affiche le domaine pour un site d’agence inconnu', () => {
    expect(detecterSource('https://www.agence-exemple.be/bien/42')).toEqual({ code: 'autre', libelle: 'agence-exemple.be' })
  })
})

describe('fichiers', () => {
  it('reconnaît PDF, Word, tableur et images', () => {
    expect(typeFichier('annonce.PDF')).toBe('pdf')
    expect(typeFichier('compromis.docx')).toBe('word')
    expect(typeFichier('liste.xlsx')).toBe('tableur')
    expect(typeFichier('photo', 'image/jpeg')).toBe('image')
    expect(typeFichier('notes.zip')).toBe('autre')
  })
  it('taille et titre lisibles', () => {
    expect(tailleLisible(2_516_582)).toBe('2,4 Mo')
    expect(tailleLisible(3000)).toBe('3 Ko')
    expect(titreDepuisNomFichier('annonce_immoweb-rue-puissant.pdf')).toBe('annonce immoweb rue puissant')
    expect(titreDepuisNomFichier('Annonce Immoweb - Rue Puissant 7.pdf')).toBe('Annonce Immoweb – Rue Puissant 7')
  })
})
