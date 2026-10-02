import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { LinkimmoDB } from '../db'
import { EvenementRepository } from '../repositories/evenements'
import { CLE_AGENDAS_ESTIMATIONS, ImportEstimations } from './estimations'
import { FauxGoogle } from './faux'
import { SyncGoogle } from './moteur'

const maintenant = new Date('2026-10-02T08:00:00Z')
const PRINCIPAL = 'adem@gmail.com'
const SECRETARIAT = 'secretariat.agence@gmail.com'
let google: FauxGoogle

function appareil() {
  const db = new LinkimmoDB(`test-${crypto.randomUUID()}`)
  const options = { utilisateur: () => 'adem', maintenant: () => maintenant }
  return {
    db,
    estimations: new ImportEstimations(db, google.transport(), options),
    sync: new SyncGoogle(db, google.transport(), { ...options, origine: 'https://linkimmo.test' }),
    evenements: new EvenementRepository(db),
  }
}

const rdv = (id: string, titre: string, debut: string, extra = {}) => ({
  id,
  summary: titre,
  start: { dateTime: debut },
  end: { dateTime: new Date(new Date(debut).getTime() + 3_600_000).toISOString() },
  ...extra,
})

beforeEach(() => {
  google = new FauxGoogle()
  google.ajouterAgenda(PRINCIPAL, 'Adem', true)
  google.ajouterAgenda(SECRETARIAT, 'Secrétariat')
  google.ajouterAgenda('fr.be#holiday@group.v.calendar.google.com', 'Jours fériés en Belgique')
})

describe('Estimations notées par le secrétariat dans Google Agenda', () => {
  it('seuls les rendez-vous « Estimation… » entrent dans Prospect’Immo, « à encoder »', async () => {
    const a = appareil()
    google.ecrireDans(SECRETARIAT, rdv('s1', 'Estimation – M. Lambert 0475 12 34 56', '2026-10-05T08:00:00Z', { location: 'Rue de Gosselies 12, Jumet', description: 'Maison 3 façades<br>Veut vendre avant l’été' }))
    google.ecrireDans(SECRETARIAT, rdv('s2', 'Dentiste', '2026-10-05T12:00:00Z'))
    google.ecrireDans(PRINCIPAL, rdv('p1', 'estimation Dupont', '2026-10-06T09:00:00Z'))
    expect((await a.estimations.agendasDisponibles()).map((x) => x.nom)).toEqual(['Adem', 'Secrétariat'])

    expect(await a.estimations.importer()).toEqual({ ajoutees: 2, modifiees: 0, retirees: 0 })
    const liste = await a.db.evenements.toArray()
    expect(liste.map((e) => e.titre).sort()).toEqual(['Estimation – M. Lambert 0475 12 34 56', 'estimation Dupont'])
    const lambert = liste.find((e) => e.googleEventId === 's1')!
    expect(lambert).toMatchObject({ type: 'estimation', aEncoder: true, lieu: 'Rue de Gosselies 12, Jumet', notes: 'Maison 3 façades\nVeut vendre avant l’été', googleCalendrierId: SECRETARIAT, debut: '2026-10-05T08:00:00.000Z' })
    expect(await a.db.outbox.count()).toBeGreaterThan(0) // partagé avec l'équipe
  })

  it('la secrétaire déplace puis supprime le rendez-vous : Prospect’Immo suit', async () => {
    const a = appareil()
    google.ecrireDans(SECRETARIAT, rdv('s1', 'Estimation Rossi', '2026-10-05T08:00:00Z'))
    await a.estimations.importer()
    google.ecrireDans(SECRETARIAT, rdv('s1', 'Estimation Rossi', '2026-10-07T13:30:00Z'))
    expect(await a.estimations.importer()).toMatchObject({ modifiees: 1 })
    expect((await a.db.evenements.toArray())[0]!.debut).toBe('2026-10-07T13:30:00.000Z')
    expect(await a.estimations.importer()).toEqual({ ajoutees: 0, modifiees: 0, retirees: 0 }) // rien de neuf : rien ne bouge

    google.supprimerDans(SECRETARIAT, 's1')
    expect(await a.estimations.importer()).toMatchObject({ retirees: 1 })
    expect((await a.db.evenements.toArray())[0]!.archivedAt).not.toBeNull() // archivé, jamais effacé
  })

  it('une fois encodée, la fiche garde vos informations (seules la date et l’heure suivent Google)', async () => {
    const a = appareil()
    google.ecrireDans(SECRETARIAT, rdv('s1', 'Estimation Claes', '2026-10-05T08:00:00Z'))
    await a.estimations.importer()
    const [e] = await a.db.evenements.toArray()
    await a.evenements.modifier(e!.id, { aEncoder: false, contactId: 'contact-claes', titre: 'Estimation appartement Claes', notes: 'Bien en indivision' })
    google.ecrireDans(SECRETARIAT, rdv('s1', 'Estimation Claes (2e étage)', '2026-10-05T09:00:00Z'))
    await a.estimations.importer()
    expect(await a.db.evenements.get(e!.id)).toMatchObject({ titre: 'Estimation appartement Claes', notes: 'Bien en indivision', contactId: 'contact-claes', debut: '2026-10-05T09:00:00.000Z' })
  })

  it('pas de doublon : ni entre deux appareils, ni recopiée dans le calendrier « Prospect’Immo »', async () => {
    const tel = appareil()
    const pc = appareil()
    google.ecrireDans(SECRETARIAT, rdv('s1', 'Estimation Hermans', '2026-10-05T08:00:00Z'))
    await tel.estimations.importer()
    await pc.estimations.importer()
    expect((await tel.db.evenements.toArray())[0]!.id).toBe((await pc.db.evenements.toArray())[0]!.id) // même fiche
    await tel.sync.synchroniser()
    expect(google.actifs()).toHaveLength(0) // déjà dans l'agenda du secrétariat : pas recopiée
  })

  it('agendas choisis : seuls ceux-là sont lus', async () => {
    const a = appareil()
    await a.db.meta.put({ cle: CLE_AGENDAS_ESTIMATIONS, valeur: [SECRETARIAT] })
    google.ecrireDans(PRINCIPAL, rdv('p1', 'Estimation privée', '2026-10-06T09:00:00Z'))
    google.ecrireDans(SECRETARIAT, rdv('s1', 'Estimation Peeters', '2026-10-06T10:00:00Z'))
    expect(await a.estimations.importer()).toMatchObject({ ajoutees: 1 })
  })
})
