import { useMemo } from 'react'
import type { Contact, Piste } from '@/data/types'
import { classer, type Priorite, type ProspectAClasser } from '@/domain/priorite'
import { nomAffiche } from '@/features/contacts/affichage'
import { useContactsColores } from '@/features/contacts/useContacts'
import { usePistes } from '@/features/prospection/usePistes'

/** Ce qu'on suit au quotidien : une piste (annonce, maison vide) ou un contact du portefeuille. */
export interface Suivable extends ProspectAClasser {
  cle: string
  lien: string
  titre: string
  contact: Contact | null
  piste: Piste | null
  bienId: string | null
  categorie: 'portefeuille' | 'annonce' | 'maison_vide'
}

/**
 * Pistes en cours + contacts sans piste en cours. Un contact suivi via une piste n'apparaît
 * qu'une fois (par sa piste) : pas de doublon dans « Qui appeler en premier ».
 */
export function useSuivables(): { liste: Suivable[] | undefined; maintenant: Date } {
  const contacts = useContactsColores()
  const pistes = usePistes()
  return useMemo(() => {
    const maintenant = pistes.maintenant
    if (!contacts.liste || !pistes.liste) return { liste: undefined, maintenant }
    const actives = pistes.liste.filter(({ piste }) => !piste.archivedAt && piste.statut !== 'perdu' && piste.statut !== 'gagne')
    const suivisParPiste = new Set(actives.map(({ piste }) => piste.contactId).filter(Boolean))
    const liste: Suivable[] = [
      ...actives.map(({ piste, contact, couleur, titre }) => ({
        cle: `p-${piste.id}`,
        lien: `/pistes/${piste.id}`,
        titre,
        contact,
        piste,
        bienId: piste.bienId,
        categorie: piste.categorie,
        couleur,
        prochaineRelanceAt: piste.prochaineRelanceAt,
        dernierContactAt: piste.dernierContactAt,
        createdAt: piste.createdAt,
        temperature: piste.temperature,
        dernierResultatPositif: piste.dernierResultatPositif,
        tentatives: piste.tentatives,
        alerte: piste.alerte,
        historiquePrix: piste.historiquePrix,
        enVenteDepuis: piste.enVenteDepuis,
        datesCles: [...piste.datesCles, ...(contact?.datesCles ?? [])],
      })),
      ...contacts.liste
        .filter(({ contact }) => !contact.archivedAt && !suivisParPiste.has(contact.id))
        .map(({ contact, couleur }) => ({
          cle: `c-${contact.id}`,
          lien: `/contacts/${contact.id}`,
          titre: nomAffiche(contact),
          contact,
          piste: null,
          bienId: null,
          categorie: 'portefeuille' as const,
          couleur,
          prochaineRelanceAt: contact.prochaineRelanceAt,
          dernierContactAt: contact.dernierContactAt,
          createdAt: contact.createdAt,
          temperature: contact.temperature,
          dernierResultatPositif: contact.dernierResultatPositif,
          tentatives: contact.tentatives,
          datesCles: contact.datesCles,
        })),
    ]
    return { liste, maintenant }
  }, [contacts.liste, pistes.liste, pistes.maintenant])
}

export type FiltreCategorie = 'tout' | Suivable['categorie']

export const FILTRES_CATEGORIE: { code: FiltreCategorie; libelle: string }[] = [
  { code: 'tout', libelle: 'Tout' },
  { code: 'annonce', libelle: 'Annonces' },
  { code: 'maison_vide', libelle: 'Maisons vides' },
  { code: 'portefeuille', libelle: 'Portefeuille' },
]

export function filtrerCategorie(liste: Suivable[], filtre: FiltreCategorie): Suivable[] {
  return filtre === 'tout' ? liste : liste.filter((s) => s.categorie === filtre)
}

/** Joignable par téléphone ou email (et sans opposition « ne plus contacter »). */
export function estJoignable(s: Suivable): boolean {
  const c = s.contact
  return !!c && !c.nePasContacter && (c._telNorm.length > 0 || c.emails.length > 0)
}

/** File de la session d'appels : tous les suivis dus aujourd'hui et joignables, du plus prioritaire au moins prioritaire. */
export function fileAppels(liste: Suivable[], maintenant: Date): { suivable: Suivable; priorite: Priorite }[] {
  return classer(liste.filter(estJoignable), maintenant, 500).map(({ element, priorite }) => ({ suivable: element, priorite }))
}
