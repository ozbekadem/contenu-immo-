import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useState } from 'react'
import { contacts } from '@/data/repositories/contacts'
import { couleurContact } from './affichage'
import type { ContactColore } from './filtres'

/**
 * Tous les contacts avec leur couleur de suivi, mis à jour automatiquement
 * à chaque modification de la base locale. `undefined` pendant le premier chargement.
 */
export function useContactsColores(): { liste: ContactColore[] | undefined; maintenant: Date } {
  const brut = useLiveQuery(() => contacts.tous(), [])
  const jour = useJour()
  return useMemo(() => {
    const maintenant = new Date()
    return { maintenant, liste: brut?.map((contact) => ({ contact, couleur: couleurContact(contact, maintenant) })) }
    // `jour` : les couleurs (orange « aujourd'hui », rouge « en retard ») changent à minuit.
  }, [brut, jour])
}

/**
 * Date du jour (« AAAA-M-J »), mise à jour quand le jour change, y compris si l'application
 * reste ouverte toute la nuit ou revient au premier plan le lendemain.
 */
export function useJour(): string {
  const cle = () => {
    const d = new Date()
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
  }
  const [jour, setJour] = useState(cle)
  useEffect(() => {
    const verifier = () => setJour(cle())
    const minuterie = setInterval(verifier, 60_000)
    document.addEventListener('visibilitychange', verifier)
    return () => {
      clearInterval(minuterie)
      document.removeEventListener('visibilitychange', verifier)
    }
  }, [])
  return jour
}
