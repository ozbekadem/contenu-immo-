import { distanceMetres } from './prospection'

/**
 * Tournée de prospection : les adresses choisies une à une, reliées dans l'ordre sur la carte.
 * Pas de service d'itinéraire (payant ou limité) : les distances sont « à vol d'oiseau »,
 * corrigées d'un facteur moyen pour les rues. Ce sont des ordres de grandeur, affichés avec « ≈ ».
 */

export interface PointGeo {
  lat: number
  lng: number
}

/** En ville, le trajet réel par les rues est en moyenne ~35 % plus long que la ligne droite. */
export const FACTEUR_RUES = 1.35
const PIED_KMH = 4.5
const VOITURE_KMH = 26 // agglomération de Charleroi, feux et stationnement compris
const STATIONNEMENT_MIN = 1

/** Au-delà de cette distance (par les rues), on propose la voiture plutôt que la marche. */
export const SEUIL_PIED_M = 1200

export interface Trajet {
  /** Distance estimée par les rues, en mètres. */
  metres: number
  minutesPied: number
  minutesVoiture: number
  mode: 'pied' | 'voiture'
}

export function trajet(a: PointGeo, b: PointGeo): Trajet {
  const metres = distanceMetres(a, b) * FACTEUR_RUES
  const minutesPied = Math.max(1, Math.round((metres / 1000 / PIED_KMH) * 60))
  const minutesVoiture = Math.max(1, Math.round((metres / 1000 / VOITURE_KMH) * 60 + STATIONNEMENT_MIN))
  return {
    metres,
    minutesPied,
    minutesVoiture,
    mode: metres <= SEUIL_PIED_M ? 'pied' : 'voiture',
  }
}

export function dureeLisible(minutes: number): string {
  if (minutes < 60) return `${minutes} min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m ? `${h} h ${String(m).padStart(2, '0')}` : `${h} h`
}

/** « ≈ 7 min à pied » ou « ≈ 4 min en voiture » selon la distance. */
export function trajetLisible(t: Trajet): string {
  return t.mode === 'pied' ? `≈ ${dureeLisible(t.minutesPied)} à pied` : `≈ ${dureeLisible(t.minutesVoiture)} en voiture`
}

/** Trajets successifs : départ (position actuelle, si connue) → étape 1 → étape 2 → … */
export function trajets(etapes: PointGeo[], depart?: PointGeo | null): Trajet[] {
  const points = depart ? [depart, ...etapes] : etapes
  const r: Trajet[] = []
  for (let i = 1; i < points.length; i++) r.push(trajet(points[i - 1]!, points[i]!))
  return r
}

export interface ResumeTournee {
  etapes: number
  metres: number
  /** Durée en voiture de toute la tournée (c'est le mode habituel d'une tournée). */
  minutesVoiture: number
}

export function resumeTournee(etapes: PointGeo[], depart?: PointGeo | null): ResumeTournee {
  const t = trajets(etapes, depart)
  return {
    etapes: etapes.length,
    metres: t.reduce((s, x) => s + x.metres, 0),
    minutesVoiture: t.reduce((s, x) => s + x.minutesVoiture, 0),
  }
}

/**
 * Ordre conseillé : on part du point de départ (ou de la première étape) et on va chaque fois à
 * l'adresse la plus proche, puis on élimine les croisements (2-opt). Suffisant pour 2 à 25 adresses.
 */
export function ordreOptimise<T extends PointGeo>(etapes: T[], depart?: PointGeo | null): T[] {
  if (etapes.length < 3 && !depart) return [...etapes]
  const restantes = [...etapes]
  const ordre: T[] = []
  let courant: PointGeo = depart ?? restantes.shift()!
  if (!depart) ordre.push(courant as T)
  while (restantes.length) {
    let meilleur = 0
    for (let i = 1; i < restantes.length; i++) if (distanceMetres(courant, restantes[i]!) < distanceMetres(courant, restantes[meilleur]!)) meilleur = i
    courant = restantes.splice(meilleur, 1)[0]!
    ordre.push(courant as T)
  }
  // 2-opt : inverse un morceau du parcours tant que cela raccourcit le total (parcours ouvert).
  const chemin: PointGeo[] = depart ? [depart, ...ordre] : ordre
  const debut = depart ? 1 : 0
  const d = (a: PointGeo, b: PointGeo) => distanceMetres(a, b)
  let ameliore = true
  for (let passe = 0; ameliore && passe < 50; passe++) {
    ameliore = false
    for (let i = Math.max(1, debut); i < chemin.length - 1; i++) {
      for (let k = i + 1; k < chemin.length; k++) {
        const a = chemin[i - 1]!
        const b = chemin[i]!
        const c = chemin[k]!
        const e = chemin[k + 1]
        const avant = d(a, b) + (e ? d(c, e) : 0)
        const apres = d(a, c) + (e ? d(b, e) : 0)
        if (apres + 0.5 < avant) {
          chemin.splice(i, k - i + 1, ...chemin.slice(i, k + 1).reverse())
          ameliore = true
        }
      }
    }
  }
  return chemin.slice(debut) as T[]
}

/** Google Maps accepte au plus 9 étapes intermédiaires (plus la destination) dans un lien. */
export const MAX_ETAPES_GOOGLE = 10

/** Lien Google Maps avec toutes les étapes, dans l'ordre (s'ouvre dans l'application Google Maps). */
export function lienGoogleTournee(etapes: PointGeo[], depart?: PointGeo | null): string | null {
  if (!etapes.length) return null
  const f = (p: PointGeo) => `${p.lat.toFixed(6)},${p.lng.toFixed(6)}`
  const liste = etapes.slice(0, MAX_ETAPES_GOOGLE)
  const destination = liste[liste.length - 1]!
  const intermediaires = liste.slice(0, -1)
  const p = new URLSearchParams({
    api: '1',
    destination: f(destination),
    travelmode: 'driving',
  })
  if (depart) p.set('origin', f(depart))
  if (intermediaires.length) p.set('waypoints', intermediaires.map(f).join('|'))
  return `https://www.google.com/maps/dir/?${p.toString()}`
}

/** Point situé à la fraction `t` (0 → 1) du segment a → b : sert à « dessiner » le tracé progressivement. */
export function interpoler(a: PointGeo, b: PointGeo, t: number): PointGeo {
  const u = Math.min(1, Math.max(0, t))
  return { lat: a.lat + (b.lat - a.lat) * u, lng: a.lng + (b.lng - a.lng) * u }
}
