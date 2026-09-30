import type { Table } from 'dexie'
import { appareil, horloge, utilisateurCourant } from '../appareil'
import type { LinkimmoDB } from '../db'
import type { EntreeJournal, Enregistrement } from '../types'

/** Champs techniques qui ne sont ni journalisés ni synchronisés comme des données métier. */
const TECHNIQUES = new Set(['id', 'createdAt', 'createdBy', 'updatedAt', 'updatedBy', '_ts', '_demo'])

const estLocal = (champ: string) => champ.startsWith('_')

function egal(a: unknown, b: unknown): boolean {
  return a === b || JSON.stringify(a) === JSON.stringify(b)
}

export type Donnees<T extends Enregistrement> = Omit<T, keyof Enregistrement | `_${string}`> & { archivedAt?: string | null }

/**
 * Accès générique à une table : chaque écriture met à jour la base locale,
 * inscrit les champs modifiés au journal et prépare leur envoi au serveur (file « outbox »),
 * le tout dans une seule transaction.
 */
export abstract class RepositoryBase<T extends Enregistrement> {
  constructor(
    protected readonly db: LinkimmoDB,
    protected readonly table: Table<T, string>,
    protected readonly nomTable: string,
  ) {}

  /** Calcule les champs locaux dérivés (index de recherche, tri…). */
  protected abstract deriver(fiche: T): T

  get(id: string): Promise<T | undefined> {
    return this.table.get(id)
  }

  async creer(donnees: Donnees<T>, options: { demo?: boolean; journaliser?: boolean } = {}): Promise<T> {
    const [fiche] = await this.creerPlusieurs([donnees], options)
    return fiche!
  }

  async creerPlusieurs(liste: Donnees<T>[], { demo = false, journaliser = true } = {}): Promise<T[]> {
    const maintenant = new Date().toISOString()
    const fiches = liste.map((donnees) => {
      const ts: Record<string, string> = {}
      const tic = horloge.tic()
      for (const champ of Object.keys(donnees)) ts[champ] = tic
      const brut = {
        archivedAt: null,
        ...donnees,
        id: crypto.randomUUID(),
        createdAt: maintenant,
        updatedAt: maintenant,
        createdBy: utilisateurCourant,
        updatedBy: utilisateurCourant,
        _ts: ts,
        ...(demo ? { _demo: true } : {}),
      } as unknown as T
      return this.deriver(brut)
    })

    await this.db.transaction('rw', [this.table, this.db.journal, this.db.outbox], async () => {
      await this.table.bulkAdd(fiches)
      if (!demo) {
        await this.db.outbox.bulkAdd(
          fiches.map((f) => ({ table: this.nomTable, rowId: f.id, champs: this.champsMetier(f), ts: f._ts, creeLe: maintenant })),
        )
      }
      if (journaliser) {
        await this.db.journal.bulkAdd(fiches.map((f) => this.entreeJournal(f.id, 'creation', null, null, maintenant, demo)))
      }
    })
    return fiches
  }

  /** Applique les champs modifiés uniquement ; retourne la fiche à jour. */
  async modifier(id: string, patch: Partial<Donnees<T>>): Promise<T> {
    return this.db.transaction('rw', [this.table, this.db.journal, this.db.outbox], async () => {
      const actuelle = await this.table.get(id)
      if (!actuelle) throw new Error(`Fiche introuvable : ${id}`)

      const changes: Record<string, unknown> = {}
      for (const [champ, valeur] of Object.entries(patch)) {
        if (TECHNIQUES.has(champ) || estLocal(champ)) continue
        if (!egal((actuelle as Record<string, unknown>)[champ], valeur)) changes[champ] = valeur
      }
      if (Object.keys(changes).length === 0) return actuelle

      const maintenant = new Date().toISOString()
      const tic = horloge.tic()
      const ts = { ...actuelle._ts }
      for (const champ of Object.keys(changes)) ts[champ] = tic

      const suivante = this.deriver({
        ...actuelle,
        ...changes,
        updatedAt: maintenant,
        updatedBy: utilisateurCourant,
        _ts: ts,
      })
      await this.table.put(suivante)

      if (!actuelle._demo) {
        const tsChanges = Object.fromEntries(Object.keys(changes).map((c) => [c, tic]))
        await this.db.outbox.add({ table: this.nomTable, rowId: id, champs: changes, ts: tsChanges, creeLe: maintenant })
      }
      await this.db.journal.bulkAdd(
        Object.entries(changes).map(([champ, apres]) =>
          this.entreeJournal(id, champ, (actuelle as Record<string, unknown>)[champ], apres, maintenant, !!actuelle._demo),
        ),
      )
      return suivante
    })
  }

  archiver(id: string): Promise<T> {
    return this.modifier(id, { archivedAt: new Date().toISOString() } as Partial<Donnees<T>>)
  }

  restaurer(id: string): Promise<T> {
    return this.modifier(id, { archivedAt: null } as Partial<Donnees<T>>)
  }

  journal(id: string): Promise<EntreeJournal[]> {
    return this.db.journal.where('[table+rowId]').equals([this.nomTable, id]).reverse().sortBy('at')
  }

  /** Supprime définitivement les données de démonstration (et leur journal). */
  async supprimerDemo(): Promise<number> {
    return this.db.transaction('rw', [this.table, this.db.journal], async () => {
      const ids = (await this.table.filter((f) => f._demo === true).primaryKeys()) as string[]
      await this.table.bulkDelete(ids)
      for (const id of ids) await this.db.journal.where('[table+rowId]').equals([this.nomTable, id]).delete()
      return ids.length
    })
  }

  protected champsMetier(f: T): Record<string, unknown> {
    return Object.fromEntries(Object.entries(f).filter(([c]) => !TECHNIQUES.has(c) && !estLocal(c)))
  }

  private entreeJournal(rowId: string, champ: string, avant: unknown, apres: unknown, at: string, demo: boolean): EntreeJournal {
    return {
      uid: crypto.randomUUID(),
      envoye: demo ? 1 : 0,
      table: this.nomTable,
      rowId,
      champ,
      avant: avant ?? null,
      apres: apres ?? null,
      auteur: utilisateurCourant,
      appareil,
      at,
    }
  }
}
