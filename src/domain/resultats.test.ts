import { describe, expect, it } from 'vitest'
import { classer, priorite } from './priorite'
import { appliquerResultat, type EtatSuiviContact } from './resultats'

const quand = new Date(2026, 8, 30, 14, 0)
const etat: EtatSuiviContact = {
  dernierContactAt: null,
  prochaineRelanceAt: null,
  dernierResultatPositif: false,
  nePasContacter: false,
  tentatives: 0,
  temperature: null,
  statuts: ['prospect_vendeur'],
}

describe('appliquerResultat', () => {
  it('pas de réponse : tentative comptée, pas de « dernier contact », relance demain 9 h', () => {
    const e = appliquerResultat(etat, 'pas_reponse', quand)
    expect(e.tentatives).toBe(1)
    expect(e.dernierContactAt).toBeNull()
    expect(new Date(e.prochaineRelanceAt!)).toEqual(new Date(2026, 9, 1, 9, 0))
  })

  it('personne jointe : dernier contact mis à jour, tentatives remises à zéro', () => {
    const e = appliquerResultat({ ...etat, tentatives: 3 }, 'rappeler', quand)
    expect(e.dernierContactAt).toBe(quand.toISOString())
    expect(e.tentatives).toBe(0)
    expect(new Date(e.prochaineRelanceAt!)).toEqual(new Date(2026, 9, 30, 14, 0))
  })

  it('la relance choisie par l’utilisateur remplace la proposition', () => {
    const choix = new Date(2027, 0, 5, 9)
    expect(appliquerResultat(etat, 'rappeler', quand, choix).prochaineRelanceAt).toBe(choix.toISOString())
    expect(appliquerResultat(etat, 'rappeler', quand, null).prochaineRelanceAt).toBeNull()
  })

  it('RDV obtenu : positif et chaud', () => {
    const e = appliquerResultat(etat, 'rdv', quand)
    expect(e).toMatchObject({ dernierResultatPositif: true, temperature: 'chaud' })
  })

  it('pas intéressé : froid, relance dans 6 mois (la porte reste ouverte)', () => {
    const e = appliquerResultat(etat, 'pas_interesse', quand)
    expect(e.temperature).toBe('froid')
    expect(new Date(e.prochaineRelanceAt!).getMonth()).toBe(2) // mars
  })

  it('mandat signé : le prospect devient vendeur', () => {
    expect(appliquerResultat(etat, 'mandat', quand).statuts).toEqual(['prospect_vendeur', 'vendeur'])
  })

  it('ne plus rappeler : bloqué et plus de relance', () => {
    expect(appliquerResultat({ ...etat, prochaineRelanceAt: quand.toISOString() }, 'ne_pas_rappeler', quand)).toMatchObject({
      nePasContacter: true,
      prochaineRelanceAt: null,
    })
  })

  it('une simple note ne change pas le suivi', () => {
    expect(appliquerResultat(etat, 'note', quand)).toEqual(etat)
  })
})

describe('Qui appeler en premier', () => {
  const base = { createdAt: new Date(2026, 5, 1).toISOString(), temperature: null, dernierResultatPositif: false, dernierContactAt: new Date(2026, 7, 1).toISOString() }
  const jour = (n: number) => new Date(2026, 8, 30 + n, 9).toISOString()

  it('ne classe que les prospects dus ou en retard', () => {
    expect(priorite({ ...base, couleur: 'jaune', prochaineRelanceAt: jour(3) }, quand)).toBeNull()
  })

  it('un prospect chaud avec échange positif passe avant un retard ordinaire', () => {
    const liste = [
      { id: 'retard', ...base, couleur: 'rouge' as const, prochaineRelanceAt: jour(-5) },
      { id: 'chaud', ...base, couleur: 'orange' as const, prochaineRelanceAt: jour(0), temperature: 'chaud' as const, dernierResultatPositif: true },
      { id: 'affiche', ...base, couleur: 'orange' as const, prochaineRelanceAt: jour(0), dernierContactAt: null, createdAt: jour(-1) },
    ]
    const ordre = classer(liste, quand).map((x) => x.element.id)
    expect(ordre).toEqual(['chaud', 'affiche', 'retard'])
  })

  it('donne les raisons en clair et pénalise les appels sans réponse', () => {
    const p = priorite({ ...base, couleur: 'rouge', prochaineRelanceAt: jour(-3), tentatives: 2 }, quand)!
    expect(p.raisons).toEqual(['relance en retard de 3 j', '2 appels sans réponse'])
    expect(p.score).toBe(3 - 10)
  })
})
