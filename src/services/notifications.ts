import { useSyncExternalStore } from 'react'
import { nomAppareil } from '@/data/sync/service'
import { utilisateurCourant } from '@/data/appareil'
import { db } from '@/data/db'
import { serveurConfigure, supabase } from '@/data/sync/supabase'
import { PREFERENCES_DEFAUT, rappelsDus, type PreferencesNotifications } from '@/domain/rappels'

/** Clé publique des notifications (VAPID), générée dans Paramètres. Publique : ce n'est pas un secret. */
export const CLE_VAPID = (import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined) ?? ''
const CLE_ACTIVE = 'notif.active'
const CLE_PREFS = 'notif.preferences'
const CLE_DEJA = 'linkimmo.notif.affichees'

export type Support = 'ok' | 'installer_iphone' | 'non_supporte'

export function estIos(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

export function estInstallee(): boolean {
  return window.matchMedia?.('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true
}

/** Sur iPhone, les notifications n'existent que pour l'application installée sur l'écran d'accueil. */
export function support(): Support {
  if (estIos() && !estInstallee()) return 'installer_iphone'
  if (!('Notification' in window) || !('serviceWorker' in navigator)) return 'non_supporte'
  return 'ok'
}

export interface EtatNotifications {
  permission: NotificationPermission | 'indisponible'
  active: boolean
  /** Abonné aux notifications du serveur (reçues même application fermée). */
  push: boolean
  message: string | null
}

let etat: EtatNotifications = { permission: 'Notification' in window ? Notification.permission : 'indisponible', active: false, push: false, message: null }
const abonnes = new Set<() => void>()
function publier(patch: Partial<EtatNotifications>) {
  etat = { ...etat, ...patch }
  for (const f of abonnes) f()
}

export function useEtatNotifications(): EtatNotifications {
  return useSyncExternalStore(
    (f) => {
      abonnes.add(f)
      return () => abonnes.delete(f)
    },
    () => etat,
  )
}

export async function lirePreferences(): Promise<PreferencesNotifications> {
  return { ...PREFERENCES_DEFAUT, ...((await db.meta.get(CLE_PREFS))?.valeur as Partial<PreferencesNotifications> | undefined) }
}

async function sessionServeur(): Promise<string | null> {
  if (!serveurConfigure) return null
  try {
    return (await supabase().auth.getSession()).data.session?.user.id ?? null
  } catch {
    return null
  }
}

export async function enregistrerPreferences(p: PreferencesNotifications): Promise<void> {
  await db.meta.put({ cle: CLE_PREFS, valeur: p })
  if (await sessionServeur()) {
    await supabase()
      .from('preferences_notifications')
      .upsert({ relances: p.relances, rdv_minutes: p.rdvMinutes, resume_matin: p.resumeMatin, heure_matin: p.heureMatin, week_end: p.weekEnd, maj_at: new Date().toISOString() })
  }
}

function versOctets(base64url: string): Uint8Array<ArrayBuffer> {
  const b64 = (base64url + '='.repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  const brut = atob(b64)
  const octets = new Uint8Array(new ArrayBuffer(brut.length))
  for (let i = 0; i < brut.length; i++) octets[i] = brut.charCodeAt(i)
  return octets
}

/** Abonne cet appareil aux notifications du serveur (si le serveur et la clé sont configurés). */
async function abonnerPush(): Promise<boolean> {
  if (!CLE_VAPID || !('PushManager' in window) || !(await sessionServeur())) return false
  const reg = await navigator.serviceWorker.ready
  const abonnement = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: versOctets(CLE_VAPID) }))
  const j = abonnement.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } }
  const { error } = await supabase()
    .from('abonnements_push')
    .upsert({ endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth, appareil: nomAppareil(), maj_at: new Date().toISOString() }, { onConflict: 'endpoint' })
  if (error) throw new Error(error.message)
  return true
}

/** À appeler depuis un appui sur un bouton (le navigateur l'exige pour demander l'autorisation). */
export async function activerNotifications(): Promise<void> {
  publier({ message: null })
  if (support() !== 'ok') return
  const permission = await Notification.requestPermission()
  publier({ permission })
  if (permission !== 'granted') {
    publier({ message: permission === 'denied' ? 'Notifications bloquées : autorisez-les dans les réglages du téléphone (Linkimmo → Notifications).' : null })
    return
  }
  await db.meta.put({ cle: CLE_ACTIVE, valeur: true })
  let push = false
  try {
    push = await abonnerPush()
  } catch (e) {
    publier({ message: `Notifications du serveur indisponibles : ${(e as Error).message}` })
  }
  publier({ active: true, push })
  const reg = await navigator.serviceWorker.getRegistration()
  await reg?.showNotification('Linkimmo', { body: 'Les notifications sont activées ✔', icon: '/pwa-192.png', tag: 'essai' })
}

export async function desactiverNotifications(): Promise<void> {
  await db.meta.put({ cle: CLE_ACTIVE, valeur: false })
  try {
    const reg = await navigator.serviceWorker.getRegistration()
    const abonnement = await reg?.pushManager?.getSubscription()
    if (abonnement) {
      if (await sessionServeur()) await supabase().from('abonnements_push').delete().eq('endpoint', abonnement.endpoint)
      await abonnement.unsubscribe()
    }
  } catch {
    /* rien à désabonner */
  }
  publier({ active: false, push: false, message: null })
}

// ── Rappels affichés par l'application elle-même (ordinateur resté ouvert, téléphone en cours d'usage) ──
function dejaAffichees(): string[] {
  try {
    return JSON.parse(localStorage.getItem(CLE_DEJA) ?? '[]') as string[]
  } catch {
    return []
  }
}

async function verifierRappels(): Promise<void> {
  if (etat.permission !== 'granted' || !etat.active) return
  const [contacts, pistes, biens, evenements, prefs] = await Promise.all([db.contacts.toArray(), db.pistes.toArray(), db.biens.toArray(), db.evenements.toArray(), lirePreferences()])
  const dus = rappelsDus({ contacts, pistes, biens, evenements }, prefs, { maintenant: new Date(), fenetreMs: 3 * 60_000, utilisateur: utilisateurCourant })
  const deja = dejaAffichees()
  const nouveaux = dus.filter((r) => !deja.includes(r.cle))
  if (!nouveaux.length) return
  const reg = await navigator.serviceWorker.getRegistration()
  for (const r of nouveaux) {
    // Même « tag » que la notification du serveur : si les deux arrivent, une seule reste affichée.
    if (reg) await reg.showNotification(r.titre, { body: r.corps, tag: r.cle, icon: '/pwa-192.png', data: { url: r.url } })
    else new Notification(r.titre, { body: r.corps, tag: r.cle })
  }
  try {
    localStorage.setItem(CLE_DEJA, JSON.stringify([...deja, ...nouveaux.map((r) => r.cle)].slice(-300)))
  } catch {
    /* rien */
  }
}

/** Pastille sur l'icône de l'application : nombre de relances à traiter (rouge + orange). */
export function mettreAJourPastille(n: number): void {
  const nav = navigator as { setAppBadge?: (n: number) => Promise<void>; clearAppBadge?: () => Promise<void> }
  if (n > 0) void nav.setAppBadge?.(n).catch(() => {})
  else void nav.clearAppBadge?.().catch(() => {})
}

export function demarrerNotifications(): void {
  void (async () => {
    const active = (await db.meta.get(CLE_ACTIVE))?.valeur === true
    const permission = 'Notification' in window ? Notification.permission : 'indisponible'
    let push = false
    if (active && permission === 'granted') {
      try {
        // Ré-enregistre l'abonnement (le navigateur peut le renouveler ; utile aussi après la première connexion au serveur).
        push = await abonnerPush()
      } catch {
        /* nouvel essai au prochain démarrage */
      }
    }
    publier({ active, permission, push })
    void verifierRappels()
  })()
  setInterval(() => void verifierRappels(), 60_000)
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && void verifierRappels())
}
