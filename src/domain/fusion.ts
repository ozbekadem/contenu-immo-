import type { Contact } from '@/data/types'
import { comparer, type Empreinte, type RaisonDoublon } from './doublons'
import { normaliserTelephone } from './telephone'

export interface PaireDoublon<T> {
  a: T
  b: T
  raisons: RaisonDoublon[]
}

const FORTES: RaisonDoublon[] = ['telephone', 'email', 'nom', 'nom_inverse']

/**
 * Toutes les paires de fiches probablement en double, sans tout comparer à tout :
 * on ne compare que les fiches qui partagent un téléphone, un email, un nom ou une adresse.
 * Une simple adresse commune (couple, colocataires) ne suffit pas : il faut aussi un indice sur la personne.
 */
export function pairesDoublons<T extends { id: string }>(fiches: { fiche: T; empreinte: Empreinte }[]): PaireDoublon<T>[] {
  const paquets = new Map<string, number[]>()
  const ajouter = (cle: string, i: number) => {
    const p = paquets.get(cle)
    if (p) p.push(i)
    else paquets.set(cle, [i])
  }
  fiches.forEach(({ empreinte: e }, i) => {
    for (const t of e.telephones) ajouter(`t:${t}`, i)
    for (const m of e.emails) ajouter(`m:${m}`, i)
    if (e.phonNom.length >= 2) ajouter(`n:${e.phonNom}`, i)
    if (e.phonNom && e.phonPrenom) ajouter(`n:${e.phonPrenom}`, i) // nom et prénom inversés
  })
  const vus = new Set<string>()
  const paires: PaireDoublon<T>[] = []
  for (const indices of paquets.values()) {
    if (indices.length < 2 || indices.length > 50) continue // un nom très courant n'est pas un indice
    for (let x = 0; x < indices.length; x++)
      for (let y = x + 1; y < indices.length; y++) {
        const [i, j] = [indices[x]!, indices[y]!]
        const cle = i < j ? `${i}-${j}` : `${j}-${i}`
        if (vus.has(cle)) continue
        vus.add(cle)
        const raisons = comparer(fiches[i]!.empreinte, fiches[j]!.empreinte)
        if (raisons.some((r) => FORTES.includes(r))) paires.push({ a: fiches[i]!.fiche, b: fiches[j]!.fiche, raisons })
      }
  }
  return paires.sort((p, q) => q.raisons.length - p.raisons.length)
}

const plusRecent = (a: string | null | undefined, b: string | null | undefined) => (!a ? (b ?? null) : !b ? a : a > b ? a : b)
const plusTot = (a: string | null | undefined, b: string | null | undefined) => (!a ? (b ?? null) : !b ? a : a < b ? a : b)
const union = <T,>(a: T[] | undefined, b: T[] | undefined, cle: (x: T) => string = (x) => JSON.stringify(x)) => {
  const vus = new Set<string>()
  return [...(a ?? []), ...(b ?? [])].filter((x) => {
    const k = cle(x)
    if (vus.has(k)) return false
    vus.add(k)
    return true
  })
}

/**
 * Fiche fusionnée : on garde tout, rien n'est perdu. Les champs vides de la fiche gardée sont complétés,
 * les listes (téléphones, emails, statuts, dates clés…) réunies, les notes mises bout à bout.
 * « Ne plus contacter » l'emporte toujours (le plus prudent).
 */
export function fusionnerDonnees(garde: Contact, autre: Contact): Partial<Contact> {
  const remplir = <K extends keyof Contact>(k: K) => (garde[k] || autre[k]) as Contact[K]
  const adresseDifferente = autre.adresse && JSON.stringify(autre.adresse) !== JSON.stringify(garde.adresse)
  const consentements = { ...autre.consentements }
  for (const [canal, c] of Object.entries(garde.consentements ?? {})) {
    const k = canal as keyof typeof consentements
    if (!consentements[k] || (c && c.date >= consentements[k]!.date)) consentements[k] = c
  }
  const utilisation = { ...autre.utilisationCanaux }
  for (const [k, n] of Object.entries(garde.utilisationCanaux)) utilisation[k as keyof typeof utilisation] = (utilisation[k as keyof typeof utilisation] ?? 0) + (n ?? 0)
  return {
    civilite: remplir('civilite'),
    prenom: remplir('prenom'),
    nom: remplir('nom'),
    societe: remplir('societe'),
    telephones: union(garde.telephones, autre.telephones, (t) => normaliserTelephone(t.numero) ?? t.numero),
    emails: union(garde.emails, autre.emails, (e) => e.trim().toLowerCase()),
    adresse: garde.adresse ?? autre.adresse,
    anciennesAdresses: union(
      garde.anciennesAdresses,
      [...autre.anciennesAdresses, ...(adresseDifferente && garde.adresse ? [{ ...autre.adresse!, jusquau: new Date().toISOString().slice(0, 10) }] : [])],
      (a) => `${a.rue}|${a.numero}|${a.cp}`,
    ),
    dateNaissance: remplir('dateNaissance'),
    statuts: union(garde.statuts, autre.statuts),
    source: garde.source ?? autre.source ?? null,
    temperature: garde.temperature ?? autre.temperature,
    canalPrefere: garde.canalPrefere ?? autre.canalPrefere,
    utilisationCanaux: utilisation,
    collaborateurId: garde.collaborateurId ?? autre.collaborateurId,
    tags: union(garde.tags, autre.tags),
    notes: [garde.notes.trim(), autre.notes.trim()].filter(Boolean).join('\n\n'),
    nePasContacter: garde.nePasContacter || autre.nePasContacter,
    dernierContactAt: plusRecent(garde.dernierContactAt, autre.dernierContactAt),
    prochaineRelanceAt: plusTot(garde.prochaineRelanceAt, autre.prochaineRelanceAt),
    dernierResultatPositif: garde.dernierResultatPositif || autre.dernierResultatPositif,
    datesCles: union(garde.datesCles, autre.datesCles, (d) => d.id),
    consentements,
  }
}
