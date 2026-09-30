import { useSyncExternalStore } from 'react'
import { contacts } from '@/data/repositories/contacts'
import type { Contact } from '@/data/types'
import { lienAppel, lienEmail, lienSms, lienWhatsapp, type Canal } from '@/domain/telephone'

/** Action lancée (appel, SMS…) dont on attend le résultat au retour dans l'application. */
export interface ActionEnCours {
  contactId: string | null
  /** Piste de prospection concernée (le résultat s'y enregistre). */
  pisteId?: string | null
  canal: Canal | 'note'
  numero: string | null
  lanceeLe: string
  /** true = la fenêtre « résultat » est affichée. */
  afficher: boolean
}

const CLE = 'linkimmo.actionEnCours'
/** Au-delà, on ne propose plus de noter le résultat (l'appel est trop ancien). */
const DUREE_MAX_MS = 3 * 60 * 60 * 1000

function lire(): ActionEnCours | null {
  try {
    const brut = sessionStorage.getItem(CLE) ?? localStorage.getItem(CLE)
    const a = brut ? (JSON.parse(brut) as ActionEnCours) : null
    return a && Date.now() - new Date(a.lanceeLe).getTime() < DUREE_MAX_MS ? a : null
  } catch {
    return null
  }
}

let courante: ActionEnCours | null = lire()
const abonnes = new Set<() => void>()

function publier(a: ActionEnCours | null) {
  courante = a
  try {
    // localStorage : l'iPhone peut recharger l'application pendant un appel.
    if (a) localStorage.setItem(CLE, JSON.stringify(a))
    else localStorage.removeItem(CLE)
  } catch {
    /* stockage indisponible : l'action reste en mémoire */
  }
  for (const f of abonnes) f()
}

export function useActionEnCours(): ActionEnCours | null {
  return useSyncExternalStore(
    (f) => {
      abonnes.add(f)
      return () => abonnes.delete(f)
    },
    () => courante,
  )
}

export function lienPour(canal: Canal, contact: Contact, numero?: string | null): string | null {
  const tel = numero ?? contact._telNorm[0]
  const email = contact.emails[0]
  if (canal === 'email') return email ? lienEmail(email) : null
  if (!tel) return null
  return canal === 'appel' ? lienAppel(tel) : canal === 'sms' ? lienSms(tel) : lienWhatsapp(tel)
}

/**
 * Lance un appel, un SMS, une conversation WhatsApp ou un email, mémorise le canal le plus
 * utilisé pour ce contact, puis proposera de noter le résultat au retour dans l'application.
 */
export function lancerAction(contact: Contact, canal: Canal, numero?: string | null, pisteId: string | null = null): void {
  const lien = lienPour(canal, contact, numero)
  if (!lien) return
  const utilisation = { ...contact.utilisationCanaux, [canal]: (contact.utilisationCanaux[canal] ?? 0) + 1 }
  void contacts.modifier(contact.id, { utilisationCanaux: utilisation })
  publier({ contactId: contact.id, pisteId, canal, numero: numero ?? contact._telNorm[0] ?? null, lanceeLe: new Date().toISOString(), afficher: false })

  const a = document.createElement('a')
  a.href = lien
  if (canal === 'whatsapp') {
    a.target = '_blank'
    a.rel = 'noopener noreferrer'
  }
  a.click()

  // Sur ordinateur (ou si le téléphone ne quitte pas l'application), on propose quand même le résultat.
  setTimeout(() => {
    if (document.visibilityState === 'visible' && courante && !courante.afficher) publier({ ...courante, afficher: true })
  }, 2500)
}

/** Ouvre directement la saisie d'un échange (note, rendez-vous…) sans appeler. */
export function noterEchange(contactId: string | null, pisteId: string | null = null): void {
  publier({ contactId, pisteId, canal: 'note', numero: null, lanceeLe: new Date().toISOString(), afficher: true })
}

/** Au retour dans l'application après un appel ou un message : afficher la saisie du résultat. */
export function surRetour(): void {
  const a = courante ?? lire()
  if (a && !a.afficher) publier({ ...a, afficher: true })
}

export function terminerAction(): void {
  publier(null)
}

// ── Menu de contact partagé (listes) : une seule fenêtre pour toute l'application ──
let menu: { contactId: string; numero: string | null; pisteId: string | null } | null = null
const abonnesMenu = new Set<() => void>()

export function ouvrirMenuContact(contactId: string, numero: string | null = null, pisteId: string | null = null): void {
  menu = { contactId, numero, pisteId }
  for (const f of abonnesMenu) f()
}

export function fermerMenuContact(): void {
  menu = null
  for (const f of abonnesMenu) f()
}

export function useMenuContact() {
  return useSyncExternalStore(
    (f) => {
      abonnesMenu.add(f)
      return () => abonnesMenu.delete(f)
    },
    () => menu,
  )
}
