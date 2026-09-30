import Dexie, { type EntityTable, type Table } from 'dexie'
import type { Contact, EntreeJournal, OperationSortante } from './types'

export interface Meta {
  cle: string
  valeur: unknown
}

export class LinkimmoDB extends Dexie {
  contacts!: Table<Contact, string>
  journal!: EntityTable<EntreeJournal, 'id'>
  outbox!: EntityTable<OperationSortante, 'seq'>
  meta!: EntityTable<Meta, 'cle'>

  constructor(nom = 'linkimmo') {
    super(nom)
    this.version(1).stores({
      contacts: 'id, _tri, *_telNorm, prochaineRelanceAt, dernierContactAt, updatedAt',
      journal: '++id, [table+rowId], at',
      outbox: '++seq, [table+rowId]',
      meta: 'cle',
    })
  }
}

export const db = new LinkimmoDB()
