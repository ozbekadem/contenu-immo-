import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/data/db'

const CLE = 'agence.nom'

/** Nom de l'agence (Paramètres), utilisé dans les argumentaires et les messages. null tant qu'il n'est pas renseigné. */
export function useNomAgence(): string | null {
  const v = useLiveQuery(() => db.meta.get(CLE), [])
  const nom = typeof v?.valeur === 'string' ? v.valeur.trim() : ''
  return nom || null
}

export async function definirNomAgence(nom: string): Promise<void> {
  const propre = nom.trim()
  if (propre) await db.meta.put({ cle: CLE, valeur: propre })
  else await db.meta.delete(CLE)
}
