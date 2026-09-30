import { deriverContact } from '../derives'
import type { Contact, Enregistrement } from '../types'
import type { ConfigEntite } from './moteur'

/** Tables synchronisées : nom côté serveur → table locale et calcul des champs locaux. */
export const ENTITES_SYNC: Record<string, ConfigEntite> = {
  contacts: {
    table: (db) => db.contacts as never,
    deriver: (f: Enregistrement) => deriverContact(f as Contact),
  },
  piecesJointes: {
    table: (db) => db.piecesJointes as never,
    deriver: (f: Enregistrement) => f,
  },
}
