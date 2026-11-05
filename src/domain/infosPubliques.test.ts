import { describe, expect, it } from 'vitest'
import { cleRecherche, constats, infosAJour, memeRue, nomDivision, numeroOfficiel, numeroParcelle, pireAlea, surfacePolygone, titre, type InfosPubliques } from './infosPubliques'

const base: InfosPubliques = {
  consulteLe: '2026-11-05T10:00:00.000Z',
  cle: 'chaussee charleroi|31||6061',
  localisation: 'adresse',
  lat: 50.40113,
  lng: 4.47731,
  adresseOfficielle: { rue: 'Chaussée de Charleroi', numero: '31', boite: '', cp: '6061', localite: 'Montignies-sur-Sambre' },
  parcelle: { capakey: '52049C0112/00P000', division: 'Charleroi, 7ᵉ division', section: 'C', numero: '112P', surface: 165 },
  batiment: 70,
  planSecteur: 'Zone d’habitat',
  centralite: null,
  inondation: { auBien: null, aProximite: null, carte: null },
  sousSol: [],
  concession: null,
  sols: null,
  patrimoine: [],
  quartier: null,
  manquants: [],
}

describe('Infos publiques (Wallonie)', () => {
  it('écrit le numéro de parcelle comme le cadastre', () => {
    expect(numeroParcelle('0112', '00', 'P', '000')).toBe('112P')
    expect(numeroParcelle('0045', '02', 'A', '003')).toBe('45/2A3')
    expect(numeroParcelle('0123', '00', '_', '000')).toBe('123')
  })

  it('nomme la division cadastrale', () => {
    expect(nomDivision('CHARLEROI 7 DIV/MONTIGNIES-SUR-SAMB', 'Charleroi')).toBe('Charleroi, 7ᵉ division')
    expect(nomDivision('FLEURUS 1 DIV/FLEURUS', 'Fleurus')).toBe('Fleurus, 1ʳᵉ division')
    expect(nomDivision('GERPINNES', 'Gerpinnes')).toBe('Gerpinnes')
  })

  it('reconnaît la même rue malgré abréviations, tirets et suffixe de section du registre', () => {
    expect(memeRue('Chaussée de Charleroi', 'Ch. de Charleroi')).toBe(true)
    expect(memeRue('Rue Paul Janson (MT)', 'r. Paul-Janson')).toBe(true)
    expect(memeRue('Rue Monin', 'Monin')).toBe(true)
    expect(memeRue('Rue de Charleroi', 'Chaussée de Charleroi')).toBe(false)
    expect(numeroOfficiel(' 22 a ')).toBe('22A')
  })

  it('mesure une surface sur le plan (trous déduits)', () => {
    const carre = [[0, 0], [0, 20], [10, 20], [10, 0], [0, 0]]
    const trou = [[2, 2], [4, 2], [4, 4], [2, 4], [2, 2]]
    expect(surfacePolygone([carre])).toBe(200)
    expect(surfacePolygone([carre, trou])).toBe(196)
  })

  it('retient l’aléa d’inondation le plus grave', () => {
    expect(pireAlea([])).toBeNull()
    expect(
      pireAlea([
        { CODEALEA: 10, VALEUR: 'Aléa faible', TYPEALEA: 'Débordement' },
        { CODEALEA: 30, VALEUR: 'Aléa élevé', TYPEALEA: 'Ruissellement' },
      ]),
    ).toBe('Aléa élevé (ruissellement)')
  })

  it('liste les points à signaler, les plus graves d’abord', () => {
    expect(constats(base)).toEqual([])
    const c = constats({
      ...base,
      inondation: { auBien: null, aProximite: 'Aléa élevé (ruissellement)', carte: null },
      sousSol: ['Présence potentielle d’anciens puits de mines'],
      sols: { statut: 'Démarches à prévoir', demarches: true, lien: null },
    })
    expect(c.map((x) => x.niveau)).toEqual(['alerte', 'attention', 'attention'])
    expect(c[0]!.texte).toMatch(/^Sol/)
    expect(c.some((x) => x.texte === 'Inondation : aléa élevé (ruissellement) à moins de 50\u00a0m')).toBe(true)
  })

  it('sait quand refaire la recherche (adresse ou position changée, rubrique manquante)', () => {
    const adresse = { rue: 'Chaussée de Charleroi', numero: '31', boite: '', cp: '6061', ville: 'Montignies-sur-Sambre' }
    expect(cleRecherche(adresse, null, null)).toBe('chaussee charleroi|31||6061')
    expect(cleRecherche(null, 50.401134, 4.477308)).toBe('gps|50.40113|4.47731')
    expect(cleRecherche(null, null, null)).toBeNull()
    expect(infosAJour(base, 'chaussee charleroi|31||6061')).toBe(true)
    expect(infosAJour(base, 'chaussee charleroi|33||6061')).toBe(false)
    expect(infosAJour({ ...base, manquants: ['quartier'] }, base.cle)).toBe(false)
    expect(infosAJour(null, base.cle)).toBe(false)
  })

  it('remet en forme les noms en majuscules', () => {
    expect(titre('MONTIGNIES-SUR-SAMBRE-CENTRE')).toBe('Montignies-sur-Sambre-Centre')
    expect(titre('MARCHIENNE-AU-PONT')).toBe('Marchienne-au-Pont')
  })
})
