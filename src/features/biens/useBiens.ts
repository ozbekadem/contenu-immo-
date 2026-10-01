import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import { db } from '@/data/db'
import type { Bien, Contact, Piste } from '@/data/types'
import { nomAffiche } from '@/features/contacts/affichage'
import { adresseCourte } from '@/features/prospection/affichage'

/** Ce que l'on sait d'un bien : sa piste en cours (s'il y en a une), ses propriétaires connus, ses photos. */
export interface BienVue {
  bien: Bien
  titre: string
  pistes: Piste[]
  /** Piste en cours la plus récente (ni signée, ni abandonnée, ni archivée). */
  active: Piste | null
  /** Une piste a abouti à une signature. */
  signe: boolean
  proprietaires: Contact[]
  nbPhotos: number
}

export type EtatBien = 'annonce' | 'maison_vide' | 'signe' | 'aucune'

export function etatBien(v: BienVue): EtatBien {
  if (v.active) return v.active.categorie
  return v.signe ? 'signe' : 'aucune'
}

export const LIBELLE_ETAT: Record<EtatBien, string> = {
  annonce: 'Annonce en cours',
  maison_vide: 'Maison vide en cours',
  signe: 'Signé',
  aucune: 'Sans piste en cours',
}

export const COULEUR_ETAT: Record<EtatBien, string> = {
  annonce: 'var(--color-annonce)',
  maison_vide: 'var(--color-maison-vide)',
  signe: 'var(--color-suivi-vert)',
  aucune: 'var(--color-doux)',
}

export function construireVues(biens: Bien[], pistes: Piste[], contacts: Contact[], photosParBien: Map<string, number>): BienVue[] {
  const parBien = new Map<string, Piste[]>()
  for (const p of pistes) parBien.set(p.bienId, [...(parBien.get(p.bienId) ?? []), p])
  const parContact = new Map(contacts.map((c) => [c.id, c]))
  return biens
    .filter((b) => !b.archivedAt)
    .map((bien) => {
      const liste = (parBien.get(bien.id) ?? []).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      const visibles = liste.filter((p) => !p.archivedAt)
      const active = visibles.find((p) => p.statut !== 'gagne' && p.statut !== 'perdu') ?? null
      const proprietaires = [...new Set(visibles.map((p) => p.contactId).filter((id): id is string => !!id))]
        .map((id) => parContact.get(id))
        .filter((c): c is Contact => !!c && !c.archivedAt)
      return {
        bien,
        titre: adresseCourte(bien),
        pistes: liste,
        active,
        signe: visibles.some((p) => p.statut === 'gagne'),
        proprietaires,
        nbPhotos: photosParBien.get(bien.id) ?? 0,
      }
    })
    .sort((a, b) => b.bien.updatedAt.localeCompare(a.bien.updatedAt))
}

/** Tous les biens, avec leurs pistes, propriétaires et nombre de photos (mis à jour en direct). */
export function useBiens(): BienVue[] | undefined {
  const donnees = useLiveQuery(async () => {
    const [biens, pistes, contacts, photos] = await Promise.all([db.biens.toArray(), db.pistes.toArray(), db.contacts.toArray(), db.photos.toArray()])
    const photosParBien = new Map<string, number>()
    for (const p of photos) if (!p.archivedAt) photosParBien.set(p.bienId, (photosParBien.get(p.bienId) ?? 0) + 1)
    return { biens, pistes, contacts, photosParBien }
  }, [])
  return useMemo(() => (donnees ? construireVues(donnees.biens, donnees.pistes, donnees.contacts, donnees.photosParBien) : undefined), [donnees])
}

/** Nom d'un propriétaire ; s'il n'est connu que par son numéro (affiche), on le dit plutôt que de répéter l'adresse. */
export function nomProprietaire(c: Contact): string {
  return c.prenom || c.nom || c.societe ? nomAffiche(c) : c._telNorm.length ? 'Propriétaire (n° connu)' : 'Propriétaire'
}
