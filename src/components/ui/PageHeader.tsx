import type { ReactNode } from 'react'
import { useLocation } from 'react-router'
import { ONGLETS } from '@/app/navigation'
import { BoutonRetour } from './BoutonRetour'

/** Titre d'un écran. Hors des 5 onglets du bas, une flèche permet de revenir à l'écran précédent. */
export function PageHeader({ titre, sousTitre, action }: { titre: string; sousTitre?: ReactNode; action?: ReactNode }) {
  const { pathname } = useLocation()
  const onglet = ONGLETS.some((o) => o.chemin === pathname)
  return (
    <header className="mb-5 flex items-end justify-between gap-3">
      <div className="flex min-w-0 items-end gap-3">
        {!onglet && <BoutonRetour repli="/plus" className="mb-0.5" />}
        <div className="min-w-0">
          <h1 className="text-[28px] font-extrabold leading-tight tracking-tight">{titre}</h1>
          {sousTitre && <p className="mt-0.5 text-sm font-medium text-doux">{sousTitre}</p>}
        </div>
      </div>
      {action}
    </header>
  )
}
