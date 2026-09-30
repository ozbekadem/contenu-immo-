import { cleAdresse, memeImmeuble, type AdresseComparable } from './adresse'
import { clePhonetique } from './phonetique'
import { normaliserTexte } from './recherche'
import { normaliserTelephone } from './telephone'

export type RaisonDoublon = 'telephone' | 'email' | 'nom' | 'nom_inverse' | 'adresse' | 'immeuble'

export const LIBELLE_RAISON: Record<RaisonDoublon, string> = {
  telephone: 'Même téléphone',
  email: 'Même email',
  nom: 'Nom proche',
  nom_inverse: 'Prénom et nom inversés',
  adresse: 'Même adresse',
  immeuble: 'Même immeuble',
}

/** Poids de chaque raison : plus c'est élevé, plus le doublon est probable. */
const POIDS: Record<RaisonDoublon, number> = {
  telephone: 100,
  email: 90,
  nom: 50,
  nom_inverse: 45,
  adresse: 40,
  immeuble: 15,
}

/** Empreinte d'une fiche pour la comparaison (calculée une fois, stockée localement). */
export interface Empreinte {
  telephones: string[]
  emails: string[]
  phonNom: string
  phonPrenom: string
  ville: string
  adresse: string | null
}

export function normaliserEmail(e: string): string {
  return e.trim().toLowerCase()
}

export function empreinte(f: {
  prenom: string
  nom: string
  telephones: { numero: string }[]
  emails: string[]
  adresse: AdresseComparable | null
}): Empreinte {
  return {
    telephones: f.telephones.map((t) => normaliserTelephone(t.numero)).filter((n): n is string => !!n),
    emails: f.emails.map(normaliserEmail).filter((e) => e.includes('@')),
    phonNom: clePhonetique(f.nom),
    phonPrenom: clePhonetique(f.prenom),
    ville: normaliserTexte(f.adresse?.ville ?? ''),
    adresse: cleAdresse(f.adresse),
  }
}

/** Raisons pour lesquelles deux fiches pourraient être la même personne. */
export function comparer(a: Empreinte, b: Empreinte): RaisonDoublon[] {
  const raisons: RaisonDoublon[] = []
  if (a.telephones.some((t) => b.telephones.includes(t))) raisons.push('telephone')
  if (a.emails.some((e) => b.emails.includes(e))) raisons.push('email')

  // Nom proche : même nom phonétique et même prénom phonétique ;
  // si un des prénoms manque, il faut en plus la même localité (sinon trop de « Dupont »).
  if (a.phonNom.length >= 2 && a.phonNom === b.phonNom) {
    const deuxPrenoms = !!a.phonPrenom && !!b.phonPrenom
    if (deuxPrenoms ? a.phonPrenom === b.phonPrenom : !!a.ville && a.ville === b.ville) raisons.push('nom')
  } else if (a.phonNom && a.phonPrenom && a.phonNom === b.phonPrenom && a.phonPrenom === b.phonNom) {
    raisons.push('nom_inverse')
  }

  if (a.adresse && a.adresse === b.adresse) raisons.push('adresse')
  else if (memeImmeuble(a.adresse, b.adresse)) raisons.push('immeuble')
  return raisons
}

export interface Candidat<T> {
  fiche: T
  raisons: RaisonDoublon[]
  score: number
}

/** Fiches existantes ressemblant à la saisie, de la plus probable à la moins probable. */
export function trouverSimilaires<T extends { id: string }>(
  saisie: Empreinte,
  fiches: { fiche: T; empreinte: Empreinte }[],
  exclureId?: string,
  max = 5,
): Candidat<T>[] {
  const resultats: Candidat<T>[] = []
  for (const { fiche, empreinte: e } of fiches) {
    if (fiche.id === exclureId) continue
    const raisons = comparer(saisie, e)
    if (raisons.length === 0) continue
    // Un simple « même immeuble » n'est pas un doublon de personne à lui seul.
    if (raisons.length === 1 && raisons[0] === 'immeuble') continue
    resultats.push({ fiche, raisons, score: raisons.reduce((s, r) => s + POIDS[r], 0) })
  }
  return resultats.sort((x, y) => y.score - x.score).slice(0, max)
}
