/** Canaux des messages écrits (l'appel n'a pas de modèle). */
export type CanalMessage = 'sms' | 'whatsapp' | 'email'

export const CANAUX_MESSAGE: { code: CanalMessage; libelle: string }[] = [
  { code: 'sms', libelle: 'SMS' },
  { code: 'whatsapp', libelle: 'WhatsApp' },
  { code: 'email', libelle: 'Email' },
]

// ─── Consentements (RGPD) ────────────────────────────────────────────────────
export type EtatConsentement = 'accorde' | 'refuse' | 'retire'

export interface Consentement {
  etat: EtatConsentement
  /** « AAAA-MM-JJ » */
  date: string
  /** Comment l'accord a été obtenu ou retiré (« accord oral lors de l'appel », « a répondu STOP »…). */
  preuve: string
  /** « AAAA-MM-JJ », facultatif. */
  expire?: string | null
}

export type Consentements = Partial<Record<CanalMessage, Consentement>>

export const LIBELLE_CONSENTEMENT: Record<EtatConsentement, string> = {
  accorde: 'Accordé',
  refuse: 'Refusé',
  retire: 'Retiré',
}

// ─── Modèles de messages ─────────────────────────────────────────────────────
export interface ContenuModele {
  nom: string
  canal: CanalMessage
  /** Objet (email uniquement). */
  sujet: string
  texte: string
}

export const VARIABLES: { code: string; libelle: string }[] = [
  { code: 'bonjour', libelle: 'Bonjour + nom' },
  { code: 'prenom', libelle: 'Prénom' },
  { code: 'nom', libelle: 'Nom' },
  { code: 'ville', libelle: 'Ville' },
  { code: 'agent', libelle: 'Votre prénom' },
  { code: 'agence', libelle: 'Agence' },
]

/** Modèles fournis au départ (on peut les dupliquer pour les adapter). */
export const MODELES_DEFAUT: (ContenuModele & { id: string })[] = [
  {
    id: 'defaut-apres-visite',
    nom: 'Merci après la visite',
    canal: 'sms',
    sujet: '',
    texte: '{{bonjour}}, merci pour votre accueil aujourd’hui. Je reviens vers vous très vite avec mon estimation. Bonne journée !\n{{agent}}',
  },
  {
    id: 'defaut-estimation',
    nom: 'Proposition d’estimation gratuite',
    canal: 'sms',
    sujet: '',
    texte: '{{bonjour}}, suite à notre échange, je vous propose une estimation gratuite et sans engagement de votre bien. Quand seriez-vous disponible ?\n{{agent}}\n{{agence}}',
  },
  {
    id: 'defaut-nouvelles',
    nom: 'Prendre des nouvelles (ancien client)',
    canal: 'whatsapp',
    sujet: '',
    texte: '{{bonjour}}, je prenais simplement de vos nouvelles. Tout se passe bien ? Si quelqu’un autour de vous a un projet immobilier, je serai ravi d’aider.\n{{agent}}',
  },
  {
    id: 'defaut-marche',
    nom: 'Point sur le marché local',
    canal: 'email',
    sujet: 'Le marché immobilier près de chez vous',
    texte:
      '{{bonjour}},\n\nLes prix de vente dans votre quartier continuent d’évoluer. Si vous vous demandez ce que vaut votre bien aujourd’hui, je vous propose une estimation gratuite, sans engagement.\n\nBien à vous,\n{{agent}}\n{{agence}}',
  },
  {
    id: 'defaut-voeux',
    nom: 'Vœux de fin d’année',
    canal: 'email',
    sujet: 'Meilleurs vœux',
    texte: '{{bonjour}},\n\nToute l’équipe vous souhaite de belles fêtes de fin d’année et une excellente année à venir.\n\n{{agent}}\n{{agence}}',
  },
]

export interface ContexteMessage {
  civilite?: string
  prenom?: string
  nom?: string
  ville?: string
  agent?: string | null
  agence?: string | null
}

/** « Bonjour Marc », « Bonjour Madame Claes », ou « Bonjour » si on ne sait rien. */
export function salutation(c: ContexteMessage): string {
  if (c.prenom) return `Bonjour ${c.prenom}`
  const titre = c.civilite === 'Mme' ? 'Madame' : c.civilite === 'M.' ? 'Monsieur' : c.civilite === 'M. et Mme' ? 'Madame, Monsieur' : ''
  if (titre && c.nom) return `Bonjour ${titre} ${c.nom}`
  return 'Bonjour'
}

/**
 * Remplace les variables {{…}} par les informations du contact.
 * Une information absente est retirée proprement (« ({{agence}}) » vide disparaît) et signalée dans `manquantes`.
 */
export function rendre(texte: string, c: ContexteMessage): { texte: string; manquantes: string[] } {
  const valeurs: Record<string, string> = {
    bonjour: salutation(c),
    prenom: c.prenom ?? '',
    nom: c.nom ?? '',
    ville: c.ville ?? '',
    agent: c.agent ?? '',
    agence: c.agence ?? '',
  }
  const manquantes = new Set<string>()
  let r = texte.replace(/\{\{\s*(\w+)\s*\}\}/g, (tout, cle: string) => {
    if (!(cle in valeurs)) return tout
    if (!valeurs[cle]) manquantes.add(cle)
    return valeurs[cle]!
  })
  r = r
    .replace(/\(\s*\)/g, '')
    .replace(/[ \t]+([,.])/g, '$1') // (le français garde l'espace avant « ! ? ; : »)
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/ +\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n') // signature absente : pas de lignes vides en trop
    .trim()
  return { texte: r, manquantes: [...manquantes] }
}

// ─── Campagnes : règles RGPD ─────────────────────────────────────────────────
export const MENTION_DESINSCRIPTION: Record<CanalMessage, string> = {
  sms: 'Répondez STOP pour ne plus recevoir nos messages.',
  whatsapp: 'Répondez STOP pour ne plus recevoir nos messages.',
  email: 'Vous ne souhaitez plus recevoir nos messages ? Répondez simplement « STOP » à cet email.',
}

/** Toute campagne propose de se désinscrire : la mention est ajoutée si elle manque. */
export function avecDesinscription(texte: string, canal: CanalMessage): string {
  if (/\bstop\b|désinscri|desinscri|ne plus recevoir/i.test(texte)) return texte
  return `${texte.trimEnd()}${canal === 'email' ? '\n\n' : '\n'}${MENTION_DESINSCRIPTION[canal]}`
}

export type RaisonBlocage = 'opposition' | 'sans_coordonnees' | 'sans_consentement' | 'refuse' | 'retire' | 'expire'

export const LIBELLE_BLOCAGE: Record<RaisonBlocage, string> = {
  opposition: 'Ne veut plus être contacté',
  sans_coordonnees: 'Pas de numéro ou d’email',
  sans_consentement: 'Pas de consentement enregistré',
  refuse: 'Consentement refusé',
  retire: 'Consentement retiré',
  expire: 'Consentement expiré',
}

export interface ContactAContacter {
  nePasContacter: boolean
  aTelephone: boolean
  aEmail: boolean
  consentements?: Consentements
}

/**
 * Peut-on envoyer une campagne à ce contact sur ce canal ?
 * Une campagne exige un consentement accordé et valable pour le canal (règle validée pour l'agence).
 * Un message individuel, lui, n'est bloqué que par une opposition ou un refus : voir `avertissementIndividuel`.
 */
export function eligibleCampagne(c: ContactAContacter, canal: CanalMessage, aujourdhui: string): { ok: true } | { ok: false; raison: RaisonBlocage } {
  if (c.nePasContacter) return { ok: false, raison: 'opposition' }
  if (canal === 'email' ? !c.aEmail : !c.aTelephone) return { ok: false, raison: 'sans_coordonnees' }
  const consentement = c.consentements?.[canal]
  if (!consentement) return { ok: false, raison: 'sans_consentement' }
  if (consentement.etat !== 'accorde') return { ok: false, raison: consentement.etat }
  if (consentement.expire && consentement.expire < aujourdhui) return { ok: false, raison: 'expire' }
  return { ok: true }
}

/** Message individuel (modèle envoyé à une personne) : jamais bloqué, mais averti si le consentement manque ou a été retiré. */
export function avertissementIndividuel(c: ContactAContacter, canal: CanalMessage): string | null {
  if (c.nePasContacter) return 'Ce contact a demandé à ne plus être contacté.'
  const e = c.consentements?.[canal]?.etat
  if (e === 'refuse' || e === 'retire') return `Ce contact a ${e === 'refuse' ? 'refusé' : 'retiré son accord pour'} les messages par ${CANAUX_MESSAGE.find((x) => x.code === canal)!.libelle}.`
  return null
}
