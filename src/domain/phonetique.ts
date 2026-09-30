/**
 * Clé phonétique simplifiée pour le français : deux noms qui se prononcent pareil
 * donnent la même clé (Dupont/Dupond, Lefèvre/Lefebvre, Mathieu/Matthieu, Rossi/Rosi,
 * El Amrani/Elamrani, Philippe/Filip).
 */
export function clePhonetique(texte: string): string {
  let s = texte
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z]/g, '')
  if (!s) return ''

  const regles: [RegExp, string][] = [
    [/(.)\1+/g, '$1'], // lettres doublées (Matthieu, Mohammed)
    [/sch/g, 'ch'],
    [/ch/g, '§'], // son « ch » protégé
    [/ph/g, 'f'],
    [/th/g, 't'],
    [/gu(?=[eiy])/g, 'g'],
    [/qu/g, 'k'],
    [/c(?=[eiy])/g, 's'],
    [/ck/g, 'k'],
    [/[cq]/g, 'k'],
    [/g(?=[eiy])/g, 'j'],
    [/x/g, 'ks'],
    [/z/g, 's'],
    [/w/g, 'v'],
    [/y/g, 'i'],
    [/h/g, ''],
    [/bv/g, 'v'],
    [/eau|au/g, 'o'],
    [/ai|ei/g, 'e'],
    [/ou/g, 'u'],
    [/(an|en|am|em)(?=[^aeiou]|$)/g, 'an'],
    [/(on|om)(?=[^aeiou]|$)/g, 'on'],
    [/(in|ein|ain|im)(?=[^aeiou]|$)/g, 'in'],
    [/(.)\1+/g, '$1'],
  ]
  for (const [motif, remplacement] of regles) s = s.replace(motif, remplacement)

  // Lettres finales muettes (Dupont → dupon, Claes → kla, Lambert → lanber).
  if (s.length > 3) s = s.replace(/(e|s|t|d|x|p)+$/, '')
  return s.replace(/§/g, 'ch')
}

/** Clés phonétiques de chaque mot d'un texte (pour la recherche tolérante). */
export function clesMots(texte: string): string[] {
  return texte
    .split(/[\s'’-]+/)
    .map(clePhonetique)
    .filter((k) => k.length >= 2)
}
