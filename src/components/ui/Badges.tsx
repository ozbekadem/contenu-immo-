import { Flame, Snowflake, Thermometer } from 'lucide-react'
import type { Categorie, Temperature } from '@/domain/relance'
import { LIBELLE_TEMPERATURE } from '@/domain/relance'
import { libelleCategorie } from '@/domain/categories'

const CAT: Record<Categorie, string> = {
  portefeuille: 'bg-portefeuille/12 text-portefeuille',
  annonce: 'bg-annonce/12 text-annonce',
  maison_vide: 'bg-maison-vide/12 text-maison-vide',
}

export function CategorieBadge({ categorie, court = false }: { categorie: Categorie; court?: boolean }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${CAT[categorie]}`}>
      {libelleCategorie(categorie, court)}
    </span>
  )
}

const TEMP = {
  chaud: { Icone: Flame, cls: 'text-chaud' },
  tiede: { Icone: Thermometer, cls: 'text-tiede' },
  froid: { Icone: Snowflake, cls: 'text-froid' },
} as const

export function TemperatureBadge({ temperature }: { temperature: Temperature }) {
  const { Icone, cls } = TEMP[temperature]
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${cls}`}>
      <Icone className="size-3.5" aria-hidden />
      {LIBELLE_TEMPERATURE[temperature]}
    </span>
  )
}
