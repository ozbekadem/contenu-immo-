import { ArrowLeft } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router'

/**
 * Revenir à l'écran précédent. Si l'écran a été ouvert directement (notification, lien, application
 * relancée), il n'y a pas d'écran précédent : on va alors vers `repli`.
 */
export function useRetour(repli = '/') {
  const navigate = useNavigate()
  const location = useLocation()
  return () => {
    if (location.key !== 'default') void navigate(-1)
    else void navigate(repli, { replace: true })
  }
}

export function BoutonRetour({ repli = '/', className = '' }: { repli?: string; className?: string }) {
  const retour = useRetour(repli)
  return (
    <button
      type="button"
      onClick={retour}
      className={`presse grid size-11 shrink-0 place-items-center rounded-full bg-surface shadow-carte dark:shadow-none dark:ring-1 dark:ring-bord ${className}`}
      aria-label="Retour"
    >
      <ArrowLeft className="size-5" aria-hidden />
    </button>
  )
}
