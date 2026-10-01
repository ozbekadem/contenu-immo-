import type { LinkimmoDB } from '../db'
import { ContactRepository } from '../repositories/contacts'
import { EvenementRepository } from '../repositories/evenements'
import { PisteRepository } from '../repositories/pistes'
import type { LienGoogle } from '../types'
import { estIdLinkimmo, evenementsSouhaites, NOM_CALENDRIER, notesDepuisDescription, type Souhaite } from './souhaites'
import { ErreurGoogle, type EvenementGoogle, type TransportGoogle } from './transport'

const CLE_CALENDRIER = 'google.calendrier'
const CLE_JETON_SYNC = 'google.syncToken'
export const CLE_DERNIERE_SYNC = 'google.derniereSync'

export interface BilanGoogle {
  envoyes: number
  supprimes: number
  recus: number
}

function debutDe(e: EvenementGoogle): { iso: string; journee: boolean } | null {
  if (e.start?.dateTime) return { iso: new Date(e.start.dateTime).toISOString(), journee: false }
  if (e.start?.date) {
    const [a, m, j] = e.start.date.split('-').map(Number)
    return { iso: new Date(a!, m! - 1, j!).toISOString(), journee: true }
  }
  return null
}

function finDe(e: EvenementGoogle, debut: string): string {
  if (e.end?.dateTime) return new Date(e.end.dateTime).toISOString()
  if (e.end?.date) {
    const [a, m, j] = e.end.date.split('-').map(Number)
    return new Date(a!, m! - 1, j!).toISOString()
  }
  return new Date(new Date(debut).getTime() + 3_600_000).toISOString()
}

/**
 * Synchronisation dans les deux sens avec le calendrier « Linkimmo » de l'utilisateur :
 * 1. on lit ce qui a changé dans Google (heure déplacée, événement supprimé ou ajouté à la main) ;
 * 2. on envoie ce qui a changé dans l'application (relances, rendez-vous).
 * Si les deux côtés ont changé le même élément, la version de l'application est gardée.
 */
export class SyncGoogle {
  private readonly contacts: ContactRepository
  private readonly pistes: PisteRepository
  private readonly evenements: EvenementRepository

  constructor(
    private readonly db: LinkimmoDB,
    private readonly transport: TransportGoogle,
    private readonly options: { origine: string; utilisateur: () => string | null; maintenant?: () => Date },
  ) {
    this.contacts = new ContactRepository(db)
    this.pistes = new PisteRepository(db)
    this.evenements = new EvenementRepository(db)
  }

  private async souhaites(): Promise<Map<string, Souhaite>> {
    const [contacts, pistes, biens, evenements] = await Promise.all([this.db.contacts.toArray(), this.db.pistes.toArray(), this.db.biens.toArray(), this.db.evenements.toArray()])
    const liste = evenementsSouhaites(
      { contacts, pistes, biens, evenements },
      { utilisateur: this.options.utilisateur(), origine: this.options.origine, maintenant: this.options.maintenant?.() ?? new Date() },
    )
    return new Map(liste.map((s) => [s.cle, s]))
  }

  private async calendrier(): Promise<string> {
    const connu = (await this.db.meta.get(CLE_CALENDRIER))?.valeur as string | undefined
    if (connu) return connu
    const id = await this.transport.calendrier(NOM_CALENDRIER)
    await this.db.meta.put({ cle: CLE_CALENDRIER, valeur: id })
    return id
  }

  async synchroniser(): Promise<BilanGoogle> {
    const cal = await this.calendrier()
    const bilan: BilanGoogle = { envoyes: 0, supprimes: 0, recus: 0 }

    // 1. Changements faits dans Google
    let jeton = ((await this.db.meta.get(CLE_JETON_SYNC))?.valeur as string | undefined) ?? null
    let page
    try {
      page = await this.transport.changements(cal, jeton)
    } catch (e) {
      if (!(e instanceof ErreurGoogle) || e.statut !== 410) throw e
      jeton = null // jeton expiré : relecture complète
      page = await this.transport.changements(cal, null)
    }
    let souhaites = await this.souhaites()
    for (const ev of page.evenements) if (await this.recevoir(ev, souhaites)) bilan.recus++

    // 2. Changements faits dans l'application
    if (bilan.recus) souhaites = await this.souhaites()
    const liens = new Map((await this.db.liensGoogle.toArray()).map((l) => [l.cle, l]))
    for (const s of souhaites.values()) {
      const lien = liens.get(s.cle)
      if (lien && lien.signature === s.signature) continue
      const envoye = await this.envoyer(cal, s.evenement, !!lien)
      await this.db.liensGoogle.put({ cle: s.cle, eventId: s.evenement.id, signature: s.signature, majGoogle: envoye.updated ?? '' })
      bilan.envoyes++
    }
    for (const lien of liens.values()) {
      if (souhaites.has(lien.cle)) continue
      try {
        await this.transport.supprimer(cal, lien.eventId)
      } catch (e) {
        if (!(e instanceof ErreurGoogle) || (e.statut !== 404 && e.statut !== 410)) throw e
      }
      await this.db.liensGoogle.delete(lien.cle)
      bilan.supprimes++
    }

    await this.db.meta.bulkPut([
      { cle: CLE_JETON_SYNC, valeur: page.syncToken },
      { cle: CLE_DERNIERE_SYNC, valeur: new Date().toISOString() },
    ])
    return bilan
  }

  /** Crée ou remplace l'événement (identifiant fixe : un autre appareil a pu le créer avant nous). */
  private async envoyer(cal: string, e: EvenementGoogle, existe: boolean): Promise<EvenementGoogle> {
    try {
      return existe ? await this.transport.remplacer(cal, e) : await this.transport.inserer(cal, e)
    } catch (err) {
      if (err instanceof ErreurGoogle && existe && err.statut === 404) return this.transport.inserer(cal, e)
      if (err instanceof ErreurGoogle && !existe && err.statut === 409) return this.transport.remplacer(cal, e)
      throw err
    }
  }

  /** Applique un changement venu de Google. Retourne true si l'application a été modifiée. */
  private async recevoir(ev: EvenementGoogle, souhaites: Map<string, Souhaite>): Promise<boolean> {
    const lien = await this.db.liensGoogle.where('eventId').equals(ev.id).first()
    // Écho de nos propres envois
    if (lien && ev.updated && ev.updated <= lien.majGoogle) return false
    const annule = ev.status === 'cancelled'

    if (!lien) {
      if (annule) return false
      if (estIdLinkimmo(ev.id)) {
        // Créé par un autre appareil du même utilisateur : on le reconnaît sans rien changer.
        const s = [...souhaites.values()].find((x) => x.evenement.id === ev.id)
        if (s) await this.db.liensGoogle.put({ cle: s.cle, eventId: ev.id, signature: s.signature, majGoogle: ev.updated ?? '' })
        return false
      }
      return this.importer(ev)
    }

    const souhaite = souhaites.get(lien.cle)
    // Supprimé dans l'application (sera supprimé dans Google), ou modifié des deux côtés : l'application gagne.
    if (!souhaite || souhaite.signature !== lien.signature) return false
    const [genre, table, id] = lien.cle.split(':') as [string, string, string]

    if (annule) {
      await this.db.liensGoogle.delete(lien.cle)
      if (genre === 'relance') {
        // Relance effacée dans Google : la fiche apparaît dans « Sans prochaine action » (rien n'est perdu).
        if (table === 'contacts') await this.contacts.modifier(id, { prochaineRelanceAt: null })
        else await this.pistes.modifier(id, { prochaineRelanceAt: null })
      } else await this.evenements.archiver(table)
      return true
    }

    const debut = debutDe(ev)
    if (!debut) return false
    if (genre === 'relance') {
      const repo = table === 'contacts' ? this.contacts : this.pistes
      const fiche = await repo.get(id)
      if (fiche && fiche.prochaineRelanceAt !== debut.iso) await repo.modifier(id, { prochaineRelanceAt: debut.iso })
    } else {
      const e = await this.evenements.get(table)
      if (e) {
        const patch = {
          debut: debut.iso,
          fin: finDe(ev, debut.iso),
          journee: debut.journee,
          lieu: ev.location ?? '',
          notes: notesDepuisDescription(ev.description),
          ...(ev.summary && ev.summary !== souhaite.evenement.summary ? { titre: ev.summary } : {}),
        }
        await this.evenements.modifier(e.id, patch)
      }
    }
    // Nouvelle empreinte : ce qui vient de Google n'est pas renvoyé à Google.
    const recalcule = (await this.souhaites()).get(lien.cle)
    await this.db.liensGoogle.put({ ...lien, signature: recalcule?.signature ?? lien.signature, majGoogle: ev.updated ?? lien.majGoogle } satisfies LienGoogle)
    return true
  }

  /** Rendez-vous ajouté directement dans le calendrier « Linkimmo » de Google : il entre dans l'agenda. */
  private async importer(ev: EvenementGoogle): Promise<boolean> {
    const debut = debutDe(ev)
    if (!debut) return false
    if (await this.db.evenements.where('googleEventId').equals(ev.id).first()) return false
    const e = await this.evenements.creer({
      type: 'autre',
      titre: ev.summary ?? 'Sans titre',
      debut: debut.iso,
      fin: finDe(ev, debut.iso),
      journee: debut.journee,
      lieu: ev.location ?? '',
      notes: notesDepuisDescription(ev.description),
      contactId: null,
      pisteId: null,
      bienId: null,
      collaborateurId: this.options.utilisateur(),
      googleEventId: ev.id,
    })
    const s = (await this.souhaites()).get(`evenement:${e.id}`)
    if (s) await this.db.liensGoogle.put({ cle: s.cle, eventId: ev.id, signature: s.signature, majGoogle: ev.updated ?? '' })
    return true
  }
}

/** Déconnexion de Google : on oublie le calendrier et les liens (rien n'est effacé dans Google ni dans l'application). */
export async function oublierGoogle(db: LinkimmoDB): Promise<void> {
  await db.liensGoogle.clear()
  await db.meta.bulkDelete([CLE_CALENDRIER, CLE_JETON_SYNC, CLE_DERNIERE_SYNC])
}
