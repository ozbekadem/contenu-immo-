import { ChevronRight, LineChart } from 'lucide-react'
import { Link } from 'react-router'
import { Card } from '@/components/ui/Card'
import type { Bien } from '@/data/types'
import { communePour, dernierAnnuel, nomLisible, positionPrix, serie, TYPES_MARCHE, typePourBien } from '@/domain/marche'
import { euros, kEuros, useMarche } from './donnees'

const TRANCHE = {
  bas: 'dans le quart le moins cher des ventes',
  milieu: 'dans la moitié centrale des ventes',
  haut: 'dans le quart le plus cher des ventes',
}

/**
 * « Prix du marché » sur une annonce ou un bien : le prix médian réel de la commune (Statbel)
 * et, si un prix est demandé, où il se situe. Un argument concret pour l'appel.
 */
export function PrixMarche({ bien, prix }: { bien: Bien; prix?: number | null }) {
  const d = useMarche()
  if (!d) return null
  const commune = communePour(d, bien.adresse)
  const type = typePourBien(bien.type, bien.facades)
  if (!commune || !type) return null
  // Pas assez de ventes pour ce type précis : on se rabat sur « toutes les maisons »
  let t = type
  let p = dernierAnnuel(serie(d, commune, t))
  if (!p && t !== 'apparts') {
    t = 'maisons'
    p = dernierAnnuel(serie(d, commune, t))
  }
  if (!p?.mediane) return null
  const position = prix ? positionPrix(prix, p) : null
  const libelle = TYPES_MARCHE.find((x) => x.code === t)!.libelle.toLowerCase()
  return (
    <Card>
      <Link to={`/marche?commune=${commune}&type=${t}`} className="flex items-center gap-2 active:opacity-70">
        <LineChart className="size-5 text-primaire-texte" aria-hidden />
        <h2 className="flex-1 text-base font-bold">Prix du marché</h2>
        <ChevronRight className="size-5 text-doux" aria-hidden />
      </Link>
      <p className="mt-2 text-sm">
        À <strong>{nomLisible(d.zones[commune]!.nom)}</strong>, {libelle} vendues en {p.annee} : médiane <strong>{euros(p.mediane)}</strong>
        {p.p25 && p.p75 ? ` (la moitié entre ${kEuros(p.p25)} et ${kEuros(p.p75)})` : ''}.
      </p>
      {position && prix && (
        <p
          className={`mt-2 rounded-2xl p-3 text-sm font-semibold ${position.tranche === 'haut' ? 'bg-suivi-orange/12 text-texte' : position.tranche === 'bas' ? 'bg-suivi-vert/12 text-texte' : 'bg-surface-2'}`}
        >
          Prix demandé {euros(prix)} : {position.ecart > 0 ? '+' : ''}
          {position.ecart} % par rapport à la médiane, {TRANCHE[position.tranche]}.
        </p>
      )}
      <p className="mt-2 text-xs text-doux">Ventes réelles de toute la commune (Statbel). Le prix dépend aussi de l’état, de la surface et de la rue.</p>
    </Card>
  )
}
