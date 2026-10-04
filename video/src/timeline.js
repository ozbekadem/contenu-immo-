// Prospect’Immo — vidéo de 30 s.
// UNE SEULE timeline pour l'image ET le son : chaque événement est un numéro de temps musical (b),
// converti en secondes par T(). Le rendu image et la synthèse audio lisent ce même fichier,
// ce qui garantit une synchronisation parfaite.

export const BPM = 128
export const BEAT = 60 / BPM // 0,46875 s
export const FPS = 60
export const DUREE = 30 // 16 mesures × 4 temps = 64 temps = 30 s pile
export const NB_IMAGES = DUREE * FPS // 1800
export const LARGEUR = 1080
export const HAUTEUR = 1920
export const T = (b) => b * BEAT
export const B = (t) => t / BEAT

// Zone sûre TikTok (1080 × 1920) : rien sous les onglets du haut, les boutons de droite ni la légende du bas.
export const ZONE_SURE = { x0: 80, x1: 940, y0: 250, y1: 1460 }
export const CX = (ZONE_SURE.x0 + ZONE_SURE.x1) / 2 // 510 : centre optique, décalé des boutons de droite

export const SECTIONS = [
  { id: 'accroche', de: 0, a: 6 }, // accroche choc
  { id: 'coupure', de: 6, a: 8 }, // coupure
  { id: 'reperer', de: 8, a: 16 }, // démonstration au beat (4 × 2 mesures)
  { id: 'appel', de: 16, a: 24 },
  { id: 'relances', de: 24, a: 32 },
  { id: 'marche', de: 32, a: 40 },
  { id: 'manifeste', de: 40, a: 52 }, // manifeste
  { id: 'fin', de: 52, a: 64 }, // logo + bouton s'abonner
]
export const sectionA = (b) => SECTIONS.find((s) => b >= s.de && b < s.a) ?? SECTIONS[SECTIONS.length - 1]

// —— Marqueurs : les instants clés, utilisés à la fois par l'animation et par les bruitages ——
export const M = {
  // Accroche
  impact1: 0,
  impact2: 1,
  carte: 2,
  notifCarte: 2.25,
  pulsRouge: [2.5, 3, 3.5],
  eclatement: 4,
  glitch: [5, 6],
  // Coupure
  coupure: 6,
  plusJamais: 6.5,
  aspiration: [7, 7.75],
  silence: [7.75, 8], // vrai silence (une croche) avant le drop
  drop: 8,
  // Démo 1 — Repérer
  miseAuPoint: 9.5,
  declencheurs: [10, 10.5, 11, 11.5, 12],
  epingle: 13,
  categorie: 13.5,
  tapEnregistrer: 14,
  enregistre: 14.5,
  // Démo 2 — Appel
  tapAppeler: 17,
  options: [17.5, 18, 18.5],
  tapOption: 19,
  sonnerie: [19, 21],
  raccroche: 21,
  tapResultat: 21.5,
  tapRelance: 22,
  tapEnregistrer2: 22.5,
  bravo: 22.75,
  // Démo 3 — Relances
  lignes: [25, 25.5, 26, 26.5],
  notification: 27,
  agenda: 28,
  points: [28.5, 28.75, 29, 29.25, 29.5, 29.75, 30, 30.25],
  synchro: 30.75,
  // Démo 4 — Marché + mandat
  compteur: [32.25, 33.5],
  courbe: [32.5, 34.5],
  pointFinal: 34.5,
  hausse: 35,
  roulement1: [34, 36],
  tampon: 36,
  client: 37,
  sortie: [38.75, 40],
  // Manifeste
  mots1: [40, 41, 42],
  sortie1: 43.75,
  mots2: [44, 45, 46],
  sortie2: 47.75,
  zero: 48,
  oubli: 49,
  roulement2: [50, 51.75],
  blanc: [51.25, 52],
  // Fin
  logo: 52,
  point: 53.5,
  marque: 54,
  reflet: 54.5,
  slogan: [55, 56, 57],
  bouton: 58,
  pulsation: 59,
  approche: 59.5,
  tapAbonner: 60,
  refletFinal: 62,
  fondu: [62, 64],
}

// Coups de fouet (whip pan) entre les quatre démonstrations : centrés sur ces temps, durée ±¼ de temps.
export const FOUETS = [16, 24, 32]

// —— Textes à l'écran : 2 à 3 mots, toujours dans la zone sûre ——
export const TEXTES = [
  { id: 'relance', lignes: ['Relance', 'oubliée ?'], de: 0, temps: [0, 1], a: 4 },
  { id: 'mandat', lignes: ['Mandat', 'perdu.'], de: 4, temps: [4, 4], a: 6 },
  { id: 'jamais', lignes: ['Plus jamais.'], de: 6.5, temps: [6.5], a: 7.75 },
  { id: 'reperez', lignes: ['Repérez', 'la rue'], de: 8, temps: [8, 8.5], a: 15.9 },
  { id: 'appui', lignes: ['Un appui', 'suffit'], de: 16, temps: [16, 16.5], a: 23.9 },
  { id: 'zero', lignes: ['Zéro relance', 'oubliée'], de: 24, temps: [24, 24.5], a: 31.9 },
  { id: 'prix', lignes: ['Prix du', 'quartier'], de: 32, temps: [32, 32.5], a: 36 },
  { id: 'signe', lignes: ['Mandat', 'signé'], de: 36, temps: [36, 36], a: 39.5 },
  { id: 'm1', lignes: ['Chaque', 'maison', 'compte.'], de: 40, temps: M.mots1, a: 43.9 },
  { id: 'm2', lignes: ['Chaque', 'appel', 'aussi.'], de: 44, temps: M.mots2, a: 47.9 },
  { id: 'm3', lignes: ['Zéro', 'oubli.'], de: 48, temps: [48, 49], a: 52 },
  { id: 'slogan', lignes: ['Prospectez.', 'Relancez.', 'Signez.'], de: 55, temps: M.slogan, a: 64 },
]

// —— Harmonie (fa mineur) ——
export const ACCORDS = {
  Fm: { basse: 41, notes: [53, 56, 60, 65] }, // fa – la♭ – do – fa
  Db: { basse: 37, notes: [53, 56, 61, 65] }, // ré♭ (fa – la♭ – ré♭ – fa)
  Ab: { basse: 44, notes: [51, 56, 60, 63] }, // la♭ (mi♭ – la♭ – do – mi♭)
  Eb: { basse: 39, notes: [51, 55, 58, 63] }, // mi♭ (mi♭ – sol – si♭ – mi♭)
}
export const GRILLE = [
  ...['Fm', 'Db', 'Ab', 'Eb', 'Fm', 'Db', 'Ab', 'Eb'].map((accord, i) => ({ b: 8 + i * 4, d: 4, accord })),
  { b: 40, d: 4, accord: 'Fm' },
  { b: 44, d: 4, accord: 'Db' },
  { b: 48, d: 4, accord: 'Eb' },
  { b: 52, d: 4, accord: 'Ab' }, // résolution majeure au logo
  { b: 56, d: 4, accord: 'Db' },
  { b: 60, d: 4, accord: 'Ab' },
]
export const accordA = (b) => GRILLE.find((g) => b >= g.b && b < g.b + g.d)

const serie = (de, a, pas = 1) => {
  const r = []
  for (let x = de; x < a - 1e-9; x += pas) r.push(Math.round(x * 1000) / 1000)
  return r
}

// —— Rythmique (lue par la synthèse ET par l'image : pulsations de lumière sur les kicks) ——
export const RYTHME = {
  kick: [...serie(8, 40), 40, 42, 44, 46, 48, 49, ...serie(52, 60), 60],
  clap: [...serie(9, 40, 2), 42, 46, ...serie(53, 60, 2)],
  hatFerme: [...serie(8, 40, 0.25).map((b) => ({ b, v: [0.45, 0.22, 0.7, 0.28][Math.round((b % 1) * 4)] * (b < 16 ? 0.7 : 1) })), ...serie(52, 60, 0.5).map((b) => ({ b, v: 0.35 }))],
  hatOuvert: [...serie(8.5, 40, 1).map((b) => ({ b, v: b < 16 ? 0.5 : 1 })), ...serie(52.5, 60, 1).map((b) => ({ b, v: 0.7 }))],
  basse: [
    ...serie(8.5, 40, 1).map((b) => ({ b, d: 0.42, accord: accordA(b).accord })),
    { b: 40, d: 4, accord: 'Fm', longue: true },
    { b: 44, d: 4, accord: 'Db', longue: true },
    { b: 48, d: 3.75, accord: 'Eb', longue: true },
    ...serie(52.5, 60, 1).map((b) => ({ b, d: 0.42, accord: accordA(b).accord })),
  ],
  // Arpège en doubles croches (motif 1-2-3-4-3-2-…) pendant la démo, cloches plus rares à la fin
  arpege: [
    ...serie(16, 39.5, 0.25).map((b, i) => ({ b, accord: accordA(b).accord, degre: [0, 1, 2, 3, 2, 1, 2, 3][i % 8], v: b % 1 === 0 ? 1 : 0.7 })),
    ...serie(54, 60, 0.5).map((b, i) => ({ b, accord: accordA(b).accord, degre: [0, 2, 3, 1, 2, 3][i % 6], v: 0.6, cloche: true })),
  ],
  claviers: [...M.mots1, ...M.mots2].map((b) => ({ b, accord: accordA(b).accord })),
  roulements: [M.roulement1, M.roulement2],
  crash: [{ b: M.drop, v: 1 }, { b: M.tampon, v: 1 }, { b: M.zero, v: 0.9 }, { b: M.logo, v: 1 }, { b: M.tapAbonner, v: 0.6 }],
}

// —— Événements ponctuels (bruitages + effets image) ——
// `son` : le bruitage synthétisé ; `image` : les effets d'image déclenchés au même instant.
export const CUES = [
  // Accroche
  { b: M.impact1, son: 'impact', force: 1, image: { flash: 0.9, secousse: 1, ca: 1 } },
  { b: M.impact1, son: 'stab', accord: 'Fm' },
  { b: M.impact1, son: 'drone', fin: M.coupure },
  { b: M.impact2, son: 'impact', force: 0.6, image: { flash: 0.45, secousse: 0.6, ca: 0.6 } },
  { b: M.impact2, son: 'stab', accord: 'Fm', octave: 12 },
  ...serie(1.5, 6, 0.5).map((b, i) => ({ b, son: 'tic', n: i })),
  { b: M.carte, son: 'whoosh', duree: 0.5, force: 0.6 },
  { b: M.notifCarte, son: 'notifSombre' },
  { b: M.eclatement, son: 'impact', force: 1.15, image: { flash: 1, secousse: 1.4, ca: 1.6, onde: 1 } },
  { b: M.eclatement, son: 'verre' },
  { b: M.eclatement, son: 'stab', accord: 'Db' },
  { b: 4.5, son: 'montee', fin: M.coupure, force: 0.8 },
  { b: M.glitch[0], son: 'glitch', fin: M.glitch[1] },
  // Coupure
  { b: M.coupure, son: 'arretBande' },
  { b: M.plusJamais, son: 'souffle' },
  { b: M.aspiration[0], son: 'cymbaleInverse', fin: M.aspiration[1] },
  // Drop
  { b: M.drop, son: 'impact', force: 1.25, image: { flash: 1.2, secousse: 1.2, ca: 1.4, onde: 1.2 } },
  // Démo 1
  { b: M.drop + 0.02, son: 'souffleLarge', duree: 0.8 },
  { b: M.miseAuPoint, son: 'bip' },
  ...M.declencheurs.map((b, n) => ({ b, son: 'declencheur', n, image: { flash: 0.12 } })),
  { b: M.epingle, son: 'epingle' },
  { b: M.categorie, son: 'pop', note: 2 },
  { b: M.tapEnregistrer, son: 'tap' },
  { b: M.enregistre, son: 'valide' },
  // Démo 2
  { b: M.tapAppeler, son: 'tap' },
  ...M.options.map((b, n) => ({ b, son: 'pop', note: n })),
  { b: M.tapOption, son: 'tap' },
  { b: M.sonnerie[0], son: 'sonnerie', fin: M.sonnerie[1] },
  { b: M.raccroche, son: 'raccroche' },
  { b: M.tapResultat, son: 'tap' },
  { b: M.tapRelance, son: 'tap' },
  { b: M.tapEnregistrer2, son: 'tap' },
  { b: M.tapEnregistrer2, son: 'valide' },
  { b: M.bravo, son: 'scintille', duree: 1, force: 0.6 },
  // Démo 3
  ...M.lignes.map((b, n) => ({ b, son: 'ligne', n })),
  { b: M.notification, son: 'notification' },
  { b: M.agenda, son: 'whoosh', duree: 0.35, force: 0.35 },
  ...M.points.map((b, n) => ({ b, son: 'goutte', n })),
  { b: M.synchro, son: 'pop', note: 3 },
  // Démo 4
  ...serie(M.compteur[0], M.compteur[1] + 0.01, 0.125).map((b, n) => ({ b, son: 'cran', n })),
  { b: M.pointFinal, son: 'ping' },
  { b: M.hausse, son: 'pop', note: 1 },
  { b: M.roulement1[0], son: 'montee', fin: M.tampon, force: 0.9 },
  { b: M.tampon, son: 'impact', force: 1.1, image: { flash: 0.8, secousse: 1.3, ca: 1.2, onde: 1 } },
  { b: M.tampon, son: 'tampon' },
  { b: M.tampon + 0.05, son: 'scintille', duree: 2, force: 1 },
  { b: M.client, son: 'pop', note: 3 },
  { b: M.sortie[0], son: 'whoosh', duree: 1.1, force: 0.8 },
  { b: 39, son: 'montee', fin: 40, force: 0.6 },
  // Manifeste
  ...M.mots1.map((b, n) => ({ b, son: 'mot', n, image: { flash: 0.1, secousse: 0.25 } })),
  { b: M.sortie1, son: 'souffleCourt' },
  ...M.mots2.map((b, n) => ({ b, son: 'mot', n, image: { flash: 0.1, secousse: 0.25 } })),
  { b: M.sortie2, son: 'souffleCourt' },
  { b: M.zero, son: 'impact', force: 1.1, image: { flash: 0.7, secousse: 1.2, ca: 1.3, onde: 0.8 } },
  { b: M.oubli, son: 'impact', force: 0.7, image: { flash: 0.35, secousse: 0.7, ca: 0.8 } },
  { b: M.roulement2[0], son: 'montee', fin: M.logo, force: 1 },
  // Fin
  { b: M.logo, son: 'impact', force: 1.2, image: { flash: 0.6, secousse: 0.8, ca: 1, onde: 1 } },
  { b: M.logo + 0.02, son: 'scintille', duree: 1.5, force: 0.8 },
  { b: M.point, son: 'ding' },
  { b: M.marque, son: 'whoosh', duree: 0.6, force: 0.5 },
  { b: M.reflet, son: 'reflet' },
  ...M.slogan.map((b, n) => ({ b, son: 'pluck', n })),
  { b: M.bouton, son: 'pop', note: 4 },
  { b: M.approche, son: 'souffleCourt' },
  { b: M.tapAbonner, son: 'clic', image: { flash: 0.15, secousse: 0.3, onde: 0.5 } },
  { b: M.tapAbonner, son: 'succes' },
  { b: M.tapAbonner + 0.05, son: 'scintille', duree: 2.5, force: 0.8 },
  { b: M.refletFinal, son: 'reflet', force: 0.5 },
]

// Liste à plat des événements image (secondes), lue par le rendu et par la vérification de synchro.
export const EFFETS = CUES.filter((c) => c.image).map((c) => ({ t: T(c.b), b: c.b, ...c.image }))
