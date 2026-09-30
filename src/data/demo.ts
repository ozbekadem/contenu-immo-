import { ajouterJours } from '@/domain/dates'
import { db } from './db'
import { contacts, contactVide, type DonneesContact } from './repositories/contacts'

const CLE_INITIALISE = 'demo.initialise'

const iso = (d: Date) => d.toISOString()

/** 5 contacts fictifs de la région de Charleroi, dans des situations de suivi variées. */
function contactsDemo(maintenant = new Date()): DonneesContact[] {
  const j = (n: number) => iso(ajouterJours(maintenant, n))
  return [
    {
      ...contactVide(),
      civilite: 'Mme',
      prenom: 'Nathalie',
      nom: 'Lambert',
      telephones: [{ numero: '0475 21 43 65', libelle: 'GSM' }],
      emails: ['nathalie.lambert@exemple.be'],
      adresse: { rue: 'Rue de Marchienne', numero: '48', boite: '', cp: '6110', ville: 'Montigny-le-Tilleul' },
      dateNaissance: '1968-10-04',
      statuts: ['ancien_client', 'bailleur'],
      temperature: 'tiede',
      canalPrefere: 'appel',
      tags: ['investisseur'],
      notes: 'Propriétaire de 2 appartements à Marcinelle. Pense à vendre le plus petit en 2027.',
      dernierContactAt: j(-95),
    },
    {
      ...contactVide(),
      civilite: 'M.',
      prenom: 'Marc',
      nom: 'Dupont',
      telephones: [{ numero: '0472 18 90 33', libelle: 'GSM' }],
      adresse: { rue: 'Chaussée de Bruxelles', numero: '212', boite: '', cp: '6040', ville: 'Jumet' },
      statuts: ['prospect_vendeur'],
      temperature: 'chaud',
      canalPrefere: 'whatsapp',
      notes: 'Panneau « à vendre » vu le 12/09. Maison 3 façades, veut vendre avant l’hiver.',
      dernierContactAt: j(-6),
      prochaineRelanceAt: j(0),
      dernierResultatPositif: true,
    },
    {
      ...contactVide(),
      civilite: 'M. et Mme',
      prenom: 'Giuseppe et Anna',
      nom: 'Rossi',
      telephones: [
        { numero: '0486 55 12 09', libelle: 'GSM Giuseppe' },
        { numero: '071 45 67 89', libelle: 'Fixe' },
      ],
      adresse: { rue: 'Rue Puissant', numero: '7', boite: '', cp: '6060', ville: 'Gilly' },
      dateNaissance: '1955-03-17',
      statuts: ['prospect_vendeur'],
      temperature: 'froid',
      canalPrefere: 'appel',
      notes: 'Maison vide depuis le décès de la mère. Hésitent entre vendre et louer.',
      dernierContactAt: j(-40),
      prochaineRelanceAt: j(-3),
    },
    {
      ...contactVide(),
      civilite: 'Mme',
      prenom: 'Sophie',
      nom: 'Claes',
      telephones: [{ numero: '0499 73 28 14', libelle: 'GSM' }],
      emails: ['sophie.claes@exemple.be'],
      adresse: { rue: 'Avenue Paul Pastur', numero: '301', boite: '2', cp: '6032', ville: 'Mont-sur-Marchienne' },
      statuts: ['acheteur'],
      temperature: 'chaud',
      canalPrefere: 'sms',
      notes: 'Cherche maison 3 chambres avec jardin, budget 250 000 €, secteur Mont-sur-Marchienne / Nalinnes.',
      dernierContactAt: j(-2),
      prochaineRelanceAt: j(4),
      dernierResultatPositif: true,
    },
    {
      ...contactVide(),
      civilite: 'M.',
      prenom: 'Karim',
      nom: 'Benali',
      societe: 'Benali Rénovation SRL',
      telephones: [{ numero: '0478 64 20 51', libelle: 'GSM' }],
      emails: ['contact@benali-renovation.exemple.be'],
      adresse: { rue: 'Rue du Grand Central', numero: '15', boite: '', cp: '6000', ville: 'Charleroi' },
      statuts: ['partenaire'],
      temperature: null,
      canalPrefere: 'whatsapp',
      tags: ['entrepreneur'],
      notes: 'Entrepreneur pour devis de rénovation. Recommande des vendeurs de temps en temps.',
      dernierContactAt: j(-20),
      prochaineRelanceAt: j(45),
    },
  ]
}

/** Au tout premier lancement, installe les contacts de démonstration (une seule fois). */
export async function initialiserDemo(): Promise<void> {
  if (await db.meta.get(CLE_INITIALISE)) return
  await db.meta.put({ cle: CLE_INITIALISE, valeur: new Date().toISOString() })
  if ((await contacts.compter()) === 0) await contacts.creerPlusieurs(contactsDemo(), { demo: true })
}

export function supprimerDemo(): Promise<number> {
  return contacts.supprimerDemo()
}

const PRENOMS = ['Jean', 'Marie', 'Luc', 'Isabelle', 'Pierre', 'Nathalie', 'Michel', 'Sandrine', 'Philippe', 'Valérie', 'Olivier', 'Catherine', 'Mehmet', 'Fatima', 'Giuseppe', 'Chiara', 'Thomas', 'Julie', 'Kevin', 'Laura']
const NOMS = ['Dubois', 'Lambert', 'Martin', 'Dupont', 'Leroy', 'Renard', 'Maes', 'Jacobs', 'Willems', 'Claes', 'Goossens', 'Wouters', 'Rossi', 'Russo', 'Yilmaz', 'Benali', 'El Amrani', 'Hermans', 'Lemaire', 'Denis', 'Collard', 'Thiry', 'Gilson', 'Delhaye']
const VILLES: [string, string][] = [['6000', 'Charleroi'], ['6001', 'Marcinelle'], ['6010', 'Couillet'], ['6020', 'Dampremy'], ['6030', 'Marchienne-au-Pont'], ['6031', 'Monceau-sur-Sambre'], ['6032', 'Mont-sur-Marchienne'], ['6040', 'Jumet'], ['6041', 'Gosselies'], ['6042', 'Lodelinsart'], ['6043', 'Ransart'], ['6060', 'Gilly'], ['6061', 'Montignies-sur-Sambre'], ['6110', 'Montigny-le-Tilleul'], ['6200', 'Châtelet'], ['6280', 'Gerpinnes']]
const RUES = ['Rue de la Station', 'Rue du Calvaire', 'Chaussée de Bruxelles', 'Rue Puissant', 'Avenue Paul Pastur', 'Rue de Marchienne', 'Rue de l’Église', 'Rue des Écoles', 'Rue du Moulin', 'Route de Philippeville']

/** Génère des contacts de test (marqués démo) pour vérifier la fluidité avec de gros volumes. */
export async function genererContactsTest(nombre = 5000): Promise<void> {
  const maintenant = new Date()
  const hasard = (n: number) => Math.floor(Math.random() * n)
  const choisir = <T,>(t: T[]) => t[hasard(t.length)]!
  const liste: DonneesContact[] = []
  for (let i = 0; i < nombre; i++) {
    const [cp, ville] = choisir(VILLES)
    const relance = hasard(3) === 0 ? null : iso(ajouterJours(maintenant, hasard(200) - 60))
    liste.push({
      ...contactVide(),
      prenom: choisir(PRENOMS),
      nom: choisir(NOMS),
      telephones: [{ numero: `04${70 + hasard(30)}${String(hasard(1_000_000)).padStart(6, '0')}` }],
      adresse: { rue: choisir(RUES), numero: String(1 + hasard(250)), boite: '', cp, ville },
      statuts: [choisir(['prospect_vendeur', 'vendeur', 'acheteur', 'locataire', 'bailleur', 'ancien_client'] as const)],
      temperature: choisir(['chaud', 'tiede', 'froid', null] as const),
      dernierContactAt: iso(ajouterJours(maintenant, -hasard(300))),
      prochaineRelanceAt: relance,
    })
  }
  for (let i = 0; i < liste.length; i += 1000) {
    await contacts.creerPlusieurs(liste.slice(i, i + 1000), { demo: true, journaliser: false })
  }
}
