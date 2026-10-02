import { useSyncExternalStore } from 'react'
import { apresEchec, depuisBase64Url, doitReverrouiller, nouvelleConfig, verifierCode, versBase64Url, type ConfigVerrou, type Tentatives } from '@/domain/verrou'

/**
 * Verrou de l'écran. La configuration est gardée dans le stockage simple du navigateur (lecture immédiate
 * au démarrage, avant même la base locale) et n'est jamais envoyée au serveur : chaque appareil a son code.
 */
const CLE_CONFIG = 'linkimmo.verrou'
const CLE_TENTATIVES = 'linkimmo.verrou.tentatives'

function lire<T>(cle: string): T | null {
  try {
    return JSON.parse(localStorage.getItem(cle) ?? 'null') as T | null
  } catch {
    return null
  }
}

function ecrire(cle: string, valeur: unknown) {
  try {
    if (valeur === null) localStorage.removeItem(cle)
    else localStorage.setItem(cle, JSON.stringify(valeur))
  } catch {
    /* stockage indisponible */
  }
}

export interface EtatVerrou {
  config: ConfigVerrou | null
  verrouille: boolean
}

let etat: EtatVerrou = (() => {
  const config = lire<ConfigVerrou>(CLE_CONFIG)
  return { config, verrouille: !!config }
})()
const abonnes = new Set<() => void>()
function publier(patch: Partial<EtatVerrou>) {
  etat = { ...etat, ...patch }
  for (const f of abonnes) f()
}

export function useVerrou(): EtatVerrou {
  return useSyncExternalStore(
    (f) => {
      abonnes.add(f)
      return () => abonnes.delete(f)
    },
    () => etat,
  )
}

export function tentatives(): Tentatives {
  return lire<Tentatives>(CLE_TENTATIVES) ?? { echecs: 0, bloqueJusque: 0 }
}

/** Renvoie true si le code est bon (et déverrouille). */
export async function essayerCode(code: string): Promise<boolean> {
  if (!etat.config || Date.now() < tentatives().bloqueJusque) return false
  if (await verifierCode(etat.config, code)) {
    ecrire(CLE_TENTATIVES, null)
    publier({ verrouille: false })
    return true
  }
  ecrire(CLE_TENTATIVES, apresEchec(tentatives(), Date.now()))
  return false
}

export async function activerVerrou(code: string, delaiMinutes: number): Promise<void> {
  const config = await nouvelleConfig(code, delaiMinutes)
  ecrire(CLE_CONFIG, config)
  publier({ config, verrouille: false })
}

export function changerDelai(delaiMinutes: number): void {
  if (!etat.config) return
  const config = { ...etat.config, delaiMinutes }
  ecrire(CLE_CONFIG, config)
  publier({ config })
}

export function desactiverVerrou(): void {
  ecrire(CLE_CONFIG, null)
  ecrire(CLE_TENTATIVES, null)
  publier({ config: null, verrouille: false })
}

export function verrouillerMaintenant(): void {
  if (etat.config) publier({ verrouille: true })
}

// ── Face ID / empreinte (WebAuthn, authentificateur du téléphone) ──
export async function biometrieDisponible(): Promise<boolean> {
  try {
    return !!window.PublicKeyCredential && (await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable())
  } catch {
    return false
  }
}

export async function activerBiometrie(): Promise<void> {
  if (!etat.config) return
  const cred = (await navigator.credentials.create({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      rp: { name: 'Prospect’Immo' },
      user: { id: crypto.getRandomValues(new Uint8Array(16)), name: 'prospectimmo', displayName: 'Prospect’Immo' },
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 },
        { type: 'public-key', alg: -257 },
      ],
      authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'discouraged' },
      timeout: 60_000,
    },
  })) as PublicKeyCredential | null
  if (!cred) throw new Error('Annulé')
  const config = { ...etat.config, biometrie: versBase64Url(cred.rawId) }
  ecrire(CLE_CONFIG, config)
  publier({ config })
}

export function retirerBiometrie(): void {
  if (!etat.config) return
  const { biometrie: _, ...config } = etat.config
  ecrire(CLE_CONFIG, config)
  publier({ config })
}

/** Demande Face ID / l'empreinte ; déverrouille si le téléphone confirme. */
export async function deverrouillerBiometrie(): Promise<boolean> {
  const id = etat.config?.biometrie
  if (!id) return false
  try {
    const r = await navigator.credentials.get({
      publicKey: { challenge: crypto.getRandomValues(new Uint8Array(32)), allowCredentials: [{ type: 'public-key', id: depuisBase64Url(id) }], userVerification: 'required', timeout: 60_000 },
    })
    if (!r) return false
    ecrire(CLE_TENTATIVES, null)
    publier({ verrouille: false })
    return true
  } catch {
    return false
  }
}

/** Reverrouille quand on revient dans l'application après le délai choisi. */
export function surveillerVerrou(): void {
  let quitteA: number | null = null
  document.addEventListener('visibilitychange', () => {
    if (!etat.config) return
    if (document.visibilityState === 'hidden') {
      quitteA = Date.now()
      // « Immédiatement » : on cache tout de suite (l'aperçu des applications ouvertes ne montre pas les fiches).
      if (etat.config.delaiMinutes === 0) publier({ verrouille: true })
    } else if (doitReverrouiller(quitteA, Date.now(), etat.config.delaiMinutes)) publier({ verrouille: true })
  })
}
