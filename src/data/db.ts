import Dexie, { type EntityTable, type Table } from 'dexie'
import { deriverContact } from './derives'
import type { Contact, EntreeJournal, FichierLocal, OperationSortante, PieceJointe } from './types'

export interface Meta {
  cle: string
  valeur: unknown
}

export class LinkimmoDB extends Dexie {
  contacts!: Table<Contact, string>
  piecesJointes!: Table<PieceJointe, string>
  fichiers!: Table<FichierLocal, string>
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
    this.version(2).stores({
      piecesJointes: 'id, [entite+entiteId], updatedAt',
      fichiers: 'id',
    })
    // v3 : recherche tolérante aux fautes et empreinte anti-doublons → recalcul des champs locaux.
    this.version(3)
      .stores({})
      .upgrade((tx) =>
        tx
          .table<Contact, string>('contacts')
          .toCollection()
          .modify((c, ref) => {
            ref.value = deriverContact(c)
          }),
      )
  }
}

export const db = new LinkimmoDB()
