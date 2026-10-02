/**
 * Verrouillage de l'application (facultatif) : un code à 4–6 chiffres, et Face ID / empreinte si le téléphone le permet.
 * C'est un verrou d'écran (comme celui d'une application bancaire) : il empêche quelqu'un qui prend le téléphone
 * déverrouillé d'ouvrir les fiches. Il ne chiffre pas les données.
 */

export interface ConfigVerrou {
  /** Empreinte du code (PBKDF2-SHA-256), jamais le code lui-même. */
  empreinte: string
  sel: string
  /** Nombre de chiffres : le code est vérifié dès le dernier chiffre tapé. */
  longueur: number
  /** Délai d'absence avant de reverrouiller : 0 = dès que l'on quitte l'application. */
  delaiMinutes: number
  /** Identifiant de la clé Face ID / empreinte enregistrée sur cet appareil (base64url). */
  biometrie?: string
}

export interface Tentatives {
  echecs: number
  /** Horodatage (ms) jusqu'auquel la saisie est bloquée. */
  bloqueJusque: number
}

export const DELAIS_VERROU = [
  { minutes: 0, libelle: 'Immédiatement' },
  { minutes: 1, libelle: 'Après 1 minute' },
  { minutes: 5, libelle: 'Après 5 minutes' },
  { minutes: 15, libelle: 'Après 15 minutes' },
] as const

export const ESSAIS_LIBRES = 5

export function codeValide(code: string): boolean {
  return /^\d{4,6}$/.test(code)
}

/** Code trop facile à deviner (1111, 1234, 4321…). */
export function codeTropSimple(code: string): boolean {
  if (/^(\d)\1+$/.test(code)) return true
  const ch = [...code].map(Number)
  const pas = ch.slice(1).map((c, i) => c - ch[i]!)
  return pas.every((p) => p === 1) || pas.every((p) => p === -1)
}

export function versBase64Url(octets: ArrayBuffer | Uint8Array): string {
  const t = octets instanceof Uint8Array ? octets : new Uint8Array(octets)
  let s = ''
  for (const o of t) s += String.fromCharCode(o)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function depuisBase64Url(texte: string): Uint8Array<ArrayBuffer> {
  const b64 = (texte + '='.repeat((4 - (texte.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  const brut = atob(b64)
  const octets = new Uint8Array(new ArrayBuffer(brut.length))
  for (let i = 0; i < brut.length; i++) octets[i] = brut.charCodeAt(i)
  return octets
}

export async function hacherCode(code: string, sel: string): Promise<string> {
  const cle = await crypto.subtle.importKey('raw', new TextEncoder().encode(code), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: depuisBase64Url(sel), iterations: 150_000 }, cle, 256)
  return versBase64Url(bits)
}

export async function nouvelleConfig(code: string, delaiMinutes: number): Promise<ConfigVerrou> {
  const sel = versBase64Url(crypto.getRandomValues(new Uint8Array(16)))
  return { empreinte: await hacherCode(code, sel), sel, longueur: code.length, delaiMinutes }
}

export async function verifierCode(config: ConfigVerrou, code: string): Promise<boolean> {
  return (await hacherCode(code, config.sel)) === config.empreinte
}

/** Après 5 erreurs : 30 s d'attente, puis le double à chaque nouvelle erreur (15 minutes au plus). */
export function apresEchec(t: Tentatives, maintenant: number): Tentatives {
  const echecs = t.echecs + 1
  if (echecs < ESSAIS_LIBRES) return { echecs, bloqueJusque: 0 }
  const attente = Math.min(30_000 * 2 ** (echecs - ESSAIS_LIBRES), 15 * 60_000)
  return { echecs, bloqueJusque: maintenant + attente }
}

/** Faut-il reverrouiller en revenant dans l'application ? */
export function doitReverrouiller(quitteA: number | null, maintenant: number, delaiMinutes: number): boolean {
  if (quitteA === null) return false
  return maintenant - quitteA >= delaiMinutes * 60_000
}
