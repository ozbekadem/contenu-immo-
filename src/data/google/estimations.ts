import { estEstimation } from '@/domain/estimations'
import type { LinkimmoDB } from '../db'
import { EvenementRepository } from '../repositories/evenements'
import type { Evenement } from '../types'
import { debutDe, finDe } from './moteur'
import type { AgendaGoogle, EvenementGoogle, TransportGoogle } from './transport'

export const CLE_AGENDAS_ESTIMATIONS = 'google.agendasEstimations'
const CLE_CALENDRIER_LINKIMMO = 'google.calendrier'
/** Fenêtre lue à chaque passage : de la veille à 6 mois. */
const AVANT_MS = 86_400_000
const APRES_MS = 183 * 86_400_000

/** Agendas techniques de Google (jours fériés, anniversaires, numéros de semaine) : jamais lus. */
const estTechnique = (id: string) => /#(holiday|contacts|weeknum)@|@group\.v\.calendar\.google\.com$|addressbook#/.test(id)

/** Identifiant Linkimmo fixe pour un événement Google : deux appareils qui l'importent créent la même fiche. */
export async function idDepuisGoogle(agenda: string, eventId: string): Promise<string> {
  const h = [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${agenda}|${eventId}`)))].map((b) => b.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`
}

/** Texte brut d'une description Google (qui peut contenir du HTML simple). */
export function texteBrut(description: string | undefined): string {
  return (description ?? '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export interface BilanEstimations {
  ajoutees: number
  modifiees: number
  retirees: number
}

/**
 * Demandes d'estimation notées par le secrétariat dans Google Agenda (titre commençant par « Estimation ») :
 * elles entrent dans Linkimmo « à encoder ». Google reste la référence pour la date et l'heure ;
 * un rendez-vous supprimé ou renommé dans Google est retiré (archivé, jamais effacé).
 */
export class ImportEstimations {
  private readonly evenements: EvenementRepository

  constructor(
    private readonly db: LinkimmoDB,
    private readonly transport: TransportGoogle,
    private readonly options: { utilisateur: () => string | null; maintenant?: () => Date },
  ) {
    this.evenements = new EvenementRepository(db)
  }

  /** Agendas qu'on peut surveiller (sauf « Linkimmo » et les agendas techniques). */
  async agendasDisponibles(): Promise<AgendaGoogle[]> {
    const linkimmo = (await this.db.meta.get(CLE_CALENDRIER_LINKIMMO))?.valeur
    return (await this.transport.agendas()).filter((a) => a.id !== linkimmo && a.nom !== 'Linkimmo' && !estTechnique(a.id))
  }

  /** Agendas surveillés : le choix de l'utilisateur, sinon tous les agendas disponibles. */
  async agendasSurveilles(): Promise<string[]> {
    const choix = (await this.db.meta.get(CLE_AGENDAS_ESTIMATIONS))?.valeur as string[] | undefined
    return choix ?? (await this.agendasDisponibles()).map((a) => a.id)
  }

  async importer(): Promise<BilanEstimations> {
    const bilan: BilanEstimations = { ajoutees: 0, modifiees: 0, retirees: 0 }
    const maintenant = this.options.maintenant?.() ?? new Date()
    const du = new Date(maintenant.getTime() - AVANT_MS)
    const au = new Date(maintenant.getTime() + APRES_MS)
    for (const agenda of await this.agendasSurveilles()) {
      // Si la lecture échoue, on n'en déduit rien (aucune suppression sur une liste incomplète).
      const liste = (await this.transport.lister(agenda, du, au)).filter((e) => e.status !== 'cancelled' && estEstimation(e.summary))
      const vus = new Set<string>()
      for (const ev of liste) {
        vus.add(ev.id)
        const r = await this.recevoir(agenda, ev)
        if (r === 'ajoutee') bilan.ajoutees++
        else if (r === 'modifiee') bilan.modifiees++
      }
      const locaux = await this.db.evenements.filter((e) => e.googleCalendrierId === agenda && !e.archivedAt).toArray()
      for (const e of locaux) {
        const dansFenetre = new Date(e.fin) > du && new Date(e.debut) < au
        if (dansFenetre && e.googleEventId && !vus.has(e.googleEventId)) {
          await this.evenements.archiver(e.id)
          bilan.retirees++
        }
      }
    }
    return bilan
  }

  private async recevoir(agenda: string, ev: EvenementGoogle): Promise<'ajoutee' | 'modifiee' | null> {
    const debut = debutDe(ev)
    if (!debut) return null
    const id = await idDepuisGoogle(agenda, ev.id)
    const existant = await this.evenements.get(id)
    const depuisGoogle = { debut: debut.iso, fin: finDe(ev, debut.iso), journee: debut.journee }
    const textes = { titre: ev.summary?.trim() ?? 'Estimation', lieu: ev.location?.trim() ?? '', notes: texteBrut(ev.description) }
    if (!existant) {
      await this.evenements.creer(
        {
          type: 'estimation',
          ...textes,
          ...depuisGoogle,
          contactId: null,
          pisteId: null,
          bienId: null,
          collaborateurId: this.options.utilisateur(),
          googleEventId: ev.id,
          googleCalendrierId: agenda,
          aEncoder: true,
        },
        { id },
      )
      return 'ajoutee'
    }
    if (existant.archivedAt) return null // retiré volontairement dans Linkimmo : on ne le recrée pas
    // Date et heure : Google fait foi. Textes : repris tant que l'estimation n'est pas encodée.
    const voulu: Partial<Evenement> = { ...depuisGoogle, ...(existant.aEncoder ? textes : {}) }
    const patch = Object.fromEntries(Object.entries(voulu).filter(([k, v]) => existant[k as keyof Evenement] !== v))
    if (!Object.keys(patch).length) return null
    await this.evenements.modifier(id, patch)
    return 'modifiee'
  }
}
