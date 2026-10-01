import { describe, expect, it } from 'vitest'
import { ARGUMENTAIRES_DEFAUT, casPour, ORDRE_CAS, personnaliserTexte } from './argumentaires'

const maintenant = new Date(2026, 9, 1, 10)

describe('Argumentaires', () => {
  it('choisit l’argumentaire selon la situation, le plus urgent d’abord', () => {
    expect(casPour({ categorie: 'annonce', source: 'affiche' }, maintenant)).toBe('affiche')
    expect(casPour({ categorie: 'annonce', source: 'immoweb' }, maintenant)).toBe('annonce_en_ligne')
    expect(
      casPour({ categorie: 'annonce', source: '2ememain', historiquePrix: [{ date: '2026-06-01', prix: 235000 }, { date: '2026-09-20', prix: 219000 }] }, maintenant),
    ).toBe('baisse_prix')
    expect(casPour({ categorie: 'annonce', source: 'immoweb', alerte: 'Annonce retirée du site' }, maintenant)).toBe('annonce_retiree')
    expect(casPour({ categorie: 'annonce', source: 'affiche', alerte: 'Panneau d’agence posé' }, maintenant)).toBe('autre_agence')
    expect(casPour({ categorie: 'maison_vide', source: 'reperage' }, maintenant)).toBe('maison_vide')
    expect(casPour({ categorie: 'portefeuille', source: 'recommandation' }, maintenant)).toBe('recommandation')
    expect(casPour({ categorie: 'portefeuille', statutsContact: ['ancien_client'] }, maintenant)).toBe('ancien_client')
    expect(casPour({ categorie: 'portefeuille' }, maintenant)).toBe('general')
  })

  it('chaque situation a un argumentaire avec des objections', () => {
    for (const cas of ORDRE_CAS) {
      expect(ARGUMENTAIRES_DEFAUT[cas].accroche.length).toBeGreaterThan(20)
      expect(ARGUMENTAIRES_DEFAUT[cas].objections.length).toBeGreaterThan(0)
    }
  })

  it('remplace [prénom] et [agence]', () => {
    expect(personnaliserTexte('Je suis [prénom] de l’agence [agence]', { prenom: 'Adem', agence: 'Agence du Centre' })).toBe('Je suis Adem de l’agence Agence du Centre')
    expect(personnaliserTexte('Je suis [prénom]', {})).toBe('Je suis [prénom]')
    for (const cas of ORDRE_CAS) expect(ARGUMENTAIRES_DEFAUT[cas].accroche).not.toMatch(/vision/i)
  })
})
