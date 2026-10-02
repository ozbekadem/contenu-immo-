import type { Adresse, Civilite, Contact, SourceContact, StatutContact } from '@/data/types'
import { cpPourLocalite, localitesPourCp } from './adresse'
import { comparer, empreinte, type Empreinte } from './doublons'
import { normaliserTexte } from './recherche'
import { formaterTelephone, normaliserTelephone } from './telephone'

/** Informations qu'on peut importer, avec les en-têtes reconnus automatiquement (français, néerlandais, anglais). */
export const CHAMPS_IMPORT = [
  { code: 'ignorer', libelle: '— Ne pas importer —', synonymes: [] },
  { code: 'civilite', libelle: 'Civilité', synonymes: ['civilite', 'titre', 'aanspreking', 'title', 'salutation'] },
  { code: 'prenom', libelle: 'Prénom', synonymes: ['prenom', 'voornaam', 'first name', 'firstname', 'given name'] },
  { code: 'nom', libelle: 'Nom', synonymes: ['nom', 'nom de famille', 'achternaam', 'naam', 'last name', 'lastname', 'surname', 'family name'] },
  { code: 'nomComplet', libelle: 'Nom complet (prénom + nom)', synonymes: ['nom complet', 'contact', 'client', 'proprietaire', 'vendeur', 'full name', 'name'] },
  { code: 'societe', libelle: 'Société', synonymes: ['societe', 'entreprise', 'bedrijf', 'company', 'firme'] },
  { code: 'telephone', libelle: 'Téléphone', synonymes: ['telephone', 'tel', 'gsm', 'mobile', 'portable', 'telefoon', 'phone', 'numero de telephone', 'tel 1', 'telephone 1'] },
  { code: 'telephone2', libelle: 'Téléphone 2', synonymes: ['telephone 2', 'tel 2', 'gsm 2', 'telephone fixe', 'fixe', 'phone 2'] },
  { code: 'email', libelle: 'Email', synonymes: ['email', 'e-mail', 'mail', 'courriel', 'adresse email', 'adresse e-mail'] },
  { code: 'adresseComplete', libelle: 'Adresse complète (une seule colonne)', synonymes: ['adresse', 'adres', 'address', 'adresse complete'] },
  { code: 'rue', libelle: 'Rue', synonymes: ['rue', 'straat', 'street', 'voie'] },
  { code: 'numero', libelle: 'Numéro', synonymes: ['numero', 'n', 'no', 'nr', 'huisnummer', 'number'] },
  { code: 'boite', libelle: 'Boîte', synonymes: ['boite', 'bte', 'bus', 'box'] },
  { code: 'cp', libelle: 'Code postal', synonymes: ['code postal', 'cp', 'postcode', 'zip', 'code'] },
  { code: 'ville', libelle: 'Localité', synonymes: ['ville', 'localite', 'commune', 'gemeente', 'city', 'town', 'section'] },
  { code: 'dateNaissance', libelle: 'Date de naissance', synonymes: ['date de naissance', 'naissance', 'geboortedatum', 'birthday', 'anniversaire'] },
  { code: 'statut', libelle: 'Statut', synonymes: ['statut', 'type', 'categorie', 'status'] },
  { code: 'source', libelle: 'Origine', synonymes: ['origine', 'source', 'bron', 'provenance'] },
  { code: 'notes', libelle: 'Notes', synonymes: ['notes', 'note', 'commentaire', 'commentaires', 'remarque', 'remarques', 'opmerkingen', 'comments'] },
] as const

export type CodeChamp = (typeof CHAMPS_IMPORT)[number]['code']

const cle = (t: string) => normaliserTexte(t).replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()

/** Correspondance automatique colonne → information (chaque information une seule fois). */
export function devinerColonnes(entetes: string[]): CodeChamp[] {
  const pris = new Set<CodeChamp>()
  return entetes.map((e) => {
    const k = cle(e)
    const trouve = CHAMPS_IMPORT.find((c) => c.code !== 'ignorer' && !pris.has(c.code) && (c.synonymes as readonly string[]).some((s) => s === k))
      ?? CHAMPS_IMPORT.find((c) => c.code !== 'ignorer' && !pris.has(c.code) && (c.synonymes as readonly string[]).some((s) => s.length > 3 && k.includes(s)))
    if (!trouve) return 'ignorer'
    pris.add(trouve.code)
    return trouve.code
  })
}

/** Lecture d'un CSV (séparateur « ; » ou « , » détecté, guillemets, BOM d'Excel). */
export function lireCsv(texte: string): string[][] {
  const t = texte.replace(/^﻿/, '')
  const premiere = t.split(/\r?\n/, 1)[0] ?? ''
  const sep = (premiere.match(/;/g)?.length ?? 0) >= (premiere.match(/,/g)?.length ?? 0) ? ';' : premiere.includes('\t') ? '\t' : ','
  const lignes: string[][] = []
  let ligne: string[] = []
  let cellule = ''
  let guillemets = false
  for (let i = 0; i < t.length; i++) {
    const c = t[i]!
    if (guillemets) {
      if (c === '"' && t[i + 1] === '"') {
        cellule += '"'
        i++
      } else if (c === '"') guillemets = false
      else cellule += c
    } else if (c === '"') guillemets = true
    else if (c === sep) {
      ligne.push(cellule)
      cellule = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && t[i + 1] === '\n') i++
      ligne.push(cellule)
      lignes.push(ligne)
      ligne = []
      cellule = ''
    } else cellule += c
  }
  if (cellule || ligne.length) {
    ligne.push(cellule)
    lignes.push(ligne)
  }
  return lignes.filter((l) => l.some((x) => x.trim()))
}

const STATUTS: [RegExp, StatutContact][] = [
  [/prospect/, 'prospect_vendeur'],
  [/ancien/, 'ancien_client'],
  [/acheteu|acquereu|koper|buyer/, 'acheteur'],
  [/bailleur|proprietaire|eigenaar|landlord/, 'bailleur'],
  [/locataire|huurder|tenant/, 'locataire'],
  [/partenaire|notaire|apporteur|partner/, 'partenaire'],
  [/vendeu|verkoper|seller/, 'vendeur'],
]
const SOURCES: [RegExp, SourceContact][] = [
  [/affiche|panneau|bord/, 'affiche'],
  [/immoweb/, 'immoweb'],
  [/2ememain|2dehands/, '2ememain'],
  [/recommand|bouche|referral/, 'recommandation'],
  [/agence/, 'autre_agence'],
  [/reperage|rue/, 'reperage'],
  [/ancien/, 'ancien_client'],
  [/site|internet|web/, 'autre_site'],
]

function lireDate(v: unknown): string | null {
  if (v instanceof Date && !Number.isNaN(v.getTime())) return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, '0')}-${String(v.getDate()).padStart(2, '0')}`
  const s = String(v ?? '').trim()
  let m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/)
  if (m) return `${m[3]}-${m[2]!.padStart(2, '0')}-${m[1]!.padStart(2, '0')}`
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null
}

/** « Rue de la Montagne 88 bte 2, 6000 Charleroi » → adresse découpée (au mieux). */
export function decouperAdresse(texte: string): Adresse | null {
  const t = texte.replace(/\s+/g, ' ').trim()
  if (!t) return null
  const m = t.match(/^(.*?)[\s,]+(\d{1,4}(?:\s?[a-zA-Z](?![a-zA-Zà-ÿ]))?)(?:\s*(?:bte|boîte|boite|bus|b\.)\s*(\w+))?\s*,?\s*(?:(\d{4})\s+)?([^\d,]*)$/i)
  if (!m) return { rue: t, numero: '', boite: '', cp: '', ville: '' }
  const cp = m[4] ?? ''
  const ville = (m[5] ?? '').trim()
  return { rue: m[1]!.replace(/,$/, '').trim(), numero: m[2]!.replace(/\s/g, ''), boite: m[3] ?? '', cp: cp || (ville && cpPourLocalite(ville)) || '', ville: ville || (cp && localitesPourCp(cp).length === 1 ? localitesPourCp(cp)[0]! : '') }
}

function lireCivilite(s: string): Civilite {
  const k = cle(s)
  if (/^(m et mme|monsieur et madame|mr et mme)/.test(k)) return 'M. et Mme'
  if (/^(mme|madame|mlle|mademoiselle|mevrouw|mevr|mrs|ms)/.test(k)) return 'Mme'
  if (/^(m|mr|monsieur|meneer|dhr)$/.test(k)) return 'M.'
  return ''
}

export interface LigneImportee {
  /** Numéro de ligne dans le fichier (1 = en-têtes). */
  ligne: number
  contact: Pick<Contact, 'civilite' | 'prenom' | 'nom' | 'societe' | 'telephones' | 'emails' | 'adresse' | 'dateNaissance' | 'statuts' | 'source' | 'notes'>
  /** Fiche existante probablement identique (même téléphone, email, nom…). */
  doublonDe: string | null
  /** Ligne identique plus haut dans le même fichier. */
  doublonLigne: number | null
}

/** Transforme les lignes du fichier en fiches, et repère les doublons (avec la base et dans le fichier). */
export function preparerImport(lignes: unknown[][], colonnes: CodeChamp[], existants: { id: string; empreinte: Empreinte }[]): { lignes: LigneImportee[]; vides: number } {
  const resultat: LigneImportee[] = []
  const deja: { ligne: number; empreinte: Empreinte }[] = []
  let vides = 0
  lignes.forEach((brute, i) => {
    const v = (code: CodeChamp) => {
      const idx = colonnes.indexOf(code)
      const x = idx >= 0 ? brute[idx] : undefined
      return x instanceof Date ? x : String(x ?? '').trim()
    }
    const s = (code: CodeChamp) => String(v(code) instanceof Date ? '' : v(code))
    let prenom = s('prenom')
    let nom = s('nom')
    let civilite = lireCivilite(s('civilite'))
    if (!prenom && !nom && s('nomComplet')) {
      const complet = s('nomComplet').replace(/^(m\.|mr|mme|madame|monsieur)\s+/i, (x) => {
        civilite = civilite || lireCivilite(x)
        return ''
      })
      nom = complet
    }
    // « 0472/18.90.33 » est un seul numéro ; « 0472 18 90 33 / 071 45 67 89 » en contient deux.
    const telephones = [s('telephone'), s('telephone2')]
      .flatMap((x) => (normaliserTelephone(x) ? [x] : x.split(/[/;]| ou /)))
      .map((x) => x.trim())
      .filter(Boolean)
      .map((x) => ({ numero: normaliserTelephone(x) ? formaterTelephone(x) : x }))
    const emails = s('email')
      .split(/[;, ]+/)
      .map((e) => e.trim().toLowerCase())
      .filter((e) => e.includes('@'))
    const adresse =
      s('rue') || s('cp') || s('ville')
        ? { rue: s('rue'), numero: s('numero'), boite: s('boite'), cp: s('cp') || cpPourLocalite(s('ville')) || '', ville: s('ville') || (localitesPourCp(s('cp')).length === 1 ? localitesPourCp(s('cp'))[0]! : '') }
        : decouperAdresse(s('adresseComplete'))
    const statutTexte = normaliserTexte(s('statut'))
    const statut = STATUTS.find(([r]) => r.test(statutTexte))?.[1]
    const sourceTexte = normaliserTexte(s('source'))
    const contact: LigneImportee['contact'] = {
      civilite,
      prenom,
      nom,
      societe: s('societe'),
      telephones,
      emails,
      adresse,
      dateNaissance: lireDate(v('dateNaissance')),
      statuts: statut ? [statut] : [],
      source: (sourceTexte && SOURCES.find(([r]) => r.test(sourceTexte))?.[1]) || null,
      notes: s('notes'),
    }
    if (!prenom && !nom && !contact.societe && !telephones.length && !emails.length && !adresse) {
      vides++
      return
    }
    const e = empreinte(contact)
    const fort = (r: ReturnType<typeof comparer>) => r.includes('telephone') || r.includes('email') || (r.includes('nom') && r.length > 1)
    const doublonDe = existants.find((x) => fort(comparer(e, x.empreinte)))?.id ?? null
    const doublonLigne = deja.find((x) => fort(comparer(e, x.empreinte)))?.ligne ?? null
    deja.push({ ligne: i + 2, empreinte: e })
    resultat.push({ ligne: i + 2, contact, doublonDe, doublonLigne })
  })
  return { lignes: resultat, vides }
}

// ─── Export ──────────────────────────────────────────────────────────────────
/** Une cellule CSV (Excel belge : séparateur « ; »). */
function cellule(v: string | number | null | undefined): string {
  const s = v == null ? '' : String(v)
  return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function versCsv(lignes: (string | number | null | undefined)[][]): string {
  return '﻿' + lignes.map((l) => l.map(cellule).join(';')).join('\r\n') + '\r\n'
}
