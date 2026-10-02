import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { LinkimmoDB } from '../db'
import { CampagneRepository, FILTRES_VIDES, ModeleRepository, repartir, selectionner } from './communication'
import { ContactRepository, contactVide } from './contacts'

let db: LinkimmoDB
let contacts: ContactRepository
let campagnes: CampagneRepository
const accord = { etat: 'accorde' as const, date: '2026-09-01', preuve: 'Accord oral' }

beforeEach(() => {
  db = new LinkimmoDB(`test-${crypto.randomUUID()}`)
  contacts = new ContactRepository(db)
  campagnes = new CampagneRepository(db)
})

describe('Campagnes', () => {
  it('choisit les destinataires, bloque sans consentement, journalise chaque envoi', async () => {
    const marc = await contacts.creer({ ...contactVide(), prenom: 'Marc', telephones: [{ numero: '0472 18 90 33' }], statuts: ['ancien_client'], adresse: { rue: '', numero: '', boite: '', cp: '6041', ville: 'Gosselies' }, consentements: { sms: accord } })
    await contacts.creer({ ...contactVide(), prenom: 'Sans accord', telephones: [{ numero: '0475 11 22 33' }], statuts: ['ancien_client'] })
    await contacts.creer({ ...contactVide(), prenom: 'Opposé', telephones: [{ numero: '0476 11 22 33' }], statuts: ['ancien_client'], nePasContacter: true, consentements: { sms: accord } })
    await contacts.creer({ ...contactVide(), prenom: 'Acheteur', telephones: [{ numero: '0477 11 22 33' }], statuts: ['acheteur'], consentements: { sms: accord } })

    const choisis = selectionner(await db.contacts.toArray(), { ...FILTRES_VIDES, statuts: ['ancien_client'] })
    expect(choisis).toHaveLength(3)
    expect(selectionner(await db.contacts.toArray(), { ...FILTRES_VIDES, localites: ['gosselies'] }).map((c) => c.prenom)).toEqual(['Marc'])

    const r = repartir(choisis, 'sms', '2026-10-02')
    expect(r.aEnvoyer.map((c) => c.prenom)).toEqual(['Marc'])
    expect(r.bloques.map((b) => [b.contact.prenom, b.raison]).sort()).toEqual([
      ['Opposé', 'opposition'],
      ['Sans accord', 'sans_consentement'],
    ])

    const c = await campagnes.lancer({ nom: 'Nouvelles', canal: 'sms', sujet: '', texte: '{{bonjour}} !', filtres: FILTRES_VIDES }, r)
    const envois = await campagnes.envois.deCampagne(c.id)
    expect(envois.map((e) => e.etat).sort()).toEqual(['a_envoyer', 'bloque', 'bloque']) // les bloqués restent tracés
    const aEnvoyer = envois.find((e) => e.etat === 'a_envoyer')!
    await campagnes.marquerEnvoye(c, aEnvoyer, 'Bonjour Marc !')
    expect((await campagnes.envois.get(aEnvoyer.id))!.etat).toBe('envoye')
    const historique = await db.interactions.where('contactId').equals(marc.id).toArray()
    expect(historique[0]).toMatchObject({ type: 'sms', resultat: 'message_envoye', campagneId: c.id, commentaire: 'Campagne « Nouvelles » : Bonjour Marc !' })
    expect(await db.outbox.count()).toBeGreaterThan(0) // partagé avec l'équipe
  })

  it('campagne sur des contacts de démonstration : reste locale', async () => {
    await contacts.creer({ ...contactVide(), prenom: 'Démo', telephones: [{ numero: '0472 18 90 33' }], consentements: { sms: accord } }, { demo: true })
    const avant = await db.outbox.count()
    const c = await campagnes.lancer({ nom: 'Test', canal: 'sms', sujet: '', texte: 'x', filtres: FILTRES_VIDES }, repartir(await db.contacts.toArray(), 'sms', '2026-10-02'))
    expect(c._demo).toBe(true)
    expect(await db.outbox.count()).toBe(avant)
  })

  it('modèles fournis + modèles de l’agence', async () => {
    const m = new ModeleRepository(db)
    await m.creer({ nom: 'Mon modèle', canal: 'sms', sujet: '', texte: 'Coucou' })
    const tous = await m.tous('sms')
    expect(tous[0]).toMatchObject({ nom: 'Mon modèle', fourni: false })
    expect(tous.some((x) => x.fourni)).toBe(true)
    expect((await m.tous('email')).every((x) => x.canal === 'email')).toBe(true)
  })
})
