import { describe, expect, it } from 'vitest'
import type { Contact } from '@/data/types'
import { empreinte } from './doublons'
import { fusionnerDonnees, pairesDoublons } from './fusion'

const contact = (id: string, x: Partial<Contact> = {}): Contact =>
  ({
    id,
    civilite: '',
    prenom: '',
    nom: '',
    societe: '',
    telephones: [],
    emails: [],
    adresse: null,
    anciennesAdresses: [],
    dateNaissance: null,
    statuts: [],
    source: null,
    temperature: null,
    canalPrefere: null,
    utilisationCanaux: {},
    collaborateurId: null,
    tags: [],
    notes: '',
    nePasContacter: false,
    dernierContactAt: null,
    prochaineRelanceAt: null,
    dernierResultatPositif: false,
    ...x,
  }) as Contact

const index = (cs: Contact[]) => cs.map((c) => ({ fiche: c, empreinte: empreinte(c) }))

describe('Doublons', () => {
  it('trouve les paires par téléphone, email ou nom (mais pas une simple adresse commune)', () => {
    const adresse = { rue: 'Rue Puissant', numero: '7', boite: '', cp: '6060', ville: 'Gilly' }
    const paires = pairesDoublons(
      index([
        contact('1', { prenom: 'Marc', nom: 'Dupont', telephones: [{ numero: '0472 18 90 33' }] }),
        contact('2', { prenom: 'M.', nom: 'Dupond', telephones: [{ numero: '+32 472 18 90 33' }] }),
        contact('3', { prenom: 'Sophie', nom: 'Claes', emails: ['sophie@x.be'] }),
        contact('4', { nom: 'Claes Sophie', emails: ['Sophie@X.be'] }),
        contact('5', { prenom: 'Anna', nom: 'Rossi', adresse }),
        contact('6', { prenom: 'Giuseppe', nom: 'Bianchi', adresse }),
      ]),
    )
    expect(paires.map((p) => [p.a.id, p.b.id].sort().join('-')).sort()).toEqual(['1-2', '3-4'])
    expect(paires.find((p) => p.a.id === '1' || p.b.id === '1')!.raisons).toContain('telephone')
  })

  it('fusion : rien n’est perdu, « ne plus contacter » l’emporte', () => {
    const garde = contact('g', {
      prenom: 'Marc',
      nom: 'Dupont',
      telephones: [{ numero: '0472 18 90 33' }],
      statuts: ['prospect_vendeur'],
      notes: 'Rencontré au salon',
      prochaineRelanceAt: '2026-11-01T09:00:00.000Z',
      consentements: { sms: { etat: 'accorde', date: '2026-01-01', preuve: 'oral' } },
    })
    const autre = contact('a', {
      civilite: 'M.',
      nom: 'Dupond',
      telephones: [{ numero: '+32472189033' }, { numero: '071 45 67 89' }],
      emails: ['marc@x.be'],
      statuts: ['vendeur'],
      adresse: { rue: 'Rue Wilmet', numero: '23', boite: '', cp: '6041', ville: 'Gosselies' },
      notes: 'Vend la maison de sa mère',
      nePasContacter: true,
      dateNaissance: '1971-10-01',
      prochaineRelanceAt: '2026-10-10T09:00:00.000Z',
      consentements: { sms: { etat: 'retire', date: '2026-06-01', preuve: 'STOP' }, email: { etat: 'accorde', date: '2026-02-01', preuve: 'form' } },
    })
    const f = fusionnerDonnees(garde, autre)
    expect(f).toMatchObject({
      civilite: 'M.',
      prenom: 'Marc',
      nom: 'Dupont',
      emails: ['marc@x.be'],
      statuts: ['prospect_vendeur', 'vendeur'],
      notes: 'Rencontré au salon\n\nVend la maison de sa mère',
      nePasContacter: true,
      dateNaissance: '1971-10-01',
      prochaineRelanceAt: '2026-10-10T09:00:00.000Z',
      adresse: { rue: 'Rue Wilmet' },
    })
    expect(f.telephones!.map((t) => t.numero)).toEqual(['0472 18 90 33', '071 45 67 89']) // même numéro gardé une fois
    expect(f.consentements).toMatchObject({ sms: { etat: 'retire' }, email: { etat: 'accorde' } }) // le plus récent gagne
  })
})
