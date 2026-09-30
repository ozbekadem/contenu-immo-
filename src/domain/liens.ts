/** Ajoute « https:// » si besoin et vérifie que l'adresse est une URL web valide. */
export function normaliserUrl(saisie: string): string | null {
  let brut = saisie.trim()
  if (!brut) return null
  // Un lien partagé depuis une application arrive souvent avec du texte autour : on garde l'URL.
  const trouve = brut.match(/https?:\/\/\S+/i)
  if (trouve) brut = trouve[0]
  if (!/^https?:\/\//i.test(brut)) brut = `https://${brut}`
  try {
    const url = new URL(brut)
    if (!url.hostname.includes('.')) return null
    return url.toString()
  } catch {
    return null
  }
}

export interface SourceLien {
  code: string
  libelle: string
}

const SITES: [RegExp, SourceLien][] = [
  [/(^|\.)immoweb\.be$/, { code: 'immoweb', libelle: 'Immoweb' }],
  [/(^|\.)2ememain\.be$/, { code: '2ememain', libelle: '2ememain' }],
  [/(^|\.)zimmo\.be$/, { code: 'zimmo', libelle: 'Zimmo' }],
  [/(^|\.)immovlan\.be$/, { code: 'immovlan', libelle: 'Immovlan' }],
  [/(^|\.)logic-immo\.be$/, { code: 'logic-immo', libelle: 'Logic-Immo' }],
  [/(^|\.)realo\.be$/, { code: 'realo', libelle: 'Realo' }],
  [/(^|\.)(facebook\.com|fb\.com|fb\.me)$/, { code: 'facebook', libelle: 'Facebook' }],
  [/(^|\.)notaire\.be$|(^|\.)biddit\.be$/, { code: 'notaire', libelle: 'Notaire / Biddit' }],
  [/(^|\.)google\.[a-z.]+$|(^|\.)goo\.gl$/, { code: 'google', libelle: 'Google' }],
]

/** Reconnaît le site d'une annonce ; sinon renvoie le nom de domaine (ex. « agence-dupont.be »). */
export function detecterSource(url: string): SourceLien {
  let hote: string
  try {
    hote = new URL(url).hostname.toLowerCase().replace(/^www\./, '')
  } catch {
    return { code: 'autre', libelle: 'Lien' }
  }
  for (const [motif, source] of SITES) if (motif.test(hote)) return source
  return { code: 'autre', libelle: hote }
}

export type TypeFichier = 'pdf' | 'word' | 'tableur' | 'image' | 'autre'

export function typeFichier(nom: string, mime = ''): TypeFichier {
  const ext = nom.toLowerCase().split('.').pop() ?? ''
  if (mime === 'application/pdf' || ext === 'pdf') return 'pdf'
  if (/^(docx?|odt|rtf)$/.test(ext) || mime.includes('word')) return 'word'
  if (/^(xlsx?|ods|csv)$/.test(ext) || mime.includes('sheet') || mime.includes('excel')) return 'tableur'
  if (mime.startsWith('image/') || /^(jpe?g|png|webp|heic|gif)$/.test(ext)) return 'image'
  return 'autre'
}

/** Formats acceptés par le bouton « Ajouter un document ». */
export const FORMATS_ACCEPTES = '.pdf,.doc,.docx,.odt,.rtf,.txt,.xls,.xlsx,.ods,.csv,image/*,application/pdf'

export const TAILLE_MAX_OCTETS = 25 * 1024 * 1024

export function tailleLisible(octets: number): string {
  if (octets < 1024) return `${octets} o`
  if (octets < 1024 * 1024) return `${Math.round(octets / 1024)} Ko`
  return `${(octets / 1024 / 1024).toFixed(1).replace('.', ',')} Mo`
}

/** Titre par défaut : nom du fichier sans extension. */
export function titreDepuisNomFichier(nom: string): string {
  return nom.replace(/\.[^.]+$/, '').replace(/[_]+/g, ' ').replace(/\s+-\s+/g, ' – ').replace(/-/g, ' ').replace(/\s+/g, ' ').trim() || nom
}
