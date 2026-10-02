import { liveQuery } from 'dexie'
import { useSyncExternalStore } from 'react'
import { utilisateurCourant } from '@/data/appareil'
import { db } from '@/data/db'
import { CLE_DERNIERE_SYNC, oublierGoogle, SyncGoogle, type BilanGoogle } from '@/data/google/moteur'
import { ImportEstimations, type BilanEstimations } from '@/data/google/estimations'
import { ErreurGoogle, transportGoogle, type AgendaGoogle } from '@/data/google/transport'

/** Identifiant public de l'application dans Google Cloud (pas un secret). */
export const CLIENT_ID_GOOGLE = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined) ?? ''

/**
 * Créer et gérer le calendrier « Linkimmo », le retrouver depuis un autre appareil,
 * et lire les autres agendas pour y repérer les « Estimation… » notées par le secrétariat.
 */
const PERMISSIONS = [
  'https://www.googleapis.com/auth/calendar.app.created',
  'https://www.googleapis.com/auth/calendar.calendarlist.readonly',
  'https://www.googleapis.com/auth/calendar.events.readonly',
].join(' ')
const CLE_LECTURE = 'google.lectureAgendas'
const CLE_JETON = 'linkimmo.google'
const CLE_LIE = 'google.lie'

export type StatutGoogle = 'non_configure' | 'deconnecte' | 'a_reconnecter' | 'synchro' | 'ok' | 'erreur'

export interface EtatGoogle {
  statut: StatutGoogle
  derniereSync: string | null
  message: string | null
  bilan: BilanGoogle | null
  /** Lecture des autres agendas autorisée (estimations du secrétariat). */
  lecture: boolean
  estimations: BilanEstimations | null
}

let etat: EtatGoogle = { statut: CLIENT_ID_GOOGLE ? 'deconnecte' : 'non_configure', derniereSync: null, message: null, bilan: null, lecture: false, estimations: null }
const abonnes = new Set<() => void>()
function publier(patch: Partial<EtatGoogle>) {
  etat = { ...etat, ...patch }
  for (const f of abonnes) f()
}

export function useEtatGoogle(): EtatGoogle {
  return useSyncExternalStore(
    (f) => {
      abonnes.add(f)
      return () => abonnes.delete(f)
    },
    () => etat,
  )
}

// ── Jeton d'accès (valable 1 heure, jamais envoyé ailleurs qu'à Google) ──
let jeton: { valeur: string; expire: number } | null = (() => {
  try {
    const j = JSON.parse(sessionStorage.getItem(CLE_JETON) ?? 'null') as { valeur: string; expire: number } | null
    return j && j.expire > Date.now() + 60_000 ? j : null
  } catch {
    return null
  }
})()

function jetonValide(): string | null {
  return jeton && jeton.expire > Date.now() + 60_000 ? jeton.valeur : null
}

function retenirJeton(valeur: string, secondes: number) {
  jeton = { valeur, expire: Date.now() + secondes * 1000 }
  try {
    sessionStorage.setItem(CLE_JETON, JSON.stringify(jeton))
  } catch {
    /* gardé en mémoire seulement */
  }
}

interface ClientJeton {
  requestAccessToken(o?: { prompt?: string }): void
}
interface Gis {
  accounts: {
    oauth2: {
      initTokenClient(c: {
        client_id: string
        scope: string
        callback: (r: { access_token?: string; expires_in?: number; error?: string; scope?: string }) => void
        error_callback?: (e: { type: string; message?: string }) => void
      }): ClientJeton
      revoke(jeton: string, fait?: () => void): void
    }
  }
}

let gis: Promise<Gis> | null = null
function chargerGis(): Promise<Gis> {
  gis ??= new Promise((ok, ko) => {
    const s = document.createElement('script')
    s.src = 'https://accounts.google.com/gsi/client'
    s.async = true
    s.onload = () => ok((window as unknown as { google: Gis }).google)
    s.onerror = () => {
      gis = null
      ko(new Error('Impossible de joindre Google (réseau ?)'))
    }
    document.head.appendChild(s)
  })
  return gis
}

/**
 * Connexion à Google (à appeler depuis un appui sur un bouton : Google ouvre une petite fenêtre).
 * La première fois, Google demande l'autorisation ; ensuite la reconnexion est quasi immédiate.
 */
export async function connecterGoogle(): Promise<void> {
  if (!CLIENT_ID_GOOGLE) return
  publier({ message: null })
  const g = await chargerGis()
  const dejaLie = !!(await db.meta.get(CLE_LIE))
  await new Promise<void>((ok, ko) => {
    const client = g.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID_GOOGLE,
      scope: PERMISSIONS,
      callback: (r) => {
        if (!r.access_token) return ko(new Error(r.error === 'access_denied' ? 'Autorisation refusée' : 'Connexion Google impossible'))
        if (!r.scope?.includes('calendar.app.created')) return ko(new Error('Cochez l’accès à l’agenda dans la fenêtre de Google, puis réessayez.'))
        retenirJeton(r.access_token, r.expires_in ?? 3600)
        // La lecture des autres agendas peut être décochée dans la fenêtre Google : le reste fonctionne quand même.
        void db.meta.put({ cle: CLE_LECTURE, valeur: !!r.scope?.includes('calendar.events.readonly') })
        ok()
      },
      error_callback: (e) => ko(new Error(e.type === 'popup_closed' ? 'Fenêtre Google fermée' : 'Fenêtre Google bloquée : autorisez les fenêtres pour Linkimmo')),
    })
    client.requestAccessToken({ prompt: dejaLie ? '' : 'consent' })
  }).catch((e: Error) => {
    publier({ statut: dejaLie ? 'a_reconnecter' : 'deconnecte', message: e.message })
    throw e
  })
  await db.meta.put({ cle: CLE_LIE, valeur: new Date().toISOString() })
  await synchroniserGoogle()
}

/** Déconnecte Google sur cet appareil (rien n'est effacé, ni dans Google ni dans Linkimmo). */
export async function deconnecterGoogle(): Promise<void> {
  const j = jetonValide()
  if (j) void chargerGis().then((g) => g.accounts.oauth2.revoke(j))
  jeton = null
  try {
    sessionStorage.removeItem(CLE_JETON)
  } catch {
    /* rien */
  }
  await db.meta.bulkDelete([CLE_LIE, CLE_LECTURE])
  await oublierGoogle(db)
  publier({ statut: CLIENT_ID_GOOGLE ? 'deconnecte' : 'non_configure', derniereSync: null, bilan: null, message: null })
}

let enCours: Promise<void> | null = null
let moteur: SyncGoogle | null = null
let importeur: ImportEstimations | null = null

function importEstimations(): ImportEstimations {
  importeur ??= new ImportEstimations(db, transportGoogle(jetonValide), { utilisateur: () => utilisateurCourant })
  return importeur
}

/** Agendas où chercher les « Estimation… », et ceux actuellement surveillés. */
export async function agendasEstimations(): Promise<{ disponibles: AgendaGoogle[]; surveilles: string[] } | null> {
  if (!jetonValide() || !etat.lecture) return null
  const i = importEstimations()
  return { disponibles: await i.agendasDisponibles(), surveilles: await i.agendasSurveilles() }
}

export async function choisirAgendasEstimations(ids: string[]): Promise<void> {
  await db.meta.put({ cle: 'google.agendasEstimations', valeur: ids })
  void synchroniserGoogle()
}

export function synchroniserGoogle(): Promise<void> {
  if (enCours) return enCours
  enCours = (async () => {
    if (!CLIENT_ID_GOOGLE || !(await db.meta.get(CLE_LIE))) return
    if (!jetonValide()) return publier({ statut: 'a_reconnecter' })
    if (!navigator.onLine) return
    moteur ??= new SyncGoogle(db, transportGoogle(jetonValide), { origine: window.location.origin, utilisateur: () => utilisateurCourant })
    publier({ statut: 'synchro', message: null })
    try {
      const lecture = (await db.meta.get(CLE_LECTURE))?.valeur === true
      // D'abord les estimations du secrétariat (elles ne sont pas recopiées dans « Linkimmo »).
      let estimations: BilanEstimations | null = null
      let avertissement: string | null = null
      if (lecture) {
        try {
          estimations = await importEstimations().importer()
        } catch (e) {
          if (e instanceof ErreurGoogle && e.statut === 401) throw e
          // Un agenda partagé retiré, une autorisation manquante… : la synchronisation « Linkimmo » continue.
          avertissement = `Estimations du secrétariat : ${(e as Error).message}`
        }
      }
      const bilan = await moteur.synchroniser()
      publier({ statut: 'ok', bilan, lecture, estimations, message: avertissement, derniereSync: ((await db.meta.get(CLE_DERNIERE_SYNC))?.valeur as string) ?? null })
    } catch (e) {
      if (e instanceof ErreurGoogle && e.statut === 401) {
        jeton = null
        return publier({ statut: 'a_reconnecter' })
      }
      if (e instanceof ErreurGoogle && e.statut === 404) await oublierGoogle(db) // calendrier supprimé dans Google : il sera recréé
      publier({ statut: 'erreur', message: (e as Error).message })
    }
  })().finally(() => {
    enCours = null
  })
  return enCours
}

/** Synchronisation automatique : au démarrage, au retour dans l'application, après chaque changement, et toutes les 5 minutes. */
export function demarrerGoogle(): void {
  if (!CLIENT_ID_GOOGLE) return
  void (async () => {
    const lie = await db.meta.get(CLE_LIE)
    const derniere = (await db.meta.get(CLE_DERNIERE_SYNC))?.valeur as string | undefined
    publier({
      statut: lie ? (jetonValide() ? 'ok' : 'a_reconnecter') : 'deconnecte',
      derniereSync: derniere ?? null,
      lecture: (await db.meta.get(CLE_LECTURE))?.valeur === true,
    })
    void synchroniserGoogle()
  })()
  let attente: ReturnType<typeof setTimeout> | undefined
  const bientot = () => {
    clearTimeout(attente)
    attente = setTimeout(() => void synchroniserGoogle(), 4000)
  }
  // Toute modification d'une relance ou d'un rendez-vous part vers Google quelques secondes après.
  let premier = true
  liveQuery(() => Promise.all([db.contacts.count(), db.pistes.count(), db.evenements.count(), db.outbox.count()])).subscribe(() => {
    if (premier) premier = false
    else bientot()
  })
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && void synchroniserGoogle())
  window.addEventListener('online', () => void synchroniserGoogle())
  setInterval(() => void synchroniserGoogle(), 5 * 60_000)
}
