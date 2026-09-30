import type { Contact } from '@/data/types'
import { ecartJours } from '@/domain/dates'
import type { Couleur } from '@/domain/relance'
import { correspond, preparerRequete } from '@/domain/recherche'

export type FiltreRapide = 'tous' | 'retard' | 'aujourdhui' | 'semaine' | 'positifs' | 'sans6mois' | 'archives'

export const FILTRES: { code: FiltreRapide; libelle: string }[] = [
  { code: 'tous', libelle: 'Tous' },
  { code: 'retard', libelle: 'En retard' },
  { code: 'aujourdhui', libelle: 'À appeler aujourd’hui' },
  { code: 'semaine', libelle: 'Cette semaine' },
  { code: 'positifs', libelle: 'Positifs' },
  { code: 'sans6mois', libelle: 'Sans contact depuis 6 mois' },
  { code: 'archives', libelle: 'Archivés' },
]

export interface ContactColore {
  contact: Contact
  couleur: Couleur
}

function jourRelance(c: Contact, maintenant: Date): number | null {
  return c.prochaineRelanceAt ? ecartJours(maintenant, new Date(c.prochaineRelanceAt)) : null
}

export function appliquerFiltre(liste: ContactColore[], filtre: FiltreRapide, maintenant: Date): ContactColore[] {
  if (filtre === 'archives') return liste.filter(({ contact }) => contact.archivedAt)
  const actifs = liste.filter(({ contact }) => !contact.archivedAt)
  switch (filtre) {
    case 'tous':
      return actifs
    case 'retard':
      return actifs.filter(({ couleur }) => couleur === 'rouge')
    case 'aujourdhui':
      return actifs.filter(({ couleur }) => couleur === 'orange')
    case 'semaine':
      return actifs.filter(({ contact }) => {
        const j = jourRelance(contact, maintenant)
        return j !== null && j >= 0 && j <= 7
      })
    case 'positifs':
      return actifs.filter(({ contact }) => contact.dernierResultatPositif || contact.temperature === 'chaud')
    case 'sans6mois':
      return actifs.filter(
        ({ contact }) => !contact.nePasContacter && (!contact.dernierContactAt || ecartJours(new Date(contact.dernierContactAt), maintenant) > 180),
      )
  }
}

export function rechercher(liste: ContactColore[], requete: string): ContactColore[] {
  const jetons = preparerRequete(requete)
  if (jetons.length === 0) return liste
  return liste.filter(({ contact }) => correspond(contact._recherche, jetons, contact._rechPhon))
}

export type Tri = 'nom' | 'relance' | 'dernier' | 'ajout'

export const TRIS: { code: Tri; libelle: string }[] = [
  { code: 'nom', libelle: 'Nom (A → Z)' },
  { code: 'relance', libelle: 'Prochaine relance' },
  { code: 'dernier', libelle: 'Dernier contact' },
  { code: 'ajout', libelle: 'Ajout récent' },
]

/** Trie sans modifier la liste d'origine ; les dates manquantes vont en fin de liste. */
export function trier(liste: ContactColore[], tri: Tri): ContactColore[] {
  if (tri === 'nom') return liste // déjà triée par nom à la lecture
  const cle = (c: ContactColore['contact']): string | null =>
    tri === 'relance' ? c.prochaineRelanceAt : tri === 'dernier' ? c.dernierContactAt : c.createdAt
  const sens = tri === 'ajout' ? -1 : 1
  return [...liste].sort((a, b) => {
    const ka = cle(a.contact)
    const kb = cle(b.contact)
    if (ka === kb) return 0
    if (!ka) return tri === 'dernier' ? -1 : 1 // jamais contacté = le plus « ancien »
    if (!kb) return tri === 'dernier' ? 1 : -1
    return ka < kb ? -sens : sens
  })
}
