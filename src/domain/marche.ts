import type { TypeBien } from '@/data/types'
import { normaliserTexte } from './recherche'

/** Types de biens publiés par Statbel. */
export type TypeMarche = 'm23' | 'm4' | 'maisons' | 'apparts'

export const TYPES_MARCHE: { code: TypeMarche; libelle: string; court: string }[] = [
  { code: 'm23', libelle: 'Maisons 2-3 façades', court: '2-3 façades' },
  { code: 'm4', libelle: 'Maisons 4 façades', court: '4 façades' },
  { code: 'maisons', libelle: 'Toutes les maisons', court: 'Maisons' },
  { code: 'apparts', libelle: 'Appartements', court: 'Appartements' },
]

/** [année, période (Y, S1, S2, Q1…Q4), nombre de ventes, P25, médiane, P75] — prix absents sous le seuil de publication. */
export type LigneMarche = [number, string, number | null, number | null, number | null, number | null]

export interface DonneesMarche {
  source: string
  /** Dernier trimestre publié, ex. « 2026 T2 ». */
  derniere: string
  baseIndice: number
  /** Indice des prix à la consommation, moyenne annuelle. */
  indice: Record<string, number>
  zones: Record<string, { nom: string; niveau: number }>
  series: Record<string, Partial<Record<TypeMarche, LigneMarche[]>>>
}

export interface PointMarche {
  annee: number
  periode: string
  /** Nombre de ventes (parfois non communiqué). */
  ventes: number | null
  p25: number | null
  mediane: number | null
  p75: number | null
}

const point = ([annee, periode, ventes, p25, mediane, p75]: LigneMarche): PointMarche => ({ annee, periode, ventes, p25, mediane, p75 })

/** Codes Statbel des zones de référence. */
export const BELGIQUE = '01000'
export const WALLONIE = '03000'

const PETITS_MOTS = new Set(['lez', 'sur', 'le', 'la', 'les', 'de', 'du', 'des', 'au', 'aux', 'en', 'et', 'sous', 'lès'])
const ACCENTS: Record<string, string> = {
  CHATELET: 'Châtelet',
  "FONTAINE-L'EVEQUE": 'Fontaine-l’Évêque',
  'PONT-A-CELLES': 'Pont-à-Celles',
  'MERBES-LE-CHATEAU': 'Merbes-le-Château',
  'LA LOUVIERE': 'La Louvière',
  ECAUSSINNES: 'Écaussinnes',
  'BRAINE-LE-COMTE': 'Braine-le-Comte',
  'REGION WALLONNE': 'Wallonie',
  BELGIQUE: 'Belgique',
  'SAINT-GHISLAIN': 'Saint-Ghislain',
  'HONNELLES': 'Honnelles',
  'QUEVY': 'Quévy',
  'FRAMERIES': 'Frameries',
  'EGHEZEE': 'Éghezée',
  'FERNELMONT': 'Fernelmont',
  'GESVES': 'Gesves',
  'VIROINVAL': 'Viroinval',
  'CERFONTAINE': 'Cerfontaine',
}

/** « CHAPELLE-LEZ-HERLAIMONT » → « Chapelle-lez-Herlaimont », « ARRONDISSEMENT DE THUIN » → « Arrondissement de Thuin ». */
export function nomLisible(nom: string): string {
  if (ACCENTS[nom]) return ACCENTS[nom]!
  return nom
    .toLowerCase()
    .split(/([ -])/)
    .map((m, i) => (i > 0 && PETITS_MOTS.has(m) ? m : m.replace(/^(l'|d')?(\p{L})/u, (_, ap: string | undefined, l: string) => (ap ? ap : '') + l.toUpperCase())))
    .join('')
    .replace(/^(.)/, (l) => l.toUpperCase())
}

export function serie(d: DonneesMarche, zone: string, type: TypeMarche): PointMarche[] {
  return (d.series[zone]?.[type] ?? []).map(point)
}

/** Chiffres annuels publiés (avec médiane), du plus ancien au plus récent. */
export function annuels(s: PointMarche[]): PointMarche[] {
  return s.filter((p) => p.periode === 'Y' && p.mediane !== null)
}

/** Dernière année complète publiée. */
export function dernierAnnuel(s: PointMarche[]): PointMarche | null {
  return annuels(s).at(-1) ?? null
}

const ORDRE_TRIMESTRE = ['Q1', 'Q2', 'Q3', 'Q4']

/** Derniers trimestres publiés (même sans prix, le nombre de ventes est connu). */
export function trimestres(s: PointMarche[]): PointMarche[] {
  return s.filter((p) => ORDRE_TRIMESTRE.includes(p.periode)).sort((a, b) => a.annee - b.annee || ORDRE_TRIMESTRE.indexOf(a.periode) - ORDRE_TRIMESTRE.indexOf(b.periode))
}

/** Évolution de la médiane sur N ans (en %), à partir des chiffres annuels. */
export function evolution(s: PointMarche[], ans: number): number | null {
  const a = annuels(s)
  const fin = a.at(-1)
  const debut = fin && a.find((p) => p.annee === fin.annee - ans)
  if (!fin || !debut) return null
  return Math.round(((fin.mediane! - debut.mediane!) / debut.mediane!) * 1000) / 10
}

/** Prix d'une année exprimé en euros d'une autre année (corrigé de l'inflation). */
export function corrigerInflation(prix: number, annee: number, versAnnee: number, indice: Record<string, number>): number | null {
  const de = indice[String(annee)]
  const vers = indice[String(versAnnee)]
  return de && vers ? Math.round((prix * vers) / de) : null
}

/** Codes postaux de la zone → commune (nom Statbel). Les sections (Marcinelle, Jumet…) renvoient à leur commune. */
const CP_COMMUNE: [RegExp, string][] = [
  [/^60[0-6]\d$/, 'CHARLEROI'],
  [/^611[01]$/, 'MONTIGNY-LE-TILLEUL'],
  [/^6120$/, 'HAM-SUR-HEURE-NALINNES'],
  [/^614[0-2]$/, "FONTAINE-L'EVEQUE"],
  [/^6150$/, 'ANDERLUES'],
  [/^618[0-3]$/, 'COURCELLES'],
  [/^6200$/, 'CHATELET'],
  [/^621[01]$/, 'LES BONS VILLERS'],
  [/^622[0-4]$/, 'FLEURUS'],
  [/^623[08]$/, 'PONT-A-CELLES'],
  [/^6240$/, 'FARCIENNES'],
  [/^6250$/, 'AISEAU-PRESLES'],
  [/^6280$/, 'GERPINNES'],
  [/^6500$/, 'BEAUMONT'],
  [/^6530$/, 'THUIN'],
  [/^6540$/, 'LOBBES'],
  [/^7160$/, 'CHAPELLE-LEZ-HERLAIMONT'],
  [/^717\d$/, 'MANAGE'],
  [/^718\d$/, 'SENEFFE'],
  [/^7100$/, 'LA LOUVIERE'],
  [/^7000$/, 'MONS'],
  [/^5000$/, 'NAMUR'],
  [/^5060$/, 'SAMBREVILLE'],
  [/^5070$/, 'FOSSES-LA-VILLE'],
]

/** Commune Statbel d'une adresse : par le code postal, sinon par le nom de la localité. */
export function communePour(d: DonneesMarche, adresse: { cp?: string; ville?: string } | null | undefined): string | null {
  if (!adresse) return null
  const communes = Object.entries(d.zones).filter(([, z]) => z.niveau === 5)
  const parNom = (nom: string) => communes.find(([, z]) => normaliserTexte(z.nom) === normaliserTexte(nom))?.[0] ?? null
  const cp = adresse.cp?.trim() ?? ''
  const viaCp = CP_COMMUNE.find(([motif]) => motif.test(cp))?.[1]
  return (viaCp && parNom(viaCp)) || (adresse.ville ? parNom(adresse.ville) : null)
}

/** Arrondissement d'une commune (« 52011 » → « 52000 »). */
export function arrondissement(commune: string): string {
  return `${commune.slice(0, 2)}000`
}

/** Type Statbel correspondant à un bien (null : pas de comparaison possible, ex. terrain). */
export function typePourBien(type: TypeBien | null, facades: number | null): TypeMarche | null {
  if (type === 'appartement') return 'apparts'
  if (type === 'maison' || type === null) return facades === 4 ? 'm4' : facades === 2 || facades === 3 ? 'm23' : 'maisons'
  return null
}

export interface PositionPrix {
  /** Écart avec la médiane, en %. */
  ecart: number
  tranche: 'bas' | 'milieu' | 'haut'
}

/** Où se situe un prix demandé par rapport aux ventes réelles : sous le quart le moins cher, au milieu, ou dans le quart le plus cher. */
export function positionPrix(prix: number, p: PointMarche): PositionPrix | null {
  if (!p.mediane) return null
  const ecart = Math.round(((prix - p.mediane) / p.mediane) * 100)
  const tranche = p.p25 !== null && prix < p.p25 ? 'bas' : p.p75 !== null && prix > p.p75 ? 'haut' : 'milieu'
  return { ecart, tranche }
}
