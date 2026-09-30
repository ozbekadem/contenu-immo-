import type { Categorie } from './relance'

export const CATEGORIES: { code: Categorie; libelle: string; court: string; description: string }[] = [
  {
    code: 'portefeuille',
    libelle: 'Portefeuille',
    court: 'Portefeuille',
    description: 'Contacts existants à recontacter régulièrement',
  },
  {
    code: 'annonce',
    libelle: 'Annonces de particuliers',
    court: 'Annonces',
    description: 'Affiches « à vendre » et annonces privées — objectif : mandat',
  },
  {
    code: 'maison_vide',
    libelle: 'Maisons vides',
    court: 'Maisons vides',
    description: 'Biens vides ou à l’abandon — objectif : achat en privé',
  },
]

export function libelleCategorie(c: Categorie, court = false): string {
  const cat = CATEGORIES.find((x) => x.code === c)!
  return court ? cat.court : cat.libelle
}
