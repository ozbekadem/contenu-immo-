import { ecartJours } from './dates'
import type { Couleur, Temperature } from './relance'

export interface ProspectAClasser {
  couleur: Couleur
  prochaineRelanceAt: string | null
  dernierContactAt: string | null
  createdAt: string
  temperature: Temperature | null
  dernierResultatPositif: boolean
  tentatives?: number
}

export interface Priorite {
  score: number
  raisons: string[]
}

/**
 * « Qui appeler en premier » : score de priorité d'un prospect à appeler aujourd'hui,
 * avec les raisons lisibles. Seuls les prospects dus (orange) ou en retard (rouge) sont classés.
 */
export function priorite(p: ProspectAClasser, maintenant: Date): Priorite | null {
  if (p.couleur !== 'orange' && p.couleur !== 'rouge') return null
  let score = 0
  const raisons: string[] = []

  if (p.dernierResultatPositif) {
    score += 40
    raisons.push('dernier échange positif')
  }
  if (p.temperature === 'chaud') {
    score += 30
    raisons.push('prospect chaud')
  } else if (p.temperature === 'tiede') score += 10

  if (!p.dernierContactAt) {
    const age = ecartJours(new Date(p.createdAt), maintenant)
    if (age <= 14) {
      score += 25
      raisons.push(age === 0 ? 'repéré aujourd’hui : appeler vite' : `repéré il y a ${age} j, jamais appelé`)
    } else {
      score += 10
      raisons.push('jamais appelé')
    }
  }

  if (p.prochaineRelanceAt) {
    const retard = -ecartJours(maintenant, new Date(p.prochaineRelanceAt))
    if (retard > 0) {
      score += Math.min(retard, 30)
      raisons.push(`relance en retard de ${retard} j`)
    } else raisons.push('relance prévue aujourd’hui')
  } else if (p.couleur === 'rouge' && p.dernierContactAt) {
    const oubli = ecartJours(new Date(p.dernierContactAt), maintenant)
    score += Math.min(Math.round(oubli / 10), 20)
    raisons.push(`sans nouvelles depuis ${oubli} j`)
  }

  const tentatives = p.tentatives ?? 0
  if (tentatives > 0) {
    score -= tentatives * 5
    raisons.push(tentatives === 1 ? '1 appel sans réponse' : `${tentatives} appels sans réponse`)
  }
  return { score, raisons }
}

/** Les N prospects à appeler en premier, du plus prioritaire au moins prioritaire. */
export function classer<T extends ProspectAClasser>(liste: T[], maintenant: Date, n = 10): { element: T; priorite: Priorite }[] {
  return liste
    .map((element) => ({ element, priorite: priorite(element, maintenant) }))
    .filter((x): x is { element: T; priorite: Priorite } => x.priorite !== null)
    .sort((a, b) => b.priorite.score - a.priorite.score)
    .slice(0, n)
}
