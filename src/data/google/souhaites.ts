import type { Bien, Contact, Evenement, Piste } from '../types'
import { TYPES_EVENEMENT } from '../types'
import type { EvenementGoogle } from './transport'

/** Nom du calendrier créé dans le Google Agenda de chaque utilisateur. */
export const NOM_CALENDRIER = 'Linkimmo'
const FUSEAU = 'Europe/Brussels'
/** Séparateur entre les notes et le lien vers la fiche (permet de relire les notes modifiées dans Google). */
export const SEPARATEUR = '\n\n— Ouvrir dans Linkimmo : '
/** Les relances plus anciennes ne sont pas (ou plus) envoyées. */
const RELANCES_DEPUIS_JOURS = 30
const DUREE_RELANCE_MIN = 15

export interface Souhaite {
  cle: string
  /** Contenu de l'événement Google (avec son identifiant). */
  evenement: EvenementGoogle
  signature: string
}

export interface DonneesAgenda {
  contacts: Contact[]
  pistes: Piste[]
  biens: Bien[]
  evenements: Evenement[]
}

/**
 * Identifiant Google fixe, déduit de l'identifiant Linkimmo (caractères 0-9 et a-v autorisés par Google) :
 * deux appareils du même utilisateur créent donc le même événement, jamais un doublon.
 */
export function idGoogle(prefixe: 'rc' | 'rp' | 'ev', uuid: string): string {
  return `${prefixe}${uuid.replace(/-/g, '').toLowerCase()}`
}

export function estIdLinkimmo(id: string): boolean {
  return /^(rc|rp|ev)[0-9a-f]{32}$/.test(id)
}

const nom = (c: Contact) => [c.prenom, c.nom].filter(Boolean).join(' ') || c.societe || ''
const adresse = (b: Bien | null | undefined) => {
  const a = b?.adresse
  if (!a) return ''
  return [[a.rue, a.numero].filter(Boolean).join(' '), [a.cp, a.ville].filter(Boolean).join(' ')].filter(Boolean).join(', ')
}
const telephone = (c: Contact | null | undefined) => (c && !c.nePasContacter && c._telNorm[0] ? `Téléphone : ${c._telNorm[0]}` : '')

function texte(lignes: string[], lien: string): string {
  return lignes.filter(Boolean).join('\n') + SEPARATEUR + lien
}

/** Notes saisies dans Google (ce qui précède le lien vers la fiche). */
export function notesDepuisDescription(description: string | undefined): string {
  return (description ?? '').split(SEPARATEUR)[0]!.trim()
}

function plage(debutIso: string, finIso: string, journee: boolean): Pick<EvenementGoogle, 'start' | 'end'> {
  if (!journee) return { start: { dateTime: debutIso, timeZone: FUSEAU }, end: { dateTime: finIso, timeZone: FUSEAU } }
  const jour = (iso: string) => {
    const d = new Date(iso)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }
  const fin = new Date(finIso)
  if (jour(finIso) === jour(debutIso)) fin.setDate(fin.getDate() + 1)
  return { start: { date: jour(debutIso) }, end: { date: jour(fin.toISOString()) } }
}

export function titreEvenement(e: Evenement, contact: Contact | null, bien: Bien | null): string {
  if (e.titre.trim()) return e.titre.trim()
  const type = TYPES_EVENEMENT.find((t) => t.code === e.type)?.libelle ?? 'Rendez-vous'
  const qui = contact ? nom(contact) : ''
  const ou = bien?.adresse ? [bien.adresse.rue, bien.adresse.numero].filter(Boolean).join(' ') : ''
  return [type, [qui, ou].filter(Boolean).join(', ')].filter(Boolean).join(' – ')
}

function avecSignature(cle: string, evenement: EvenementGoogle): Souhaite {
  return { cle, evenement, signature: JSON.stringify(evenement) }
}

/**
 * Événements que le calendrier « Linkimmo » de l'utilisateur doit contenir :
 * ses relances (contacts et pistes) et ses rendez-vous. Les données de démonstration n'y vont jamais.
 */
export function evenementsSouhaites(d: DonneesAgenda, options: { utilisateur: string | null; origine: string; maintenant: Date }): Souhaite[] {
  const { utilisateur, origine, maintenant } = options
  const depuis = maintenant.getTime() - RELANCES_DEPUIS_JOURS * 86_400_000
  const aMoi = (collaborateurId: string | null | undefined) => !collaborateurId || collaborateurId === utilisateur
  const contacts = new Map(d.contacts.map((c) => [c.id, c]))
  const biens = new Map(d.biens.map((b) => [b.id, b]))
  const enCours = (p: Piste) => !p.archivedAt && !p._demo && p.statut !== 'gagne' && p.statut !== 'perdu'
  const suivisParPiste = new Set(d.pistes.filter(enCours).map((p) => p.contactId))
  const relanceValide = (iso: string | null) => !!iso && new Date(iso).getTime() >= depuis
  const liste: Souhaite[] = []

  for (const c of d.contacts) {
    if (c._demo || c.archivedAt || c.nePasContacter || suivisParPiste.has(c.id) || !aMoi(c.collaborateurId) || !relanceValide(c.prochaineRelanceAt)) continue
    const debut = c.prochaineRelanceAt!
    liste.push(
      avecSignature(`relance:contacts:${c.id}`, {
        id: idGoogle('rc', c.id),
        summary: `📞 Relancer ${nom(c) || 'un contact'}`,
        description: texte([telephone(c), c.emails[0] ? `Email : ${c.emails[0]}` : ''], `${origine}/contacts/${c.id}`),
        ...plage(debut, new Date(new Date(debut).getTime() + DUREE_RELANCE_MIN * 60_000).toISOString(), false),
        reminders: { useDefault: false, overrides: [{ method: 'popup', minutes: 0 }] },
        extendedProperties: { private: { linkimmo: `relance:contacts:${c.id}` } },
      }),
    )
  }

  for (const p of d.pistes) {
    if (!enCours(p) || !relanceValide(p.prochaineRelanceAt)) continue
    const proprio = p.contactId ? (contacts.get(p.contactId) ?? null) : null
    if (proprio && (!aMoi(proprio.collaborateurId) || proprio.nePasContacter)) continue
    const bien = biens.get(p.bienId)
    const quoi = p.categorie === 'annonce' ? 'Annonce' : 'Maison vide'
    const debut = p.prochaineRelanceAt!
    liste.push(
      avecSignature(`relance:pistes:${p.id}`, {
        id: idGoogle('rp', p.id),
        summary: `📞 ${quoi} – ${adresse(bien) || 'bien sans adresse'}${proprio && nom(proprio) ? ` (${nom(proprio)})` : ''}`,
        description: texte([telephone(proprio), p.alerte ? `⚠ ${p.alerte}` : '', proprio ? '' : 'Propriétaire encore inconnu'], `${origine}/pistes/${p.id}`),
        location: adresse(bien) || undefined,
        ...plage(debut, new Date(new Date(debut).getTime() + DUREE_RELANCE_MIN * 60_000).toISOString(), false),
        reminders: { useDefault: false, overrides: [{ method: 'popup', minutes: 0 }] },
        extendedProperties: { private: { linkimmo: `relance:pistes:${p.id}` } },
      }),
    )
  }

  for (const e of d.evenements) {
    if (e._demo || e.archivedAt || !aMoi(e.collaborateurId)) continue
    const contact = e.contactId ? (contacts.get(e.contactId) ?? null) : null
    const bien = e.bienId ? (biens.get(e.bienId) ?? null) : null
    const lien = e.pisteId ? `${origine}/pistes/${e.pisteId}` : e.contactId ? `${origine}/contacts/${e.contactId}` : `${origine}/agenda`
    liste.push(
      avecSignature(`evenement:${e.id}`, {
        id: e.googleEventId ?? idGoogle('ev', e.id),
        summary: titreEvenement(e, contact, bien),
        description: texte([e.notes.trim(), telephone(contact)], lien),
        location: e.lieu.trim() || adresse(bien) || undefined,
        ...plage(e.debut, e.fin, e.journee),
        reminders: { useDefault: true },
        extendedProperties: { private: { linkimmo: `evenement:${e.id}` } },
      }),
    )
  }
  return liste
}
