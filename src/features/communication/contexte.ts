import { useNomAgence } from '@/app/agence'
import { useAuth } from '@/app/auth'
import type { Contact } from '@/data/types'
import type { ContexteMessage } from '@/domain/communication'

/** Prénom de l'agent connecté et nom de l'agence (pour {{agent}} et {{agence}}). */
export function useSignature(): { agent: string | null; agence: string | null } {
  const { profil } = useAuth()
  return { agent: profil?.nom?.split(' ')[0] || null, agence: useNomAgence() }
}

export function contexteDe(c: Contact, s: { agent: string | null; agence: string | null }): ContexteMessage {
  return { civilite: c.civilite, prenom: c.prenom, nom: c.nom, ville: c.adresse?.ville ?? '', agent: s.agent, agence: s.agence }
}
