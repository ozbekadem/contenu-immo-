import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useEffect, useRef } from 'react'

export interface PointCarte {
  id: string
  lat: number
  lng: number
  couleur: string
  titre: string
  sousTitre?: string
  lien?: string
}

/** Région de Charleroi : vue de départ quand aucun bien n'est encore placé. */
const CENTRE_DEFAUT: [number, number] = [50.4108, 4.4446]

function icone(couleur: string, grand = false) {
  const t = grand ? 30 : 22
  return L.divIcon({
    className: '',
    html: `<span style="display:block;width:${t}px;height:${t}px;border-radius:9999px;background:${couleur};border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35)"></span>`,
    iconSize: [t, t],
    iconAnchor: [t / 2, t / 2],
  })
}

const echapper = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)

/**
 * Carte OpenStreetMap des biens repérés. Un appui sur un point ouvre une bulle avec un lien vers la fiche.
 * `deplacer` : mode « corriger la position » (un seul point, que l'on fait glisser ou que l'on place d'un appui).
 */
export function Carte({
  points,
  position,
  className = '',
  ouvrir,
  deplacer,
  zoom = 15,
}: {
  points: PointCarte[]
  /** Position de l'utilisateur (point bleu). */
  position?: { lat: number; lng: number } | null
  className?: string
  ouvrir?: (lien: string) => void
  deplacer?: (p: { lat: number; lng: number }) => void
  zoom?: number
}) {
  const conteneur = useRef<HTMLDivElement>(null)
  const carte = useRef<L.Map | null>(null)
  const couche = useRef<L.LayerGroup | null>(null)
  const moi = useRef<L.CircleMarker | null>(null)
  const dejaCadre = useRef(false)
  const rappels = useRef({ ouvrir, deplacer })
  rappels.current = { ouvrir, deplacer }

  useEffect(() => {
    const m = L.map(conteneur.current!, { zoomControl: false, attributionControl: true }).setView(CENTRE_DEFAUT, 12)
    L.control.zoom({ position: 'topright' }).addTo(m)
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>',
    }).addTo(m)
    m.on('click', (e: L.LeafletMouseEvent) => rappels.current.deplacer?.({ lat: e.latlng.lat, lng: e.latlng.lng }))
    // Liens des bulles : navigation dans l'application (sans recharger la page)
    m.on('popupopen', (e: L.PopupEvent) => {
      const a = e.popup.getElement()?.querySelector<HTMLAnchorElement>('a[data-lien]')
      a?.addEventListener('click', (ev) => {
        ev.preventDefault()
        rappels.current.ouvrir?.(a.dataset.lien!)
      })
    })
    couche.current = L.layerGroup().addTo(m)
    carte.current = m
    // La carte peut être créée dans un conteneur encore invisible (onglet) : on recalcule sa taille.
    const obs = new ResizeObserver(() => m.invalidateSize())
    obs.observe(conteneur.current!)
    return () => {
      obs.disconnect()
      m.remove()
      carte.current = null
    }
  }, [])

  useEffect(() => {
    const m = carte.current
    const g = couche.current
    if (!m || !g) return
    g.clearLayers()
    for (const p of points) {
      const marqueur = L.marker([p.lat, p.lng], { icon: icone(p.couleur, !!deplacer), draggable: !!deplacer, title: p.titre, alt: p.titre })
      if (deplacer) {
        marqueur.on('dragend', () => {
          const ll = marqueur.getLatLng()
          rappels.current.deplacer?.({ lat: ll.lat, lng: ll.lng })
        })
      } else {
        marqueur.bindPopup(
          `<strong style="font-size:14px">${echapper(p.titre)}</strong>` +
            (p.sousTitre ? `<br><span style="color:#667">${echapper(p.sousTitre)}</span>` : '') +
            (p.lien ? `<br><a href="#" data-lien="${echapper(p.lien)}" style="font-weight:700">Ouvrir la fiche →</a>` : ''),
        )
      }
      marqueur.addTo(g)
    }
    // Cadrage automatique au premier affichage (ensuite, on laisse l'utilisateur où il est).
    if (!dejaCadre.current && points.length) {
      dejaCadre.current = true
      if (points.length === 1) m.setView([points[0]!.lat, points[0]!.lng], zoom)
      else m.fitBounds(L.latLngBounds(points.map((p) => [p.lat, p.lng])), { padding: [30, 30], maxZoom: 16 })
    }
  }, [points, deplacer, zoom])

  useEffect(() => {
    const m = carte.current
    if (!m) return
    moi.current?.remove()
    moi.current = position
      ? L.circleMarker([position.lat, position.lng], { radius: 8, color: '#fff', weight: 3, fillColor: '#2563eb', fillOpacity: 1 }).bindTooltip('Vous êtes ici').addTo(m)
      : null
  }, [position])

  /** Recentrer sur la position de l'utilisateur. */
  useEffect(() => {
    if (position && !points.length && carte.current) carte.current.setView([position.lat, position.lng], 15)
  }, [position, points.length])

  return <div ref={conteneur} className={`isolate z-0 overflow-hidden rounded-3xl bg-surface-2 ${className}`} role="region" aria-label="Carte des biens" />
}

export default Carte
