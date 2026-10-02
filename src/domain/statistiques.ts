import type { Contact, Interaction, Piste, SourceContact } from '@/data/types'
import { ajouterJours, debutJour } from './dates'
import { RESULTATS } from './resultats'

export type CodePeriode = 'semaine' | 'mois' | 'trimestre' | 'annee'

export const PERIODES: { code: CodePeriode; libelle: string }[] = [
  { code: 'semaine', libelle: 'Semaine' },
  { code: 'mois', libelle: 'Mois' },
  { code: 'trimestre', libelle: 'Trimestre' },
  { code: 'annee', libelle: 'Année' },
]

export interface Intervalle {
  du: Date
  au: Date
}

/** Période en cours (lundi → maintenant, 1er du mois → maintenant…) et la même durée juste avant, pour comparer. */
export function periode(code: CodePeriode, maintenant: Date): Intervalle & { precedente: Intervalle } {
  const j = debutJour(maintenant)
  let du: Date
  let avant: Date
  if (code === 'semaine') {
    du = ajouterJours(j, -((j.getDay() + 6) % 7))
    avant = ajouterJours(du, -7)
  } else if (code === 'mois') {
    du = new Date(j.getFullYear(), j.getMonth(), 1)
    avant = new Date(j.getFullYear(), j.getMonth() - 1, 1)
  } else if (code === 'trimestre') {
    du = new Date(j.getFullYear(), Math.floor(j.getMonth() / 3) * 3, 1)
    avant = new Date(du.getFullYear(), du.getMonth() - 3, 1)
  } else {
    du = new Date(j.getFullYear(), 0, 1)
    avant = new Date(j.getFullYear() - 1, 0, 1)
  }
  // Période précédente de même longueur (comparaison « à date » : du 1er au même jour du mois précédent…)
  const duree = maintenant.getTime() - du.getTime()
  return { du, au: maintenant, precedente: { du: avant, au: new Date(avant.getTime() + duree) } }
}

export interface Chiffres {
  appels: number
  joints: number
  rdv: number
  signatures: number
  messages: number
  reperages: number
}

const dans = (iso: string, i: Intervalle) => {
  const t = new Date(iso).getTime()
  return t >= i.du.getTime() && t <= i.au.getTime()
}

/** Chiffres d'activité sur une période (une personne si `qui` est donné). */
export function chiffres(interactions: Interaction[], pistes: Piste[], i: Intervalle, qui?: string | null): Chiffres {
  const c: Chiffres = { appels: 0, joints: 0, rdv: 0, signatures: 0, messages: 0, reperages: 0 }
  for (const x of interactions) {
    if (x.archivedAt || !dans(x.date, i) || (qui !== undefined && x.createdBy !== qui)) continue
    if (x.type === 'appel') {
      c.appels++
      if (RESULTATS[x.resultat]?.joint) c.joints++
    }
    if ((x.type === 'sms' || x.type === 'whatsapp' || x.type === 'email') && x.resultat === 'message_envoye') c.messages++
    if (x.resultat === 'rdv' || x.resultat === 'visite') c.rdv++
    if (x.resultat === 'mandat' || x.resultat === 'accord') c.signatures++
  }
  for (const p of pistes) if (!p.archivedAt && dans(p.createdAt, i) && (qui === undefined || p.createdBy === qui)) c.reperages++
  return c
}

/** Appels et personnes jointes par semaine (lundi), des N dernières semaines. */
export function parSemaine(interactions: Interaction[], maintenant: Date, n = 12): { debut: Date; appels: number; joints: number }[] {
  const lundi = periode('semaine', maintenant).du
  const semaines = Array.from({ length: n }, (_, k) => ({ debut: ajouterJours(lundi, -7 * (n - 1 - k)), appels: 0, joints: 0 }))
  for (const x of interactions) {
    if (x.archivedAt || x.type !== 'appel') continue
    const t = new Date(x.date).getTime()
    const s = semaines.findLast((w) => w.debut.getTime() <= t)
    if (!s || t > maintenant.getTime()) continue
    s.appels++
    if (RESULTATS[x.resultat]?.joint) s.joints++
  }
  return semaines
}

export interface LigneOrigine {
  source: SourceContact | 'inconnue'
  fiches: number
  rdv: number
  signes: number
  /** Part des fiches arrivées au moins au rendez-vous, en %. */
  tauxRdv: number
}

/**
 * Résultats par origine (affiche, Immoweb, recommandation…) : de quoi savoir où mettre son énergie.
 * Une piste compte pour sa propre origine ; un contact du portefeuille, pour la sienne.
 */
export function parOrigine(contacts: Contact[], pistes: Piste[], interactions: Interaction[]): LigneOrigine[] {
  const parContact = new Map<string, Set<string>>()
  const parPiste = new Map<string, Set<string>>()
  for (const x of interactions) {
    if (x.archivedAt) continue
    if (x.pisteId) parPiste.set(x.pisteId, (parPiste.get(x.pisteId) ?? new Set()).add(x.resultat))
    else if (x.contactId) parContact.set(x.contactId, (parContact.get(x.contactId) ?? new Set()).add(x.resultat))
  }
  const lignes = new Map<string, LigneOrigine>()
  const compter = (source: SourceContact | null | undefined, rdv: boolean, signe: boolean) => {
    const k = source ?? 'inconnue'
    const l = lignes.get(k) ?? { source: k, fiches: 0, rdv: 0, signes: 0, tauxRdv: 0 }
    l.fiches++
    if (rdv || signe) l.rdv++
    if (signe) l.signes++
    lignes.set(k, l)
  }
  const avecPiste = new Set<string>()
  for (const p of pistes) {
    if (p.archivedAt) continue
    if (p.contactId) avecPiste.add(p.contactId)
    const r = parPiste.get(p.id) ?? new Set()
    compter(p.source, p.statut === 'rdv' || r.has('rdv') || r.has('visite'), p.statut === 'gagne')
  }
  for (const c of contacts) {
    if (c.archivedAt || avecPiste.has(c.id)) continue
    const r = parContact.get(c.id) ?? new Set()
    compter(c.source, r.has('rdv') || r.has('visite'), r.has('mandat') || r.has('accord'))
  }
  return [...lignes.values()].map((l) => ({ ...l, tauxRdv: l.fiches ? Math.round((l.rdv / l.fiches) * 100) : 0 })).sort((a, b) => b.fiches - a.fiches)
}

/** Valeur du portefeuille en cours : commissions estimées des pistes au stade RDV / visite (prix connu × taux). */
export function valeurPortefeuille(pistes: Piste[], tauxPct: number): { pistes: number; prixTotal: number; commission: number } {
  const enRdv = pistes.filter((p) => !p.archivedAt && p.statut === 'rdv' && p.prix)
  const prixTotal = enRdv.reduce((s, p) => s + p.prix!, 0)
  return { pistes: enRdv.length, prixTotal, commission: Math.round((prixTotal * tauxPct) / 100) }
}
