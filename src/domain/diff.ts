/**
 * Champs réellement modifiés par l'utilisateur entre l'ouverture du formulaire (`avant`)
 * et l'enregistrement (`apres`). Seuls ces champs sont envoyés : un champ modifié entre-temps
 * par un collègue sur un autre appareil n'est donc jamais écrasé par une valeur périmée.
 */
export function champsModifies<T extends object>(avant: T, apres: T): Partial<T> {
  const resultat: Partial<T> = {}
  for (const cle of Object.keys(apres) as (keyof T)[]) {
    if (JSON.stringify(avant[cle] ?? null) !== JSON.stringify(apres[cle] ?? null)) resultat[cle] = apres[cle]
  }
  return resultat
}
