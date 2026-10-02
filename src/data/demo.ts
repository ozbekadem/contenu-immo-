import { ajouterJours } from '@/domain/dates'
import { db } from './db'
import { contacts, contactVide, type DonneesContact } from './repositories/contacts'
import { campagnes } from './repositories/communication'
import { evenements, evenementVide } from './repositories/evenements'
import { interactions } from './repositories/interactions'
import { biens } from './repositories/biens'
import { photos } from './repositories/photos'
import { pistes } from './repositories/pistes'
import type { PhotoCompressee } from './repositories/photos'
import { piecesJointes } from './repositories/piecesJointes'

const CLE_INITIALISE = 'demo.initialise'
/** Deuxième série d'exemples (affiche, annonce Internet, contact à suivre), ajoutée le 30/09. */
const CLE_SERIE_2 = 'demo.serie2'
/** Troisième série : pistes de prospection (affiche, annonce, maisons vides), ajoutée à l'étape 5. */
const CLE_SERIE_3 = 'demo.serie3'
const CLE_SERIE_4 = 'demo.serie4'
const CLE_SERIE_5 = 'demo.serie5'
const CLE_SERIE_6 = 'demo.serie6'
const CLE_SERIE_7 = 'demo.serie7'
const CLE_SERIE_8 = 'demo.serie8'

const iso = (d: Date) => d.toISOString()

/** Contacts fictifs de la région de Charleroi, dans des situations de suivi variées. */
function contactsDemo(maintenant = new Date()): DonneesContact[] {
  const j = (n: number) => iso(ajouterJours(maintenant, n))
  return [
    {
      ...contactVide(),
      civilite: 'Mme',
      prenom: 'Nathalie',
      nom: 'Lambert',
      source: 'ancien_client',
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
      source: 'affiche',
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
      source: 'reperage',
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
      source: 'immoweb',
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
      source: 'autre',
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

/**
 * Exemples de prospection réalistes :
 * 1. une affiche « à vendre » collée sur une fenêtre (seul le numéro est connu) ;
 * 2. une annonce de particulier trouvée sur Internet (lien de l'annonce joint à la fiche) ;
 * 3. une propriétaire rencontrée par recommandation, à suivre sur plusieurs mois.
 */
function contactsDemoSerie2(maintenant = new Date()): { contact: DonneesContact; liens?: { url: string; titre: string; note: string }[] }[] {
  const j = (n: number) => iso(ajouterJours(maintenant, n))
  return [
    {
      contact: {
        ...contactVide(),
        telephones: [{ numero: '0477 31 52 86', libelle: 'Lu sur l’affiche' }],
        adresse: { rue: 'Rue de la Montagne', numero: '88', boite: '', cp: '6000', ville: 'Charleroi' },
        statuts: ['prospect_vendeur'],
        source: 'affiche',
        tags: ['affiche', 'particulier'],
        notes:
          'Affiche « À VENDRE – particulier » collée à la fenêtre du rez-de-chaussée. Maison 2 façades, ' +
          'probablement 3 chambres, châssis récents, pas de panneau d’agence. Numéro lu sur l’affiche ; ' +
          'nom du propriétaire encore inconnu. Premier appel à faire aujourd’hui.',
        prochaineRelanceAt: j(0),
      },
    },
    {
      contact: {
        ...contactVide(),
        civilite: 'M.',
        prenom: 'Jacques',
        nom: 'Hermans',
        telephones: [{ numero: '0468 12 77 40', libelle: 'GSM (annonce)' }],
        adresse: { rue: 'Rue Wilmet', numero: '23', boite: '', cp: '6041', ville: 'Gosselies' },
        statuts: ['prospect_vendeur'],
        source: '2ememain',
        temperature: 'tiede',
        tags: ['particulier', 'baisse de prix'],
        notes:
          'Vend lui-même sa maison sur 2ememain (3 chambres, jardin, garage). En ligne depuis 3 mois, ' +
          'prix baissé de 235 000 € à 219 000 €. Appelé : veut encore essayer seul jusqu’à fin octobre, ' +
          'd’accord pour qu’on le rappelle. Argument : estimation gratuite + photos professionnelles.',
        dernierContactAt: j(-18),
        prochaineRelanceAt: j(2),
      },
      liens: [
        {
          url: 'https://www.2ememain.be/v/immo/maisons-a-vendre/m0000000000-maison-3-ch-jardin-garage-gosselies',
          titre: 'Annonce 2ememain – Maison 3 ch. avec jardin – 219 000 €',
          note: 'Prix initial 235 000 € (juin), baissé à 219 000 € (septembre).',
        },
      ],
    },
    {
      contact: {
        ...contactVide(),
        civilite: 'Mme',
        prenom: 'Isabelle',
        nom: 'Renard',
        telephones: [{ numero: '0494 60 18 27', libelle: 'GSM' }],
        emails: ['isabelle.renard@exemple.be'],
        adresse: { rue: 'Avenue Meurée', numero: '54', boite: '', cp: '6001', ville: 'Marcinelle' },
        statuts: ['prospect_vendeur', 'bailleur'],
        source: 'recommandation',
        temperature: 'tiede',
        canalPrefere: 'whatsapp',
        tags: ['recommandée par Karim Benali'],
        notes:
          'Recommandée par Karim Benali (entrepreneur). Propriétaire d’un appartement 2 chambres loué ' +
          'à Marcinelle, bail jusqu’à fin mars. Souhaite vendre après le départ du locataire. ' +
          'Rappeler début janvier pour préparer l’estimation et la visite.',
        dernierContactAt: j(-5),
        prochaineRelanceAt: j(95),
      },
    },
  ]
}

async function creerSerie2(): Promise<void> {
  for (const { contact, liens } of contactsDemoSerie2()) {
    const fiche = await contacts.creer(contact, { demo: true })
    for (const lien of liens ?? []) await piecesJointes.ajouterLien('contacts', fiche.id, lien)
  }
}

/**
 * Au tout premier lancement, installe les contacts de démonstration (une seule fois).
 * Sur un appareil qui a déjà les premiers exemples, ajoute la deuxième série — sauf si
 * les données de démonstration ont été supprimées.
 */
export async function initialiserDemo(): Promise<void> {
  // Séries d'exemples ajoutées au fil des étapes (un appareil existant reçoit les nouvelles).
  const series: [string, () => Promise<void>][] = [
    [CLE_SERIE_2, creerSerie2],
    [CLE_SERIE_3, creerSerie3],
    [CLE_SERIE_4, creerSerie4],
    [CLE_SERIE_5, creerSerie5],
    [CLE_SERIE_6, creerSerie6],
    [CLE_SERIE_7, creerSerie7],
    [CLE_SERIE_8, creerSerie8],
  ]
  if (!(await db.meta.get(CLE_INITIALISE))) {
    const maintenant = new Date().toISOString()
    await db.meta.bulkPut([{ cle: CLE_INITIALISE, valeur: maintenant }, ...series.map(([cle]) => ({ cle, valeur: maintenant }))])
    if ((await contacts.compter()) === 0) {
      await contacts.creerPlusieurs(contactsDemo(), { demo: true })
      for (const [, creer] of series) await creer()
    }
    return
  }
  for (const [cle, creer] of series) {
    if (await db.meta.get(cle)) continue
    await db.meta.put({ cle, valeur: new Date().toISOString() })
    // Rien n'est ajouté si la démonstration a été supprimée.
    if ((await db.contacts.filter((c) => c._demo === true).count()) > 0) await creer()
  }
}

/** Quatrième série (étape 6) : un anniversaire aujourd'hui, une signature d'il y a 2 ans, un projet de vente qui mûrit. */
async function creerSerie4(): Promise<void> {
  const maintenant = new Date()
  const demo = await db.contacts.filter((c) => c._demo === true).toArray()
  const parNom = (n: string) => demo.find((c) => c.nom === n)
  const jour = (d: Date, annee: number) => `${annee}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const dupont = parNom('Dupont')
  if (dupont) await contacts.modifier(dupont.id, { dateNaissance: jour(maintenant, 1971) })
  const lambert = parNom('Lambert')
  if (lambert) {
    const signe = ajouterJours(maintenant, 6)
    signe.setFullYear(signe.getFullYear() - 2)
    await interactions.creer(
      {
        contactId: lambert.id,
        pisteId: null,
        type: 'rdv',
        resultat: 'mandat',
        commentaire: 'Mandat de vente signé pour l’appartement de la rue de Montigny.',
        date: signe.toISOString(),
        relanceAt: null,
        numero: null,
      },
      { demo: true },
    )
  }
  const claes = parNom('Claes')
  if (claes) {
    await contacts.modifier(claes.id, {
      datesCles: [{ id: crypto.randomUUID(), type: 'projet_vente', date: jour(ajouterJours(maintenant, 40), ajouterJours(maintenant, 40).getFullYear()), note: 'Revendra son appartement de Marcinelle' }],
    })
  }
}

/** Cinquième série (étape 8) : rendez-vous d'exemple dans l'agenda. */
async function creerSerie5(): Promise<void> {
  const demo = await db.contacts.filter((c) => c._demo === true).toArray()
  const lesPistes = await db.pistes.filter((p) => p._demo === true).toArray()
  const a = (jours: number, heure: number, minutes = 0) => {
    const d = ajouterJours(new Date(), jours)
    d.setHours(heure, minutes, 0, 0)
    return d
  }
  const rossi = demo.find((c) => c.nom === 'Rossi')
  const pisteRossi = lesPistes.find((p) => p.contactId === rossi?.id)
  if (rossi)
    await evenements.creer(
      { ...evenementVide(a(1, 10), 60), type: 'visite', contactId: rossi.id, pisteId: pisteRossi?.id ?? null, bienId: pisteRossi?.bienId ?? null, notes: 'Visite avec les deux enfants. Prévoir le dossier succession.' },
      { demo: true },
    )
  const dupont = demo.find((c) => c.nom === 'Dupont')
  if (dupont)
    await evenements.creer({ ...evenementVide(a(0, 17, 30), 60), type: 'estimation', contactId: dupont.id, lieu: 'Chez M. Dupont', notes: 'Estimation de l’appartement, apporter les ventes récentes du quartier.' }, { demo: true })
  const hermans = demo.find((c) => c.nom === 'Hermans')
  const pisteHermans = lesPistes.find((p) => p.contactId === hermans?.id)
  if (hermans)
    await evenements.creer(
      { ...evenementVide(a(3, 14), 90), type: 'rdv', contactId: hermans.id, pisteId: pisteHermans?.id ?? null, bienId: pisteHermans?.bienId ?? null, notes: 'Présenter l’analyse de prix (baisse sans résultat).' },
      { demo: true },
    )
}

/** Sixième série : une estimation notée par le secrétariat dans Google Agenda, « à encoder ». */
async function creerSerie6(): Promise<void> {
  const debut = ajouterJours(new Date(), 2)
  debut.setHours(11, 0, 0, 0)
  await evenements.creer(
    {
      ...evenementVide(debut, 60),
      type: 'estimation',
      titre: 'Estimation – Mme Peeters 0478 55 44 33 – Rue de la Station 5, Gosselies',
      notes: 'Appartement 2 chambres, veut vendre pour la fin de l’année. Rappeler après 17 h.',
      googleEventId: 'demo-secretariat-1',
      googleCalendrierId: 'demo-secretariat',
      aEncoder: true,
    },
    { demo: true },
  )
}

/** Septième série (étape 11) : consentements RGPD d'exemple, pour essayer une campagne. */
async function creerSerie7(): Promise<void> {
  const demo = await db.contacts.filter((c) => c._demo === true).toArray()
  const jour = ajouterJours(new Date(), -20).toISOString().slice(0, 10)
  const accord = (preuve: string) => ({ etat: 'accorde' as const, date: jour, preuve })
  const parNom = (n: string) => demo.find((c) => c.nom === n)
  const lambert = parNom('Lambert')
  if (lambert) await contacts.modifier(lambert.id, { consentements: { sms: accord('Accord oral lors de la signature'), email: accord('Formulaire de mandat') } })
  const dupont = parNom('Dupont')
  if (dupont) await contacts.modifier(dupont.id, { consentements: { sms: accord('Accord oral au téléphone'), whatsapp: accord('Accord oral au téléphone') } })
  const claes = parNom('Claes')
  if (claes) await contacts.modifier(claes.id, { consentements: { email: accord('Inscrite via le formulaire'), sms: { etat: 'retire', date: jour, preuve: 'A répondu STOP' } } })
}

/** Huitième série (étape 12) : un doublon (même numéro que Marc Dupont, encodé autrement) à fusionner. */
async function creerSerie8(): Promise<void> {
  await contacts.creer(
    {
      ...contactVide(),
      civilite: 'M.',
      nom: 'Dupond',
      telephones: [{ numero: '+32 472 18 90 33', libelle: 'GSM' }],
      emails: ['marc.dupont.gosselies@gmail.com'],
      notes: 'Encodé par la secrétaire après un appel entrant.',
      source: 'appel_entrant',
    },
    { demo: true },
  )
}

/** Photo d'illustration dessinée sur l'appareil (façade stylisée), pour la démonstration. */
async function photoIllustration(teinte: string, fenetresFermees: boolean): Promise<PhotoCompressee | null> {
  if (typeof document === 'undefined') return null
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext?.('2d')
  if (!ctx) return null
  canvas.width = 800
  canvas.height = 600
  const ciel = ctx.createLinearGradient(0, 0, 0, 600)
  ciel.addColorStop(0, '#9cc9f5')
  ciel.addColorStop(1, '#e8f2fb')
  ctx.fillStyle = ciel
  ctx.fillRect(0, 0, 800, 600)
  ctx.fillStyle = '#7a8b6f'
  ctx.fillRect(0, 500, 800, 100)
  ctx.fillStyle = teinte
  ctx.fillRect(170, 220, 460, 290)
  ctx.fillStyle = '#5b4a45'
  ctx.beginPath()
  ctx.moveTo(140, 230)
  ctx.lineTo(400, 90)
  ctx.lineTo(660, 230)
  ctx.closePath()
  ctx.fill()
  for (const [x, y] of [
    [220, 270],
    [480, 270],
    [220, 390],
  ]) {
    ctx.fillStyle = fenetresFermees ? '#6b6b6b' : '#cfe6f7'
    ctx.fillRect(x!, y!, 100, 80)
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 6
    ctx.strokeRect(x!, y!, 100, 80)
  }
  ctx.fillStyle = '#3b2f2b'
  ctx.fillRect(470, 380, 80, 130)
  const versBlob = (l: number, h: number) =>
    new Promise<Blob | null>((ok) => {
      if (l === 800) return canvas.toBlob(ok, 'image/jpeg', 0.8)
      const petit = document.createElement('canvas')
      petit.width = l
      petit.height = h
      petit.getContext('2d')!.drawImage(canvas, 0, 0, l, h)
      petit.toBlob(ok, 'image/jpeg', 0.7)
    })
  const [image, miniature] = await Promise.all([versBlob(800, 600), versBlob(400, 300)])
  return image && miniature ? { image, miniature, largeur: 800, hauteur: 600 } : null
}

/** Pistes de démonstration reliées aux contacts fictifs. */
async function creerSerie3(): Promise<void> {
  const maintenant = new Date()
  const j = (n: number) => ajouterJours(maintenant, n).toISOString()
  const demo = await db.contacts.filter((c) => c._demo === true).toArray()
  const parNom = (n: string) => demo.find((c) => c.nom === n)
  const montagne = demo.find((c) => !c.nom && c.adresse?.rue === 'Rue de la Montagne')
  const hermans = parNom('Hermans')
  const rossi = parNom('Rossi')
  const renard = parNom('Renard')
  const avecPhoto = async (teinte: string, ferme: boolean) => {
    const p = await photoIllustration(teinte, ferme)
    return p ? [p] : []
  }

  if (montagne) {
    await pistes.creerDepuisTerrain(
      {
        categorie: 'annonce',
        source: 'affiche',
        telephone: '',
        nomProprietaire: '',
        adresse: montagne.adresse,
        position: { lat: 50.40797, lng: 4.44006, precision: 6 },
        adresseAChercher: false,
        typeBien: 'maison',
        prix: null,
        sourceUrl: null,
        indices: [],
        notes: 'Affiche « À VENDRE – particulier » collée à la fenêtre du rez. Maison 2 façades, châssis récents.',
        photos: await avecPhoto('#d9b38c', false),
        contactExistantId: montagne.id,
      },
      { demo: true, maintenant },
    )
  }

  if (hermans) {
    const p = await pistes.creerDepuisTerrain(
      {
        categorie: 'annonce',
        source: '2ememain',
        telephone: '',
        nomProprietaire: '',
        adresse: hermans.adresse,
        position: { lat: 50.4602, lng: 4.4331, precision: 10 },
        adresseAChercher: false,
        typeBien: 'maison',
        prix: 235000,
        sourceUrl: 'https://www.2ememain.be/v/immo/maisons-a-vendre/m0000000000-maison-3-ch-jardin-garage-gosselies',
        indices: [],
        notes: 'Vend seul depuis juin. Estimation gratuite + photos pro comme arguments.',
        photos: await avecPhoto('#c9c2b4', false),
        contactExistantId: hermans.id,
      },
      { demo: true, maintenant },
    )
    await pistes.modifier(p.id, {
      historiquePrix: [
        { date: j(-95), prix: 235000 },
        { date: j(-12), prix: 219000 },
      ],
      prix: 219000,
      enVenteDepuis: j(-95),
      veilleProchaine: j(0),
      statut: 'en_cours',
      dernierContactAt: j(-18),
      temperature: 'tiede',
      prochaineRelanceAt: j(2),
    })
  }

  if (rossi) {
    const p = await pistes.creerDepuisTerrain(
      {
        categorie: 'maison_vide',
        source: 'reperage',
        telephone: '',
        nomProprietaire: '',
        adresse: rossi.adresse,
        position: { lat: 50.4205, lng: 4.4868, precision: 8 },
        adresseAChercher: false,
        typeBien: 'maison',
        prix: null,
        sourceUrl: null,
        indices: ['boite_pleine', 'volets_fermes', 'jardin', 'lumiere'],
        notes: 'Maison de la mère décédée. Les enfants hésitent entre vendre et louer.',
        photos: await avecPhoto('#bfb3a3', true),
        contactExistantId: rossi.id,
      },
      { demo: true, maintenant },
    )
    await pistes.modifier(p.id, { statut: 'en_cours', dernierContactAt: j(-40), prochaineRelanceAt: j(-3), temperature: 'froid' })
  }

  // Maison vide dont le propriétaire est encore inconnu
  await pistes.creerDepuisTerrain(
    {
      categorie: 'maison_vide',
      source: 'reperage',
      telephone: '',
      nomProprietaire: '',
      adresse: { rue: 'Rue du Moulin', numero: '14', boite: '', cp: '6061', ville: 'Montignies-sur-Sambre' },
      position: { lat: 50.4072, lng: 4.4812, precision: 7 },
      adresseAChercher: false,
      typeBien: 'maison',
      prix: null,
      sourceUrl: null,
      indices: ['boite_pleine', 'volets_fermes', 'vitres', 'facade', 'compteurs'],
      notes: 'Voisine (n° 16) : vide depuis 2 ans, propriétaire parti en maison de repos. Demander l’extrait cadastral.',
      photos: await avecPhoto('#a89f94', true),
    },
    { demo: true, maintenant },
  )

  if (renard) {
    await contacts.modifier(renard.id, {
      datesCles: [{ id: crypto.randomUUID(), type: 'fin_bail', date: `${maintenant.getFullYear() + 1}-03-31`, note: 'Locataire prévenu, départ confirmé' }],
    })
  }
}

export async function supprimerDemo(): Promise<number> {
  await piecesJointes.supprimerDemo()
  await evenements.supprimerDemo()
  await campagnes.envois.supprimerDemo()
  await campagnes.supprimerDemo()
  await interactions.supprimerDemo()
  const idsPhotos = (await db.photos.filter((p) => p._demo === true).primaryKeys()) as string[]
  await db.photosLocales.bulkDelete(idsPhotos)
  await photos.supprimerDemo()
  await pistes.supprimerDemo()
  await biens.supprimerDemo()
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
