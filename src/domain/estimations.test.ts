import { describe, expect, it } from 'vitest'
import { estEstimation, extraireCoordonnees } from './estimations'

describe('Estimations reçues par Google Agenda', () => {
  it('reconnaît les titres qui commencent par « Estimation »', () => {
    for (const t of ['Estimation – M. Lambert', 'ESTIMATION Dupont', 'estimation: rue X', '📍 Estimation Rossi', 'Estim. Claes', 'Éstimation Peeters'])
      expect(estEstimation(t), t).toBe(true)
    for (const t of ['Visite estimation', 'RDV notaire', 'Estimer le prix', '', null]) expect(estEstimation(t), String(t)).toBe(false)
  })

  it('lit le nom, le téléphone et l’adresse du titre', () => {
    expect(extraireCoordonnees('Estimation – M. Lambert 0475 12 34 56 – Rue de Gosselies 12, Jumet')).toEqual({
      civilite: 'M.',
      prenom: '',
      nom: 'Lambert',
      telephones: ['+32475123456'],
      email: null,
      adresse: { rue: 'Rue de Gosselies', numero: '12', boite: '', cp: '6040', ville: 'Jumet' },
    })
  })

  it('cherche aussi dans la description et le lieu', () => {
    const c = extraireCoordonnees(
      'Estimation Dupont Jean',
      'Tél : 071/45.67.89\nGSM +32 (0)476 98 76 54\nMail : jean.dupont@gmail.com\nVeut vendre la maison de sa mère',
      'Avenue Paul Pastur 145 bte 2, 6001 Marcinelle',
    )
    expect(c).toMatchObject({
      prenom: '',
      nom: 'Dupont Jean', // ordre inconnu : rien n'est deviné
      telephones: ['+3271456789', '+32476987654'],
      email: 'jean.dupont@gmail.com',
      adresse: { rue: 'Avenue Paul Pastur', numero: '145', boite: '2', cp: '6001', ville: 'Marcinelle' },
    })
  })

  it('« DUPONT Jean » : le nom en majuscules est le nom de famille ; « Mme Anne Claes »', () => {
    expect(extraireCoordonnees('Estimation DUPONT Jean 0475123456')).toMatchObject({ nom: 'Dupont', prenom: 'Jean' })
    expect(extraireCoordonnees('Estimation : Mme Anne Claes')).toMatchObject({ civilite: 'Mme', prenom: 'Anne', nom: 'Claes' })
  })

  it('rien à lire : tout reste vide (rien n’est inventé)', () => {
    expect(extraireCoordonnees('Estimation')).toEqual({ civilite: '', prenom: '', nom: '', telephones: [], email: null, adresse: null })
  })
})
