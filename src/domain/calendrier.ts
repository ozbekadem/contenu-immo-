import { ajouterJours, ajouterMois, debutJour } from './dates'

/** Présentations de l'agenda. */
export type VueAgenda = 'jour' | 'semaine' | 'mois' | 'trimestre'

export const VUES_AGENDA: { code: VueAgenda; libelle: string }[] = [
  { code: 'jour', libelle: 'Jour' },
  { code: 'semaine', libelle: 'Semaine' },
  { code: 'mois', libelle: 'Mois' },
  { code: 'trimestre', libelle: 'Trimestre' },
]

/** Lundi de la semaine (à minuit). */
export function debutSemaine(d: Date): Date {
  const j = debutJour(d)
  return ajouterJours(j, -((j.getDay() + 6) % 7))
}

export function debutMois(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

/** Premier jour du trimestre civil (janvier, avril, juillet, octobre). */
export function debutTrimestre(d: Date): Date {
  return new Date(d.getFullYear(), Math.floor(d.getMonth() / 3) * 3, 1)
}

/** Période affichée par une vue : [du, au[. */
export function plageVue(vue: VueAgenda, d: Date): { du: Date; au: Date } {
  switch (vue) {
    case 'jour':
      return { du: debutJour(d), au: ajouterJours(debutJour(d), 1) }
    case 'semaine':
      return { du: debutSemaine(d), au: ajouterJours(debutSemaine(d), 7) }
    case 'mois':
      return { du: debutMois(d), au: ajouterMois(debutMois(d), 1) }
    case 'trimestre':
      return { du: debutTrimestre(d), au: ajouterMois(debutTrimestre(d), 3) }
  }
}

/** Période précédente (-1) ou suivante (+1), en gardant un jour de référence dans la nouvelle période. */
export function decaler(vue: VueAgenda, d: Date, sens: number): Date {
  switch (vue) {
    case 'jour':
      return ajouterJours(debutJour(d), sens)
    case 'semaine':
      return ajouterJours(debutSemaine(d), 7 * sens)
    case 'mois':
      return ajouterMois(debutMois(d), sens)
    case 'trimestre':
      return ajouterMois(debutTrimestre(d), 3 * sens)
  }
}

/** Grille d'un mois : semaines complètes du lundi au dimanche (5 ou 6 lignes de 7 jours). */
export function grilleMois(d: Date): Date[][] {
  const premier = debutMois(d)
  const fin = ajouterMois(premier, 1)
  const semaines: Date[][] = []
  for (let lundi = debutSemaine(premier); lundi < fin; lundi = ajouterJours(lundi, 7)) {
    semaines.push(Array.from({ length: 7 }, (_, i) => ajouterJours(lundi, i)))
  }
  return semaines
}

/** Clé d'un jour (heure locale), pour regrouper rendez-vous et relances. */
export function cleJour(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
}

const MOIS = new Intl.DateTimeFormat('fr-BE', { month: 'long', year: 'numeric' })
const MOIS_COURT = new Intl.DateTimeFormat('fr-BE', { month: 'short' })
const JOUR_MOIS = new Intl.DateTimeFormat('fr-BE', { day: 'numeric', month: 'short' })
const JOUR_LONG = new Intl.DateTimeFormat('fr-BE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

/** Titre de la période : « 5 – 11 oct. 2026 », « octobre 2026 », « 4e trimestre 2026 (oct. – déc.) »… */
export function titrePeriode(vue: VueAgenda, d: Date): string {
  const { du, au } = plageVue(vue, d)
  const dernier = ajouterJours(au, -1)
  switch (vue) {
    case 'jour':
      return JOUR_LONG.format(du)
    case 'semaine':
      return du.getMonth() === dernier.getMonth()
        ? `${du.getDate()} – ${JOUR_MOIS.format(dernier)} ${dernier.getFullYear()}`
        : `${JOUR_MOIS.format(du)} – ${JOUR_MOIS.format(dernier)} ${dernier.getFullYear()}`
    case 'mois':
      return MOIS.format(du)
    case 'trimestre': {
      const n = Math.floor(du.getMonth() / 3) + 1
      return `${n}${n === 1 ? 'er' : 'e'} trimestre ${du.getFullYear()} (${MOIS_COURT.format(du).replace('.', '')} – ${MOIS_COURT.format(dernier).replace('.', '')})`
    }
  }
}
