import Dexie, { type EntityTable, type Table } from 'dexie'
import { deriverContact } from './derives'
import type { ArgumentairePerso, Bien, Evenement, LienGoogle, Contact, EntreeJournal, FichierLocal, Interaction, OperationSortante, Photo, PhotoLocale, PieceJointe, Piste } from './types'

export interface Meta {
  cle: string
  valeur: unknown
}

export class LinkimmoDB extends Dexie {
  contacts!: Table<Contact, string>
  piecesJointes!: Table<PieceJointe, string>
  interactions!: Table<Interaction, string>
  biens!: Table<Bien, string>
  pistes!: Table<Piste, string>
  photos!: Table<Photo, string>
  photosLocales!: Table<PhotoLocale, string>
  fichiers!: Table<FichierLocal, string>
  journal!: EntityTable<EntreeJournal, 'id'>
  argumentaires!: Table<ArgumentairePerso, string>
  evenements!: Table<Evenement, string>
  liensGoogle!: Table<LienGoogle, string>
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
    // v6 : prospection (biens, pistes, photos).
    this.version(6).stores({
      interactions: 'id, contactId, pisteId, date',
      biens: 'id, _cleAdresse, updatedAt',
      pistes: 'id, bienId, contactId, categorie, _cleAnnonce, updatedAt',
      photos: 'id, bienId, pisteId',
      photosLocales: 'id',
    })
    this.version(7).stores({
      argumentaires: 'id, cas',
    })
    this.version(8).stores({
      evenements: 'id, debut, contactId, pisteId, bienId, googleEventId',
      liensGoogle: 'cle, eventId',
    })
  }
}

export const db = new LinkimmoDB()
