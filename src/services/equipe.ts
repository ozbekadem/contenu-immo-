import { useLiveQuery } from 'dexie-react-hooks'
import type { Role } from '@/app/auth'
import { db } from '@/data/db'
import { serveurConfigure, supabase } from '@/data/sync/supabase'

export interface Membre {
  id: string
  email: string
  nom: string
  role: Role
  actif: boolean
}

export const LIBELLE_ROLE: Record<Role, string> = {
  admin: 'Administrateur',
  collaborateur: 'Collaborateur',
  stagiaire: 'Stagiaire',
}

const CLE = 'equipe'

/** Membres de l'équipe (gardés sur l'appareil : utilisables hors ligne). Vide en mode local (un seul utilisateur). */
export function useEquipe(): Membre[] {
  return (useLiveQuery(() => db.meta.get(CLE), [])?.valeur as Membre[] | undefined) ?? []
}

export async function rafraichirEquipe(): Promise<void> {
  if (!serveurConfigure) return
  const { data, error } = await supabase().from('profils').select('id, email, nom, role, actif').order('nom')
  if (error || !data) return
  await db.meta.put({ cle: CLE, valeur: data as Membre[] })
}

/** Réservé aux administrateurs (le serveur le vérifie aussi). */
export async function modifierMembre(id: string, patch: Partial<Pick<Membre, 'nom' | 'role' | 'actif'>>): Promise<void> {
  const { error } = await supabase().from('profils').update(patch).eq('id', id)
  if (error) throw new Error(error.message)
  await rafraichirEquipe()
}

export function nomMembre(equipe: Membre[], id: string | null | undefined): string | null {
  if (!id) return null
  const m = equipe.find((x) => x.id === id)
  return m ? m.nom || m.email.split('@')[0]! : null
}
