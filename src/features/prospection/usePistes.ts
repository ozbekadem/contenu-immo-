import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import { db } from '@/data/db'
import type { Bien, Contact, Piste } from '@/data/types'
import type { Couleur } from '@/domain/relance'
import { useJour } from '@/features/contacts/useContacts'
import { adresseCourte, couleurPiste } from './affichage'

export interface PisteVue {
  piste: Piste
  bien: Bien | null
  contact: Contact | null
  couleur: Couleur
  titre: string
}

/** Toutes les pistes avec leur bien, leur propriétaire et leur couleur de suivi (mis à jour en direct). */
export function usePistes(): { liste: PisteVue[] | undefined; maintenant: Date } {
  const donnees = useLiveQuery(async () => {
    const [pistes, biens, contacts] = await Promise.all([db.pistes.toArray(), db.biens.toArray(), db.contacts.toArray()])
    return { pistes, biens: new Map(biens.map((b) => [b.id, b])), contacts: new Map(contacts.map((c) => [c.id, c])) }
  }, [])
  const jour = useJour()
  return useMemo(() => {
    const maintenant = new Date()
    if (!donnees) return { liste: undefined, maintenant }
    const liste = donnees.pistes.map((piste) => {
      const bien = donnees.biens.get(piste.bienId) ?? null
      return {
        piste,
        bien,
        contact: piste.contactId ? (donnees.contacts.get(piste.contactId) ?? null) : null,
        couleur: couleurPiste(piste, maintenant),
        titre: bien ? adresseCourte(bien) : 'Bien inconnu',
      }
    })
    return { liste, maintenant }
    // `jour` : recalcul des couleurs au changement de jour
  }, [donnees, jour])
}
