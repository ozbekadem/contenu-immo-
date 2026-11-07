import { describe, expect, it } from 'vitest'
import { casPour } from './argumentaires'
import { etapesPour, libelleEtape, statutApres } from './prospection'
import { resultatsPour } from './resultats'

const maintenant = new Date(2026, 10, 7)

describe('parcours d’achat', () => {
  it('avance Visite → Offre → Compromis → Acheté sans jamais reculer', () => {
    expect(statutApres('rdv', 'offre_faite')).toBe('offre')
    expect(statutApres('en_cours', 'offre_refusee')).toBe('offre')
    expect(statutApres('offre', 'compromis')).toBe('compromis')
    expect(statutApres('compromis', 'offre_faite')).toBe('compromis')
    expect(statutApres('compromis', 'visite')).toBe('compromis')
    expect(statutApres('compromis', 'acte')).toBe('gagne')
    expect(statutApres('offre', 'ne_pas_rappeler')).toBe('perdu')
  })

  it('propose les étapes et libellés selon l’objectif', () => {
    expect(etapesPour('mandat')).toEqual(['a_contacter', 'en_cours', 'rdv', 'gagne'])
    expect(etapesPour('achat')).toHaveLength(6)
    expect(libelleEtape('gagne', 'achat')).toBe('Acheté')
    expect(libelleEtape('gagne', 'mandat')).toBe('Mandat')
    expect(libelleEtape('rdv', 'achat')).toBe('Visite')
  })

  it('propose les résultats d’achat pour une annonce dont l’objectif est l’achat', () => {
    expect(resultatsPour('appel', 'annonce')).toContain('mandat')
    const achat = resultatsPour('appel', 'annonce', 'achat')
    expect(achat).toContain('offre_faite')
    expect(achat).toContain('compromis')
    expect(achat).not.toContain('mandat')
    expect(resultatsPour('appel', 'maison_vide', 'mandat')).toContain('visite')
    expect(resultatsPour('appel', 'portefeuille', 'achat')).toContain('mandat')
  })

  it('choisit un argumentaire d’achat', () => {
    expect(casPour({ categorie: 'annonce', source: 'immoweb', objectif: 'achat' }, maintenant)).toBe('achat_direct')
    expect(casPour({ categorie: 'maison_vide', source: 'reperage', objectif: 'achat' }, maintenant)).toBe('achat_maison_vide')
    expect(casPour({ categorie: 'maison_vide', source: 'succession', objectif: 'achat' }, maintenant)).toBe('succession')
    expect(casPour({ categorie: 'annonce', source: 'immoweb', objectif: 'mandat' }, maintenant)).toBe('annonce_en_ligne')
    expect(casPour({ categorie: 'annonce', source: 'immoweb' }, maintenant)).toBe('annonce_en_ligne')
  })
})
