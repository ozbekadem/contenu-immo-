import { useEffect, useState } from 'react'
import type { DonneesMarche } from '@/domain/marche'

let chargement: Promise<DonneesMarche> | null = null

/** Données Statbel (chargées seulement quand on en a besoin : elles ne ralentissent pas l'ouverture). */
export function chargerMarche(): Promise<DonneesMarche> {
  chargement ??= import('@/data/marche/statbel.json').then((m) => m.default as unknown as DonneesMarche)
  return chargement
}

export function useMarche(): DonneesMarche | null {
  const [d, setD] = useState<DonneesMarche | null>(null)
  useEffect(() => {
    let actif = true
    void chargerMarche().then((x) => actif && setD(x))
    return () => {
      actif = false
    }
  }, [])
  return d
}

export const euros = (n: number | null | undefined) => (n == null ? '–' : `${new Intl.NumberFormat('fr-BE', { maximumFractionDigits: 0 }).format(n)} €`)
export const kEuros = (n: number) => `${Math.round(n / 1000)} k€`
