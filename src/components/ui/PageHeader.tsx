import type { ReactNode } from 'react'

export function PageHeader({ titre, sousTitre, action }: { titre: string; sousTitre?: ReactNode; action?: ReactNode }) {
  return (
    <header className="mb-4 flex items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">{titre}</h1>
        {sousTitre && <p className="mt-0.5 text-sm text-doux">{sousTitre}</p>}
      </div>
      {action}
    </header>
  )
}
