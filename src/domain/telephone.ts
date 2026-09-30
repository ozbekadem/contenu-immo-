import { parsePhoneNumberFromString } from 'libphonenumber-js/min'

/**
 * Normalise un numéro au format international E.164 (+32…), en supposant la Belgique
 * lorsque l'indicatif est absent. Retourne null si le numéro est invalide.
 * Exemples acceptés : « 0476 12 34 56 », « 0032476123456 », « +32 (0)476/12.34.56 ».
 */
export function normaliserTelephone(saisie: string | null | undefined): string | null {
  if (!saisie) return null
  let brut = saisie.trim().replace(/\(0\)/g, '').replace(/[^\d+]/g, '')
  if (brut.startsWith('00')) brut = '+' + brut.slice(2)
  if (!brut) return null
  const num = parsePhoneNumberFromString(brut, 'BE')
  return num && num.isValid() ? num.number : null
}

/** Affichage lisible : « +32 476 12 34 56 » (ou la saisie brute si invalide). */
export function formaterTelephone(saisie: string | null | undefined): string {
  if (!saisie) return ''
  const e164 = normaliserTelephone(saisie)
  if (!e164) return saisie.trim()
  return parsePhoneNumberFromString(e164)!.formatInternational()
}

export function estMobile(saisie: string | null | undefined): boolean {
  const e164 = normaliserTelephone(saisie)
  if (!e164) return false
  const type = parsePhoneNumberFromString(e164)?.getType()
  // Les métadonnées « min » ne donnent pas toujours le type : on se rabat sur les préfixes belges 4xx.
  if (type) return type === 'MOBILE'
  return /^\+324\d{8}$/.test(e164)
}

export type Canal = 'appel' | 'sms' | 'whatsapp' | 'email'

export function lienAppel(e164: string): string {
  return `tel:${e164}`
}

export function lienSms(e164: string, texte?: string): string {
  return texte ? `sms:${e164}?&body=${encodeURIComponent(texte)}` : `sms:${e164}`
}

/** Ouvre directement la conversation WhatsApp (wa.me attend le numéro sans « + »). */
export function lienWhatsapp(e164: string, texte?: string): string {
  const base = `https://wa.me/${e164.replace(/^\+/, '')}`
  return texte ? `${base}?text=${encodeURIComponent(texte)}` : base
}

export function lienEmail(adresse: string, sujet?: string, corps?: string): string {
  const params = new URLSearchParams()
  if (sujet) params.set('subject', sujet)
  if (corps) params.set('body', corps)
  const q = params.toString().replace(/\+/g, '%20')
  return `mailto:${adresse}${q ? `?${q}` : ''}`
}

const ORDRE_DEFAUT: Canal[] = ['appel', 'whatsapp', 'sms', 'email']

/**
 * Ordre d'affichage des canaux : le plus utilisé pour ce contact en premier,
 * puis l'ordre par défaut. L'email n'apparaît que si une adresse est connue.
 */
export function ordreCanaux(utilisation: Partial<Record<Canal, number>> = {}, aEmail = false): Canal[] {
  const disponibles = ORDRE_DEFAUT.filter((c) => c !== 'email' || aEmail)
  return [...disponibles].sort((a, b) => {
    const diff = (utilisation[b] ?? 0) - (utilisation[a] ?? 0)
    return diff !== 0 ? diff : ORDRE_DEFAUT.indexOf(a) - ORDRE_DEFAUT.indexOf(b)
  })
}
