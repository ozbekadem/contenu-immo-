import type { Adresse, Civilite } from '@/data/types'
import { cpPourLocalite, localitesPourCp } from './adresse'
import { normaliserTelephone } from './telephone'

const sansAccents = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '')

/** Titre d'agenda d'une demande d'estimation : commence par « Estimation » (majuscules, accents, emoji indifférents). */
export function estEstimation(titre: string | null | undefined): boolean {
  const t = sansAccents(titre ?? '')
    .toLowerCase()
    .replace(/^[^a-z0-9]+/, '')
  return /^estimation\b/.test(t) || /^estim[.:\s-]/.test(t)
}

export interface Coordonnees {
  civilite: Civilite
  prenom: string
  nom: string
  telephones: string[]
  email: string | null
  adresse: Adresse | null
}

const TELEPHONE = /(?:\+|00)32[\s./-]?\(?0?\)?[1-9](?:[\s./-]?\d){7,8}|\b0[1-9](?:[\s./-]?\d){7,8}\b/g
const EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g
const TYPES_RUE = 'rue|avenue|av\\.|chauss[ée]e|ch[ée]e|place|boulevard|bd|chemin|route|all[ée]e|square|quai|clos|cit[ée]|dr[èe]ve|impasse|sentier|voie|r[ée]sidence|cour|parc|ruelle'
const ADRESSE = new RegExp(`\\b((?:${TYPES_RUE})\\s+[^,\\d\\n]{2,60}?)\\s*,?\\s*(\\d{1,4}\\s?[a-zA-Z]?)\\b(?:\\s*(?:bte|bo[iî]te|bt)\\.?\\s*(\\w{1,5}))?`, 'i')
const VILLE_APRES = /^\s*[,–—-]?\s*(\d{4})?\s*([A-Za-zÀ-ÿ'][A-Za-zÀ-ÿ' -]{1,40})?/
const CIVILITES: [RegExp, Civilite][] = [
  [/^(?:m\.?|mr\.?|monsieur)\s+et\s+(?:mme\.?|madame)\s+/i, 'M. et Mme'],
  [/^(?:mme\.?|madame|mlle\.?|mademoiselle)\s+/i, 'Mme'],
  [/^(?:m\.|mr\.?|monsieur)\s+/i, 'M.'],
]

function chercherAdresse(texte: string): { adresse: Adresse; morceau: string } | null {
  const m = ADRESSE.exec(texte)
  if (!m) return null
  let morceau = m[0]
  const rue = m[1]!.trim().replace(/\s+/g, ' ')
  const suite = texte.slice(m.index + m[0].length)
  const v = VILLE_APRES.exec(suite)
  let cp = v?.[1] ?? ''
  let ville = ''
  const candidat = v?.[2]?.trim().split(/\s+(?=[-–—])|\s{2,}/)[0]?.trim() ?? ''
  // La localité n'est retenue que si elle est connue (ou si un code postal la précède).
  const connue = (nom: string) => !!cpPourLocalite(nom)
  if (candidat) {
    const mots = candidat.split(/\s+/)
    for (let n = Math.min(mots.length, 4); n >= 1; n--) {
      const essai = mots.slice(0, n).join(' ')
      if (connue(essai) || (cp && n === 1)) {
        ville = essai
        break
      }
    }
  }
  if (cp && !ville && localitesPourCp(cp).length === 1) ville = localitesPourCp(cp)[0]!
  if (!cp && ville) cp = cpPourLocalite(ville) ?? ''
  if (v && (cp || ville)) morceau += suite.slice(0, v[0].indexOf(ville || cp) + (ville || cp).length)
  return { adresse: { rue: rue.charAt(0).toUpperCase() + rue.slice(1), numero: m[2]!.replace(/\s/g, ''), boite: m[3] ?? '', cp, ville }, morceau }
}

function decouperNom(texte: string): Pick<Coordonnees, 'civilite' | 'prenom' | 'nom'> {
  let reste = texte.trim()
  let civilite: Civilite = ''
  for (const [motif, c] of CIVILITES) {
    if (motif.test(reste)) {
      civilite = c
      reste = reste.replace(motif, '')
      break
    }
  }
  const mots = reste.split(/\s+/).filter(Boolean)
  if (mots.length === 0) return { civilite, prenom: '', nom: '' }
  if (mots.length === 1) return { civilite, prenom: '', nom: mots[0]! }
  // « DUPONT Jean » : le mot en majuscules est le nom de famille
  const majuscules = mots.findIndex((m) => m.length > 1 && m === m.toUpperCase() && /[A-Z]/.test(m))
  if (majuscules >= 0) {
    const nom = mots[majuscules]!
    return { civilite, nom: nom.charAt(0) + nom.slice(1).toLowerCase(), prenom: mots.filter((_, i) => i !== majuscules).join(' ') }
  }
  if (civilite && civilite !== 'M. et Mme') return { civilite, prenom: mots.slice(0, -1).join(' '), nom: mots[mots.length - 1]! }
  // « Dupont Jean » ou « Jean Dupont » ? Impossible à savoir : on garde le tout, vous corrigez si besoin.
  return { civilite, prenom: '', nom: mots.join(' ') }
}

/**
 * Coordonnées du client lues dans le titre et la description du rendez-vous
 * (« Estimation – M. Lambert 0475 12 34 56 – Rue de Gosselies 12, Jumet »).
 * Lecture « au mieux » : tout est proposé, rien n'est imposé (vous corrigez avant d'enregistrer).
 */
export function extraireCoordonnees(titre: string, description = '', lieu = ''): Coordonnees {
  const tout = [titre, description, lieu].join('\n')
  const telephones = [...new Set((tout.match(TELEPHONE) ?? []).map((t) => normaliserTelephone(t)).filter((t): t is string => !!t))]
  const email = tout.match(EMAIL)?.[0]?.toLowerCase() ?? null
  const trouvee = chercherAdresse(lieu) ?? chercherAdresse(titre) ?? chercherAdresse(description)

  const nettoyer = (t: string) => {
    let r = t.replace(TELEPHONE, ' ').replace(EMAIL, ' ')
    if (trouvee) r = r.replace(trouvee.morceau, ' ')
    return r.replace(/\b(?:t[ée]l(?:[ée]phone)?|gsm|mail|e-mail|adresse)\s*[:.]?/gi, ' ')
  }
  const segments = (t: string) =>
    nettoyer(t)
      .split(/[–—|,;:/\n()]|\s-\s/)
      .map((s) => s.replace(/\s+/g, ' ').trim())
      .filter((s) => /[A-Za-zÀ-ÿ]{2}/.test(s))
  const titreSans = titre.replace(/^[^A-Za-zÀ-ÿ0-9]*estim(?:ation)?\.?\s*(?:de|pour|chez)?\s*/i, '')
  const nom = segments(titreSans)[0] ?? segments(description)[0] ?? ''
  return { ...decouperNom(nom), telephones, email, adresse: trouvee?.adresse ?? null }
}
