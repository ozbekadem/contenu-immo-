import { useSyncExternalStore } from 'react'
import { appareil, horloge } from '../appareil'
import { db } from '../db'
import { definirTelechargeur } from '../repositories/piecesJointes'
import { ENTITES_SYNC } from './entites'
import { MoteurSync, type EtatSync } from './moteur'
import { serveurConfigure, transportSupabase } from './supabase'

/** Nom lisible de l'appareil (« iPhone », « Android », « Ordinateur Windows »…). */
export function nomAppareil(): string {
  const ua = navigator.userAgent
  if (/iPhone/.test(ua)) return 'iPhone'
  if (/iPad/.test(ua)) return 'iPad'
  if (/Android/.test(ua)) return /Mobile/.test(ua) ? 'Smartphone Android' : 'Tablette Android'
  if (/Windows/.test(ua)) return 'Ordinateur Windows'
  if (/Mac OS X/.test(ua)) return 'Mac'
  return 'Ordinateur'
}

const ETAT_LOCAL: EtatSync = { statut: 'local', enAttente: 0, derniere: null, erreur: null }

let moteur: MoteurSync | null = null
let arreter: (() => void) | null = null
const abonnes = new Set<() => void>()
let etatCourant: EtatSync = ETAT_LOCAL

function publier(e: EtatSync) {
  etatCourant = e
  for (const f of abonnes) f()
}

/**
 * Démarre la synchronisation automatique pour l'utilisateur connecté :
 * au démarrage, au retour du réseau, au retour dans l'application, après chaque modification,
 * à chaque changement signalé par le serveur (temps réel) et toutes les minutes par sécurité.
 */
export function demarrerSynchronisation(surRevoque: () => void): void {
  if (!serveurConfigure || moteur) return
  const transport = transportSupabase()
  moteur = new MoteurSync(db, transport, ENTITES_SYNC, horloge, { id: appareil, nom: nomAppareil() }, surRevoque)
  const m = moteur
  const desabonner = m.abonner(publier)
  definirTelechargeur((p) => m.telechargerFichier(p))

  let minuterie: ReturnType<typeof setTimeout> | undefined
  const bientot = (delai: number) => {
    clearTimeout(minuterie)
    minuterie = setTimeout(() => void m.synchroniser(), delai)
  }
  const maintenant = () => void m.synchroniser()
  const visible = () => document.visibilityState === 'visible' && maintenant()
  const horsLigne = () => publier({ ...m.obtenirEtat(), statut: 'hors_ligne' })

  window.addEventListener('online', maintenant)
  window.addEventListener('offline', horsLigne)
  document.addEventListener('visibilitychange', visible)
  const intervalle = setInterval(maintenant, 60_000)
  const arretEcoute = transport.ecouter(() => bientot(400))
  // Chaque modification locale ajoute une opération à la file : on synchronise juste après.
  const surAjout = () => {
    bientot(800)
  }
  db.outbox.hook('creating', surAjout)

  arreter = () => {
    window.removeEventListener('online', maintenant)
    window.removeEventListener('offline', horsLigne)
    document.removeEventListener('visibilitychange', visible)
    clearInterval(intervalle)
    clearTimeout(minuterie)
    arretEcoute()
    db.outbox.hook('creating').unsubscribe(surAjout)
    desabonner()
    definirTelechargeur(null)
  }
  maintenant()
}

export function arreterSynchronisation(): void {
  arreter?.()
  arreter = null
  moteur = null
  publier(ETAT_LOCAL)
}

export function synchroniserMaintenant(): Promise<void> {
  return moteur?.synchroniser() ?? Promise.resolve()
}

export function useEtatSync(): EtatSync {
  return useSyncExternalStore(
    (f) => {
      abonnes.add(f)
      return () => abonnes.delete(f)
    },
    () => etatCourant,
  )
}
