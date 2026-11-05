import { afterEach, describe, expect, it, vi } from 'vitest'
import { biens, bienVide } from '@/data/repositories/biens'
import enregistre from './__fixtures__/geoservices-chaussee-charleroi-31.json'
import { chercherInfosPubliques, completerInfosPubliques } from './infosPubliques'

/**
 * Réponses réelles des services wallons, enregistrées le 5 novembre 2026 pour l'adresse de l'agence
 * (chaussée de Charleroi 31, 6061 Montignies-sur-Sambre), rejouées ici sans réseau.
 */
const REPONSES = enregistre as Record<string, unknown>
const AGENCE = { rue: 'Ch. de Charleroi', numero: '31', boite: '', cp: '6061', ville: 'Montignies-sur-Sambre' }

function fauxFetch(remplacer: (url: string) => unknown = () => undefined, appels: string[] = []): typeof fetch {
  return (async (url: string | URL, init?: RequestInit) => {
    const u = String(url)
    appels.push(u)
    const special = remplacer(u)
    if (special instanceof Error) throw special
    const json = special ?? REPONSES[init?.method === 'POST' ? `POST ${u}?${String(init.body)}` : `GET ${u}`]
    if (json === undefined) return { ok: false, status: 404, json: async () => ({}) } as Response
    return { ok: true, status: 200, json: async () => json } as Response
  }) as typeof fetch
}

/** Point officiel de l'adresse, tel que le registre ICAR l'a renvoyé. */
async function pointOfficiel() {
  const i = await chercherInfosPubliques({ adresse: AGENCE, lat: null, lng: null }, fauxFetch())
  return { lat: i.lat, lng: i.lng }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('Infos publiques : services wallons', () => {
  it('situe l’adresse officielle et lit cadastre, zone, risques, sous-sol et quartier', async () => {
    const i = await chercherInfosPubliques({ adresse: AGENCE, lat: null, lng: null }, fauxFetch())
    expect(i).toMatchObject({
      localisation: 'adresse',
      cle: 'chaussee charleroi|31||6061',
      adresseOfficielle: { rue: 'Chaussée de Charleroi', numero: '31', cp: '6061', localite: 'Montignies-sur-Sambre' },
      parcelle: { capakey: '52049C0112/00P000', division: 'Charleroi, 7ᵉ division', section: 'C', numero: '112P', surface: 165 },
      batiment: 70,
      planSecteur: 'Zone d’habitat',
      centralite: 'Centralité urbaine de pôle',
      inondation: { auBien: null, aProximite: 'Aléa élevé (ruissellement)' },
      sousSol: ['Présence potentielle d’anciens puits de mines'],
      concession: 'Mambourg, Sacré-Madame et Poiriers réunis (houille)',
      sols: null,
      patrimoine: [],
      quartier: { code: '52011E0', nom: 'Montignies-sur-Sambre-Centre' },
      manquants: [],
    })
    expect(i.inondation.carte).toMatch(/^https:\/\/cartodoc\.wallonie\.be\/.+\.pdf$/)
  })

  it('sans adresse reconnue, se rabat sur le point GPS', async () => {
    const { lat, lng } = await pointOfficiel()
    const i = await chercherInfosPubliques({ adresse: { ...AGENCE, rue: 'Rue Inconnue' }, lat, lng }, fauxFetch())
    expect(i.localisation).toBe('gps')
    expect(i.adresseOfficielle).toBeNull()
    expect(i.parcelle?.numero).toBe('112P')
  })

  it('sans adresse reconnue ni GPS : message clair', async () => {
    await expect(chercherInfosPubliques({ adresse: { ...AGENCE, rue: 'Rue Inconnue' }, lat: null, lng: null }, fauxFetch())).rejects.toThrow(/registre officiel/)
    await expect(chercherInfosPubliques({ adresse: null, lat: null, lng: null }, fauxFetch())).rejects.toThrow(/adresse/)
  })

  it('une rubrique en panne n’empêche pas les autres', async () => {
    const i = await chercherInfosPubliques({ adresse: AGENCE, lat: null, lng: null }, fauxFetch((u) => (u.includes('LIMITES_QS_STATBEL') ? new Error('panne') : undefined)))
    expect(i.quartier).toBeNull()
    expect(i.manquants).toEqual(['quartier'])
    expect(i.parcelle?.capakey).toBe('52049C0112/00P000')
  })

  it('hors connexion : erreur compréhensible', async () => {
    await expect(chercherInfosPubliques({ adresse: AGENCE, lat: null, lng: null }, fauxFetch(() => new TypeError('Failed to fetch')))).rejects.toThrow(/connexion/)
  })

  it('enregistre les infos sur le bien, une seule recherche à la fois', async () => {
    const appels: string[] = []
    vi.stubGlobal('fetch', fauxFetch(undefined, appels))
    const b = await biens.creer({ ...bienVide(), adresse: { ...AGENCE, rue: 'Chaussée de Charleroi' } })
    const [a, c] = await Promise.all([completerInfosPubliques(b), completerInfosPubliques(b)])
    expect(a).toBe(c)
    expect(appels.filter((u) => u.includes('ICAR_ADR_PT')).length).toBe(1)
    const apres = await biens.get(b.id)
    expect(apres?.infosPubliques?.parcelle?.capakey).toBe('52049C0112/00P000')
  })
})
