import type { CategoriePiste, PointPrix } from './prospection'
import { baisseRecente } from './prospection'

/** Situation de l'appel : elle détermine l'argumentaire proposé pendant la session d'appels. */
export type CasArgumentaire =
  | 'affiche'
  | 'annonce_en_ligne'
  | 'baisse_prix'
  | 'annonce_retiree'
  | 'autre_agence'
  | 'maison_vide'
  | 'recommandation'
  | 'ancien_client'
  | 'achat_direct'
  | 'achat_maison_vide'
  | 'succession'
  | 'general'

export interface Objection {
  objection: string
  reponse: string
}

export interface ContenuArgumentaire {
  /** Première phrase à dire (accroche). */
  accroche: string
  /** Points à aborder, dans l'ordre. */
  points: string[]
  objections: Objection[]
}

export interface Argumentaire extends ContenuArgumentaire {
  cas: CasArgumentaire
  titre: string
}

const VENDRE_SEUL: Objection = {
  objection: 'Je vends seul, je n’ai pas besoin d’agence.',
  reponse:
    'C’est tout à fait possible, et je respecte ce choix. Beaucoup de vendeurs nous appellent après quelques semaines pour les visites, le filtrage des acheteurs non financés et les documents (PEB, électricité, urbanisme). Je vous propose simplement une estimation gratuite : vous saurez si votre prix est le bon, sans engagement.',
}
const TROP_CHER: Objection = {
  objection: 'Les agences prennent trop cher.',
  reponse:
    'Je comprends. Notre commission est payée par un meilleur prix de vente et un délai plus court : acheteurs déjà financés, négociation, compromis sans erreur. Je peux vous montrer les prix obtenus récemment dans votre quartier.',
}
const PAS_PRESSE: Objection = {
  objection: 'Je ne suis pas pressé, on verra plus tard.',
  reponse: 'Aucun souci. Quand pensez-vous y réfléchir ? Je note la date et je vous rappelle à ce moment-là, sans vous déranger avant.',
}
const DEJA_AGENCE: Objection = {
  objection: 'J’ai déjà une agence.',
  reponse:
    'Très bien. Jusqu’à quand court votre mandat ? Si le bien n’est pas vendu à cette date, je serais heureux de vous présenter notre façon de travailler. (Notez la fin du mandat en date clé.)',
}
const PRIX_TROP_BAS: Objection = {
  objection: 'Vous allez me proposer un prix trop bas.',
  reponse:
    'Je comprends la crainte. Mon prix tient compte des travaux à faire, que je prends entièrement à ma charge : vous n’avez ni frais d’agence, ni visites, ni réparations, ni risque que l’acheteur n’obtienne pas son crédit. Je vous montre le détail de mon calcul, vous comparez en toute liberté.',
}
const ATTENDRE_ACHETEUR: Objection = {
  objection: 'Je préfère attendre un acheteur qui paiera plus.',
  reponse:
    'C’est possible, et c’est votre choix. Pendant ce temps, le bien coûte (précompte, assurance, énergie, taxe sur les immeubles inoccupés) et se dégrade. Je peux vous laisser une offre écrite valable quelques jours : vous gardez une solution sûre en main.',
}
const DEJA_AGENCE_ACHAT: Objection = {
  objection: 'Le bien est déjà en vente chez une agence.',
  reponse: 'Pas de souci : je peux faire une offre par l’agence. Jusqu’à quand court votre mandat ? Si rien ne s’est fait d’ici là, je vous rappelle. (Notez la fin du mandat en date clé.)',
}
const PAS_INTERESSE: Objection = {
  objection: 'Pas intéressé.',
  reponse: 'Je comprends. Puis-je vous laisser mes coordonnées par SMS, au cas où votre situation change ? Et connaissez-vous quelqu’un autour de vous qui pense à vendre ?',
}

export const ARGUMENTAIRES_DEFAUT: Record<CasArgumentaire, Argumentaire> = {
  affiche: {
    cas: 'affiche',
    titre: 'Affiche de particulier',
    accroche: 'Bonjour, je suis [prénom] de l’agence [agence]. Je passe régulièrement dans votre rue et j’ai vu votre affiche « à vendre ».',
    points: [
      'Le bien est-il toujours disponible ?',
      'Depuis quand est-il en vente ? Combien de visites avez-vous eu ?',
      'Avez-vous déjà le PEB et le contrôle électrique ?',
      'Proposer une estimation gratuite, sans engagement.',
    ],
    objections: [VENDRE_SEUL, TROP_CHER, PAS_PRESSE],
  },
  annonce_en_ligne: {
    cas: 'annonce_en_ligne',
    titre: 'Annonce de particulier en ligne',
    accroche: 'Bonjour, je suis [prénom] de l’agence [agence]. J’ai vu votre annonce en ligne et je travaille avec des acheteurs qui cherchent dans votre secteur.',
    points: [
      'Le bien est-il toujours disponible ?',
      'Combien de contacts sérieux l’annonce vous a-t-elle apportés ?',
      'Les acheteurs qui appellent ont-ils déjà leur financement ?',
      'Proposer une estimation gratuite et un avis sur l’annonce (photos, prix).',
    ],
    objections: [VENDRE_SEUL, TROP_CHER, PAS_PRESSE],
  },
  baisse_prix: {
    cas: 'baisse_prix',
    titre: 'Annonce en baisse de prix',
    accroche: 'Bonjour, je suis [prénom] de l’agence [agence]. J’ai remarqué que vous avez ajusté le prix de votre bien.',
    points: [
      'Comment se passent les visites ? Qu’en disent les acheteurs ?',
      'La baisse a-t-elle apporté plus de contacts ?',
      'Une baisse de prix sans changer la présentation (photos, texte) donne souvent peu de résultats.',
      'Proposer une analyse gratuite : prix du marché, présentation, acheteurs actifs.',
    ],
    objections: [VENDRE_SEUL, TROP_CHER, PAS_PRESSE],
  },
  annonce_retiree: {
    cas: 'annonce_retiree',
    titre: 'Annonce retirée ou affiche disparue',
    accroche: 'Bonjour, je suis [prénom] de l’agence [agence]. Votre annonce n’est plus en ligne : votre bien est-il vendu ?',
    points: [
      'Si vendu : féliciter, demander si un autre projet suit (achat, location).',
      'Sinon : pourquoi l’avoir retirée ? Fatigue des visites, pas d’acheteur sérieux ?',
      'Proposer de reprendre la vente avec un accompagnement complet.',
    ],
    objections: [PAS_PRESSE, TROP_CHER, PAS_INTERESSE],
  },
  autre_agence: {
    cas: 'autre_agence',
    titre: 'Bien chez une autre agence',
    accroche: 'Bonjour, je suis [prénom] de l’agence [agence]. Je sais que votre bien est actuellement proposé par une agence ; je ne veux pas interférer.',
    points: [
      'Êtes-vous satisfait du suivi (visites, retours) ?',
      'Jusqu’à quand court le mandat ? → noter la date clé « Fin du mandat ».',
      'Laisser ses coordonnées pour la suite.',
    ],
    objections: [DEJA_AGENCE, PAS_INTERESSE],
  },
  maison_vide: {
    cas: 'maison_vide',
    titre: 'Maison vide',
    accroche: 'Bonjour, je suis [prénom] de l’agence [agence]. Je vous appelle au sujet de votre maison [adresse], qui semble inoccupée.',
    points: [
      'Rester délicat : succession, maison de repos, séparation sont fréquents.',
      'Avez-vous un projet pour ce bien : vendre, louer, rénover ?',
      'Une maison vide coûte (assurance, précompte, taxe sur les immeubles inoccupés) et se dégrade.',
      'Proposer une estimation gratuite ou une mise en location.',
    ],
    objections: [PAS_PRESSE, PAS_INTERESSE, TROP_CHER],
  },
  recommandation: {
    cas: 'recommandation',
    titre: 'Recommandation',
    accroche: 'Bonjour, je suis [prénom] de l’agence [agence]. [Nom de la personne] m’a conseillé de vous appeler : il paraît que vous pensez à vendre ?',
    points: [
      'Rappeler le lien avec la personne qui recommande (confiance).',
      'Où en est le projet ? Quel délai ?',
      'Proposer un rendez-vous d’estimation à domicile.',
    ],
    objections: [PAS_PRESSE, TROP_CHER],
  },
  ancien_client: {
    cas: 'ancien_client',
    titre: 'Ancien client',
    accroche: 'Bonjour, c’est [prénom] de l’agence [agence]. Je prends simplement de vos nouvelles : tout se passe bien dans la maison ?',
    points: [
      'Écouter : travaux, famille, projets.',
      'Un nouveau projet (vendre, acheter, investir) dans les prochains mois ?',
      'Demander une recommandation : quelqu’un autour de vous pense à vendre ?',
    ],
    objections: [PAS_INTERESSE],
  },
  achat_direct: {
    cas: 'achat_direct',
    titre: 'Achat direct (marchand de biens)',
    accroche: 'Bonjour, je m’appelle [prénom], [agence]. J’achète des maisons dans la région pour les rénover, et votre bien [adresse] m’intéresse.',
    points: [
      'Le bien est-il toujours disponible ? Depuis quand est-il en vente ?',
      'Quel est son état : toiture, électricité, chauffage, humidité ? Y a-t-il des travaux à prévoir ?',
      'Ce que j’apporte : achat en direct, sans commission, sans visites à répétition, dans l’état, avec un délai court jusqu’à l’acte.',
      'Proposer une visite rapide, puis une offre écrite chiffrée dans les jours qui suivent.',
    ],
    objections: [PRIX_TROP_BAS, ATTENDRE_ACHETEUR, DEJA_AGENCE_ACHAT, PAS_PRESSE],
  },
  achat_maison_vide: {
    cas: 'achat_maison_vide',
    titre: 'Maison vide : proposition d’achat',
    accroche: 'Bonjour, je m’appelle [prénom], [agence]. Je vous appelle au sujet de votre maison [adresse], qui semble inoccupée : j’achète des maisons à rénover dans le quartier.',
    points: [
      'Rester délicat : succession, maison de repos, séparation sont fréquents.',
      'Avez-vous un projet pour ce bien : vendre, louer, rénover ?',
      'Une maison vide coûte (assurance, précompte, taxe sur les immeubles inoccupés) et se dégrade chaque hiver.',
      'Proposer de racheter en l’état, sans travaux ni visites, avec un délai adapté (succession, déménagement).',
    ],
    objections: [PRIX_TROP_BAS, ATTENDRE_ACHETEUR, PAS_PRESSE, PAS_INTERESSE],
  },
  succession: {
    cas: 'succession',
    titre: 'Succession',
    accroche: 'Bonjour, je m’appelle [prénom], [agence]. Je me permets de vous contacter au sujet du bien [adresse]. Je sais que ce n’est sans doute pas un moment facile.',
    points: [
      'Présenter ses condoléances si c’est le cas, sans insister.',
      'Les héritiers sont-ils d’accord pour vendre ? Qui s’occupe du dossier (notaire) ?',
      'Délai : la déclaration de succession et ses droits à payer, souvent dans les mois qui viennent.',
      'Proposer un rachat en l’état, vidage compris si besoin, au rythme des héritiers.',
    ],
    objections: [PAS_PRESSE, PRIX_TROP_BAS, PAS_INTERESSE],
  },
  general: {
    cas: 'general',
    titre: 'Appel de suivi',
    accroche: 'Bonjour, c’est [prénom] de l’agence [agence]. Je vous rappelle comme convenu.',
    points: ['Reprendre là où l’échange précédent s’est arrêté (voir l’historique).', 'Où en est votre projet ?', 'Fixer la prochaine étape : rendez-vous, envoi d’informations, date de rappel.'],
    objections: [PAS_PRESSE, PAS_INTERESSE],
  },
}

export const ORDRE_CAS: CasArgumentaire[] = [
  'affiche',
  'annonce_en_ligne',
  'baisse_prix',
  'annonce_retiree',
  'autre_agence',
  'maison_vide',
  'recommandation',
  'ancien_client',
  'achat_direct',
  'achat_maison_vide',
  'succession',
  'general',
]

export interface SituationAppel {
  categorie: CategoriePiste | 'portefeuille'
  /** Origine de la piste ou du contact. */
  source?: string | null
  historiquePrix?: PointPrix[]
  /** Alerte de la veille (« Annonce retirée », « Prix baissé… »). */
  alerte?: string | null
  statutsContact?: string[]
  /** Objectif de la piste : mandat (par défaut) ou achat par l'agence. */
  objectif?: 'mandat' | 'achat'
}

/** Argumentaire le plus adapté à la situation (le plus urgent d'abord : retrait, baisse de prix…). */
export function casPour(s: SituationAppel, maintenant: Date): CasArgumentaire {
  const alerte = s.alerte?.toLowerCase() ?? ''
  if (s.objectif === 'achat' && s.categorie !== 'portefeuille') {
    if (s.source === 'succession' || s.source === 'notaire') return 'succession'
    return s.categorie === 'maison_vide' ? 'achat_maison_vide' : 'achat_direct'
  }
  if (s.source === 'succession') return 'succession'
  if (/retir|dispar/.test(alerte)) return 'annonce_retiree'
  if (/agence/.test(alerte) || s.source === 'autre_agence') return 'autre_agence'
  if (/baiss/.test(alerte) || (s.categorie === 'annonce' && baisseRecente(s.historiquePrix, maintenant, 60))) return 'baisse_prix'
  if (s.categorie === 'maison_vide') return 'maison_vide'
  if (s.categorie === 'annonce') return s.source === 'affiche' || s.source === 'reperage' ? 'affiche' : 'annonce_en_ligne'
  if (s.source === 'recommandation') return 'recommandation'
  if (s.source === 'ancien_client' || s.statutsContact?.includes('ancien_client')) return 'ancien_client'
  if (s.source === 'affiche') return 'affiche'
  if (s.source && ['immoweb', '2ememain', 'autre_site'].includes(s.source)) return 'annonce_en_ligne'
  return 'general'
}

/**
 * Remplace [prénom] et [agence] par le prénom de l'agent et le nom de l'agence (Paramètres).
 * Le reste des crochets ([adresse]…) est laissé à compléter à voix haute.
 */
export function personnaliserTexte(texte: string, p: { prenom?: string | null; agence?: string | null }): string {
  let t = texte
  if (p.prenom) t = t.replace(/\[prénom\]/gi, p.prenom)
  if (p.agence) t = t.replace(/\[agence\]/gi, p.agence)
  return t
}
