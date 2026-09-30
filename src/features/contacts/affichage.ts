import type { Contact } from '@/data/types'
import { STATUTS_CONTACT } from '@/data/types'
import { couleurSuivi, parametresPour, type Couleur } from '@/domain/relance'

const date = (iso: string | null) => (iso ? new Date(iso) : null)

export function nomAffiche(c: Pick<Contact, 'civilite' | 'prenom' | 'nom' | 'societe'>): string {
  const personne = [c.prenom, c.nom].filter(Boolean).join(' ')
  return personne || c.societe || 'Sans nom'
}

export function initiales(c: Pick<Contact, 'prenom' | 'nom' | 'societe'>): string {
  const lettres = [c.prenom, c.nom].filter(Boolean).map((m) => m.trim()[0])
  return (lettres.join('') || c.societe.slice(0, 2) || '?').toUpperCase()
}

/**
 * Couleur de suivi d'un contact. Tant que les pistes de prospection n'existent pas (étape 5),
 * on applique le seuil du Portefeuille.
 */
export function couleurContact(c: Contact, maintenant = new Date()): Couleur {
  return couleurSuivi(
    {
      archive: !!c.archivedAt,
      nePasRappeler: c.nePasContacter,
      dernierContactAt: date(c.dernierContactAt),
      prochaineRelanceAt: date(c.prochaineRelanceAt),
      dernierResultatPositif: c.dernierResultatPositif,
      temperature: c.temperature,
      creeLe: date(c.createdAt),
    },
    parametresPour('portefeuille'),
    maintenant,
  )
}

export function libelleStatut(code: string): string {
  return STATUTS_CONTACT.find((s) => s.code === code)?.libelle ?? code
}

export function dateNaissanceLisible(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(`${iso}T12:00:00`)
  return new Intl.DateTimeFormat('fr-BE', { day: 'numeric', month: 'long', year: 'numeric' }).format(d)
}
