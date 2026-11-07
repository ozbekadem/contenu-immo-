import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/data/db'
import type { Piste } from '@/data/types'
import { objectifParDefaut, type Activite, type Objectif } from '@/domain/achat'

const CLE = 'activite'
const CLE_DROITS = 'achat.droits'

/** Activité (Paramètres) : agence, marchand de biens ou les deux. Par défaut : les deux. */
export function useActivite(): Activite {
  const v = useLiveQuery(() => db.meta.get(CLE), [])
  const a = v?.valeur
  return a === 'agence' || a === 'marchand' || a === 'les_deux' ? a : 'les_deux'
}

export async function definirActivite(a: Activite): Promise<void> {
  await db.meta.put({ cle: CLE, valeur: a })
}

/** Droits d'enregistrement utilisés par défaut dans la calculette (%), null = taux normal. */
export function useDroitsParDefaut(): number | null {
  const v = useLiveQuery(() => db.meta.get(CLE_DROITS), [])
  return typeof v?.valeur === 'number' ? v.valeur : null
}

export async function definirDroitsParDefaut(pct: number | null): Promise<void> {
  if (pct == null) await db.meta.delete(CLE_DROITS)
  else await db.meta.put({ cle: CLE_DROITS, valeur: pct })
}

/** Objectif d'une piste : celui choisi, sinon celui proposé par la catégorie et l'activité. */
export function objectifPiste(p: Pick<Piste, 'objectif' | 'categorie'>, activite: Activite): Objectif {
  return p.objectif ?? objectifParDefaut(p.categorie, activite)
}
