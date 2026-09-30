/** Minuscules, sans accents ni ponctuation superflue : « Évêché » → « eveche ». */
export function normaliserTexte(t: string): string {
  return t
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}@.+]+/gu, ' ')
    .trim()
}

/** Variantes d'un numéro E.164 belge pour la recherche : 32476123456 et 0476123456. */
function variantesNumero(e164: string): string[] {
  const chiffres = e164.replace(/\D/g, '')
  return chiffres.startsWith('32') ? [chiffres, '0' + chiffres.slice(2)] : [chiffres]
}

/** Construit le texte indexé d'une fiche (noms, adresse, ville, emails, téléphones). */
export function construireIndex(morceaux: (string | null | undefined)[], telephonesE164: string[] = []): string {
  const texte = normaliserTexte(morceaux.filter(Boolean).join(' '))
  const numeros = telephonesE164.flatMap(variantesNumero).join(' ')
  return `${texte} ${numeros}`.trim()
}

/** Découpe une requête en jetons. Une requête « numéro » est compactée : « 0476 12 34 » → « 04761234 ». */
export function preparerRequete(requete: string): string[] {
  const brut = requete.trim()
  if (!brut) return []
  if (/^[\d\s+./()-]+$/.test(brut) && /\d{3}/.test(brut.replace(/\D/g, ''))) {
    let chiffres = brut.replace(/\D/g, '')
    if (chiffres.startsWith('0032')) chiffres = '0' + chiffres.slice(4)
    else if (brut.startsWith('+32') || (chiffres.startsWith('32') && chiffres.length >= 10)) chiffres = '0' + chiffres.slice(2)
    return [chiffres]
  }
  return normaliserTexte(brut).split(' ').filter(Boolean)
}

/** Tous les jetons doivent se trouver dans le texte indexé. */
export function correspond(index: string, jetons: string[]): boolean {
  for (const j of jetons) if (!index.includes(j)) return false
  return true
}

/** Clé de tri alphabétique « nom prénom ». */
export function cleTri(nom: string, prenom: string, societe = ''): string {
  return normaliserTexte(`${nom || societe} ${prenom}`) || '~'
}
