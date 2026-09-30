import type { Bien, Piste } from '@/data/types'
import { couleurSuivi, parametresPour, type Couleur } from '@/domain/relance'

/** « Rue de la Montagne 88, Charleroi » ; à défaut la position ou « Bien sans adresse ». */
export function adresseCourte(b: Pick<Bien, 'adresse' | 'lat' | 'lng' | 'adresseAChercher'>): string {
  const a = b.adresse
  const rue = a ? [a.rue, a.numero].filter(Boolean).join(' ') + (a.boite ? ` bte ${a.boite}` : '') : ''
  const texte = [rue, a?.ville].filter(Boolean).join(', ')
  if (texte) return texte
  if (b.adresseAChercher) return 'Adresse en cours de recherche'
  if (b.lat != null) return `Position ${b.lat.toFixed(4)}, ${b.lng!.toFixed(4)}`
  return 'Bien sans adresse'
}

const date = (iso: string | null) => (iso ? new Date(iso) : null)

/** Couleur de suivi d'une piste (seuils de sa catégorie ; signée = verte, abandonnée = grise). */
export function couleurPiste(p: Piste, maintenant = new Date()): Couleur {
  if (p.statut === 'gagne') return 'vert'
  return couleurSuivi(
    {
      archive: !!p.archivedAt || p.statut === 'perdu',
      dernierContactAt: date(p.dernierContactAt),
      prochaineRelanceAt: date(p.prochaineRelanceAt),
      dernierResultatPositif: p.dernierResultatPositif,
      temperature: p.temperature,
      creeLe: date(p.createdAt),
    },
    parametresPour(p.categorie),
    maintenant,
  )
}

/** Liens d'itinéraire vers le bien (Google Maps ou Waze). */
export function liensItineraire(b: Pick<Bien, 'adresse' | 'lat' | 'lng'>): { google: string; waze: string } | null {
  if (b.lat != null && b.lng != null)
    return {
      google: `https://www.google.com/maps/dir/?api=1&destination=${b.lat},${b.lng}`,
      waze: `https://waze.com/ul?ll=${b.lat},${b.lng}&navigate=yes`,
    }
  const a = b.adresse
  if (!a || !a.rue) return null
  const q = encodeURIComponent(`${a.rue} ${a.numero}, ${a.cp} ${a.ville}, Belgique`)
  return { google: `https://www.google.com/maps/dir/?api=1&destination=${q}`, waze: `https://waze.com/ul?q=${q}&navigate=yes` }
}
