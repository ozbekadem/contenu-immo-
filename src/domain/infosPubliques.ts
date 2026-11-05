import { cleAdresse, normaliserRue, type AdresseComparable } from './adresse'

/**
 * « Infos publiques » d'un bien : ce que les services cartographiques de la Région wallonne disent
 * de l'endroit (cadastre, plan de secteur, risques, sous-sol, patrimoine, quartier statistique).
 * Données publiques, sans rien sur le propriétaire.
 */
export interface InfosPubliques {
  /** Date de la consultation (ISO). */
  consulteLe: string
  /** Adresse ou position qui a servi à la recherche : si elle change, les infos sont à refaire. */
  cle: string
  /** Comment le bien a été situé : par son adresse officielle, ou seulement par le point GPS. */
  localisation: 'adresse' | 'gps'
  /** Point interrogé (WGS84) : point officiel de l'adresse, ou point GPS. */
  lat: number
  lng: number
  /** Adresse telle qu'elle figure au registre wallon des adresses (ICAR). */
  adresseOfficielle: { rue: string; numero: string; boite: string; cp: string; localite: string } | null
  parcelle: Parcelle | null
  /** Emprise au sol du bâtiment au point de l'adresse (m²), d'après le plan cadastral. */
  batiment: number | null
  /** Zone du plan de secteur, ex. « Zone d'habitat ». */
  planSecteur: string | null
  /** Centralité du Schéma de développement du territoire, ex. « Centralité urbaine de pôle ». */
  centralite: string | null
  inondation: {
    /** Pire aléa sur la parcelle (ou au point), ex. « Aléa élevé (ruissellement) ». */
    auBien: string | null
    /** Pire aléa à moins de 50 m. */
    aProximite: string | null
    /** Carte officielle au 1/10 000 (PDF). */
    carte: string | null
  }
  /** Zones de consultation du sous-sol : puits de mine, karst, carrières… */
  sousSol: string[]
  /** Ancienne concession minière, ex. « Mambourg, Sacré-Madame et Poiriers réunis (houille) ». */
  concession: string | null
  /** Banque de données de l'état des sols (BDES) : null si la parcelle n'y est pas reprise. */
  sols: { statut: string; demarches: boolean; lien: string | null } | null
  /** Biens classés, zones de protection et inventaire du patrimoine sur la parcelle. */
  patrimoine: string[]
  /** Secteur statistique (quartier) de Statbel. */
  quartier: { code: string; nom: string } | null
  /** Rubriques que le service n'a pas pu fournir (panne passagère) : à réessayer. */
  manquants: string[]
}

export interface Parcelle {
  /** Identifiant cadastral unique, ex. « 52049C0112/00P000 ». */
  capakey: string
  /** Ex. « Charleroi, 7ᵉ division ». */
  division: string
  section: string
  /** Numéro de parcelle, ex. « 112P ». */
  numero: string
  /** Surface de la parcelle (m²), mesurée sur le plan cadastral. */
  surface: number | null
}

export type Niveau = 'ok' | 'attention' | 'alerte'

export interface Constat {
  niveau: Niveau
  texte: string
}

/** Clé de recherche d'un bien : son adresse complète, sinon sa position GPS (au mètre près). */
export function cleRecherche(adresse: AdresseComparable | null | undefined, lat: number | null, lng: number | null): string | null {
  const cle = cleAdresse(adresse)
  if (cle) return cle
  if (lat == null || lng == null) return null
  return `gps|${lat.toFixed(5)}|${lng.toFixed(5)}`
}

/** Les infos sont absentes, ou ont été cherchées pour une autre adresse ou position. */
export function infosAJour(infos: InfosPubliques | null | undefined, cle: string | null): boolean {
  return !!infos && !!cle && infos.cle === cle && infos.manquants.length === 0
}

/** Nom de rue du registre ICAR sans le suffixe de section : « Rue Paul Janson (MT) » → « Rue Paul Janson ». */
export function rueSansSection(nom: string): string {
  return nom.replace(/\s*\([^)]*\)\s*$/, '').trim()
}

/** Même rue, malgré les abréviations, les accents et le suffixe de section du registre. */
export function memeRue(officielle: string, saisie: string): boolean {
  const a = normaliserRue(rueSansSection(officielle))
  const b = normaliserRue(saisie)
  return !!a && !!b && (a === b || a.endsWith(` ${b}`) || b.endsWith(` ${a}`))
}

/** Numéro tel que le registre l'écrit : « 22 a » → « 22A ». */
export function numeroOfficiel(numero: string): string {
  return numero.replace(/\s+/g, '').toUpperCase()
}

/** « CHARLEROI 7 DIV/MONTIGNIES-SUR-SAMB » → « Charleroi, 7ᵉ division ». */
export function nomDivision(divNom: string, commune: string): string {
  const m = /^(.+?)\s+(\d+)\s*DIV\b/i.exec(divNom)
  const nom = titre(m ? m[1]! : commune || divNom)
  return m ? `${nom}, ${m[2]}${m[2] === '1' ? 'ʳᵉ' : 'ᵉ'} division` : nom
}

/** Numéro de parcelle : radical, bis, exposant et puissance (« 0112 », « 00 », « P », « 000 » → « 112P »). */
export function numeroParcelle(radical: string, bis: string, exposant: string, puissance: string): string {
  const r = String(Number.parseInt(radical, 10) || radical)
  const b = Number.parseInt(bis, 10)
  const e = /^[A-Z]$/i.test(exposant ?? '') ? exposant.toUpperCase() : ''
  const p = Number.parseInt(puissance, 10)
  return `${r}${b > 0 ? `/${b}` : ''}${e}${p > 0 ? p : ''}`
}

/** Surface (m²) d'un polygone en coordonnées métriques (anneaux ArcGIS : trous dans l'autre sens). */
export function surfacePolygone(anneaux: number[][][]): number {
  let total = 0
  for (const r of anneaux) {
    let s = 0
    for (let i = 0; i + 1 < r.length; i++) s += r[i]![0]! * r[i + 1]![1]! - r[i + 1]![0]! * r[i]![1]!
    total += s / 2
  }
  return Math.round(Math.abs(total))
}

const RANG_ALEA: Record<number, number> = { 10: 1, 20: 2, 30: 3 }

/** Le pire aléa d'une liste, ex. « Aléa élevé (ruissellement) » ; null si aucun. */
export function pireAlea(zones: { CODEALEA?: unknown; VALEUR?: unknown; TYPEALEA?: unknown }[]): string | null {
  let pire: (typeof zones)[number] | null = null
  for (const z of zones) if (!pire || (RANG_ALEA[Number(z.CODEALEA)] ?? 0) > (RANG_ALEA[Number(pire.CODEALEA)] ?? 0)) pire = z
  if (!pire) return null
  const type = String(pire.TYPEALEA ?? '').toLowerCase()
  return `${String(pire.VALEUR ?? 'Aléa')}${type ? ` (${type})` : ''}`
}

/** Points à signaler au vendeur ou à l'acheteur, du plus grave au moins grave. */
export function constats(i: InfosPubliques): Constat[] {
  const c: Constat[] = []
  if (i.inondation.auBien) c.push({ niveau: /élevé/i.test(i.inondation.auBien) ? 'alerte' : 'attention', texte: `Inondation : ${minuscule(i.inondation.auBien)} sur le bien` })
  else if (i.inondation.aProximite) c.push({ niveau: 'attention', texte: `Inondation : ${minuscule(i.inondation.aProximite)} à moins de 50 m` })
  for (const s of i.sousSol) c.push({ niveau: 'attention', texte: `Sous-sol : ${minuscule(s)}` })
  if (i.sols) c.push({ niveau: i.sols.demarches ? 'alerte' : 'attention', texte: i.sols.demarches ? 'Sol : démarches de gestion des sols réalisées ou à prévoir' : 'Sol : repris à titre indicatif à l’inventaire des sols' })
  if (i.patrimoine.length) c.push({ niveau: 'attention', texte: `Patrimoine : ${i.patrimoine[0]}${i.patrimoine.length > 1 ? ` (+${i.patrimoine.length - 1})` : ''}` })
  if (i.planSecteur && !/habitat/i.test(i.planSecteur)) c.push({ niveau: 'attention', texte: `Plan de secteur : ${minuscule(i.planSecteur)}` })
  const ordre: Record<Niveau, number> = { alerte: 0, attention: 1, ok: 2 }
  return c.sort((a, b) => ordre[a.niveau] - ordre[b.niveau])
}

/** « zone d'habitat » → « Zone d'habitat ». */
export function majuscule(t: string): string {
  return t ? t[0]!.toUpperCase() + t.slice(1) : t
}

function minuscule(t: string): string {
  return t ? t[0]!.toLowerCase() + t.slice(1) : t
}

/** « MONTIGNIES-SUR-SAMBRE-CENTRE » → « Montignies-sur-Sambre-Centre ». */
export function titre(t: string): string {
  const petits = new Set(['sur', 'sous', 'lez', 'lès', 'les', 'le', 'la', 'de', 'du', 'des', 'aux', 'au', 'en', 'et', 'l', 'd'])
  return t
    .toLowerCase()
    .split(/([\s-]+)/)
    .map((m, i) => (i > 0 && petits.has(m) ? m : m.replace(/^(\p{L})/u, (x) => x.toUpperCase())))
    .join('')
    .replace(/\b([ld])'(\p{L})/gu, (_, a: string, b: string) => `${a}’${b.toUpperCase()}`)
}
