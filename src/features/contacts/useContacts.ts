import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import { contacts } from '@/data/repositories/contacts'
import { couleurContact } from './affichage'
import type { ContactColore } from './filtres'

/**
 * Tous les contacts avec leur couleur de suivi, mis à jour automatiquement
 * à chaque modification de la base locale. `undefined` pendant le premier chargement.
 */
export function useContactsColores(): { liste: ContactColore[] | undefined; maintenant: Date } {
  const brut = useLiveQuery(() => contacts.tous(), [])
  return useMemo(() => {
    const maintenant = new Date()
    return { maintenant, liste: brut?.map((contact) => ({ contact, couleur: couleurContact(contact, maintenant) })) }
  }, [brut])
}
