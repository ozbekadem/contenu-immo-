import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router'
import { MODULES } from '@/app/navigation'
import { PageHeader } from '@/components/ui/PageHeader'

const TEINTES = [
  'bg-[#e0e7ff] text-[#4338ca]',
  'bg-[#dcfce7] text-[#15803d]',
  'bg-[#fce7f3] text-[#be185d]',
  'bg-[#ffedd5] text-[#c2410c]',
  'bg-[#e0f2fe] text-[#0369a1]',
  'bg-[#f3e8ff] text-[#7e22ce]',
  'bg-[#f1f5f9] text-[#334155]',
]

export default function PlusPage() {
  return (
    <>
      <PageHeader titre="Plus" />
      <ul className="overflow-hidden rounded-3xl bg-surface py-1 shadow-carte dark:shadow-none dark:ring-1 dark:ring-bord">
        {MODULES.map(({ chemin, libelle, description, icone: Icone }, i) => (
          <li key={chemin} className="relative after:absolute after:bottom-0 after:left-[72px] after:right-4 after:h-px after:bg-bord/70 last:after:hidden">
            <Link to={chemin} className="flex items-center gap-3 px-4 py-3.5 transition-colors active:bg-surface-2">
              <span className={`grid size-11 place-items-center rounded-2xl ${TEINTES[i % TEINTES.length]}`}>
                <Icone className="size-5" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-bold">{libelle}</span>
                <span className="block truncate text-[13px] text-doux">{description}</span>
              </span>
              <ChevronRight className="size-5 text-doux" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </>
  )
}
