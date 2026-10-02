import type { LigneImportee } from '@/domain/importation'
import { db as dbDefaut, type LinkimmoDB } from '../db'
import { ContactRepository, contactVide } from './contacts'

/** Étiquette posée sur chaque fiche importée : permet de retrouver (et d'annuler) un import. */
export function etiquetteImport(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `import ${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}h${p(d.getMinutes())}`
}

export async function importerContacts(
  lignes: LigneImportee[],
  options: { doublons: 'ignorer' | 'creer'; etiquette?: string },
  db: LinkimmoDB = dbDefaut,
): Promise<{ creees: number; ignorees: number; etiquette: string }> {
  const etiquette = options.etiquette ?? etiquetteImport()
  const garder = lignes.filter((l) => options.doublons === 'creer' || (!l.doublonDe && !l.doublonLigne))
  const repo = new ContactRepository(db)
  for (let i = 0; i < garder.length; i += 500) {
    await repo.creerPlusieurs(
      garder.slice(i, i + 500).map((l) => ({ ...contactVide(), ...l.contact, tags: [etiquette] })),
      { journaliser: true },
    )
  }
  return { creees: garder.length, ignorees: lignes.length - garder.length, etiquette }
}

/** Imports passés (étiquette, nombre de fiches encore actives). */
export async function importsPasses(db: LinkimmoDB = dbDefaut): Promise<{ etiquette: string; fiches: number }[]> {
  const compte = new Map<string, number>()
  await db.contacts.each((c) => {
    if (c.archivedAt) return
    for (const t of c.tags) if (t.startsWith('import ')) compte.set(t, (compte.get(t) ?? 0) + 1)
  })
  return [...compte].map(([etiquette, fiches]) => ({ etiquette, fiches })).sort((a, b) => b.etiquette.localeCompare(a.etiquette))
}

/** Annule un import : les fiches importées sont archivées (récupérables, jamais effacées). */
export async function annulerImport(etiquette: string, db: LinkimmoDB = dbDefaut): Promise<number> {
  const repo = new ContactRepository(db)
  const fiches = await db.contacts.filter((c) => !c.archivedAt && c.tags.includes(etiquette)).toArray()
  for (const c of fiches) await repo.archiver(c.id)
  return fiches.length
}
