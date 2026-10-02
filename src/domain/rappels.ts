import type { Bien, Contact, Evenement, Piste } from '@/data/types'

export interface PreferencesNotifications {
  relances: boolean
  /** Minutes avant un rendez-vous (0 = à l'heure). */
  rdvMinutes: number
  resumeMatin: boolean
  /** « HH:MM », heure de Bruxelles. */
  heureMatin: string
  weekEnd: boolean
}

export const PREFERENCES_DEFAUT: PreferencesNotifications = { relances: true, rdvMinutes: 30, resumeMatin: true, heureMatin: '08:30', weekEnd: false }

export interface Rappel {
  /** Même clé que le serveur : une notification reçue des deux côtés ne s'affiche qu'une fois. */
  cle: string
  titre: string
  corps: string
  url: string
}

const nom = (c: Contact) => [c.prenom, c.nom].filter(Boolean).join(' ').trim() || c.societe || 'un contact'
const adresse = (b: Bien | undefined) => {
  const a = b?.adresse
  const rue = a ? [a.rue, a.numero].filter(Boolean).join(' ') : ''
  return [rue, a?.ville].filter(Boolean).join(', ') || 'bien sans adresse'
}
const heure = (iso: string) => new Intl.DateTimeFormat('fr-BE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Brussels' }).format(new Date(iso)).replace(':', 'h')

/**
 * Rappels à afficher maintenant (mêmes règles que le serveur, voir rappels_a_envoyer) :
 * relances arrivées à l'heure prévue et rendez-vous dans N minutes, pour l'utilisateur
 * (fiches qui lui sont attribuées, ou attribuées à personne).
 */
export function rappelsDus(
  d: { contacts: Contact[]; pistes: Piste[]; biens: Bien[]; evenements: Evenement[] },
  prefs: PreferencesNotifications,
  options: { maintenant: Date; fenetreMs: number; utilisateur: string | null },
): Rappel[] {
  const { maintenant, fenetreMs, utilisateur } = options
  const t = maintenant.getTime()
  const dansFenetre = (ms: number) => ms <= t && ms > t - fenetreMs
  const aMoi = (f: { collaborateurId: string | null; createdBy: string | null }) => {
    const pour = f.collaborateurId ?? f.createdBy
    return !pour || !utilisateur || pour === utilisateur
  }
  const contacts = new Map(d.contacts.map((c) => [c.id, c]))
  const biens = new Map(d.biens.map((b) => [b.id, b]))
  const enCours = d.pistes.filter((p) => !p.archivedAt && p.statut !== 'gagne' && p.statut !== 'perdu')
  const suivis = new Set(enCours.map((p) => p.contactId))
  const liste: Rappel[] = []

  if (prefs.relances) {
    for (const c of d.contacts) {
      if (c.archivedAt || c.nePasContacter || suivis.has(c.id) || !c.prochaineRelanceAt || !aMoi(c)) continue
      if (!dansFenetre(new Date(c.prochaineRelanceAt).getTime())) continue
      liste.push({
        cle: `relance:contacts:${c.id}:${c.prochaineRelanceAt}`,
        titre: `📞 Relancer ${nom(c)}`,
        corps: c.telephones[0]?.numero ? `Téléphone : ${c.telephones[0].numero}` : 'Prévue maintenant',
        url: `/contacts/${c.id}`,
      })
    }
    for (const p of enCours) {
      if (!p.prochaineRelanceAt || !dansFenetre(new Date(p.prochaineRelanceAt).getTime())) continue
      const proprio = p.contactId ? contacts.get(p.contactId) : undefined
      if (!aMoi({ collaborateurId: p.collaborateurId ?? proprio?.collaborateurId ?? null, createdBy: p.createdBy })) continue
      liste.push({
        cle: `relance:pistes:${p.id}:${p.prochaineRelanceAt}`,
        titre: `📞 ${p.categorie === 'maison_vide' ? 'Maison vide' : 'Annonce'} – ${adresse(biens.get(p.bienId))}`,
        corps: (proprio ? `Appeler ${nom(proprio)}` : 'Propriétaire encore inconnu') + (p.alerte ? ` · ${p.alerte}` : ''),
        url: `/pistes/${p.id}`,
      })
    }
  }
  for (const e of d.evenements) {
    if (e.archivedAt || e.journee || !aMoi(e)) continue
    if (!dansFenetre(new Date(e.debut).getTime() - prefs.rdvMinutes * 60_000)) continue
    liste.push({ cle: `rdv:${e.id}:${e.debut}`, titre: `📅 ${e.titre || 'Rendez-vous'} à ${heure(e.debut)}`, corps: e.lieu || 'Rendez-vous', url: '/agenda' })
  }
  return liste
}
