import { biens } from '@/data/repositories/biens'
import type { Adresse, Bien } from '@/data/types'
import {
  cleRecherche,
  infosAJour,
  majuscule,
  memeRue,
  nomDivision,
  numeroOfficiel,
  numeroParcelle,
  pireAlea,
  rueSansSection,
  surfacePolygone,
  titre,
  type InfosPubliques,
} from '@/domain/infosPubliques'

/**
 * Services cartographiques publics de la Région wallonne (ArcGIS REST, sans clé, ouverts aux appels
 * depuis le navigateur). Toutes les requêtes partent du point officiel de l'adresse (registre ICAR) :
 * le point GPS d'un repérage est souvent sur le trottoir d'en face, hors de la parcelle.
 */
const BASE = 'https://geoservices.wallonie.be/arcgis/rest/services/'
const PROXIMITE_M = 50

type Valeurs = Record<string, unknown>
interface Entite {
  attributes: Valeurs
  geometry?: { x?: number; y?: number; rings?: number[][][] }
}
interface Polygone {
  rings: number[][][]
  spatialReference: { wkid: number }
}
type Fetch = typeof fetch

async function appeler(f: Fetch, chemin: string, params: Record<string, string | number>): Promise<Valeurs> {
  const corps = new URLSearchParams({ f: 'json', ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])) })
  // Une parcelle détaillée ne tient pas dans une adresse web : au-delà, la demande part en POST.
  const r =
    corps.toString().length > 1800
      ? await f(BASE + chemin, { method: 'POST', body: corps })
      : await f(`${BASE}${chemin}?${corps}`, { headers: { Accept: 'application/json' } })
  if (!r.ok) throw new Error(`Service public indisponible (${r.status})`)
  const d = (await r.json()) as Valeurs & { error?: { message?: string } }
  if (d.error) throw new Error(d.error.message ?? 'Réponse du service public illisible')
  return d
}

async function entites(f: Fetch, couche: string, params: Record<string, string | number>): Promise<Entite[]> {
  const d = await appeler(f, `${couche}/query`, { returnGeometry: 'false', outFields: '*', ...params })
  return (d.features as Entite[] | undefined) ?? []
}

/** Paramètres d'une recherche au point (WGS84), éventuellement élargie à un rayon en mètres. */
function auPoint(lat: number, lng: number, rayon = 0): Record<string, string | number> {
  return {
    geometry: JSON.stringify({ x: lng, y: lat, spatialReference: { wkid: 4326 } }),
    geometryType: 'esriGeometryPoint',
    inSR: 4326,
    spatialRel: 'esriSpatialRelIntersects',
    ...(rayon > 0 ? { distance: rayon, units: 'esriSRUnit_Meter' } : {}),
  }
}

/** Paramètres d'une recherche sur toute la parcelle (Lambert 72). */
function surParcelle(p: Polygone): Record<string, string | number> {
  return { geometry: JSON.stringify(p), geometryType: 'esriGeometryPolygon', inSR: 31370, spatialRel: 'esriSpatialRelIntersects' }
}

/** Couches touchées par la parcelle (ou le point), pour un service à plusieurs couches. */
async function couchesTouchees(f: Fetch, service: string, zone: { parcelle: Polygone | null; lat: number; lng: number }): Promise<{ couche: string; valeur: string }[]> {
  const geo = zone.parcelle
    ? { geometry: JSON.stringify(zone.parcelle), geometryType: 'esriGeometryPolygon', sr: 31370 }
    : { geometry: JSON.stringify({ x: zone.lng, y: zone.lat, spatialReference: { wkid: 4326 } }), geometryType: 'esriGeometryPoint', sr: 4326 }
  const xs = zone.parcelle ? zone.parcelle.rings.flat().map((p) => p[0]!) : [zone.lng]
  const ys = zone.parcelle ? zone.parcelle.rings.flat().map((p) => p[1]!) : [zone.lat]
  const marge = zone.parcelle ? 50 : 0.0007
  const d = await appeler(f, `${service}/MapServer/identify`, {
    ...geo,
    layers: 'all',
    tolerance: zone.parcelle ? 0 : 2,
    mapExtent: [Math.min(...xs) - marge, Math.min(...ys) - marge, Math.max(...xs) + marge, Math.max(...ys) + marge].join(','),
    imageDisplay: '400,400,96',
    returnGeometry: 'false',
  })
  return ((d.results as { layerName: string; value?: unknown }[] | undefined) ?? []).map((r) => ({ couche: r.layerName, valeur: String(r.value ?? '').trim() }))
}

let millesime: Promise<string> | null = null

/** Plan cadastral le plus récent qui contient aussi les bâtiments (ex. « CADMAP_2025_PARCELLES »). */
function planCadastral(f: Fetch): Promise<string> {
  millesime ??= appeler(f, 'PLAN_REGLEMENT', {})
    .then((d) => {
      const annees = ((d.services as { name: string }[] | undefined) ?? [])
        .map((s) => /CADMAP_(\d{4})_PARCELLES$/.exec(s.name)?.[1])
        .filter((a): a is string => !!a)
        .sort()
      if (!annees.length) throw new Error('Plan cadastral introuvable')
      return `PLAN_REGLEMENT/CADMAP_${annees.at(-1)}_PARCELLES/MapServer`
    })
    .catch((e) => {
      millesime = null
      throw e
    })
  return millesime
}

const echapper = (t: string) => t.replace(/'/g, "''")

/** Point officiel de l'adresse dans le registre wallon (ICAR), ou null s'il est introuvable. */
async function pointAdresse(f: Fetch, a: Adresse): Promise<{ lat: number; lng: number; officielle: NonNullable<InfosPubliques['adresseOfficielle']> } | null> {
  const numero = numeroOfficiel(a.numero)
  if (!a.rue.trim() || !numero || !(a.cp.trim() || a.ville.trim())) return null
  const lieu = a.cp.trim() ? `CODE_POSTAL='${echapper(a.cp.trim())}'` : `UPPER(ZONE_ADRES)=UPPER('${echapper(a.ville.trim())}')`
  const candidats = await entites(f, 'DONNEES_BASE/ICAR_ADR_PT/MapServer/1', {
    where: `${lieu} AND ADR_NUMERO='${echapper(numero)}'`,
    outFields: 'RUE_NM,ADR_NUMERO,ADR_BTE,CODE_POSTAL,ZONE_ADRES',
    returnGeometry: 'true',
    outSR: 4326,
  })
  const memes = candidats.filter((c) => memeRue(String(c.attributes.RUE_NM ?? ''), a.rue))
  const boite = a.boite.trim().toLowerCase()
  const choisi = memes.find((c) => String(c.attributes.ADR_BTE ?? '').toLowerCase() === boite) ?? memes[0]
  if (!choisi?.geometry || choisi.geometry.x == null || choisi.geometry.y == null) return null
  const v = choisi.attributes
  return {
    lat: choisi.geometry.y,
    lng: choisi.geometry.x,
    officielle: {
      rue: rueSansSection(String(v.RUE_NM ?? '')),
      numero: String(v.ADR_NUMERO ?? ''),
      boite: String(v.ADR_BTE ?? ''),
      cp: String(v.CODE_POSTAL ?? ''),
      localite: String(v.ZONE_ADRES ?? ''),
    },
  }
}

/**
 * Cherche les infos publiques d'un bien : situe l'adresse dans le registre officiel (à défaut, le point GPS),
 * puis interroge le cadastre, le plan de secteur, les cartes de risques, le sous-sol, le patrimoine
 * et le découpage statistique. Une rubrique en panne n'empêche pas les autres.
 */
export async function chercherInfosPubliques(bien: Pick<Bien, 'adresse' | 'lat' | 'lng'>, f: Fetch = (...a) => fetch(...a)): Promise<InfosPubliques> {
  const cle = cleRecherche(bien.adresse, bien.lat, bien.lng)
  if (!cle) throw new Error('Ajoutez l’adresse (rue et numéro) ou la position du bien.')

  const manquants: string[] = []
  const essayer = async <T>(rubrique: string, travail: () => Promise<T>, defaut: T): Promise<T> => {
    try {
      return await travail()
    } catch {
      manquants.push(rubrique)
      return defaut
    }
  }
  // Le millésime du plan cadastral se cherche pendant que l'on situe l'adresse.
  const cadastreP = essayer('cadastre', () => planCadastral(f), '')

  const aGps = bien.lat != null && bien.lng != null
  let officiel: Awaited<ReturnType<typeof pointAdresse>> = null
  try {
    officiel = bien.adresse ? await pointAdresse(f, bien.adresse) : null
  } catch (e) {
    // Registre injoignable : on se rabat sur le GPS s'il existe (le reste dira si le réseau manque vraiment)
    if (!aGps) throw new Error(e instanceof TypeError ? 'Pas de connexion pour le moment : réessayez dès que le réseau revient.' : (e as Error).message)
  }
  if (!officiel && !aGps) throw new Error('Adresse introuvable dans le registre officiel des adresses de Wallonie : vérifiez la rue et le numéro.')
  const lat = officiel?.lat ?? bien.lat!
  const lng = officiel?.lng ?? bien.lng!
  const ici = auPoint(lat, lng)
  const sansGeometrie: Entite[] = []

  // 1. Tout ce qui se lit au point, en même temps que la parcelle et le bâtiment
  const auPointP = Promise.all([
    essayer('plan de secteur', () => entites(f, 'AMENAGEMENT_TERRITOIRE/PDS/MapServer/22', { ...ici, outFields: 'CARTO_JURIDIQUE,DESCRIPTION' }), sansGeometrie),
    essayer('centralité', () => entites(f, 'AMENAGEMENT_TERRITOIRE/CENTRALITES/MapServer/0', { ...ici, outFields: 'TYPECENTR' }), sansGeometrie),
    essayer('inondation', () => entites(f, 'EAU/ALEA_INOND/MapServer/2', { ...auPoint(lat, lng, PROXIMITE_M), outFields: 'TYPEALEA,VALEUR,CODEALEA' }), sansGeometrie),
    essayer('inondation', () => entites(f, 'EAU/ALEA_INOND/MapServer/5', { ...ici, outFields: 'PDF_ALEA' }), sansGeometrie),
    essayer('sous-sol', () => entites(f, 'SOL_SOUS_SOL/CONCESSIONS_MINES_SITUATION_ADMIN/MapServer/0', { ...ici, outFields: 'NOM_CONC,SUBSTAN' }), sansGeometrie),
    essayer('quartier', () => entites(f, 'LIMITES/LIMITES_QS_STATBEL/MapServer/0', { ...ici, outFields: 'C_NIS7,T_SEC_FR' }), sansGeometrie),
  ])
  const cadastre = await cadastreP
  const [parcelle, batiment] = cadastre
    ? await Promise.all([
        essayer('cadastre', () => entites(f, `${cadastre}/0`, { ...ici, returnGeometry: 'true', outSR: 31370 }), sansGeometrie),
        essayer('bâtiment', () => entites(f, `${cadastre}/1`, { ...ici, returnGeometry: 'true', outSR: 31370 }), sansGeometrie),
      ])
    : [sansGeometrie, sansGeometrie]
  const p = parcelle[0]
  const polygone: Polygone | null = p?.geometry?.rings ? { rings: p.geometry.rings, spatialReference: { wkid: 31370 } } : null
  const zone = polygone ? surParcelle(polygone) : ici
  // Inventaire des sols : il recense des parcelles, qui touchent leurs voisines ; on le lit par la référence exacte.
  const capakey = p ? String(p.attributes.CAPAKEY ?? '') : ''
  const parcelleExacte = capakey ? { where: `CAPAKEY='${echapper(capakey)}'` } : ici

  // 2. Ce qui se lit sur toute la parcelle
  const [[plan, centralite, aleaProche, carte, concession, quartier], [aleaBien, sousSol, solsDemarches, solsIndicatif, classes, inventaire]] = await Promise.all([
    auPointP,
    Promise.all([
      essayer('inondation', () => entites(f, 'EAU/ALEA_INOND/MapServer/2', { ...zone, outFields: 'TYPEALEA,VALEUR,CODEALEA' }), sansGeometrie),
      essayer('sous-sol', () => couchesTouchees(f, 'SOL_SOUS_SOL/CONSULT_SSOL', { parcelle: polygone, lat, lng }), []),
      essayer('sols', () => entites(f, 'SOL_SOUS_SOL/BDES_INVENTAIRE/MapServer/0', { ...parcelleExacte, outFields: 'STATUT_FR,URL_BDES' }), sansGeometrie),
      essayer('sols', () => entites(f, 'SOL_SOUS_SOL/BDES_INVENTAIRE/MapServer/1', { ...parcelleExacte, outFields: 'STATUT_FR,URL_BDES' }), sansGeometrie),
      essayer('patrimoine', () => couchesTouchees(f, 'AMENAGEMENT_TERRITOIRE/BC_PAT', { parcelle: polygone, lat, lng }), []),
      essayer('patrimoine', () => entites(f, 'AMENAGEMENT_TERRITOIRE/IPIC/MapServer/0', { ...zone, outFields: 'LIBELLE' }), sansGeometrie),
    ]),
  ])
  if (manquants.length >= 8) throw new Error('Services publics de Wallonie injoignables pour le moment : réessayez plus tard.')

  const v = p?.attributes
  const sol = solsDemarches[0] ?? solsIndicatif[0]
  const q = quartier[0]?.attributes
  const c = concession[0]?.attributes
  return {
    consulteLe: new Date().toISOString(),
    cle,
    localisation: officiel ? 'adresse' : 'gps',
    lat,
    lng,
    adresseOfficielle: officiel?.officielle ?? null,
    parcelle: v
      ? {
          capakey: String(v.CAPAKEY ?? ''),
          division: nomDivision(String(v.DIV_NOM ?? ''), String(v.NOM_COMMUNE ?? '')),
          section: String(v.SECT ?? ''),
          numero: numeroParcelle(String(v.RADICAL ?? ''), String(v.BIS ?? ''), String(v.EXPOSANT ?? ''), String(v.PUISSANCE ?? '')),
          surface: polygone ? surfacePolygone(polygone.rings) : null,
        }
      : null,
    batiment: batiment[0]?.geometry?.rings ? surfacePolygone(batiment[0].geometry.rings) : null,
    planSecteur: plan[0] ? typo(majuscule(String(plan[0].attributes.CARTO_JURIDIQUE ?? plan[0].attributes.DESCRIPTION ?? ''))) || null : null,
    centralite: centralite[0] ? typo(String(centralite[0].attributes.TYPECENTR ?? '')) || null : null,
    inondation: {
      auBien: pireAlea(aleaBien.map((e) => e.attributes)),
      aProximite: pireAlea(aleaProche.map((e) => e.attributes)),
      carte: carte[0] ? String(carte[0].attributes.PDF_ALEA ?? '') || null : null,
    },
    sousSol: [...new Set(sousSol.map((s) => typo(s.couche)))],
    concession: c ? typo(`${titreConcession(String(c.NOM_CONC ?? ''))}${c.SUBSTAN ? ` (${String(c.SUBSTAN).toLowerCase()})` : ''}`) : null,
    sols: sol ? { statut: typo(String(sol.attributes.STATUT_FR ?? '')), demarches: solsDemarches.length > 0, lien: sol.attributes.URL_BDES ? String(sol.attributes.URL_BDES) : null } : null,
    patrimoine: [...new Set([...classes.map((x) => typo(`${x.couche} : ${x.valeur}`)), ...inventaire.map((e) => typo(`Inventaire du patrimoine : ${String(e.attributes.LIBELLE ?? '')}`))])],
    quartier: q ? { code: String(q.C_NIS7 ?? ''), nom: titre(String(q.T_SEC_FR ?? '')) } : null,
    manquants: [...new Set(manquants)],
  }
}

/** Apostrophe typographique, comme dans le reste de l'application. */
const typo = (t: string) => t.replace(/'/g, '’')

/** Les noms de concessions sont déjà en casse normale ; seuls ceux tout en majuscules sont adoucis. */
function titreConcession(nom: string): string {
  return nom === nom.toUpperCase() ? titre(nom) : nom
}

const enCours = new Map<string, Promise<InfosPubliques>>()

/** Cherche et enregistre les infos publiques d'un bien (une seule demande à la fois par bien). */
export function completerInfosPubliques(bien: Bien): Promise<InfosPubliques> {
  const existante = enCours.get(bien.id)
  if (existante) return existante
  const travail = chercherInfosPubliques(bien)
    .then(async (infos) => {
      await biens.modifier(bien.id, { infosPubliques: infos })
      return infos
    })
    .finally(() => enCours.delete(bien.id))
  enCours.set(bien.id, travail)
  return travail
}

/** Biens récents (repérés ces 14 derniers jours) dont les infos publiques manquent : complétés dès que le réseau revient. */
export async function chercherInfosPubliquesEnAttente(limite = 10): Promise<number> {
  if (!navigator.onLine) return 0
  const depuis = new Date(Date.now() - 14 * 24 * 3600_000).toISOString()
  const aFaire = (
    await biens.filtrer((b) => !b.archivedAt && !b._demo && b.createdAt >= depuis && !infosAJour(b.infosPubliques, cleRecherche(b.adresse, b.lat, b.lng)) && !!cleRecherche(b.adresse, b.lat, b.lng))
  ).slice(0, limite)
  let faits = 0
  for (const b of aFaire) {
    if (!navigator.onLine) break
    try {
      await completerInfosPubliques(b)
      faits++
    } catch {
      // adresse introuvable pour ce bien : on passe au suivant (il sera retenté au prochain passage)
    }
  }
  return faits
}
