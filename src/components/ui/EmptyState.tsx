import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

export function EmptyState({ icone: Icone, titre, children }: { icone: LucideIcon; titre: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-3xl bg-surface px-6 py-12 text-center shadow-carte dark:shadow-none dark:ring-1 dark:ring-bord">
      <span className="degrade grid size-16 place-items-center rounded-3xl text-white shadow-primaire">
        <Icone className="size-8" aria-hidden />
      </span>
      <h2 className="text-lg font-bold">{titre}</h2>
      {children && <div className="max-w-sm text-sm text-doux">{children}</div>}
    </div>
  )
}
