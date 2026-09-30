import { ecartJours } from '@/domain/dates'
import type { Couleur } from '@/domain/relance'

const STYLES: Record<Couleur, string> = {
  rouge: 'bg-suivi-rouge/12 text-suivi-rouge',
  orange: 'bg-suivi-orange/12 text-suivi-orange',
  jaune: 'bg-suivi-jaune/15 text-[#a16207] dark:text-suivi-jaune',
  vert: 'bg-suivi-vert/12 text-suivi-vert',
  gris: 'bg-surface-2 text-doux',
}

const FORMAT = new Intl.DateTimeFormat('fr-BE', { day: 'numeric', month: 'short' })

/** Texte court de l'étiquette : « Retard 3 j », « Aujourd'hui », « Demain », « 7 oct. », « À relancer ». */
export function texteRelance(couleur: Couleur, relance: Date | null, maintenant: Date): string {
  if (couleur === 'gris') return 'Archivé'
  if (!relance) return couleur === 'rouge' ? 'À relancer' : 'Pas de relance'
  const n = ecartJours(maintenant, relance)
  if (n < 0) return `Retard ${-n} j`
  if (n === 0) return "Aujourd'hui"
  if (n === 1) return 'Demain'
  return FORMAT.format(relance)
}

export function RelancePill({ couleur, relance, maintenant }: { couleur: Couleur; relance: Date | null; maintenant: Date }) {
  return (
    <span className={`inline-flex h-7 shrink-0 items-center rounded-full px-2.5 text-xs font-bold ${STYLES[couleur]}`}>
      {texteRelance(couleur, relance, maintenant)}
    </span>
  )
}
