import { useSyncExternalStore } from 'react'

interface InvitationInstallation extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let invitation: InvitationInstallation | null = null
let installee = false
const abonnes = new Set<() => void>()
const prevenir = () => abonnes.forEach((f) => f())

/** À appeler au démarrage : Android et ordinateur proposent l'installation via cet événement. */
export function ecouterInstallation(): void {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault() // on garde l'invitation pour notre bouton « Installer »
    invitation = e as InvitationInstallation
    prevenir()
  })
  window.addEventListener('appinstalled', () => {
    installee = true
    invitation = null
    prevenir()
  })
}

export function useInstallation(): { possible: boolean; installee: boolean } {
  const etat = useSyncExternalStore(
    (f) => {
      abonnes.add(f)
      return () => abonnes.delete(f)
    },
    () => `${!!invitation}|${installee}`,
  )
  const [possible, fait] = etat.split('|')
  return { possible: possible === 'true', installee: fait === 'true' }
}

export async function installer(): Promise<boolean> {
  if (!invitation) return false
  await invitation.prompt()
  const { outcome } = await invitation.userChoice
  invitation = null
  prevenir()
  return outcome === 'accepted'
}
