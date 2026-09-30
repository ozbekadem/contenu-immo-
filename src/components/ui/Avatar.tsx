import { Home } from 'lucide-react'
import type { Couleur } from '@/domain/relance'
import { StatusDot } from './StatusDot'

/** Teintes douces, choisies de façon stable à partir du nom. */
const TEINTES = [
  'bg-[#e0e7ff] text-[#4338ca] dark:bg-[#312e81] dark:text-[#c7d2fe]',
  'bg-[#dcfce7] text-[#15803d] dark:bg-[#14532d] dark:text-[#bbf7d0]',
  'bg-[#fce7f3] text-[#be185d] dark:bg-[#831843] dark:text-[#fbcfe8]',
  'bg-[#ffedd5] text-[#c2410c] dark:bg-[#7c2d12] dark:text-[#fed7aa]',
  'bg-[#e0f2fe] text-[#0369a1] dark:bg-[#0c4a6e] dark:text-[#bae6fd]',
  'bg-[#f3e8ff] text-[#7e22ce] dark:bg-[#581c87] dark:text-[#e9d5ff]',
  'bg-[#ccfbf1] text-[#0f766e] dark:bg-[#134e4a] dark:text-[#99f6e4]',
  'bg-[#fef9c3] text-[#a16207] dark:bg-[#713f12] dark:text-[#fef08a]',
]

function teinte(cle: string): string {
  let h = 0
  for (let i = 0; i < cle.length; i++) h = (h * 31 + cle.charCodeAt(i)) >>> 0
  return TEINTES[h % TEINTES.length]!
}

export function Avatar({
  initiales,
  cle,
  couleur,
  taille = 'md',
}: {
  initiales: string
  cle: string
  couleur?: Couleur
  taille?: 'md' | 'lg'
}) {
  const t = taille === 'lg' ? 'size-[72px] rounded-[26px] text-2xl' : 'size-11 rounded-2xl text-sm'
  return (
    <span className={`relative grid shrink-0 place-items-center font-bold ${t} ${teinte(cle)}`}>
      {initiales || <Home className={taille === 'lg' ? 'size-8' : 'size-5'} aria-hidden />}
      {couleur && (
        <span className={`absolute rounded-full bg-surface p-[3px] ${taille === 'lg' ? '-bottom-1 -right-1' : '-bottom-0.5 -right-0.5'}`}>
          <StatusDot couleur={couleur} taille={taille === 'lg' ? 'lg' : 'sm'} />
        </span>
      )}
    </span>
  )
}
