import type { ButtonHTMLAttributes } from 'react'

export type VarianteBouton = 'primaire' | 'secondaire' | 'fantome' | 'danger'

const VARIANTES: Record<VarianteBouton, string> = {
  primaire: 'degrade text-white shadow-primaire',
  secondaire: 'bg-surface text-texte shadow-carte ring-1 ring-bord dark:shadow-none',
  fantome: 'bg-surface-2 text-texte',
  danger: 'bg-suivi-rouge/10 text-suivi-rouge',
}

/** Classes d'un bouton, réutilisables sur un lien (<Link>, <a>). */
export function classesBouton(variante: VarianteBouton = 'primaire', taille: 'md' | 'lg' = 'md') {
  const t = taille === 'lg' ? 'h-14 rounded-2xl px-6 text-base' : 'h-11 rounded-full px-4 text-sm'
  return `presse inline-flex items-center justify-center gap-2 font-bold disabled:pointer-events-none disabled:opacity-50 ${t} ${VARIANTES[variante]}`
}

export function Bouton({
  variante = 'primaire',
  taille = 'md',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: VarianteBouton; taille?: 'md' | 'lg' }) {
  return <button type="button" {...props} className={`${classesBouton(variante, taille)} ${className}`} />
}
