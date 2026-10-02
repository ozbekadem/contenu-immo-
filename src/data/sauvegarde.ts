import type { Table } from 'dexie'
import type { LinkimmoDB } from './db'
import { ENTITES_SYNC } from './sync/entites'
import type { Enregistrement, EntreeJournal } from './types'

export const FORMAT_SAUVEGARDE = 'linkimmo-sauvegarde'
export const CLE_DERNIERE_SAUVEGARDE = 'sauvegarde.derniere'

export interface Sauvegarde {
  format: typeof FORMAT_SAUVEGARDE
  version: 1
  creeLe: string
  tables: Record<string, Enregistrement[]>
  journal: EntreeJournal[]
}

const TECHNIQUES = new Set(['id', 'createdAt', 'createdBy', 'updatedAt', 'updatedBy', '_ts', '_demo'])
/** Champs locaux recalculés sur l'appareil (index de recherche…) : inutile de les sauvegarder. */
const sansChampsLocaux = (f: Enregistrement) => Object.fromEntries(Object.entries(f).filter(([k]) => !k.startsWith('_') || k === '_ts')) as Enregistrement

/**
 * Sauvegarde complète (fiches, historique, pistes, biens, rendez-vous, modèles, campagnes, journal).
 * Les données de démonstration n'y sont pas. Le contenu des photos et documents n'y est pas non plus
 * (il reste sur le serveur et sur les appareils) : seules leurs descriptions y figurent.
 */
export async function creerSauvegarde(db: LinkimmoDB): Promise<Sauvegarde> {
  const tables: Record<string, Enregistrement[]> = {}
  for (const [nom, config] of Object.entries(ENTITES_SYNC)) {
    tables[nom] = ((await (config.table(db) as Table<Enregistrement, string>).toArray()) as Enregistrement[]).filter((f) => !f._demo).map(sansChampsLocaux)
  }
  const journal = (await db.journal.toArray()).filter((j) => !tables[j.table] || tables[j.table]!.some((f) => f.id === j.rowId)).map(({ id: _id, ...j }) => j as EntreeJournal)
  const s: Sauvegarde = { format: FORMAT_SAUVEGARDE, version: 1, creeLe: new Date().toISOString(), tables, journal }
  await db.meta.put({ cle: CLE_DERNIERE_SAUVEGARDE, valeur: s.creeLe })
  return s
}

export function compterSauvegarde(s: Sauvegarde): { table: string; nombre: number }[] {
  return Object.entries(s.tables).map(([table, l]) => ({ table, nombre: l.length }))
}

/** Vérifie qu'un fichier est bien une sauvegarde Linkimmo lisible. */
export function lireSauvegarde(texte: string): Sauvegarde {
  let d: Partial<Sauvegarde>
  try {
    d = JSON.parse(texte) as Partial<Sauvegarde>
  } catch {
    throw new Error('Ce fichier n’est pas une sauvegarde Linkimmo (format illisible).')
  }
  if (d.format !== FORMAT_SAUVEGARDE || d.version !== 1 || typeof d.tables !== 'object' || !d.tables) throw new Error('Ce fichier n’est pas une sauvegarde Linkimmo.')
  return { ...d, journal: Array.isArray(d.journal) ? d.journal : [] } as Sauvegarde
}

export interface BilanRestauration {
  restaurees: number
  ignorees: number
}

/**
 * Restauration « sans écraser » : une fiche est remise si elle manque sur cet appareil ou si la version
 * de la sauvegarde est plus récente. Les fiches restaurées repartent vers le serveur (et l'équipe) ;
 * la fusion champ par champ du serveur garde toujours la valeur la plus récente.
 */
export async function restaurer(db: LinkimmoDB, s: Sauvegarde): Promise<BilanRestauration> {
  const bilan: BilanRestauration = { restaurees: 0, ignorees: 0 }
  const maintenant = new Date().toISOString()
  const tables = Object.values(ENTITES_SYNC).map((c) => c.table(db) as unknown as Table)
  await db.transaction('rw', [...tables, db.outbox, db.journal], async () => {
    for (const [nom, liste] of Object.entries(s.tables)) {
      const config = ENTITES_SYNC[nom]
      if (!config) continue
      const table = config.table(db) as Table<Enregistrement, string>
      for (const brut of liste) {
        if (!brut?.id || brut._demo) continue
        const existant = await table.get(brut.id)
        if (existant && existant.updatedAt >= brut.updatedAt) {
          bilan.ignorees++
          continue
        }
        await table.put(config.deriver({ ...brut, _ts: brut._ts ?? {} }) as Enregistrement)
        await db.outbox.add({
          table: nom,
          rowId: brut.id,
          champs: Object.fromEntries(Object.entries(brut).filter(([k]) => !TECHNIQUES.has(k) && !k.startsWith('_'))),
          ts: brut._ts ?? {},
          creeLe: maintenant,
        })
        bilan.restaurees++
      }
    }
    const connus = new Set((await db.journal.toArray()).map((j) => j.uid))
    const manquants = s.journal.filter((j) => j?.uid && !connus.has(j.uid)).map(({ id: _id, ...j }) => ({ ...j, envoye: 0 as const }))
    if (manquants.length) await db.journal.bulkAdd(manquants)
  })
  return bilan
}
