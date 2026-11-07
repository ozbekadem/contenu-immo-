import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useEffect, useRef } from 'react'
import { interpoler, trajet, trajetLisible, type PointGeo } from '@/domain/tournee'

export interface PointTournee extends PointGeo {
  id: string
  /** Couleur de la catégorie (annonce, maison vide). */
  couleur: string
  titre: string
  sousTitre?: string
  /** Petite étiquette dans la bulle (statut de la piste). */
  etiquette?: string
  lien?: string
}

const CENTRE_DEFAUT: [number, number] = [50.4108, 4.4446]
const DUREE_TRACE_MS = 850

const echapper = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)
const versLatLng = (p: PointGeo): L.LatLngTuple => [p.lat, p.lng]
const mouvementReduit = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

const SVG_PIED =
  '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 16v-2.38C4 11.5 2.97 10.5 3 8c.03-2.72 1.49-6 4.5-6C9.37 2 10 3.8 10 5.5c0 3.11-2 5.66-2 8.68V16a2 2 0 1 1-4 0Z"/><path d="M20 20v-2.38c0-2.12 1.03-3.12 1-5.62-.03-2.72-1.49-6-4.5-6C14.63 6 14 7.8 14 9.5c0 3.11 2 5.66 2 8.68V20a2 2 0 1 0 4 0Z"/></svg>'
const SVG_VOITURE =
  '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/></svg>'

/** Épingle numérotée ; `arrive` : elle tombe en rebondissant (nouvelle étape). */
function iconeEtape(numero: number, couleur: string, arrive: boolean, active: boolean) {
  return L.divIcon({
    className: '',
    html: `<div class="tournee-pin${arrive ? ' tournee-pin--arrive' : ''}${active ? ' tournee-pin--active' : ''}" style="--pin:${couleur}">
<svg viewBox="0 0 34 44" width="34" height="44" aria-hidden="true"><path d="M17 42.5C15.6 35.6 2 27.4 2 16.5a15 15 0 0 1 30 0C32 27.4 18.4 35.6 17 42.5Z" fill="${couleur}" stroke="#fff" stroke-width="2.5"/></svg>
<span>${numero}</span></div>`,
    iconSize: [34, 44],
    iconAnchor: [17, 43],
    tooltipAnchor: [0, -40],
  })
}

function iconeCandidat(couleur: string) {
  return L.divIcon({
    className: '',
    html: `<span class="tournee-candidat" style="background:${couleur}"></span>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  })
}

const ICONE_VOUS = L.divIcon({
  className: '',
  html: '<div class="tournee-vous"><span class="tournee-vous-point"></span><span class="tournee-vous-etiquette">Vous</span></div>',
  iconSize: [0, 0],
})

const ICONE_HALO = L.divIcon({
  className: '',
  html: '<div class="tournee-halo"><span></span><span></span></div>',
  iconSize: [0, 0],
})

function bulle(p: PointTournee) {
  return (
    `<div class="tournee-bulle-titre">${echapper(p.titre)}</div>` +
    (p.sousTitre ? `<div class="tournee-bulle-sous">${echapper(p.sousTitre)}</div>` : '') +
    `<div class="tournee-bulle-bas">` +
    (p.etiquette ? `<span class="tournee-bulle-puce" style="--pin:${p.couleur}"><i></i>${echapper(p.etiquette)}</span>` : '') +
    (p.lien ? `<a href="#" data-lien="${echapper(p.lien)}">Fiche →</a>` : '') +
    `</div>`
  )
}

/**
 * Carte de tournée : les adresses choisies sont reliées dans l'ordre par un tracé pointillé qui se
 * dessine à chaque ajout ; l'épingle numérotée tombe à l'arrivée du tracé, la carte suit, un halo
 * pulse autour de l'adresse active, avec sa bulle et la durée estimée depuis l'étape précédente.
 */
export function CarteTournee({
  candidats,
  etapes,
  focus,
  position,
  ajouter,
  choisir,
  ouvrir,
  className = '',
}: {
  /** Adresses que l'on peut ajouter (points discrets). */
  candidats: PointTournee[]
  /** Étapes de la tournée, dans l'ordre. */
  etapes: PointTournee[]
  /** Étape mise en avant (halo, bulle, durée). */
  focus: string | null
  /** Point de départ : la position de l'utilisateur. */
  position?: PointGeo | null
  ajouter: (id: string) => void
  choisir: (id: string) => void
  ouvrir?: (lien: string) => void
  className?: string
}) {
  const conteneur = useRef<HTMLDivElement>(null)
  const carte = useRef<L.Map | null>(null)
  const couches = useRef<{
    candidats: L.LayerGroup
    trace: L.LayerGroup
    etapes: L.LayerGroup
    decor: L.LayerGroup
  } | null>(null)
  const marqueurs = useRef(new Map<string, { m: L.Marker; numero: number; active: boolean }>())
  const precedentes = useRef<string[]>([])
  const animation = useRef<{ arreter: () => void } | null>(null)
  const dejaCadre = useRef(false)
  const rappels = useRef({ ajouter, choisir, ouvrir })
  rappels.current = { ajouter, choisir, ouvrir }

  // ─── Création de la carte ─────────────────────────────────────────────
  useEffect(() => {
    const el = conteneur.current!
    const m = L.map(el, {
      zoomControl: false,
      attributionControl: true,
    }).setView(CENTRE_DEFAUT, 13)
    L.control.zoom({ position: 'topright' }).addTo(m)
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      className: 'tournee-tuiles',
      attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>',
    }).addTo(m)
    m.createPane('tournee-trace').style.zIndex = '450'
    couches.current = {
      candidats: L.layerGroup().addTo(m),
      trace: L.layerGroup().addTo(m),
      decor: L.layerGroup().addTo(m),
      etapes: L.layerGroup().addTo(m),
    }
    // Lien « Fiche → » de la bulle : navigation dans l'application
    const clic = (e: MouseEvent) => {
      const a = (e.target as HTMLElement).closest<HTMLAnchorElement>('a[data-lien]')
      if (!a) return
      e.preventDefault()
      rappels.current.ouvrir?.(a.dataset.lien!)
    }
    el.addEventListener('click', clic)
    carte.current = m
    const obs = new ResizeObserver(() => m.invalidateSize())
    obs.observe(el)
    return () => {
      animation.current?.arreter()
      el.removeEventListener('click', clic)
      obs.disconnect()
      m.remove()
      carte.current = null
      marqueurs.current.clear()
      precedentes.current = []
    }
  }, [])

  // ─── Adresses disponibles (points discrets, un appui = ajout) ──────────
  useEffect(() => {
    const g = couches.current?.candidats
    const m = carte.current
    if (!g || !m) return
    g.clearLayers()
    const dansTournee = new Set(etapes.map((e) => e.id))
    for (const p of candidats) {
      if (dansTournee.has(p.id)) continue
      L.marker(versLatLng(p), {
        icon: iconeCandidat(p.couleur),
        title: `Ajouter ${p.titre}`,
        alt: p.titre,
        keyboard: true,
      })
        .bindTooltip(echapper(p.titre), {
          direction: 'top',
          offset: [0, -8],
          className: 'tournee-info',
        })
        .on('click', () => rappels.current.ajouter(p.id))
        .addTo(g)
    }
    // Cadrage au premier affichage : toutes les adresses (et la position, si connue)
    if (!dejaCadre.current && (candidats.length || etapes.length)) {
      dejaCadre.current = true
      const tous = [...candidats, ...etapes, ...(position ? [position] : [])].map(versLatLng)
      if (tous.length === 1) m.setView(tous[0]!, 16)
      else m.fitBounds(L.latLngBounds(tous), { padding: [36, 36], maxZoom: 16 })
    }
  }, [candidats, etapes, position])

  // ─── Position de départ (« Vous ») ─────────────────────────────────────
  useEffect(() => {
    const g = couches.current?.decor
    if (!g || !position) return
    const vous = L.marker(versLatLng(position), {
      icon: ICONE_VOUS,
      interactive: false,
      zIndexOffset: -100,
    }).addTo(g)
    return () => void vous.remove()
  }, [position])

  // ─── Tracé, épingles, halo, bulle ─────────────────────────────────────
  useEffect(() => {
    const m = carte.current
    const c = couches.current
    if (!m || !c) return
    animation.current?.arreter()

    const ids = etapes.map((e) => e.id)
    const avant = precedentes.current
    precedentes.current = ids
    // Ajout en fin de tournée : on anime le dernier tronçon (le reste est déjà dessiné).
    const ajoutEnFin = ids.length === avant.length + 1 && avant.every((id, i) => ids[i] === id)
    const anime = ajoutEnFin && !mouvementReduit()
    const depart: PointGeo | null = position ?? null
    const chemin: PointGeo[] = depart ? [depart, ...etapes] : [...etapes]

    // Tronçons pointillés
    c.trace.clearLayers()
    const options: L.PolylineOptions = {
      pane: 'tournee-trace',
      className: 'tournee-trace',
      weight: 4,
      lineCap: 'round',
      dashArray: '0.1 9',
      interactive: false,
    }
    const nbStatiques = anime ? chemin.length - 2 : chemin.length - 1
    for (let i = 0; i < nbStatiques; i++) L.polyline([versLatLng(chemin[i]!), versLatLng(chemin[i + 1]!)], options).addTo(c.trace)

    // Épingles numérotées (on garde celles qui existent : seule la nouvelle tombe)
    const vues = new Set<string>()
    etapes.forEach((p, i) => {
      vues.add(p.id)
      const active = p.id === focus
      const existant = marqueurs.current.get(p.id)
      if (existant) {
        existant.m.setLatLng(versLatLng(p))
        if (existant.numero !== i + 1 || existant.active !== active) existant.m.setIcon(iconeEtape(i + 1, p.couleur, false, active))
        existant.numero = i + 1
        existant.active = active
        existant.m.setZIndexOffset(active ? 1000 : 0)
        return
      }
      const nouvelle = anime && i === etapes.length - 1
      const mk = L.marker(versLatLng(p), {
        icon: iconeEtape(i + 1, p.couleur, true, active),
        title: p.titre,
        alt: `Étape ${i + 1} : ${p.titre}`,
        zIndexOffset: active ? 1000 : 0,
      })
      mk.on('click', () => rappels.current.choisir(p.id))
      marqueurs.current.set(p.id, { m: mk, numero: i + 1, active })
      if (!nouvelle) mk.addTo(c.etapes)
    })
    for (const [id, { m: mk }] of marqueurs.current)
      if (!vues.has(id)) {
        mk.remove()
        marqueurs.current.delete(id)
      }

    // Halo, bulle et durée autour de l'étape active
    c.decor.eachLayer((l) => {
      if ((l as L.Marker).options.icon !== ICONE_VOUS) c.decor.removeLayer(l)
    })
    const indexFocus = etapes.findIndex((e) => e.id === focus)
    const cible = indexFocus >= 0 ? etapes[indexFocus]! : null
    const decorer = () => {
      if (!cible) return
      L.marker(versLatLng(cible), {
        icon: ICONE_HALO,
        interactive: false,
        zIndexOffset: -200,
      }).addTo(c.decor)
      const mk = marqueurs.current.get(cible.id)?.m
      mk?.unbindTooltip()
        .bindTooltip(bulle(cible), {
          permanent: true,
          direction: 'top',
          offset: [0, -2],
          className: 'tournee-bulle',
          interactive: true,
          opacity: 1,
        })
        .openTooltip()
      const precedent = indexFocus > 0 ? etapes[indexFocus - 1]! : depart
      if (precedent) {
        const t = trajet(precedent, cible)
        L.marker(versLatLng(interpoler(precedent, cible, 0.5)), {
          interactive: false,
          icon: L.divIcon({
            className: '',
            html: `<div class="tournee-duree"><div>${t.mode === 'pied' ? SVG_PIED : SVG_VOITURE}${echapper(trajetLisible(t).replace('≈ ', ''))}</div></div>`,
            iconSize: [0, 0],
          }),
        }).addTo(c.decor)
      }
    }
    for (const [id, { m: mk }] of marqueurs.current) if (id !== cible?.id) mk.unbindTooltip()

    if (anime) {
      const a = chemin[chemin.length - 2]
      const b = chemin[chemin.length - 1]!
      const derniere = marqueurs.current.get(etapes[etapes.length - 1]!.id)!.m
      if (!a) {
        // Première étape sans position de départ : l'épingle tombe directement.
        derniere.addTo(c.etapes)
        m.flyTo(versLatLng(b), Math.max(m.getZoom(), 16), { duration: 0.7 })
        decorer()
        return
      }
      m.flyToBounds(L.latLngBounds([versLatLng(a), versLatLng(b)]), {
        padding: [70, 70],
        maxZoom: 17,
        duration: 0.7,
      })
      const ligne = L.polyline([versLatLng(a), versLatLng(a)], options).addTo(c.trace)
      let raf = 0
      const debut = performance.now()
      const finir = () => {
        cancelAnimationFrame(raf)
        ligne.setLatLngs([versLatLng(a), versLatLng(b)])
        if (!c.etapes.hasLayer(derniere)) derniere.addTo(c.etapes)
        decorer()
        animation.current = null
      }
      const pas = (t: number) => {
        const u = Math.min(1, (t - debut) / DUREE_TRACE_MS)
        const e = 1 - (1 - u) ** 3 // ralentit à l'arrivée
        ligne.setLatLngs([versLatLng(a), versLatLng(interpoler(a, b, e))])
        if (u < 1) raf = requestAnimationFrame(pas)
        else finir()
      }
      raf = requestAnimationFrame(pas)
      animation.current = { arreter: finir }
      return
    }

    decorer()
    if (cible)
      m.flyTo(versLatLng(cible), Math.max(m.getZoom(), 16), {
        duration: mouvementReduit() ? 0 : 0.7,
      })
    else if (!ajoutEnFin && etapes.length && ids.length !== avant.length)
      m.flyToBounds(L.latLngBounds(chemin.map(versLatLng)), {
        padding: [50, 50],
        maxZoom: 16,
        duration: 0.6,
      })
  }, [etapes, focus, position])

  return (
    <div ref={conteneur} className={`tournee-carte isolate z-0 overflow-hidden rounded-3xl bg-surface-2 ${className}`} role="region" aria-label="Carte de la tournée" />
  )
}

export default CarteTournee
