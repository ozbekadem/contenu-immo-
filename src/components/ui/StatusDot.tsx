import type { Couleur } from '@/domain/relance'
import { LIBELLE_COULEUR } from '@/domain/relance'

const CLASSES: Record<Couleur, string> = {
  vert: 'bg-suivi-vert',
  jaune: 'bg-suivi-jaune',
  orange: 'bg-suivi-orange',
  rouge: 'bg-suivi-rouge',
  gris: 'bg-suivi-gris',
}

export function StatusDot({ couleur, taille = 'md' }: { couleur: Couleur; taille?: 'sm' | 'md' | 'lg' }) {
  const t = taille === 'sm' ? 'size-2.5' : taille === 'lg' ? 'size-4' : 'size-3'
  return (
    <span
      role="img"
      aria-label={LIBELLE_COULEUR[couleur]}
      title={LIBELLE_COULEUR[couleur]}
      className={`inline-block shrink-0 rounded-full ${t} ${CLASSES[couleur]} ${couleur === 'rouge' ? 'ring-4 ring-suivi-rouge/20' : ''}`}
    />
  )
}
