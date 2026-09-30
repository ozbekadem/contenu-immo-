import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { LinkimmoDB } from '../db'
import { BienRepository } from './biens'
import { ContactRepository } from './contacts'
import { InteractionRepository } from './interactions'
import { PisteRepository, type SaisieTerrain } from './pistes'

let db: LinkimmoDB
let pistes: PisteRepository
let biens: BienRepository
let contacts: ContactRepository
let interactions: InteractionRepository
const maintenant = new Date(2026, 8, 30, 10, 30)

beforeEach(() => {
  db = new LinkimmoDB(`test-${crypto.randomUUID()}`)
  pistes = new PisteRepository(db)
  biens = new BienRepository(db)
  contacts = new ContactRepository(db)
  interactions = new InteractionRepository(db)
})

const saisie = (p: Partial<SaisieTerrain> = {}): SaisieTerrain => ({
  categorie: 'annonce',
  source: 'affiche',
  telephone: '',
  nomProprietaire: '',
  adresse: { rue: 'Rue de la Montagne', numero: '88', boite: '', cp: '6000', ville: 'Charleroi' },
  position: { lat: 50.4108, lng: 4.4446, precision: 8 },
  adresseAChercher: false,
  typeBien: 'maison',
  prix: null,
  sourceUrl: null,
  indices: [],
  notes: '',
  photos: [],
  ...p,
})

describe('Repérage terrain', () => {
  it('affiche avec numéro : bien + propriétaire + piste à appeler aujourd’hui', async () => {
    const p = await pistes.creerDepuisTerrain(saisie({ telephone: '0477 31 52 86', prix: 189000 }), { maintenant })
    const contact = await contacts.get(p.contactId!)
    expect(contact).toMatchObject({ statuts: ['prospect_vendeur'], source: 'affiche', _telNorm: ['+32477315286'] })
    expect(new Date(p.prochaineRelanceAt!).toDateString()).toBe(maintenant.toDateString())
    expect(p.historiquePrix).toHaveLength(1)
    expect(p.veilleProchaine).not.toBeNull() // l'affiche sera revérifiée dans un mois
    expect((await biens.get(p.bienId))!._cleAdresse).toBe('rue montagne|88||6000')
  })

  it('maison vide sans propriétaire connu : rechercher le propriétaire dans 14 jours', async () => {
    const p = await pistes.creerDepuisTerrain(saisie({ categorie: 'maison_vide', source: 'reperage', indices: ['boite_pleine'] }), { maintenant })
    expect(p.contactId).toBeNull()
    expect(new Date(p.prochaineRelanceAt!)).toEqual(new Date(2026, 9, 14, 10, 30))
  })

  it('repère le même bien par l’adresse ou à moins de 25 m', async () => {
    const p = await pistes.creerDepuisTerrain(saisie(), { maintenant })
    const parAdresse = await biens.similaires({ rue: 'R. de la Montagne', numero: '88', boite: '', cp: '6000', ville: '' }, null)
    expect(parAdresse.map((x) => x.raison)).toEqual(['adresse'])
    const parGps = await biens.similaires(null, { lat: 50.41095, lng: 4.44462 })
    expect(parGps[0]).toMatchObject({ raison: 'proximite' })
    expect(parGps[0]!.bien.id).toBe(p.bienId)
    expect(await biens.similaires(null, { lat: 50.42, lng: 4.45 })).toHaveLength(0)
  })

  it('« C’est le même » : le repérage complète la piste en cours, sans en créer une deuxième', async () => {
    const p = await pistes.creerDepuisTerrain(saisie({ notes: 'Affiche au rez' }), { maintenant })
    const q = await pistes.creerDepuisTerrain(
      saisie({ bienExistantId: p.bienId, telephone: '0477 31 52 86', prix: 189000, notes: 'Numéro enfin lisible' }),
      { maintenant },
    )
    expect(q.id).toBe(p.id)
    expect(await db.pistes.count()).toBe(1)
    expect(q.contactId).not.toBeNull()
    expect(q.prix).toBe(189000)
    expect(q.notes).toBe('Affiche au rez\nNuméro enfin lisible')
    // Une piste terminée (perdue) laisse place à une nouvelle piste sur le même bien
    await pistes.modifier(p.id, { statut: 'perdu' })
    const r = await pistes.creerDepuisTerrain(saisie({ bienExistantId: p.bienId }), { maintenant })
    expect(r.id).not.toBe(p.id)
  })

  it('repère la même annonce collée deux fois', async () => {
    await pistes.creerDepuisTerrain(saisie({ source: 'immoweb', sourceUrl: 'https://www.immoweb.be/fr/annonce/maison/a-vendre/charleroi/6000/20123456' }), { maintenant })
    expect(await pistes.parAnnonce('immoweb:20123456')).toHaveLength(1)
  })
})

describe('Résultats sur une piste', () => {
  it('mandat signé : piste « Signé » et propriétaire devenu client, sans ressaisie', async () => {
    const p = await pistes.creerDepuisTerrain(saisie({ telephone: '0477315286' }), { maintenant })
    await interactions.enregistrerResultat({ contactId: p.contactId, pisteId: p.id, type: 'appel', resultat: 'pas_reponse', quand: maintenant })
    expect((await pistes.get(p.id))!.tentatives).toBe(1)
    await interactions.enregistrerResultat({ contactId: p.contactId, pisteId: p.id, type: 'appel', resultat: 'rdv', quand: maintenant })
    expect((await pistes.get(p.id))!.statut).toBe('rdv')
    await interactions.enregistrerResultat({ contactId: p.contactId, pisteId: p.id, type: 'note', resultat: 'mandat', quand: maintenant })
    expect((await pistes.get(p.id))!.statut).toBe('gagne')
    const c = (await contacts.get(p.contactId!))!
    expect(c.statuts).toEqual(['vendeur'])
    expect(c.dernierContactAt).toBe(maintenant.toISOString())
    expect(await interactions.pourPiste(p.id)).toHaveLength(3)
  })

  it('maison vide sans propriétaire : « introuvable » relance à 14 jours', async () => {
    const p = await pistes.creerDepuisTerrain(saisie({ categorie: 'maison_vide' }), { maintenant })
    const plusTard = new Date(2026, 9, 14, 11, 0)
    await interactions.enregistrerResultat({ contactId: null, pisteId: p.id, type: 'note', resultat: 'introuvable', quand: plusTard })
    const maj = (await pistes.get(p.id))!
    expect(maj.dernierResultat).toBe('introuvable')
    expect(new Date(maj.prochaineRelanceAt!)).toEqual(new Date(2026, 9, 28, 11, 0))
  })
})

describe('Veille des annonces et affiches', () => {
  it('une baisse de prix déclenche un appel aujourd’hui ; une hausse non', async () => {
    const p = await pistes.creerDepuisTerrain(saisie({ prix: 235000, sourceUrl: 'https://www.2ememain.be/v/immo/m123456789-maison' }), { maintenant })
    const plusTard = new Date(2026, 9, 20, 9)
    const baisse = await pistes.veillePrix(p, 219000, plusTard)
    expect(baisse.alerte).toMatch(/^Prix baissé de 16\s000 €$/)
    expect(baisse.prochaineRelanceAt).toBe(plusTard.toISOString())
    expect(baisse.historiquePrix.map((h) => h.prix)).toEqual([235000, 219000])
  })

  it('annonce retirée : alerte et appel aujourd’hui', async () => {
    const p = await pistes.creerDepuisTerrain(saisie({ sourceUrl: 'https://www.immoweb.be/fr/annonce/x/20123456' }), { maintenant })
    const r = await pistes.veilleChangement(p, 'retiree', maintenant)
    expect(r).toMatchObject({ veilleEtat: 'retiree', alerte: 'Annonce retirée', veilleProchaine: null })
  })
})
