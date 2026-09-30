import { empreinte } from '@/domain/doublons'
import { cleTri, construireIndex, construireIndexPhonetique } from '@/domain/recherche'
import { normaliserTelephone } from '@/domain/telephone'
import { SOURCES_CONTACT, type Contact } from './types'

/**
 * Champs locaux calculés d'un contact : index de recherche (texte et phonétique),
 * clé de tri, téléphones normalisés et empreinte anti-doublons.
 */
export function deriverContact(c: Contact): Contact {
  const telNorm = [...new Set(c.telephones.map((t) => normaliserTelephone(t.numero)).filter((n): n is string => !!n))]
  const a = c.adresse
  return {
    ...c,
    _telNorm: telNorm,
    _tri: cleTri(c.nom, c.prenom, c.societe),
    _recherche: construireIndex(
      [
        c.prenom,
        c.nom,
        c.societe,
        a && `${a.rue} ${a.numero}`,
        a?.cp,
        a?.ville,
        ...c.emails,
        ...c.tags,
        c.notes,
        SOURCES_CONTACT.find((s) => s.code === c.source)?.libelle,
      ],
      telNorm,
    ),
    _rechPhon: construireIndexPhonetique([c.prenom, c.nom, c.societe, a?.rue, a?.ville]),
    _empreinte: empreinte(c),
  }
}
