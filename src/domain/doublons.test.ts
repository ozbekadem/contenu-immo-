import { describe, expect, it } from 'vitest'
import { comparer, empreinte, trouverSimilaires } from './doublons'

const fiche = (p: Partial<Parameters<typeof empreinte>[0]> = {}) =>
  empreinte({ prenom: '', nom: '', telephones: [], emails: [], adresse: null, ...p })

const dupont = fiche({
  prenom: 'Marc',
  nom: 'Dupont',
  telephones: [{ numero: '0472 18 90 33' }],
  emails: ['marc.dupont@exemple.be'],
  adresse: { rue: 'Chaussée de Bruxelles', numero: '212', boite: '', cp: '6040', ville: 'Jumet' },
})

describe('comparer', () => {
  it('même téléphone, quel que soit le format', () => {
    expect(comparer(fiche({ telephones: [{ numero: '+32472/18.90.33' }] }), dupont)).toEqual(['telephone'])
  })
  it('même email en majuscules', () => {
    expect(comparer(fiche({ emails: [' MARC.Dupont@exemple.be '] }), dupont)).toEqual(['email'])
  })
  it('nom mal orthographié, même prénom', () => {
    expect(comparer(fiche({ prenom: 'Marc', nom: 'Dupond' }), dupont)).toEqual(['nom'])
  })
  it('prénom et nom inversés', () => {
    expect(comparer(fiche({ prenom: 'Dupont', nom: 'Marc' }), dupont)).toEqual(['nom_inverse'])
  })
  it('même nom sans prénom : seulement si même localité', () => {
    expect(comparer(fiche({ nom: 'Dupond' }), dupont)).toEqual([])
    expect(comparer(fiche({ nom: 'Dupond', adresse: { rue: '', numero: '', cp: '', ville: 'Jumet' } }), dupont)).toEqual(['nom'])
  })
  it('homonyme avec un autre prénom : pas d’alerte', () => {
    expect(comparer(fiche({ prenom: 'Julie', nom: 'Dupont' }), dupont)).toEqual([])
  })
  it('même adresse écrite autrement', () => {
    expect(comparer(fiche({ adresse: { rue: 'Chée de Bruxelles', numero: '212', boite: '', cp: '6040', ville: '' } }), dupont)).toEqual(['adresse'])
  })
})

describe('trouverSimilaires', () => {
  it('classe les plus probables en premier et ignore la fiche en cours', () => {
    const fiches = [
      { fiche: { id: 'a' }, empreinte: dupont },
      { fiche: { id: 'b' }, empreinte: fiche({ prenom: 'Marc', nom: 'Dupond' }) },
      { fiche: { id: 'c' }, empreinte: fiche({ prenom: 'Julie', nom: 'Martin' }) },
    ]
    const saisie = fiche({ prenom: 'Marc', nom: 'Dupont', telephones: [{ numero: '0472189033' }] })
    expect(trouverSimilaires(saisie, fiches).map((c) => c.fiche.id)).toEqual(['a', 'b'])
    expect(trouverSimilaires(saisie, fiches, 'a').map((c) => c.fiche.id)).toEqual(['b'])
  })

  it('« même immeuble » seul ne suffit pas', () => {
    const voisin = fiche({ adresse: { rue: 'Avenue Paul Pastur', numero: '301', boite: '5', cp: '6032', ville: '' } })
    const saisie = fiche({ adresse: { rue: 'Av. Paul Pastur', numero: '301', boite: '2', cp: '6032', ville: '' } })
    expect(trouverSimilaires(saisie, [{ fiche: { id: 'v' }, empreinte: voisin }])).toEqual([])
  })
})
