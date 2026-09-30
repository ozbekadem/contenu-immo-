import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

export function EmptyState({ icone: Icone, titre, children }: { icone: LucideIcon; titre: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-bord px-6 py-10 text-center">
      <span className="grid size-14 place-items-center rounded-2xl bg-accent text-accent-ink">
        <Icone className="size-7" aria-hidden />
      </span>
      <h2 className="text-lg font-bold">{titre}</h2>
      {children && <div className="max-w-sm text-sm text-doux">{children}</div>}
    </div>
  )
}
