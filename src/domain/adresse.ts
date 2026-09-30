import { normaliserTexte } from './recherche'

/** Abréviations courantes des voies en Belgique francophone. */
const ABREVIATIONS: [RegExp, string][] = [
  [/\bav\b\.?/g, 'avenue'],
  [/\bbd\b\.?|\bboul\b\.?/g, 'boulevard'],
  [/\bch(ee|ss)?\b\.?|\bchaus\b\.?/g, 'chaussee'],
  [/\br\b\.?/g, 'rue'],
  [/\bpl\b\.?/g, 'place'],
  [/\bsq\b\.?/g, 'square'],
  [/\bimp\b\.?/g, 'impasse'],
  [/\bst\b\.?/g, 'saint'],
  [/\bste\b\.?/g, 'sainte'],
  [/\bdr\b\.?/g, 'docteur'],
]

/** « Av. Paul-Pastur » → « avenue paul pastur ». */
export function normaliserRue(rue: string): string {
  let s = normaliserTexte(rue.replace(/[-'’]/g, ' '))
  for (const [motif, rempl] of ABREVIATIONS) s = s.replace(motif, rempl)
  // Articles et petits mots ignorés : « rue de la station » = « rue station »
  return s
    .split(' ')
    .filter((m) => m && !['de', 'du', 'des', 'la', 'le', 'les', 'l', 'd'].includes(m))
    .join(' ')
}

export interface AdresseComparable {
  rue: string
  numero: string
  boite?: string
  cp: string
  ville: string
}

/**
 * Clé d'adresse : rue normalisée + numéro + boîte + (code postal ou localité).
 * Retourne null si l'adresse est trop incomplète pour comparer (rue ou numéro manquant).
 */
export function cleAdresse(a: AdresseComparable | null | undefined): string | null {
  if (!a) return null
  const rue = normaliserRue(a.rue)
  const numero = a.numero.toLowerCase().replace(/\s+/g, '')
  if (!rue || !numero) return null
  const lieu = a.cp.trim() || normaliserTexte(a.ville)
  if (!lieu) return null
  const boite = (a.boite ?? '').toLowerCase().replace(/^(bte|boite|bus)\s*/, '').trim()
  return [rue, numero, boite, lieu].join('|')
}

/** Même rue, même numéro et même localité — la boîte peut différer (même immeuble). */
export function memeImmeuble(a: string | null, b: string | null): boolean {
  if (!a || !b) return false
  const [ra, na, , la] = a.split('|')
  const [rb, nb, , lb] = b.split('|')
  return ra === rb && na === nb && la === lb
}

/**
 * Codes postaux de Charleroi et des communes voisines (zone de prospection),
 * plus les grandes villes. La liste belge complète arrivera avec le géocodage (étape 5).
 */
export const CODES_POSTAUX: [string, string][] = [
  ['6000', 'Charleroi'],
  ['6001', 'Marcinelle'],
  ['6010', 'Couillet'],
  ['6020', 'Dampremy'],
  ['6030', 'Marchienne-au-Pont'],
  ['6030', 'Goutroux'],
  ['6031', 'Monceau-sur-Sambre'],
  ['6032', 'Mont-sur-Marchienne'],
  ['6040', 'Jumet'],
  ['6041', 'Gosselies'],
  ['6042', 'Lodelinsart'],
  ['6043', 'Ransart'],
  ['6044', 'Roux'],
  ['6060', 'Gilly'],
  ['6061', 'Montignies-sur-Sambre'],
  ['6110', 'Montigny-le-Tilleul'],
  ['6111', 'Landelies'],
  ['6120', 'Ham-sur-Heure'],
  ['6120', 'Cour-sur-Heure'],
  ['6120', 'Jamioulx'],
  ['6120', 'Marbaix'],
  ['6120', 'Nalinnes'],
  ['6140', 'Fontaine-l’Évêque'],
  ['6141', 'Forchies-la-Marche'],
  ['6142', 'Leernes'],
  ['6150', 'Anderlues'],
  ['6180', 'Courcelles'],
  ['6181', 'Gouy-lez-Piéton'],
  ['6182', 'Souvret'],
  ['6183', 'Trazegnies'],
  ['6200', 'Châtelet'],
  ['6200', 'Châtelineau'],
  ['6200', 'Bouffioulx'],
  ['6210', 'Frasnes-lez-Gosselies'],
  ['6210', 'Rèves'],
  ['6210', 'Villers-Perwin'],
  ['6210', 'Wayaux'],
  ['6211', 'Mellet'],
  ['6220', 'Fleurus'],
  ['6220', 'Heppignies'],
  ['6220', 'Lambusart'],
  ['6220', 'Wangenies'],
  ['6221', 'Saint-Amand'],
  ['6222', 'Brye'],
  ['6223', 'Wagnelée'],
  ['6224', 'Wanfercée-Baulet'],
  ['6230', 'Pont-à-Celles'],
  ['6230', 'Buzet'],
  ['6230', 'Obaix'],
  ['6230', 'Thiméon'],
  ['6230', 'Viesville'],
  ['6238', 'Luttre'],
  ['6238', 'Liberchies'],
  ['6240', 'Farciennes'],
  ['6240', 'Pironchamps'],
  ['6250', 'Aiseau'],
  ['6250', 'Pont-de-Loup'],
  ['6250', 'Presles'],
  ['6250', 'Roselies'],
  ['6280', 'Gerpinnes'],
  ['6280', 'Acoz'],
  ['6280', 'Gougnies'],
  ['6280', 'Joncret'],
  ['6280', 'Loverval'],
  ['6280', 'Villers-Poterie'],
  ['6500', 'Beaumont'],
  ['6530', 'Thuin'],
  ['6540', 'Lobbes'],
  ['5060', 'Sambreville'],
  ['5070', 'Fosses-la-Ville'],
  ['1000', 'Bruxelles'],
  ['1400', 'Nivelles'],
  ['4000', 'Liège'],
  ['5000', 'Namur'],
  ['7000', 'Mons'],
  ['7100', 'La Louvière'],
]

export function localitesPourCp(cp: string): string[] {
  const c = cp.trim()
  return CODES_POSTAUX.filter(([code]) => code === c).map(([, ville]) => ville)
}

export function cpPourLocalite(ville: string): string | null {
  const v = normaliserTexte(ville)
  if (!v) return null
  return CODES_POSTAUX.find(([, nom]) => normaliserTexte(nom) === v)?.[0] ?? null
}
