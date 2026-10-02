import type { ComponentType, ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router'

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-3xl bg-surface p-4 shadow-carte dark:shadow-none dark:ring-1 dark:ring-bord ${className}`}>{children}</section>
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <h2 className="text-base font-bold tracking-tight">{children}</h2>
      {action}
    </div>
  )
}

export type TeinteSection = 'primaire' | 'rouge' | 'orange' | 'annonce' | 'rose'

const TEINTES: Record<TeinteSection, { bandeau: string; icone: string; nombre: string }> = {
  primaire: { bandeau: 'bg-primaire-doux', icone: 'text-primaire-texte', nombre: 'bg-primaire text-white' },
  rouge: { bandeau: 'bg-suivi-rouge/10', icone: 'text-suivi-rouge', nombre: 'bg-suivi-rouge text-white' },
  orange: { bandeau: 'bg-suivi-orange/12', icone: 'text-suivi-orange', nombre: 'bg-suivi-orange text-white' },
  annonce: { bandeau: 'bg-annonce/12', icone: 'text-annonce', nombre: 'bg-annonce text-white' },
  rose: { bandeau: 'bg-[#db2777]/10', icone: 'text-[#db2777]', nombre: 'bg-[#db2777] text-white' },
}

/**
 * En-tête d'une carte de l'accueil : bandeau coloré, titre en gras et plus grand, icône dans une pastille,
 * séparé du contenu par un trait — pour qu'on ne le confonde pas avec le texte des fiches.
 */
export function EnteteSection({
  icone: Icone,
  titre,
  teinte = 'primaire',
  nombre,
  description,
  lien,
}: {
  icone: ComponentType<{ className?: string; 'aria-hidden'?: boolean }>
  titre: string
  teinte?: TeinteSection
  nombre?: number
  description?: ReactNode
  lien?: string
}) {
  const t = TEINTES[teinte]
  const ligne = (
    <div className="flex items-center gap-2.5">
      <span className={`grid size-9 shrink-0 place-items-center rounded-xl bg-surface shadow-sm ${t.icone}`}>
        <Icone className="size-5" aria-hidden />
      </span>
      <h2 className="min-w-0 flex-1 text-[17px] font-extrabold leading-tight tracking-tight">{titre}</h2>
      {nombre !== undefined && <span className={`grid h-7 min-w-7 shrink-0 place-items-center rounded-full px-2 text-sm font-extrabold tabular-nums ${t.nombre}`}>{nombre}</span>}
      {lien && <ChevronRight className="size-5 shrink-0 text-doux" aria-hidden />}
    </div>
  )
  return (
    <div className={`border-b border-bord/70 px-4 pb-3 pt-3.5 ${t.bandeau}`}>
      {lien ? (
        <Link to={lien} className="block active:opacity-70">
          {ligne}
        </Link>
      ) : (
        ligne
      )}
      {description && <p className="mt-1.5 text-xs leading-snug text-doux">{description}</p>}
    </div>
  )
}
