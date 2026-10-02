import { deriverBien, deriverContact, deriverPiste } from '../derives'
import type { Bien, Contact, Enregistrement, Piste } from '../types'
import type { ConfigEntite } from './moteur'

/** Tables synchronisées : nom côté serveur → table locale et calcul des champs locaux. */
export const ENTITES_SYNC: Record<string, ConfigEntite> = {
  contacts: {
    table: (db) => db.contacts as never,
    deriver: (f: Enregistrement) => deriverContact(f as Contact),
  },
  interactions: {
    table: (db) => db.interactions as never,
    deriver: (f: Enregistrement) => f,
  },
  biens: {
    table: (db) => db.biens as never,
    deriver: (f: Enregistrement) => deriverBien(f as Bien),
  },
  pistes: {
    table: (db) => db.pistes as never,
    deriver: (f: Enregistrement) => deriverPiste(f as Piste),
  },
  photos: {
    table: (db) => db.photos as never,
    deriver: (f: Enregistrement) => f,
  },
  evenements: {
    table: (db) => db.evenements as never,
    deriver: (f: Enregistrement) => f,
  },
  modeles: {
    table: (db) => db.modeles as never,
    deriver: (f: Enregistrement) => f,
  },
  campagnes: {
    table: (db) => db.campagnes as never,
    deriver: (f: Enregistrement) => f,
  },
  envois: {
    table: (db) => db.envois as never,
    deriver: (f: Enregistrement) => f,
  },
  argumentaires: {
    table: (db) => db.argumentaires as never,
    deriver: (f: Enregistrement) => f,
  },
  piecesJointes: {
    table: (db) => db.piecesJointes as never,
    deriver: (f: Enregistrement) => f,
  },
}
