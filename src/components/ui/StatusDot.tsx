import type { Couleur } from '@/domain/relance'
import { LIBELLE_COULEUR } from '@/domain/relance'

export const FOND_COULEUR: Record<Couleur, string> = {
  vert: 'bg-suivi-vert',
  jaune: 'bg-suivi-jaune',
  orange: 'bg-suivi-orange',
  rouge: 'bg-suivi-rouge',
  gris: 'bg-suivi-gris',
}

export function StatusDot({ couleur, taille = 'md', className = '' }: { couleur: Couleur; taille?: 'sm' | 'md' | 'lg'; className?: string }) {
  const t = taille === 'sm' ? 'size-2.5' : taille === 'lg' ? 'size-4' : 'size-3'
  return (
    <span
      role="img"
      aria-label={LIBELLE_COULEUR[couleur]}
      title={LIBELLE_COULEUR[couleur]}
      className={`relative inline-flex shrink-0 rounded-full ${t} ${FOND_COULEUR[couleur]} ${className}`}
    >
      {couleur === 'rouge' && taille === 'lg' && <span className="absolute inset-0 animate-ping rounded-full bg-suivi-rouge/50 [animation-duration:2s]" />}
    </span>
  )
}
