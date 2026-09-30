import { biens } from '@/data/repositories/biens'
import type { Adresse } from '@/data/types'
import { localitesPourCp } from '@/domain/adresse'

export interface Position {
  lat: number
  lng: number
  precision: number
}

/** Position GPS actuelle (précise, 10 secondes maximum). */
export function positionActuelle(): Promise<Position> {
  return new Promise((ok, echec) => {
    if (!('geolocation' in navigator)) return echec(new Error('GPS indisponible sur cet appareil'))
    navigator.geolocation.getCurrentPosition(
      (p) => ok({ lat: p.coords.latitude, lng: p.coords.longitude, precision: p.coords.accuracy }),
      (e) => echec(new Error(e.code === 1 ? 'Accès à la position refusé : autorisez-le dans les réglages du téléphone.' : 'Position introuvable pour le moment.')),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 30_000 },
    )
  })
}

interface ReponseNominatim {
  address?: {
    road?: string
    pedestrian?: string
    house_number?: string
    postcode?: string
    city?: string
    town?: string
    village?: string
    suburb?: string
    city_district?: string
  }
}

/**
 * Adresse la plus proche d'une position (OpenStreetMap / Nominatim, gratuit).
 * La localité est déduite du code postal quand il désigne une seule section (6001 → Marcinelle).
 */
export async function adresseDepuisPosition(p: { lat: number; lng: number }): Promise<Adresse | null> {
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&accept-language=fr&zoom=18&lat=${p.lat}&lon=${p.lng}`
  const r = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!r.ok) throw new Error(`Service d'adresses indisponible (${r.status})`)
  const a = ((await r.json()) as ReponseNominatim).address
  if (!a) return null
  const cp = a.postcode ?? ''
  const sections = localitesPourCp(cp)
  return {
    rue: a.road ?? a.pedestrian ?? '',
    numero: a.house_number ?? '',
    boite: '',
    cp,
    ville: sections.length === 1 ? sections[0]! : (a.town ?? a.city ?? a.village ?? a.suburb ?? a.city_district ?? ''),
  }
}

/** Complète l'adresse des biens repérés hors ligne, dès que le réseau revient. */
export async function chercherAdressesEnAttente(): Promise<number> {
  if (!navigator.onLine) return 0
  const enAttente = await biens.filtrer((b) => b.adresseAChercher && b.lat != null && b.lng != null)
  let trouvees = 0
  for (const b of enAttente) {
    try {
      const adresse = await adresseDepuisPosition({ lat: b.lat!, lng: b.lng! })
      if (adresse) {
        await biens.modifier(b.id, { adresse, adresseAChercher: false })
        trouvees++
      }
      await new Promise((r) => setTimeout(r, 1100)) // règle d'usage du service : 1 demande par seconde
    } catch {
      break
    }
  }
  return trouvees
}
