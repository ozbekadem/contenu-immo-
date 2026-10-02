import { describe, expect, it } from 'vitest'
import { empreinte } from './doublons'
import { decouperAdresse, devinerColonnes, lireCsv, preparerImport, versCsv } from './importation'

describe('Import de contacts', () => {
  it('reconnaît les colonnes (français, néerlandais, anglais)', () => {
    expect(devinerColonnes(['Nom', 'Prénom', 'GSM', 'E-mail', 'Adresse', 'Remarques', 'Divers'])).toEqual(['nom', 'prenom', 'telephone', 'email', 'adresseComplete', 'notes', 'ignorer'])
    expect(devinerColonnes(['Voornaam', 'Achternaam', 'Telefoon', 'Straat', 'Huisnummer', 'Postcode', 'Gemeente'])).toEqual(['prenom', 'nom', 'telephone', 'rue', 'numero', 'cp', 'ville'])
    expect(devinerColonnes(['First name', 'Last name', 'Phone', 'Email', 'City'])).toEqual(['prenom', 'nom', 'telephone', 'email', 'ville'])
  })

  it('lit un CSV d’Excel (point-virgule, guillemets, accents, BOM)', () => {
    expect(lireCsv('﻿Nom;Notes\r\nDupont;"Dit ""oui""; rappeler"\r\n;\r\nClaes;\r\n')).toEqual([
      ['Nom', 'Notes'],
      ['Dupont', 'Dit "oui"; rappeler'],
      ['Claes', ''],
    ])
    expect(lireCsv('name,phone\nMarc,0472189033')).toEqual([
      ['name', 'phone'],
      ['Marc', '0472189033'],
    ])
  })

  it('découpe une adresse écrite en une seule colonne', () => {
    expect(decouperAdresse('Rue de la Montagne 88 bte 2, 6000 Charleroi')).toEqual({ rue: 'Rue de la Montagne', numero: '88', boite: '2', cp: '6000', ville: 'Charleroi' })
    expect(decouperAdresse('Avenue Paul Pastur, 145 Marcinelle')).toEqual({ rue: 'Avenue Paul Pastur', numero: '145', boite: '', cp: '6001', ville: 'Marcinelle' })
  })

  it('prépare les fiches et repère les doublons (avec la base et dans le fichier)', () => {
    const existant = { id: 'marc', empreinte: empreinte({ prenom: 'Marc', nom: 'Dupont', telephones: [{ numero: '0472 18 90 33' }], emails: [], adresse: null }) }
    const r = preparerImport(
      [
        ['M. Marc Dupont', '0472/18.90.33', '', 'Prospect vendeur', 'Affiche'],
        ['Mme Sophie Claes', '0478 55 44 33', 'SOPHIE@X.BE', 'Acheteuse', 'Immoweb'],
        ['', '', '', '', ''],
        ['Claes Sophie', '', 'sophie@x.be', '', ''],
      ],
      ['nomComplet', 'telephone', 'email', 'statut', 'source'],
      [existant],
    )
    expect(r.vides).toBe(1)
    expect(r.lignes.map((l) => [l.ligne, l.doublonDe, l.doublonLigne])).toEqual([
      [2, 'marc', null],
      [3, null, null],
      [5, null, 3],
    ])
    expect(r.lignes[1]!.contact).toMatchObject({ civilite: 'Mme', nom: 'Sophie Claes', telephones: [{ numero: '+32 478 55 44 33' }], emails: ['sophie@x.be'], statuts: ['acheteur'], source: 'immoweb' })
    expect(r.lignes[0]!.contact).toMatchObject({ civilite: 'M.', statuts: ['prospect_vendeur'], source: 'affiche' })
  })

  it('export CSV lisible par Excel en Belgique', () => {
    expect(versCsv([['Nom', 'Notes'], ['Dupont', 'a; b'], ['Claes', null]])).toBe('﻿Nom;Notes\r\nDupont;"a; b"\r\nClaes;\r\n')
  })
})
