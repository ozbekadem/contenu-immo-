import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router'
import { MODULES } from '@/app/navigation'
import { PageHeader } from '@/components/ui/PageHeader'

export default function PlusPage() {
  return (
    <>
      <PageHeader titre="Plus" />
      <ul className="divide-y divide-bord overflow-hidden rounded-2xl border border-bord bg-surface">
        {MODULES.map(({ chemin, libelle, description, icone: Icone }) => (
          <li key={chemin}>
            <Link to={chemin} className="flex items-center gap-3 px-4 py-3.5 active:bg-surface-2">
              <span className="grid size-10 place-items-center rounded-xl bg-surface-2">
                <Icone className="size-5" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{libelle}</span>
                <span className="block truncate text-xs text-doux">{description}</span>
              </span>
              <ChevronRight className="size-5 text-doux" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </>
  )
}
