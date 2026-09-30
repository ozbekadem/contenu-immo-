import Dexie, { type EntityTable, type Table } from 'dexie'
import { deriverContact } from './derives'
import type { Contact, EntreeJournal, FichierLocal, Interaction, OperationSortante, PieceJointe } from './types'

export interface Meta {
  cle: string
  valeur: unknown
}

export class LinkimmoDB extends Dexie {
  contacts!: Table<Contact, string>
  piecesJointes!: Table<PieceJointe, string>
  interactions!: Table<Interaction, string>
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
    // v4 : le journal devient synchronisable (identifiant unique + indicateur d'envoi).
    this.version(4)
      .stores({ journal: '++id, [table+rowId], at, &uid, envoye' })
      .upgrade(async (tx) => {
        const demo = new Set(
          (await tx.table<Contact, string>('contacts').toArray()).filter((c) => c._demo).map((c) => c.id),
        )
        await tx
          .table<EntreeJournal, number>('journal')
          .toCollection()
          .modify((e) => {
            e.uid = crypto.randomUUID()
            e.envoye = demo.has(e.rowId) ? 1 : 0
          })
      })
    // v5 : historique des échanges (appels, messages, notes).
    this.version(5).stores({ interactions: 'id, contactId, date' })
  }
}

export const db = new LinkimmoDB()
