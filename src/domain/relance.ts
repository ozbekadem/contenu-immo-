import { ajouterJours, ajouterMois, ecartJours } from './dates'

export type Couleur = 'vert' | 'jaune' | 'orange' | 'rouge' | 'gris'
export type Temperature = 'chaud' | 'tiede' | 'froid'
export type Categorie = 'portefeuille' | 'annonce' | 'maison_vide'

export interface EtatSuivi {
  archive?: boolean
  nePasRappeler?: boolean
  /** Date du dernier contact réel (appel, SMS, visite…). */
  dernierContactAt?: Date | null
  /** Date de la prochaine relance planifiée. */
  prochaineRelanceAt?: Date | null
  /** Le dernier résultat est positif (RDV, visite, mandat, accord…). */
  dernierResultatPositif?: boolean
  temperature?: Temperature | null
  /** Date de repérage / création, utilisée si aucun contact n'a encore eu lieu. */
  creeLe?: Date | null
}

export interface ParametresCouleur {
  /** Seuil « aucun contact depuis trop longtemps » en jours. */
  seuilRougeJours: number
  /** Une relance dans ce nombre de jours (ou moins) est affichée en jaune. */
  horizonJauneJours: number
  /** Un contact de moins de ce nombre de jours est considéré comme récent (vert). */
  recentVertJours: number
}

export const SEUILS_ROUGE_DEFAUT: Record<Categorie, number> = {
  portefeuille: 90,
  annonce: 30,
  maison_vide: 60,
}

export const PARAMETRES_DEFAUT: Omit<ParametresCouleur, 'seuilRougeJours'> = {
  horizonJauneJours: 7,
  recentVertJours: 14,
}

export function parametresPour(categorie: Categorie, surcharge?: Partial<ParametresCouleur>): ParametresCouleur {
  return { ...PARAMETRES_DEFAUT, seuilRougeJours: SEUILS_ROUGE_DEFAUT[categorie], ...surcharge }
}

/**
 * Couleur de suivi, par ordre de priorité :
 * ⚪ archivé / ne pas rappeler
 * 🔴 relance dépassée, ou aucun contact depuis plus que le seuil (s'il n'y a pas de relance future planifiée)
 * 🟠 relance due aujourd'hui
 * 🟡 relance dans les prochains jours
 * 🟢 positif / chaud, contact récent, ou relance planifiée plus loin
 */
export function couleurSuivi(e: EtatSuivi, p: ParametresCouleur, maintenant: Date = new Date()): Couleur {
  if (e.archive || e.nePasRappeler) return 'gris'

  const relance = e.prochaineRelanceAt ?? null
  const joursAvantRelance = relance ? ecartJours(maintenant, relance) : null

  if (joursAvantRelance !== null && joursAvantRelance < 0) return 'rouge'

  // Sans relance future planifiée, on vérifie l'ancienneté du dernier contact.
  if (joursAvantRelance === null) {
    const reference = e.dernierContactAt ?? e.creeLe ?? null
    if (reference && ecartJours(reference, maintenant) > p.seuilRougeJours) return 'rouge'
  }

  if (joursAvantRelance === 0) return 'orange'
  if (joursAvantRelance !== null && joursAvantRelance <= p.horizonJauneJours) return 'jaune'

  return 'vert'
}

export const LIBELLE_COULEUR: Record<Couleur, string> = {
  vert: 'À jour',
  jaune: 'Relance proche',
  orange: "À rappeler aujourd'hui",
  rouge: 'En retard',
  gris: 'Archivé',
}

export const LIBELLE_TEMPERATURE: Record<Temperature, string> = {
  chaud: 'Chaud',
  tiede: 'Tiède',
  froid: 'Froid',
}

/** « aujourd'hui », « hier », « il y a 12 jours » ; « jamais » si aucune date. */
export function libelleDernierContact(date: Date | null | undefined, maintenant: Date = new Date()): string {
  if (!date) return 'jamais'
  const n = ecartJours(date, maintenant)
  if (n <= 0) return "aujourd'hui"
  if (n === 1) return 'hier'
  return `il y a ${n} jours`
}

const FORMAT_DATE = new Intl.DateTimeFormat('fr-BE', { weekday: 'short', day: 'numeric', month: 'short' })
const FORMAT_DATE_ANNEE = new Intl.DateTimeFormat('fr-BE', { day: 'numeric', month: 'short', year: 'numeric' })

/** « aujourd'hui », « demain », « en retard de 3 jours », « mar. 7 oct. ». */
export function libelleProchaineRelance(date: Date | null | undefined, maintenant: Date = new Date()): string {
  if (!date) return 'aucune'
  const n = ecartJours(maintenant, date)
  if (n < 0) return n === -1 ? 'en retard de 1 jour' : `en retard de ${-n} jours`
  if (n === 0) return "aujourd'hui"
  if (n === 1) return 'demain'
  return date.getFullYear() === maintenant.getFullYear() ? FORMAT_DATE.format(date) : FORMAT_DATE_ANNEE.format(date)
}

export type DelaiRelance = '1s' | '1m' | '3m' | '6m'

export const DELAIS_RELANCE: { code: DelaiRelance; libelle: string }[] = [
  { code: '1s', libelle: '+1 semaine' },
  { code: '1m', libelle: '+1 mois' },
  { code: '3m', libelle: '+3 mois' },
  { code: '6m', libelle: '+6 mois' },
]

export function dateRelance(delai: DelaiRelance, depuis: Date = new Date()): Date {
  switch (delai) {
    case '1s':
      return ajouterJours(depuis, 7)
    case '1m':
      return ajouterMois(depuis, 1)
    case '3m':
      return ajouterMois(depuis, 3)
    case '6m':
      return ajouterMois(depuis, 6)
  }
}

/** Heure d'une relance proposée par défaut : celle du moment si elle tombe entre 9 h et 19 h, sinon 9 h. */
export function heureOuvrable(d: Date): number {
  const h = d.getHours()
  return h >= 9 && h < 19 ? h : 9
}
