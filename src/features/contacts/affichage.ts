import type { Contact } from '@/data/types'
import { formaterTelephone } from '@/domain/telephone'
import { STATUTS_CONTACT } from '@/data/types'
import { couleurSuivi, parametresPour, type Couleur } from '@/domain/relance'

const date = (iso: string | null) => (iso ? new Date(iso) : null)

/**
 * Nom à afficher. Aucun champ n'étant obligatoire, on se rabat sur la société,
 * le téléphone, l'email ou la rue pour toujours pouvoir reconnaître la fiche.
 */
export function nomAffiche(c: Partial<Pick<Contact, 'prenom' | 'nom' | 'societe' | 'telephones' | 'emails' | 'adresse'>>): string {
  const personne = [c.prenom, c.nom].filter(Boolean).join(' ')
  if (personne) return personne
  if (c.societe) return c.societe
  // Prospect repéré sans nom (affiche, maison vide) : l'adresse du bien le rend reconnaissable.
  const a = c.adresse
  if (a && (a.rue || a.ville)) return [[a.rue, a.numero].filter(Boolean).join(' '), a.ville].filter(Boolean).join(', ')
  if (c.telephones?.[0]?.numero) return formaterTelephone(c.telephones[0].numero)
  if (c.emails?.[0]) return c.emails[0]
  return 'Contact sans nom'
}

/** Initiales de l'avatar ; chaîne vide pour un prospect sans nom (l'avatar affiche alors une maison). */
export function initiales(c: Pick<Contact, 'prenom' | 'nom' | 'societe'>): string {
  const lettres = [c.prenom, c.nom].filter((m) => m.trim()).map((m) => m.trim()[0])
  return (lettres.join('') || c.societe.trim().slice(0, 2)).toUpperCase()
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
