import type { ReactNode } from 'react'

export function PageHeader({ titre, sousTitre, action }: { titre: string; sousTitre?: ReactNode; action?: ReactNode }) {
  return (
    <header className="mb-5 flex items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-[28px] font-extrabold leading-tight tracking-tight">{titre}</h1>
        {sousTitre && <p className="mt-0.5 text-sm font-medium text-doux">{sousTitre}</p>}
      </div>
      {action}
    </header>
  )
}
