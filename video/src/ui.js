// Dessins Canvas 2D : l'interface de Prospect’Immo (fidèle à l'application), la carte d'alerte,
// le tampon, le logo et tous les textes animés. Tout est fonction du temps musical b.
import { ICONES } from './icones.js'
import { CX, M, T, TEXTES, ZONE_SURE } from './timeline.js'
import { alea, clamp, entreeCubique, entreeSortieCubique, lerp, lisse, prog, ressort, sortieCubique, sortieExpo, sortieRetour } from './outils.js'

export const POLICE = 'PJS'
export const C = {
  fond: '#f4f5fa', surface: '#ffffff', surface2: '#eef0f5', bord: '#e5e7ef', texte: '#111827', doux: '#6b7280',
  primaire: '#4f46e5', primaire2: '#8b5cf6', primaireDoux: '#eef0ff', primaireTexte: '#3730a3',
  rouge: '#ef4444', orange: '#f97316', jaune: '#eab308', vert: '#16b364', gris: '#94a3b8',
  maisonVide: '#9b51e0', chaud: '#f43f5e', whatsapp: '#25d366', lavande: '#c4b5fd', bleu: '#60a5fa', nuit: '#0b0f1c',
}

export async function chargerPolices() {
  const latin = 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD'
  const ext = 'U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF'
  for (const [fichier, plage] of [['latin', latin], ['latin-ext', ext]]) {
    const url = new URL(`../polices/plus-jakarta-sans-${fichier}-wght-normal.woff2`, import.meta.url)
    const f = new FontFace(POLICE, `url(${url})`, { weight: '200 800', unicodeRange: plage })
    await f.load()
    document.fonts.add(f)
  }
}

// ———————————————————— utilitaires de dessin ————————————————————
export const police = (ctx, taille, poids = 600) => (ctx.font = `${poids} ${taille}px ${POLICE}`)
const rr = (ctx, x, y, w, h, r) => {
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, r)
}
function texte(ctx, s, x, y, taille, poids, coul, align = 'left') {
  police(ctx, taille, poids)
  ctx.fillStyle = coul
  ctx.textAlign = align
  ctx.textBaseline = 'alphabetic'
  ctx.fillText(s, x, y)
}
const chemins = new Map()
const chemin = (d) => {
  if (!chemins.has(d)) chemins.set(d, new Path2D(d))
  return chemins.get(d)
}
function icone(ctx, nom, x, y, taille, coul, ep = 2) {
  const el = ICONES[nom]
  if (!el) return
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(taille / 24, taille / 24)
  ctx.strokeStyle = coul
  ctx.lineWidth = ep
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  for (const [tag, a] of el) {
    ctx.beginPath()
    if (tag === 'path') ctx.stroke(chemin(a.d))
    else if (tag === 'circle') {
      ctx.arc(+a.cx, +a.cy, +a.r, 0, Math.PI * 2)
      ctx.stroke()
    } else if (tag === 'rect') {
      ctx.roundRect(+a.x, +a.y, +a.width, +a.height, +(a.rx ?? 0))
      ctx.stroke()
    } else if (tag === 'line') {
      ctx.moveTo(+a.x1, +a.y1)
      ctx.lineTo(+a.x2, +a.y2)
      ctx.stroke()
    } else if (tag === 'polyline' || tag === 'polygon') {
      const p = a.points.trim().split(/[\s,]+/).map(Number)
      ctx.moveTo(p[0], p[1])
      for (let i = 2; i < p.length; i += 2) ctx.lineTo(p[i], p[i + 1])
      if (tag === 'polygon') ctx.closePath()
      ctx.stroke()
    } else if (tag === 'ellipse') {
      ctx.ellipse(+a.cx, +a.cy, +a.rx, +a.ry, 0, 0, Math.PI * 2)
      ctx.stroke()
    }
  }
  ctx.restore()
}
function ombre(ctx, x, y, w, h, r, f = 1) {
  ctx.fillStyle = `rgba(15,23,42,${0.035 * f})`
  rr(ctx, x - 2, y + 4, w + 4, h + 6, r + 2)
  ctx.fill()
  ctx.fillStyle = `rgba(15,23,42,${0.04 * f})`
  rr(ctx, x, y + 1.5, w, h + 1, r)
  ctx.fill()
}
function carte(ctx, x, y, w, h, r = 24) {
  ombre(ctx, x, y, w, h, r)
  ctx.fillStyle = C.surface
  rr(ctx, x, y, w, h, r)
  ctx.fill()
}
function degrade(ctx, x0, y0, x1, y1, c0 = C.primaire, c1 = C.primaire2) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1)
  g.addColorStop(0, c0)
  g.addColorStop(1, c1)
  return g
}
function pilule(ctx, s, x, y, { fond, coul, taille = 12, poids = 700, padX = 10, h = 26, ic = null, align = 'left' } = {}) {
  police(ctx, taille, poids)
  const w = ctx.measureText(s).width + padX * 2 + (ic ? taille + 5 : 0)
  const x0 = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x
  ctx.fillStyle = fond
  rr(ctx, x0, y, w, h, h / 2)
  ctx.fill()
  let tx = x0 + padX
  if (ic) {
    icone(ctx, ic, tx, y + (h - taille - 2) / 2, taille + 2, coul, 2.4)
    tx += taille + 5
  }
  texte(ctx, s, tx, y + h / 2 + taille * 0.36, taille, poids, coul)
  return w
}
function avatar(ctx, initiales, x, y, t, fond = C.primaireDoux, coul = C.primaireTexte, point = null) {
  ctx.fillStyle = fond
  rr(ctx, x, y, t, t, t * 0.3)
  ctx.fill()
  texte(ctx, initiales, x + t / 2, y + t / 2 + t * 0.15, t * 0.38, 800, coul, 'center')
  if (point) {
    ctx.fillStyle = C.surface
    ctx.beginPath()
    ctx.arc(x + t - 2, y + t - 2, t * 0.17, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = point
    ctx.beginPath()
    ctx.arc(x + t - 2, y + t - 2, t * 0.11, 0, Math.PI * 2)
    ctx.fill()
  }
}
function vignette(ctx, img, x, y, t, point = null, decal = 0) {
  ctx.save()
  rr(ctx, x, y, t, t, t * 0.3)
  ctx.clip()
  ctx.drawImage(img, 120 + decal, 330, 460, 460, x, y, t, t)
  ctx.restore()
  if (point) avatar(ctx, '', x - 1000, y, t, 'transparent', 'transparent', null), pointSuivi(ctx, x + t - 2, y + t - 2, t * 0.17, point)
}
function pointSuivi(ctx, x, y, r, coul) {
  ctx.fillStyle = C.surface
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = coul
  ctx.beginPath()
  ctx.arc(x, y, r * 0.65, 0, Math.PI * 2)
  ctx.fill()
}
function boutonRond(ctx, x, y, r, fond, ic, coulIc, tIc = 22) {
  ctx.fillStyle = fond
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fill()
  icone(ctx, ic, x - tIc / 2, y - tIc / 2, tIc, coulIc, 2.2)
}
function onde(ctx, x, y, dt, rMax = 46, coul = 'rgba(79,70,229,') {
  // cercle de « tap » qui s'élargit
  if (dt < 0 || dt > 0.45) return
  const p = sortieCubique(dt / 0.45)
  ctx.fillStyle = coul + (0.28 * (1 - p)) + ')'
  ctx.beginPath()
  ctx.arc(x, y, 12 + rMax * p, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = coul + (0.22 * (1 - p)) + ')'
  ctx.beginPath()
  ctx.arc(x, y, 12 + rMax * 0.45 * p, 0, Math.PI * 2)
  ctx.fill()
}
const pop = (dt, d = 0.3) => (dt <= 0 ? 0 : clamp(ressort(dt, 2.2, 9), 0, 1.3))
const app = (b, b0, d = 0.25) => lisse(prog(T(b0), T(b0) + T(d), T(b)))

// ———————————————————— illustrations (dessinées une fois) ————————————————————
export const IMG = {}
export function preparerImages() {
  IMG.maison = dessinerMaison(700, 1000)
  IMG.carteRue = dessinerPlan(716, 340)
}

function dessinerMaison(W, H) {
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const x = c.getContext('2d')
  const r = alea(11)
  // ciel au crépuscule (mauve → bleu)
  const ciel = x.createLinearGradient(0, 0, 0, H * 0.62)
  ciel.addColorStop(0, '#1e1b4b')
  ciel.addColorStop(0.55, '#4338ca')
  ciel.addColorStop(1, '#a5b4fc')
  x.fillStyle = ciel
  x.fillRect(0, 0, W, H)
  // étoiles
  x.fillStyle = 'rgba(255,255,255,0.8)'
  for (let i = 0; i < 40; i++) {
    x.globalAlpha = 0.25 + r() * 0.6
    x.fillRect(r() * W, r() * H * 0.3, 2, 2)
  }
  x.globalAlpha = 1
  // maisons voisines (ombres)
  const sol = H * 0.82
  x.fillStyle = '#312e81'
  x.fillRect(-10, sol - 520, 190, 520)
  x.beginPath()
  x.moveTo(-10, sol - 520)
  x.lineTo(85, sol - 640)
  x.lineTo(180, sol - 520)
  x.fill()
  x.fillRect(W - 170, sol - 560, 190, 560)
  x.fillStyle = '#3730a3'
  for (const [wx, wy] of [[30, sol - 430], [110, sol - 430], [30, sol - 290], [110, sol - 290], [W - 140, sol - 460], [W - 70, sol - 460], [W - 140, sol - 320], [W - 70, sol - 320]]) {
    x.fillStyle = r() > 0.6 ? 'rgba(255,209,102,0.85)' : '#4338ca'
    x.fillRect(wx, wy, 44, 70)
  }
  // la maison vide (au centre)
  const mx = 175, mw = W - 345, mh = 600
  x.fillStyle = '#e7e5f2'
  x.fillRect(mx, sol - mh, mw, mh)
  // briques suggérées
  x.strokeStyle = 'rgba(99,102,241,0.10)'
  x.lineWidth = 2
  for (let y = sol - mh + 18; y < sol; y += 18) {
    x.beginPath()
    x.moveTo(mx, y)
    x.lineTo(mx + mw, y)
    x.stroke()
  }
  // toit
  x.fillStyle = '#1f2640'
  x.beginPath()
  x.moveTo(mx - 18, sol - mh)
  x.lineTo(mx + mw / 2, sol - mh - 150)
  x.lineTo(mx + mw + 18, sol - mh)
  x.closePath()
  x.fill()
  // corniche
  x.fillStyle = '#c7c2e8'
  x.fillRect(mx - 10, sol - mh - 6, mw + 20, 16)
  // fenêtres : volets fermés (maison vide)
  const fen = (fx, fy, ferme) => {
    x.fillStyle = '#c7c2e8'
    x.fillRect(fx - 8, fy - 8, 96, 146)
    if (ferme) {
      x.fillStyle = '#6d63c9'
      x.fillRect(fx, fy, 80, 130)
      x.strokeStyle = 'rgba(30,27,75,0.35)'
      x.lineWidth = 3
      for (let k = 12; k < 130; k += 12) {
        x.beginPath()
        x.moveTo(fx + 4, fy + k)
        x.lineTo(fx + 76, fy + k)
        x.stroke()
      }
    } else {
      x.fillStyle = '#1f2640'
      x.fillRect(fx, fy, 80, 130)
      x.fillStyle = 'rgba(165,180,252,0.18)'
      x.fillRect(fx + 6, fy + 6, 30, 118)
      x.strokeStyle = '#e7e5f2'
      x.lineWidth = 6
      x.beginPath()
      x.moveTo(fx + 40, fy)
      x.lineTo(fx + 40, fy + 130)
      x.moveTo(fx, fy + 52)
      x.lineTo(fx + 80, fy + 52)
      x.stroke()
    }
  }
  fen(mx + 40, sol - mh + 70, true)
  fen(mx + mw - 120, sol - mh + 70, false)
  fen(mx + 40, sol - mh + 300, false)
  // porte
  x.fillStyle = '#c7c2e8'
  x.fillRect(mx + mw - 138, sol - 250, 116, 250)
  x.fillStyle = '#3730a3'
  x.fillRect(mx + mw - 126, sol - 238, 92, 238)
  x.fillStyle = '#ffd166'
  x.beginPath()
  x.arc(mx + mw - 48, sol - 120, 5, 0, Math.PI * 2)
  x.fill()
  // boîte aux lettres pleine (indice de maison vide)
  x.fillStyle = '#9ca3af'
  x.fillRect(mx + 60, sol - 150, 70, 46)
  x.fillStyle = '#f8fafc'
  x.fillRect(mx + 68, sol - 162, 54, 14)
  // trottoir et rue
  x.fillStyle = '#4c4f7a'
  x.fillRect(0, sol, W, 26)
  x.fillStyle = '#272a4d'
  x.fillRect(0, sol + 26, W, H - sol)
  x.fillStyle = 'rgba(255,255,255,0.25)'
  for (let k = 0; k < W; k += 120) x.fillRect(k + 20, sol + 120, 70, 8)
  // lampadaire
  x.fillStyle = '#1e1b4b'
  x.fillRect(W - 210, sol - 380, 8, 380)
  const halo = x.createRadialGradient(W - 206, sol - 382, 2, W - 206, sol - 382, 120)
  halo.addColorStop(0, 'rgba(255,224,160,0.95)')
  halo.addColorStop(0.15, 'rgba(255,209,102,0.45)')
  halo.addColorStop(1, 'rgba(255,209,102,0)')
  x.fillStyle = halo
  x.fillRect(W - 330, sol - 500, 250, 250)
  // végétation
  x.fillStyle = '#1e1b4b'
  for (let k = 0; k < 7; k++) {
    x.beginPath()
    x.arc(mx - 20 + k * 30, sol - 10 - (k % 2) * 12, 36, 0, Math.PI * 2)
    x.fill()
  }
  return c
}

function dessinerPlan(W, H) {
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const x = c.getContext('2d')
  x.fillStyle = '#e8eaf6'
  x.fillRect(0, 0, W, H)
  const r = alea(5)
  x.fillStyle = '#f5f6fb'
  for (let i = 0; i < 26; i++) {
    rr(x, r() * W - 40, r() * H - 30, 90 + r() * 120, 60 + r() * 90, 8)
    x.fill()
  }
  x.fillStyle = '#dfe3f5'
  rr(x, W * 0.62, H * 0.08, 210, 120, 24)
  x.fill()
  x.strokeStyle = '#c7d2fe'
  x.lineWidth = 26
  x.beginPath()
  x.moveTo(-20, H * 0.85)
  x.bezierCurveTo(W * 0.3, H * 0.6, W * 0.6, H * 1.05, W + 20, H * 0.7)
  x.stroke()
  x.strokeStyle = '#ffffff'
  x.lineCap = 'round'
  for (const [w, pts] of [
    [18, [[-20, H * 0.45], [W + 20, H * 0.38]]],
    [14, [[W * 0.28, -20], [W * 0.36, H + 20]]],
    [12, [[W * 0.7, -20], [W * 0.62, H + 20]]],
    [9, [[-20, H * 0.15], [W + 20, H * 0.22]]],
    [9, [[W * 0.05, H + 20], [W * 0.55, -20]]],
  ]) {
    x.lineWidth = w
    x.beginPath()
    x.moveTo(...pts[0])
    x.lineTo(...pts[1])
    x.stroke()
  }
  return c
}

// ———————————————————— le logo (icône de l'application) ————————————————————
const MAISON = 'M256 112 L404 226 C412 232 416 240 416 250 L416 380 C416 394 405 404 392 404 L120 404 C107 404 96 394 96 380 L96 250 C96 240 100 232 108 226 Z'
const LETTRE_P = 'M214 244 H274 C298 244 316 262 316 285 C316 308 298 326 274 326 H248 V352 H214 Z M248 272 V298 H271 C279 298 284 292 284 285 C284 278 279 272 271 272 Z'
/** Icône Prospect’Immo. `e` = étapes de construction (0 → 1) : carre, maison, lettre, point. */
export function peindreIcone(ctx, x, y, taille, e = {}) {
  const { carre = 1, maison = 1, lettre = 1, point = 1, ombrePortee = false } = e
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(taille / 512, taille / 512)
  if (carre > 0) {
    ctx.save()
    ctx.translate(256, 256)
    const s = carre
    ctx.scale(s, s)
    ctx.translate(-256, -256)
    if (ombrePortee) {
      ctx.fillStyle = 'rgba(15,10,60,0.35)'
      rr(ctx, 10, 40, 492, 492, 120)
      ctx.fill()
    }
    ctx.fillStyle = degrade(ctx, 0, 0, 512, 512, '#4F46E5', '#8B5CF6')
    rr(ctx, 0, 0, 512, 512, 120)
    ctx.fill()
    ctx.restore()
  }
  if (maison > 0) {
    const p = chemin(MAISON)
    if (maison < 1) {
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = 14
      ctx.lineJoin = 'round'
      ctx.setLineDash([1400 * maison, 1400])
      ctx.stroke(p)
      ctx.setLineDash([])
      ctx.globalAlpha = clamp((maison - 0.6) / 0.4)
    }
    ctx.fillStyle = '#ffffff'
    ctx.fill(p)
    ctx.globalAlpha = 1
  }
  if (lettre > 0) {
    ctx.save()
    ctx.translate(265, 298)
    const s = lettre
    ctx.scale(s, s)
    ctx.translate(-265, -298)
    ctx.fillStyle = '#4F46E5'
    ctx.fill(chemin(LETTRE_P), 'evenodd')
    ctx.restore()
  }
  if (point > 0) {
    ctx.fillStyle = '#FFD166'
    ctx.beginPath()
    ctx.arc(352, 176, 22 * point, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

// ———————————————————— téléphone : cadre + écran ————————————————————
export const TEL = { k: 764 / 414, W: 764, H: 1602, ptW: 414, ptH: 868 }

export function peindreTelephone(ctx, b) {
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.clearRect(0, 0, TEL.W, TEL.H)
  ctx.setTransform(TEL.k, 0, 0, TEL.k, 0, 0)
  rr(ctx, 0, 0, 414, 868, 62)
  ctx.fillStyle = '#0c0e16'
  ctx.fill()
  rr(ctx, 2.5, 2.5, 409, 863, 59.5)
  ctx.strokeStyle = 'rgba(196,181,253,0.18)'
  ctx.lineWidth = 2
  ctx.stroke()
  ctx.save()
  rr(ctx, 12, 12, 390, 844, 50)
  ctx.clip()
  ctx.translate(12, 12)
  if (b < 16) ecranReperer(ctx, b - 8)
  else if (b < 24) ecranAppel(ctx, b - 16)
  else if (b < 32) ecranRelances(ctx, b - 24)
  else ecranMarche(ctx, b - 32)
  ctx.restore()
  rr(ctx, 207 - 62, 23, 124, 35, 17.5)
  ctx.fillStyle = '#000'
  ctx.fill()
  ctx.setTransform(1, 0, 0, 1, 0, 0)
}

function barreEtat(ctx, clair = false) {
  const c = clair ? '#ffffff' : C.texte
  texte(ctx, '9:41', 44, 34, 15.5, 700, c, 'center')
  ctx.fillStyle = c
  for (let i = 0; i < 4; i++) {
    rr(ctx, 293 + i * 5.2, 31 - (4 + i * 2.4), 3.4, 4 + i * 2.4, 1)
    ctx.fill()
  }
  ctx.strokeStyle = c
  ctx.lineWidth = 1.6
  rr(ctx, 336, 21.5, 24, 12, 3.5)
  ctx.stroke()
  rr(ctx, 338, 23.5, 17, 8, 2)
  ctx.fill()
  rr(ctx, 361.5, 25.5, 2, 4, 1)
  ctx.fill()
  ctx.beginPath()
  ctx.arc(322, 33, 1.8, 0, Math.PI * 2)
  ctx.fill()
  ctx.lineWidth = 1.8
  for (const rad of [5.5, 9.5]) {
    ctx.beginPath()
    ctx.arc(322, 33, rad, Math.PI * 1.25, Math.PI * 1.75)
    ctx.stroke()
  }
}

// ———— Écran 1 : Repérer (capture terrain hors ligne) ————
function ecranReperer(ctx, lb) {
  const b = lb + 8
  const tB = T(b)
  const phaseForm = prog(T(12.5), T(12.95), tB)
  // —— appareil photo ——
  if (phaseForm < 1) {
    ctx.save()
    ctx.globalAlpha = 1 - phaseForm
    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, 390, 844)
    const zoom = 1 + 0.04 * M.declencheurs.filter((d) => b >= d).length + 0.02 * Math.sin(b * 0.8)
    ctx.save()
    rr(ctx, 0, 92, 390, 560, 0)
    ctx.clip()
    const iw = 390 * zoom, ih = (iw * 1000) / 700
    ctx.drawImage(IMG.maison, 195 - iw / 2, 372 - ih / 2 + 40, iw, ih)
    // mise au point
    const dtF = tB - T(M.miseAuPoint)
    if (dtF > 0 && b < 12.4) {
      const s = 1 + 0.5 * (1 - sortieCubique(clamp(dtF / 0.25)))
      const a = dtF < 0.5 ? 0.5 + 0.5 * Math.cos(dtF * 40) : 0.9
      ctx.strokeStyle = `rgba(255,224,160,${a})`
      ctx.lineWidth = 2.5
      const cx = 248, cy = 470, d = 54 * s
      for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        ctx.beginPath()
        ctx.moveTo(cx + sx * d, cy + sy * (d - 16))
        ctx.lineTo(cx + sx * d, cy + sy * d)
        ctx.lineTo(cx + sx * (d - 16), cy + sy * d)
        ctx.stroke()
      }
    }
    ctx.restore()
    // haut : mode + compteur
    barreEtat(ctx, true)
    const nb = M.declencheurs.filter((d) => b >= d).length
    pilule(ctx, `${nb}/5 photos`, 195, 56, { fond: 'rgba(255,255,255,0.16)', coul: '#fff', taille: 13, h: 28, align: 'center', ic: 'camera' })
    // flash de déclenchement
    let flash = 0
    for (const d of M.declencheurs) flash = Math.max(flash, tB >= T(d) ? Math.exp(-(tB - T(d)) * 22) : 0)
    if (flash > 0.01) {
      ctx.fillStyle = `rgba(255,255,255,${0.92 * flash})`
      ctx.fillRect(0, 92, 390, 560)
    }
    // bas : vignette, déclencheur, retournement
    ctx.fillStyle = '#000'
    ctx.fillRect(0, 652, 390, 192)
    const dernier = M.declencheurs.filter((d) => b >= d).pop()
    if (dernier !== undefined) {
      const dt = tB - T(dernier)
      const p = sortieCubique(clamp(dt / 0.22))
      const x0 = lerp(140, 44, p), y0 = lerp(300, 712, p), t0 = lerp(160, 58, p)
      ctx.save()
      rr(ctx, x0, y0, t0, t0, 12)
      ctx.clip()
      ctx.drawImage(IMG.maison, 100 + nb * 18, 260, 480, 480, x0, y0, t0, t0)
      ctx.restore()
      rr(ctx, x0, y0, t0, t0, 12)
      ctx.strokeStyle = '#fff'
      ctx.lineWidth = 2
      ctx.stroke()
    }
    const presse = M.declencheurs.reduce((m, d) => Math.max(m, tB >= T(d) ? Math.exp(-(tB - T(d)) * 16) : 0), 0)
    ctx.strokeStyle = '#fff'
    ctx.lineWidth = 4.5
    ctx.beginPath()
    ctx.arc(195, 742, 36, 0, Math.PI * 2)
    ctx.stroke()
    ctx.fillStyle = '#fff'
    ctx.beginPath()
    ctx.arc(195, 742, 29 * (1 - 0.14 * presse), 0, Math.PI * 2)
    ctx.fill()
    boutonRond(ctx, 330, 742, 24, 'rgba(255,255,255,0.16)', 'image', '#fff', 22)
    ctx.restore()
  }
  if (phaseForm <= 0) return
  // —— formulaire (application) ——
  ctx.save()
  ctx.globalAlpha = phaseForm
  ctx.translate(0, 50 * (1 - sortieCubique(phaseForm)))
  ctx.fillStyle = C.fond
  ctx.fillRect(0, -60, 390, 960)
  barreEtat(ctx)
  boutonRond(ctx, 36, 78, 20, C.surface, 'x', C.texte, 18)
  texte(ctx, 'Nouveau repérage', 195, 84, 17, 800, C.texte, 'center')
  pilule(ctx, 'Hors ligne', 374, 66, { fond: C.surface2, coul: C.doux, taille: 11, h: 26, ic: 'wifi-off', align: 'right' })
  // photos
  for (let i = 0; i < 5; i++) {
    const x = 16 + i * 73.5
    ctx.save()
    rr(ctx, x, 110, 66, 88, 14)
    ctx.clip()
    ctx.drawImage(IMG.maison, 90 + i * 34, 220 + (i % 2) * 40, 520 - i * 20, 700, x, 110, 66, 88)
    ctx.restore()
  }
  // carte + épingle
  ctx.save()
  rr(ctx, 16, 212, 358, 172, 22)
  ctx.clip()
  ctx.drawImage(IMG.carteRue, 16, 212, 358, 172)
  const dtP = tB - T(M.epingle)
  if (dtP > 0) {
    const chute = Math.min(1, dtP / 0.16)
    const rebond = dtP > 0.16 ? Math.exp(-(dtP - 0.16) * 9) * Math.sin((dtP - 0.16) * 26) * 10 : 0
    const py = lerp(150, 300, entreeCubique(chute)) - Math.abs(rebond)
    if (dtP > 0.16) {
      const p = clamp((dtP - 0.16) / 0.6)
      ctx.strokeStyle = `rgba(79,70,229,${0.6 * (1 - p)})`
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.ellipse(195, 306, 14 + 40 * p, 5 + 14 * p, 0, 0, Math.PI * 2)
      ctx.stroke()
    }
    ctx.fillStyle = 'rgba(15,23,42,0.2)'
    ctx.beginPath()
    ctx.ellipse(195, 306, 9, 3.5, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.save()
    ctx.translate(195, py)
    ctx.fillStyle = degrade(ctx, -16, -44, 16, 0)
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.bezierCurveTo(-6, -12, -17, -20, -17, -32)
    ctx.arc(0, -32, 17, Math.PI, 0)
    ctx.bezierCurveTo(17, -20, 6, -12, 0, 0)
    ctx.fill()
    ctx.fillStyle = '#fff'
    ctx.beginPath()
    ctx.arc(0, -32, 6.5, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }
  ctx.restore()
  pilule(ctx, 'GPS ±8 m', 28, 350, { fond: 'rgba(255,255,255,0.92)', coul: C.primaireTexte, taille: 11, h: 24, ic: 'map-pin' })
  // adresse (tapée)
  ctx.fillStyle = C.surface2
  rr(ctx, 16, 396, 358, 56, 16)
  ctx.fill()
  icone(ctx, 'map-pin', 30, 413, 22, C.primaire, 2.2)
  const adresse = 'Rue de la Montagne 88, Charleroi'
  const n = Math.round(adresse.length * prog(T(M.epingle) + 0.08, T(M.epingle) + 0.45, tB))
  texte(ctx, adresse.slice(0, n), 62, 430, 15, 700, C.texte)
  // catégories
  const sel = pop(tB - T(M.categorie))
  pilule(ctx, 'Annonce / affiche', 16, 466, { fond: C.surface, coul: C.doux, taille: 13, h: 40, padX: 14, poids: 700 })
  ctx.save()
  const xm = 280
  ctx.translate(xm, 486)
  const s = sel > 0 ? 0.8 + 0.2 * sel : 1
  ctx.scale(s, s)
  ctx.translate(-xm, -486)
  pilule(ctx, 'Maison vide', 374, 466, {
    fond: sel > 0 ? C.maisonVide : C.surface,
    coul: sel > 0 ? '#fff' : C.doux,
    taille: 13,
    h: 40,
    padX: 14,
    ic: sel > 0 ? 'check' : null,
    align: 'right',
  })
  ctx.restore()
  // propriétaire + note (texte d'aide)
  carte(ctx, 16, 522, 358, 150, 22)
  texte(ctx, 'Propriétaire', 32, 552, 13, 600, C.doux)
  texte(ctx, 'À retrouver (boîte aux lettres pleine)', 32, 576, 14.5, 600, C.texte)
  texte(ctx, 'Relance', 32, 612, 13, 600, C.doux)
  pilule(ctx, 'Dans 1 semaine', 32, 624, { fond: C.primaireDoux, coul: C.primaireTexte, taille: 12, h: 28, ic: 'clock' })
  // bouton
  const dtTap = tB - T(M.tapEnregistrer)
  const ok = tB >= T(M.enregistre)
  const sb = dtTap > 0 && dtTap < 0.2 ? 1 - 0.04 * Math.sin((dtTap / 0.2) * Math.PI) : 1
  ctx.save()
  ctx.translate(195, 769)
  ctx.scale(sb, sb)
  ctx.translate(-195, -769)
  ombre(ctx, 16, 740, 358, 58, 20, 2)
  ctx.fillStyle = ok ? C.vert : degrade(ctx, 16, 740, 374, 798)
  rr(ctx, 16, 740, 358, 58, 20)
  ctx.fill()
  if (ok) {
    icone(ctx, 'circle-check', 108, 757, 24, '#fff', 2.4)
    texte(ctx, 'Enregistré hors ligne', 214, 776, 16.5, 800, '#fff', 'center')
  } else {
    icone(ctx, 'camera', 92, 757, 23, '#fff', 2.3)
    texte(ctx, 'Enregistrer le repérage', 210, 776, 16.5, 800, '#fff', 'center')
  }
  ctx.restore()
  onde(ctx, 250, 769, tB - T(M.tapEnregistrer), 60, 'rgba(255,255,255,')
  ctx.restore()
}

// ———— Écran 2 : fiche contact → appel → résultat ————
function ecranAppel(ctx, lb) {
  const b = lb + 16
  const tB = T(b)
  const enAppel = b >= M.tapOption && b < M.raccroche
  if (enAppel) return ecranEnAppel(ctx, b, tB)
  ficheContact(ctx, b, tB)
  if (b >= M.tapAppeler && b < M.tapOption + 0.2) feuilleContacter(ctx, b, tB)
  if (b >= M.raccroche) feuilleResultat(ctx, b, tB)
}

function ficheContact(ctx, b, tB) {
  ctx.fillStyle = C.fond
  ctx.fillRect(0, 0, 390, 844)
  const g = ctx.createLinearGradient(0, 0, 0, 330)
  g.addColorStop(0, '#e6e8ff')
  g.addColorStop(1, C.fond)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 390, 330)
  barreEtat(ctx)
  boutonRond(ctx, 36, 80, 21, C.surface, 'chevron-left', C.texte, 20)
  pilule(ctx, 'Modifier', 374, 62, { fond: C.surface, coul: C.texte, taille: 13, h: 38, padX: 16, align: 'right' })
  avatar(ctx, 'MD', 147, 108, 96, '#fef3c7', '#a16207', C.orange)
  texte(ctx, 'Marc Dupont', 195, 246, 25, 800, C.texte, 'center')
  police(ctx, 12, 700)
  pilule(ctx, 'Prospect', 128, 260, { fond: C.primaireDoux, coul: C.primaireTexte, taille: 12, h: 26 })
  pilule(ctx, 'Chaud', 208, 260, { fond: '#ffe4e9', coul: C.chaud, taille: 12, h: 26, ic: 'flame' })
  texte(ctx, 'Origine : annonce de particulier', 195, 306, 12.5, 600, C.doux, 'center')
  const xs = [60.75, 150.25, 239.75, 329.25]
  const boutons = [
    ['WhatsApp', C.whatsapp, 'message-circle', '#fff'],
    ['Appeler', null, 'phone', '#fff'],
    ['SMS', C.surface, 'message-square', C.texte],
    ['Email', C.surface, 'mail', C.texte],
  ]
  boutons.forEach(([nom, fond, ic, coul], i) => {
    const x = xs[i]
    const presse = i === 1 && tB >= T(M.tapAppeler) && tB < T(M.tapAppeler) + 0.25 ? 0.9 + 0.1 * prog(T(M.tapAppeler), T(M.tapAppeler) + 0.25, tB) : 1
    ctx.save()
    ctx.translate(x, 366)
    ctx.scale(presse, presse)
    ctx.translate(-x, -366)
    if (!fond) {
      ctx.fillStyle = 'rgba(79,70,229,0.35)'
      ctx.beginPath()
      ctx.arc(x, 372, 30, 0, Math.PI * 2)
      ctx.fill()
    }
    boutonRond(ctx, x, 366, 30, fond ?? degrade(ctx, x - 30, 336, x + 30, 396), ic, coul, 24)
    if (fond === C.surface) {
      ctx.strokeStyle = C.bord
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.arc(x, 366, 30, 0, Math.PI * 2)
      ctx.stroke()
    }
    ctx.restore()
    texte(ctx, nom, x, 418, 12.5, 700, C.texte, 'center')
  })
  onde(ctx, xs[1], 366, tB - T(M.tapAppeler), 50)
  carte(ctx, 16, 446, 358, 112, 24)
  ctx.fillStyle = C.surface2
  rr(ctx, 28, 458, 161, 88, 18)
  ctx.fill()
  rr(ctx, 201, 458, 161, 88, 18)
  ctx.fill()
  texte(ctx, 'Dernier contact', 42, 484, 12, 600, C.doux)
  texte(ctx, 'il y a 92 j', 42, 516, 18, 800, C.rouge)
  texte(ctx, 'Prochaine relance', 215, 484, 12, 600, C.doux)
  pilule(ctx, 'En retard', 215, 500, { fond: '#fde8e8', coul: C.rouge, taille: 12, h: 28 })
  carte(ctx, 16, 574, 358, 136, 24)
  texte(ctx, 'Coordonnées', 32, 606, 15, 800, C.texte)
  boutonRond(ctx, 50, 642, 18, C.primaireDoux, 'phone', C.primaireTexte, 18)
  texte(ctx, '+32 476 12 34 56', 80, 648, 15, 700, C.texte)
  texte(ctx, 'GSM', 340, 648, 12, 600, C.doux, 'right')
  boutonRond(ctx, 50, 684, 18, C.primaireDoux, 'mail', C.primaireTexte, 18)
  texte(ctx, 'marc.dupont@exemple.be', 80, 690, 14, 600, C.texte)
}

function feuilleContacter(ctx, b, tB) {
  const t0 = T(M.tapAppeler) + 0.08
  const p = sortieCubique(prog(t0, t0 + 0.26, tB))
  const ferme = sortieCubique(prog(T(M.tapOption) + 0.02, T(M.tapOption) + 0.18, tB))
  ctx.fillStyle = `rgba(15,23,42,${0.38 * p * (1 - ferme)})`
  ctx.fillRect(0, 0, 390, 844)
  const y = lerp(844, 452, p) + 400 * ferme
  ctx.save()
  ombre(ctx, 0, y, 390, 420, 30, 3)
  ctx.fillStyle = C.surface
  rr(ctx, 0, y, 390, 430, 30)
  ctx.fill()
  ctx.fillStyle = C.bord
  rr(ctx, 175, y + 10, 40, 5, 3)
  ctx.fill()
  texte(ctx, 'Contacter Marc Dupont', 28, y + 54, 18, 800, C.texte)
  boutonRond(ctx, 352, y + 48, 18, C.surface2, 'x', C.texte, 16)
  const options = [
    ['Appeler', '+32 476 12 34 56', null, 'phone'],
    ['WhatsApp', 'Ouvre la conversation', C.whatsapp, 'message-circle'],
    ['SMS', 'Message prêt à envoyer', C.surface2, 'message-square'],
  ]
  options.forEach(([titre, sous, fond, ic], i) => {
    const dt = tB - T(M.options[i])
    if (dt <= 0) return
    const s = clamp(ressort(dt, 2.4, 10), 0, 1.2)
    const yy = y + 86 + i * 78
    ctx.save()
    ctx.globalAlpha = clamp(dt / 0.08)
    ctx.translate(195, yy + 32)
    ctx.scale(0.85 + 0.15 * s, 0.85 + 0.15 * s)
    ctx.translate(-195, -yy - 32)
    ctx.fillStyle = i === 0 && tB >= T(M.tapOption) ? C.primaireDoux : C.fond
    rr(ctx, 16, yy, 358, 66, 20)
    ctx.fill()
    boutonRond(ctx, 52, yy + 33, 22, fond ?? degrade(ctx, 30, yy + 11, 74, yy + 55), ic, fond === C.surface2 ? C.texte : '#fff', 20)
    texte(ctx, titre, 88, yy + 29, 16, 800, C.texte)
    texte(ctx, sous, 88, yy + 49, 13, 600, C.doux)
    icone(ctx, 'chevron-right', 340, yy + 22, 20, C.doux, 2)
    ctx.restore()
  })
  onde(ctx, 195, y + 86 + 33, tB - T(M.tapOption), 70)
  ctx.restore()
}

function ecranEnAppel(ctx, b, tB) {
  const g = ctx.createLinearGradient(0, 0, 390, 844)
  g.addColorStop(0, '#1e1b4b')
  g.addColorStop(0.55, '#312e81')
  g.addColorStop(1, '#4f46e5')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 390, 844)
  const halo = ctx.createRadialGradient(195, 330, 10, 195, 330, 260)
  halo.addColorStop(0, 'rgba(139,92,246,0.55)')
  halo.addColorStop(1, 'rgba(139,92,246,0)')
  ctx.fillStyle = halo
  ctx.fillRect(0, 0, 390, 844)
  barreEtat(ctx, true)
  texte(ctx, 'Marc Dupont', 195, 168, 30, 800, '#fff', 'center')
  const sec = Math.max(0, Math.floor((tB - T(M.tapOption)) * 2.2))
  texte(ctx, `Appel en cours · 00:0${Math.min(9, sec)}`, 195, 198, 15, 600, 'rgba(255,255,255,0.75)', 'center')
  // anneaux qui pulsent sur la sonnerie
  for (let k = 0; k < 3; k++) {
    const ph = ((b - M.sonnerie[0]) % 1 + k / 3) % 1
    if (b < M.sonnerie[0]) break
    ctx.strokeStyle = `rgba(196,181,253,${0.55 * (1 - ph)})`
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.arc(195, 340, 62 + 90 * ph, 0, Math.PI * 2)
    ctx.stroke()
  }
  ctx.fillStyle = 'rgba(255,255,255,0.14)'
  ctx.beginPath()
  ctx.arc(195, 340, 62, 0, Math.PI * 2)
  ctx.fill()
  texte(ctx, 'MD', 195, 356, 40, 800, '#fff', 'center')
  const xs = [95, 195, 295]
  ;[['mic-off', 'Muet'], ['grid-3x3', 'Clavier'], ['volume-2', 'Haut-parleur']].forEach(([ic, nom], i) => {
    boutonRond(ctx, xs[i], 560, 34, 'rgba(255,255,255,0.14)', ic, '#fff', 26)
    texte(ctx, nom, xs[i], 616, 12.5, 600, 'rgba(255,255,255,0.8)', 'center')
  })
  const presse = tB > T(M.raccroche) - 0.12 ? 0.9 : 1
  ctx.save()
  ctx.translate(195, 730)
  ctx.scale(presse, presse)
  boutonRond(ctx, 0, 0, 38, C.rouge, 'phone-off', '#fff', 28)
  ctx.restore()
}

function feuilleResultat(ctx, b, tB) {
  const p = sortieCubique(prog(T(M.raccroche), T(M.raccroche) + 0.3, tB))
  ctx.fillStyle = `rgba(15,23,42,${0.38 * p})`
  ctx.fillRect(0, 0, 390, 844)
  const y = lerp(844, 300, p)
  ombre(ctx, 0, y, 390, 560, 30, 3)
  ctx.fillStyle = C.surface
  rr(ctx, 0, y, 390, 600, 30)
  ctx.fill()
  ctx.fillStyle = C.bord
  rr(ctx, 175, y + 10, 40, 5, 3)
  ctx.fill()
  texte(ctx, 'Comment s’est passé', 28, y + 54, 19, 800, C.texte)
  texte(ctx, 'l’appel ?', 28, y + 78, 19, 800, C.texte)
  texte(ctx, 'Marc Dupont · 2 min', 28, y + 102, 13, 600, C.doux)
  const choix = ['RDV obtenu', 'Pas de réponse', 'Rappeler plus tard', 'Pas intéressé']
  const selR = tB >= T(M.tapResultat)
  const pos = [[28, 122], [168, 122], [28, 168], [210, 168]]
  choix.forEach((c, i) => {
    const actif = i === 0 && selR
    const s = actif ? 0.92 + 0.08 * clamp(ressort(tB - T(M.tapResultat), 2.5, 10), 0, 1.3) : 1
    ctx.save()
    const [px, py] = pos[i]
    ctx.translate(px + 60, y + py + 19)
    ctx.scale(s, s)
    ctx.translate(-px - 60, -y - py - 19)
    pilule(ctx, c, px, y + py, { fond: actif ? C.primaire : C.surface2, coul: actif ? '#fff' : C.texte, taille: 13.5, h: 38, padX: 15, ic: actif ? 'check' : null })
    ctx.restore()
  })
  onde(ctx, 88, y + 141, tB - T(M.tapResultat), 50)
  texte(ctx, 'Prochaine relance', 28, y + 242, 13, 700, C.doux)
  const relances = ['+1 semaine', '+1 mois', '+3 mois']
  const selRel = tB >= T(M.tapRelance)
  let x = 28
  relances.forEach((c, i) => {
    const actif = i === 2 && selRel
    const w = pilule(ctx, c, x, y + 256, { fond: actif ? C.primaire : C.surface2, coul: actif ? '#fff' : C.texte, taille: 13.5, h: 38, padX: 15 })
    if (i === 2) onde(ctx, x + w / 2, y + 275, tB - T(M.tapRelance), 46)
    x += w + 8
  })
  if (selRel) texte(ctx, 'Relance le 2 janvier · ajoutée à l’agenda', 28, y + 324, 13, 700, C.primaireTexte)
  const ok = tB >= T(M.tapEnregistrer2) + 0.08
  const dtTap = tB - T(M.tapEnregistrer2)
  const sb = dtTap > 0 && dtTap < 0.2 ? 1 - 0.04 * Math.sin((dtTap / 0.2) * Math.PI) : 1
  ctx.save()
  ctx.translate(195, y + 381)
  ctx.scale(sb, sb)
  ctx.translate(-195, -y - 381)
  ctx.fillStyle = ok ? C.vert : degrade(ctx, 16, y + 352, 374, y + 410)
  rr(ctx, 16, y + 352, 358, 58, 20)
  ctx.fill()
  if (ok) {
    icone(ctx, 'circle-check', 118, y + 369, 24, '#fff', 2.4)
    texte(ctx, 'Enregistré', 210, y + 388, 17, 800, '#fff', 'center')
  } else texte(ctx, 'Enregistrer', 195, y + 388, 17, 800, '#fff', 'center')
  ctx.restore()
  onde(ctx, 195, y + 381, dtTap, 70, 'rgba(255,255,255,')
}

// ———— Écran 3 : Aujourd'hui → notification → Agenda (vue Mois) ————
function ecranRelances(ctx, lb) {
  const b = lb + 24
  const tB = T(b)
  const versAgenda = entreeSortieCubique(prog(T(M.agenda), T(M.agenda) + 0.3, tB))
  if (versAgenda < 1) {
    ctx.save()
    ctx.translate(-390 * versAgenda, 0)
    ecranAujourdhui(ctx, b, tB)
    ctx.restore()
  }
  if (versAgenda > 0) {
    ctx.save()
    ctx.translate(390 * (1 - versAgenda), 0)
    ecranAgenda(ctx, b, tB)
    ctx.restore()
  }
  // notification (glisse depuis le haut)
  const dtN = tB - T(M.notification)
  if (dtN > 0 && b < M.agenda + 0.6) {
    const entre = clamp(ressort(dtN, 1.8, 8), 0, 1.15)
    const sort = entreeCubique(prog(T(M.agenda) + 0.15, T(M.agenda) + 0.5, tB))
    const y = lerp(-100, 12, entre) - 120 * sort
    ctx.save()
    ombre(ctx, 12, y, 366, 80, 26, 4)
    ctx.fillStyle = 'rgba(255,255,255,0.97)'
    rr(ctx, 12, y, 366, 82, 26)
    ctx.fill()
    peindreIcone(ctx, 26, y + 16, 40)
    texte(ctx, 'PROSPECT’IMMO', 80, y + 30, 11, 800, C.doux)
    texte(ctx, 'maintenant', 362, y + 30, 11, 600, C.doux, 'right')
    texte(ctx, 'Relancer Nathalie Lambert', 80, y + 52, 15, 800, C.texte)
    texte(ctx, 'Sans nouvelles depuis 95 jours', 80, y + 70, 12.5, 600, C.doux)
    ctx.restore()
  }
}

function ecranAujourdhui(ctx, b, tB) {
  ctx.fillStyle = C.fond
  ctx.fillRect(0, 0, 390, 844)
  barreEtat(ctx)
  peindreIcone(ctx, 16, 56, 34)
  police(ctx, 18, 800)
  texte(ctx, 'Prospect', 58, 80, 18, 800, C.texte)
  const w = ctx.measureText('Prospect').width
  texte(ctx, '’Immo', 58 + w, 80, 18, 800, C.primaire)
  boutonRond(ctx, 354, 73, 19, C.surface2, 'bell', C.texte, 18)
  // carte d'accueil en dégradé
  ctx.save()
  ctx.fillStyle = 'rgba(79,70,229,0.35)'
  rr(ctx, 22, 112, 346, 196, 28)
  ctx.fill()
  ctx.fillStyle = degrade(ctx, 16, 100, 374, 296)
  rr(ctx, 16, 100, 358, 200, 28)
  ctx.fill()
  texte(ctx, 'Vendredi 2 octobre', 34, 132, 13, 600, 'rgba(255,255,255,0.82)')
  texte(ctx, 'Bon après-midi !', 34, 164, 26, 800, '#fff')
  texte(ctx, '4 relances à traiter aujourd’hui.', 34, 188, 14, 600, 'rgba(255,255,255,0.9)')
  const tuiles = [['2', 'En retard', C.rouge], ['2', 'Aujourd’hui', C.orange], ['2', 'Semaine', C.jaune], ['4', 'À jour', C.vert]]
  tuiles.forEach(([n, l, c], i) => {
    const x = 28 + i * 84
    ctx.fillStyle = 'rgba(255,255,255,0.16)'
    rr(ctx, x, 206, 78, 80, 18)
    ctx.fill()
    texte(ctx, n, x + 39, 244, 25, 800, '#fff', 'center')
    texte(ctx, l, x + 39, 270, 10.5, 700, 'rgba(255,255,255,0.92)', 'center')
    ctx.fillStyle = '#fff'
    ctx.beginPath()
    ctx.arc(x + 66, 218, 5.5, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = c
    ctx.beginPath()
    ctx.arc(x + 66, 218, 3.8, 0, Math.PI * 2)
    ctx.fill()
  })
  ctx.restore()
  // carte « Qui appeler en premier » (en-tête à bandeau, comme l'application)
  carte(ctx, 16, 318, 358, 410, 24)
  ctx.save()
  rr(ctx, 16, 318, 358, 410, 24)
  ctx.clip()
  ctx.fillStyle = C.primaireDoux
  ctx.fillRect(16, 318, 358, 92)
  ctx.fillStyle = C.bord
  ctx.fillRect(16, 409, 358, 1)
  ctx.restore()
  ctx.fillStyle = C.surface
  rr(ctx, 30, 332, 36, 36, 12)
  ctx.fill()
  icone(ctx, 'trophy', 38, 340, 20, C.primaireTexte, 2.2)
  texte(ctx, 'Qui appeler en premier', 76, 357, 17, 800, C.texte)
  ctx.fillStyle = C.primaire
  rr(ctx, 332, 336, 28, 28, 14)
  ctx.fill()
  texte(ctx, '4', 346, 356, 14, 800, '#fff', 'center')
  texte(ctx, 'Classés selon vos chances de réussite.', 30, 392, 12, 600, C.doux)
  const lignes = [
    ['Marc Dupont', 'prospect chaud · relance aujourd’hui', 'MD', C.orange, false],
    ['Rue de la Montagne 88', 'repéré aujourd’hui : appeler vite', null, C.orange, true],
    ['Nathalie Lambert', 'sans nouvelles depuis 95 j', 'NL', C.rouge, false],
    ['Rue Puissant 7, Gilly', 'relance en retard de 3 j', null, C.rouge, true],
  ]
  lignes.forEach(([nom, sous, ini, coul, bien], i) => {
    const dt = tB - T(M.lignes[i])
    if (dt <= 0) return
    const p = sortieExpo(clamp(dt / 0.35))
    const y = 420 + i * 76
    ctx.save()
    ctx.globalAlpha = clamp(dt / 0.12)
    ctx.translate(60 * (1 - p), 0)
    if (i > 0) {
      ctx.fillStyle = C.bord
      ctx.fillRect(30, y - 4, 330, 1)
    }
    if (ini) avatar(ctx, ini, 30, y + 6, 50, i === 2 ? '#dcfce7' : '#fef3c7', i === 2 ? '#15803d' : '#a16207')
    else {
      ctx.save()
      rr(ctx, 30, y + 6, 50, 50, 15)
      ctx.clip()
      ctx.drawImage(IMG.maison, 120 + i * 30, 300, 460, 460, 30, y + 6, 50, 50)
      ctx.restore()
    }
    pointSuivi(ctx, 77, y + 53, 8.5, coul)
    texte(ctx, nom, 94, y + 28, 15, 800, C.texte)
    texte(ctx, sous, 94, y + 47, 12, 600, C.doux)
    boutonRond(ctx, 338, y + 31, 22, C.primaireDoux, 'phone', C.primaireTexte, 19)
    ctx.restore()
  })
  // barre d'onglets
  ongletsBas(ctx, 0)
}

function ongletsBas(ctx, actif) {
  ombre(ctx, 12, 758, 366, 74, 30, 3)
  ctx.fillStyle = 'rgba(255,255,255,0.96)'
  rr(ctx, 12, 758, 366, 74, 30)
  ctx.fill()
  const noms = [['house', 'Aujourd’hui'], ['target', 'Prospection'], ['users', 'Contacts'], ['calendar-days', 'Agenda'], ['menu', 'Plus']]
  noms.forEach(([ic, nom], i) => {
    const x = 18 + i * 70.8
    if (i === actif) {
      ctx.fillStyle = C.primaireDoux
      rr(ctx, x, 764, 66, 62, 24)
      ctx.fill()
    }
    const c = i === actif ? C.primaireTexte : C.doux
    icone(ctx, ic, x + 22, 773, 22, c, 2.2)
    texte(ctx, nom, x + 33, 814, 9.5, 700, c, 'center')
  })
}

function ecranAgenda(ctx, b, tB) {
  ctx.fillStyle = C.fond
  ctx.fillRect(0, 0, 390, 844)
  barreEtat(ctx)
  texte(ctx, 'Agenda', 20, 96, 28, 800, C.texte)
  ctx.fillStyle = degrade(ctx, 230, 70, 374, 108)
  rr(ctx, 232, 70, 142, 40, 20)
  ctx.fill()
  icone(ctx, 'plus', 246, 80, 20, '#fff', 2.6)
  texte(ctx, 'Rendez-vous', 312, 96, 13, 800, '#fff', 'center')
  // sélecteur de vue : Mois choisi
  ctx.fillStyle = C.surface2
  rr(ctx, 16, 124, 358, 46, 16)
  ctx.fill()
  ;['Jour', 'Semaine', 'Mois', 'Trimestre'].forEach((v, i) => {
    const x = 20 + i * 87.5
    if (i === 2) {
      ombre(ctx, x, 128, 86, 38, 12)
      ctx.fillStyle = C.surface
      rr(ctx, x, 128, 86, 38, 12)
      ctx.fill()
    }
    texte(ctx, v, x + 43, 153, 13, 800, i === 2 ? C.primaireTexte : C.doux, 'center')
  })
  boutonRond(ctx, 38, 206, 19, C.surface, 'chevron-left', C.texte, 18)
  boutonRond(ctx, 352, 206, 19, C.surface, 'chevron-right', C.texte, 18)
  texte(ctx, 'Octobre 2026', 195, 212, 17, 800, C.texte, 'center')
  carte(ctx, 16, 236, 358, 330, 24)
  ;['L', 'M', 'M', 'J', 'V', 'S', 'D'].forEach((l, i) => texte(ctx, l, 44 + i * 50.5, 266, 11.5, 800, C.doux, 'center'))
  // octobre 2026 commence un jeudi
  const jours = []
  for (let k = 0; k < 35; k++) jours.push(k - 3)
  const points = [[5, C.primaire], [8, C.orange], [12, C.primaire], [14, C.orange], [16, C.primaire], [20, C.orange], [23, C.primaire], [27, C.orange]]
  jours.forEach((j, k) => {
    const col = k % 7, ligne = Math.floor(k / 7)
    const x = 44 + col * 50.5, y = 304 + ligne * 54
    const vrai = j >= 1 && j <= 31
    const num = vrai ? j : j < 1 ? 30 + j : j - 31
    if (num === 2 && vrai) {
      ctx.fillStyle = degrade(ctx, x - 20, y - 22, x + 20, y + 18)
      rr(ctx, x - 21, y - 24, 42, 46, 13)
      ctx.fill()
    }
    texte(ctx, String(num), x, y + 2, 15, 800, num === 2 && vrai ? '#fff' : vrai ? C.texte : '#c3c7d4', 'center')
    const idx = points.findIndex(([d]) => d === j)
    if (idx >= 0) {
      const dt = tB - T(M.points[idx])
      if (dt > 0) {
        const s = clamp(ressort(dt, 2.8, 9), 0, 1.6)
        ctx.fillStyle = points[idx][1]
        ctx.beginPath()
        ctx.arc(x, y + 14, 3.6 * s, 0, Math.PI * 2)
        ctx.fill()
        if (dt < 0.35) {
          ctx.strokeStyle = points[idx][1]
          ctx.globalAlpha = 1 - dt / 0.35
          ctx.lineWidth = 2
          ctx.beginPath()
          ctx.arc(x, y + 14, 4 + 16 * (dt / 0.35), 0, Math.PI * 2)
          ctx.stroke()
          ctx.globalAlpha = 1
        }
      }
    }
  })
  ;[[C.primaire, 'Rendez-vous', 110], [C.orange, 'Relances', 250]].forEach(([c, l, x]) => {
    ctx.fillStyle = c
    ctx.beginPath()
    ctx.arc(x - 30, 586, 4, 0, Math.PI * 2)
    ctx.fill()
    texte(ctx, l, x - 20, 590, 12, 700, C.doux)
  })
  const dtS = tB - T(M.synchro)
  if (dtS > 0) {
    const s = clamp(ressort(dtS, 2.4, 9), 0, 1.2)
    ctx.save()
    ctx.translate(195, 636)
    ctx.scale(s, s)
    ctx.translate(-195, -636)
    pilule(ctx, 'Synchronisé avec Google Agenda', 195, 616, { fond: C.surface, coul: C.primaireTexte, taille: 13, h: 40, padX: 16, ic: 'calendar-check-2', align: 'center' })
    ctx.restore()
  }
  ongletsBas(ctx, 3)
}

// ———— Écran 4 : Marché local + mandat signé ————
const PRIX = [118, 125, 131, 142, 149, 152, 158]
function ecranMarche(ctx, lb) {
  const b = lb + 32
  const tB = T(b)
  ctx.fillStyle = C.fond
  ctx.fillRect(0, 0, 390, 844)
  barreEtat(ctx)
  boutonRond(ctx, 36, 80, 21, C.surface, 'chevron-left', C.texte, 20)
  texte(ctx, 'Marché local', 70, 88, 24, 800, C.texte)
  texte(ctx, 'Charleroi · maisons · Statbel', 70, 110, 13, 600, C.doux)
  carte(ctx, 16, 128, 358, 136, 24)
  texte(ctx, 'Prix médian des ventes 2025', 32, 158, 13, 700, C.doux)
  const pc = sortieCubique(prog(T(M.compteur[0]), T(M.compteur[1]), tB))
  const val = Math.round(lerp(120000, 158000, pc) / 100) * 100
  const fmt = val.toLocaleString('fr-BE').replace(/ | /g, ' ') + ' €'
  texte(ctx, fmt, 32, 208, 38, 800, C.texte)
  const dtH = tB - T(M.hausse)
  if (dtH > 0) {
    const s = clamp(ressort(dtH, 2.4, 9), 0, 1.2)
    ctx.save()
    ctx.translate(32, 236)
    ctx.scale(s, s)
    ctx.translate(-32, -236)
    pilule(ctx, '+4,2 % sur 1 an', 32, 224, { fond: '#dcfce7', coul: '#15803d', taille: 12.5, h: 28, ic: 'trending-up' })
    ctx.restore()
  }
  // courbe
  carte(ctx, 16, 278, 358, 300, 24)
  texte(ctx, 'Évolution du prix médian', 32, 310, 15, 800, C.texte)
  const X0 = 46, X1 = 352, Y0 = 524, Y1 = 344
  const yv = (v) => lerp(Y0, Y1, (v - 110) / 55)
  ctx.strokeStyle = C.bord
  ctx.lineWidth = 1
  for (const v of [120, 140, 160]) {
    ctx.beginPath()
    ctx.moveTo(X0, yv(v))
    ctx.lineTo(X1, yv(v))
    ctx.stroke()
    texte(ctx, `${v}k`, X0 - 6, yv(v) + 4, 10.5, 700, C.doux, 'right')
  }
  const xs = PRIX.map((_, i) => lerp(X0 + 6, X1 - 6, i / (PRIX.length - 1)))
  PRIX.forEach((_, i) => texte(ctx, `’${19 + i}`, xs[i], 552, 11, 700, C.doux, 'center'))
  const pCourbe = entreeSortieCubique(prog(T(M.courbe[0]), T(M.courbe[1]), tB))
  if (pCourbe > 0) {
    const n = (PRIX.length - 1) * pCourbe
    const pts = []
    for (let i = 0; i <= Math.floor(n); i++) pts.push([xs[i], yv(PRIX[i])])
    const f = n - Math.floor(n)
    if (f > 0 && Math.floor(n) < PRIX.length - 1) {
      const i = Math.floor(n)
      pts.push([lerp(xs[i], xs[i + 1], f), lerp(yv(PRIX[i]), yv(PRIX[i + 1]), f)])
    }
    const aire = ctx.createLinearGradient(0, Y1, 0, Y0)
    aire.addColorStop(0, 'rgba(79,70,229,0.28)')
    aire.addColorStop(1, 'rgba(79,70,229,0)')
    ctx.fillStyle = aire
    ctx.beginPath()
    ctx.moveTo(pts[0][0], Y0)
    pts.forEach(([x, y]) => ctx.lineTo(x, y))
    ctx.lineTo(pts[pts.length - 1][0], Y0)
    ctx.fill()
    ctx.strokeStyle = degrade(ctx, X0, 0, X1, 0, '#2a78d6', C.primaire2)
    ctx.lineWidth = 4
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    ctx.beginPath()
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)))
    ctx.stroke()
    pts.forEach(([x, y], i) => {
      if (i >= PRIX.length || i > n) return
      ctx.fillStyle = '#fff'
      ctx.beginPath()
      ctx.arc(x, y, 5, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = C.primaire
      ctx.beginPath()
      ctx.arc(x, y, 3, 0, Math.PI * 2)
      ctx.fill()
    })
    const dtF = tB - T(M.pointFinal)
    if (dtF > 0) {
      const x = xs[6], y = yv(PRIX[6])
      for (let k = 0; k < 2; k++) {
        const ph = ((dtF / 0.9 + k * 0.5) % 1)
        ctx.strokeStyle = `rgba(139,92,246,${0.6 * (1 - ph)})`
        ctx.lineWidth = 2.5
        ctx.beginPath()
        ctx.arc(x, y, 7 + 22 * ph, 0, Math.PI * 2)
        ctx.stroke()
      }
      ctx.fillStyle = C.primaire2
      ctx.beginPath()
      ctx.arc(x, y, 7, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  texte(ctx, 'Source : Statbel, ventes réelles', 32, 568, 11, 600, C.doux)
  // la piste
  carte(ctx, 16, 594, 358, 150, 24)
  ctx.save()
  rr(ctx, 30, 610, 64, 64, 18)
  ctx.clip()
  ctx.drawImage(IMG.maison, 120, 300, 460, 460, 30, 610, 64, 64)
  ctx.restore()
  texte(ctx, 'Rue de la Montagne 88', 108, 634, 16, 800, C.texte)
  texte(ctx, 'Maison vide · repérée le 2 oct.', 108, 656, 12.5, 600, C.doux)
  const signe = tB >= T(M.tampon)
  if (signe) {
    const s = clamp(ressort(tB - T(M.tampon), 2.2, 9), 0, 1.25)
    ctx.save()
    ctx.translate(108, 700)
    ctx.scale(s, s)
    ctx.translate(-108, -700)
    pilule(ctx, 'Mandat signé', 108, 686, { fond: C.primaire, coul: '#fff', taille: 13, h: 30, ic: 'check' })
    ctx.restore()
  } else pilule(ctx, 'RDV obtenu', 108, 686, { fond: C.primaireDoux, coul: C.primaireTexte, taille: 13, h: 30 })
  const dtC = tB - T(M.client)
  if (dtC > 0) {
    const s = clamp(ressort(dtC, 2.4, 9), 0, 1.25)
    ctx.save()
    ctx.translate(270, 700)
    ctx.scale(s, s)
    ctx.translate(-270, -700)
    pilule(ctx, 'Prospect → Client', 236, 686, { fond: '#dcfce7', coul: '#15803d', taille: 12, h: 30, ic: 'user-plus' })
    ctx.restore()
  }
}

// ———————————————————— la carte d'alerte (accroche) et le tampon ————————————————————
export function peindreCarteAlerte(c) {
  const x = c.getContext('2d')
  x.setTransform(2, 0, 0, 2, 0, 0)
  x.clearRect(0, 0, 860, 280)
  const fond = x.createLinearGradient(0, 0, 0, 280)
  fond.addColorStop(0, 'rgba(36,40,66,0.97)')
  fond.addColorStop(1, 'rgba(21,26,44,0.97)')
  x.fillStyle = fond
  rr(x, 4, 4, 852, 272, 44)
  x.fill()
  x.strokeStyle = 'rgba(196,181,253,0.22)'
  x.lineWidth = 2
  x.stroke()
  peindreIcone(x, 34, 40, 108)
  texte(x, 'PROSPECT’IMMO', 172, 78, 21, 800, '#9aa3bd')
  texte(x, 'il y a 92 j', 822, 78, 21, 600, '#9aa3bd', 'right')
  texte(x, 'Relancer Marc Dupont', 172, 130, 40, 800, '#ffffff')
  texte(x, 'Relance prévue le 2 juillet', 172, 172, 25, 600, '#9aa3bd')
  x.fillStyle = 'rgba(239,68,68,0.18)'
  rr(x, 172, 196, 236, 48, 24)
  x.fill()
  x.fillStyle = '#ef4444'
  x.beginPath()
  x.arc(198, 220, 9, 0, Math.PI * 2)
  x.fill()
  texte(x, 'En retard · 92 j', 216, 229, 23, 800, '#ff8a8a')
  x.setTransform(1, 0, 0, 1, 0, 0)
}

export function peindreTampon(c) {
  const x = c.getContext('2d')
  const W = c.width, H = c.height
  x.clearRect(0, 0, W, H)
  x.strokeStyle = '#4f46e5'
  x.lineWidth = 20
  rr(x, 18, 18, W - 36, H - 36, 46)
  x.stroke()
  x.lineWidth = 6
  rr(x, 44, 44, W - 88, H - 88, 30)
  x.stroke()
  x.fillStyle = '#4f46e5'
  x.textAlign = 'center'
  police(x, 132, 800)
  x.letterSpacing = '10px'
  x.fillText('MANDAT', W / 2, H / 2 - 8)
  police(x, 100, 800)
  x.fillText('SIGNÉ ✓', W / 2, H / 2 + 106)
  x.letterSpacing = '0px'
  // grain d'encre
  const r = alea(77)
  x.globalCompositeOperation = 'destination-out'
  for (let i = 0; i < 900; i++) {
    x.globalAlpha = 0.25 + r() * 0.75
    x.beginPath()
    x.arc(r() * W, r() * H, 0.6 + r() * 2.6, 0, Math.PI * 2)
    x.fill()
  }
  x.globalAlpha = 0.5
  for (let i = 0; i < 14; i++) {
    x.fillRect(r() * W, r() * H, 40 + r() * 140, 1 + r() * 2)
  }
  x.globalAlpha = 1
  x.globalCompositeOperation = 'source-over'
}

// ———————————————————— le calque des textes (plein écran) ————————————————————
function degradeTexte(ctx, x0, x1, y) {
  const g = ctx.createLinearGradient(x0, y - 60, x1, y + 20)
  g.addColorStop(0, '#c4b5fd')
  g.addColorStop(0.5, '#a5b4fc')
  g.addColorStop(1, '#7dd3fc')
  return g
}
/** Taille de police ajustée pour tenir dans la zone sûre (860 px de large). */
function ajuster(ctx, s, taille, poids, largeurMax = 820) {
  police(ctx, taille, poids)
  const w = ctx.measureText(s).width
  return w > largeurMax ? (taille * largeurMax) / w : taille
}

/**
 * Agrandissement maximal d'un texte (boîte autour de l'origine courante) qui le garde entier dans la zone sûre
 * TikTok, compte tenu de la transformation courante du contexte (marge de 8 px pour la secousse de caméra).
 */
function echelleMaxZone(ctx, gauche, droite, haut, bas) {
  const m = ctx.getTransform()
  const Z = { x0: ZONE_SURE.x0 + 8, x1: ZONE_SURE.x1 - 8, y0: ZONE_SURE.y0 + 8, y1: ZONE_SURE.y1 - 8 }
  let k = Infinity
  for (const [cx, cy] of [[-gauche, -haut], [droite, -haut], [-gauche, bas], [droite, bas]]) {
    const u = m.a * cx + m.c * cy, v = m.b * cx + m.d * cy
    if (u > 0) k = Math.min(k, (Z.x1 - m.e) / u)
    else if (u < 0) k = Math.min(k, (Z.x0 - m.e) / u)
    if (v > 0) k = Math.min(k, (Z.y1 - m.f) / v)
    else if (v < 0) k = Math.min(k, (Z.y0 - m.f) / v)
  }
  return k
}

/** Texte « claqué » : arrive d'une grande échelle avec un léger tassement. */
function claque(ctx, s, x, y, taille, t, t0, style) {
  const dt = t - t0
  if (dt < -0.02) return
  const p = clamp(dt / 0.17)
  const a = clamp((dt + 0.02) / 0.05)
  ctx.save()
  ctx.globalAlpha *= a
  ctx.translate(x, y)
  police(ctx, taille, 800)
  ctx.textAlign = 'center'
  // part de 2,5× sa taille, mais sans jamais sortir de la zone sûre, même pendant le claquement
  const mes = ctx.measureText(s)
  const kMax = Math.max(1, echelleMaxZone(ctx, mes.actualBoundingBoxLeft, mes.actualBoundingBoxRight, mes.actualBoundingBoxAscent, mes.actualBoundingBoxDescent))
  const ech = Math.min(1 + 1.5 * Math.pow(1 - sortieExpo(p), 1.4), kMax)
  ctx.scale(ech, ech)
  ctx.fillStyle = style === 'degrade' ? degradeTexte(ctx, -300, 300, 0) : '#ffffff'
  ctx.fillText(s, 0, 0)
  ctx.restore()
}

/** Ligne révélée par un masque, glissée vers le haut. */
function revele(ctx, s, x, y, taille, poids, t, t0, style, sortie = null) {
  const dt = t - t0
  if (dt < 0) return
  const p = sortieExpo(clamp(dt / 0.45))
  let dy = 46 * (1 - p)
  let a = 1
  if (sortie !== null && t > sortie) {
    const q = entreeCubique(clamp((t - sortie) / 0.16))
    dy -= 12 * q
    a = 1 - q
  }
  ctx.save()
  police(ctx, taille, poids)
  ctx.beginPath()
  ctx.rect(0, y - taille * 1.05, 1080, taille * 1.35)
  ctx.clip()
  ctx.globalAlpha *= a
  ctx.textAlign = 'center'
  ctx.fillStyle = style === 'degrade' ? degradeTexte(ctx, x - 300, x + 300, y) : '#ffffff'
  ctx.fillText(s, x, y + dy)
  ctx.restore()
}

/** Mot animé lettre par lettre (manifeste). */
function lettres(ctx, s, x, y, taille, t, t0, mode, style, sortie) {
  police(ctx, taille, 800)
  const W = ctx.measureText(s).width
  const r = alea(s.length * 97 + Math.round(t0 * 10))
  for (let i = 0; i < s.length; i++) {
    const avant = ctx.measureText(s.slice(0, i)).width
    const lw = ctx.measureText(s[i]).width
    const lx = x - W / 2 + avant + lw / 2
    const dt = t - t0 - i * 0.028
    if (dt < 0) continue
    let dx = 0, dy = 0, rot = 0, ech = 1, a = clamp(dt / 0.08)
    if (mode === 'monte') {
      const p = clamp(ressort(dt, 2.2, 8), 0, 1.2)
      dy = 110 * (1 - p)
      rot = 0.25 * (1 - p) * (r() - 0.5)
    } else if (mode === 'glisse') {
      const p = sortieExpo(clamp(dt / 0.32))
      dx = -80 * (1 - p)
      ech = 1 + 0.12 * (1 - p)
    } else if (mode === 'claque') {
      const p = sortieExpo(clamp(dt / 0.18))
      ech = 1 + 1.8 * (1 - p)
    }
    if (sortie !== null && t > sortie) {
      const q = entreeCubique(clamp((t - sortie - i * 0.012) / 0.18))
      dy -= 180 * q
      a *= 1 - q
    }
    ctx.save()
    ctx.globalAlpha *= a
    ctx.translate(lx + dx, y + dy)
    ctx.rotate(rot)
    ctx.scale(ech, ech)
    ctx.textAlign = 'center'
    ctx.fillStyle = style === 'degrade' ? degradeTexte(ctx, -W / 2 - avant, W / 2 - avant, 0) : '#ffffff'
    ctx.fillText(s[i], 0, 0)
    ctx.restore()
  }
}

const texteA = (id) => TEXTES.find((t) => t.id === id)

/**
 * Peint le calque de textes à l'instant t (secondes). Renvoie l'intensité lumineuse à appliquer (bloom).
 */
export function peindreCalque(ctx, t, b) {
  const zone = zoneCalque(t, b)
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height) // tout : un texte sorti de la zone ne doit pas rester
  ctx.globalAlpha = 1
  let lum
  if (b < 6) lum = calqueAccroche(ctx, t, b)
  else if (b < 8) lum = calqueCoupure(ctx, t, b)
  else if (b < 40) lum = calqueDemo(ctx, t, b)
  else if (b < 52) lum = calqueManifeste(ctx, t, b)
  else lum = calqueFin(ctx, t, b)
  return { lum, zone }
}

/** Zone du calque réellement utilisée (seule cette zone est envoyée au GPU et composée). */
const PLEIN = [0, 0, 1080, 1920]
function zoneCalque(t, b) {
  const claqueRecent = (tb) => t >= T(tb) - 0.03 && t < T(tb) + 0.22
  if (b < 6) return claqueRecent(0) || claqueRecent(1) || claqueRecent(4) ? PLEIN : [0, 440, 1080, 1000]
  if (b < 8) return [0, 780, 1080, 1080]
  if (b < 40) return claqueRecent(36) ? PLEIN : [0, 200, 1080, 500]
  if (b < 52) return claqueRecent(48) || claqueRecent(49) ? PLEIN : [0, 520, 1080, 1340]
  return [0, 540, 1080, 1660]
}

function calqueAccroche(ctx, t, b) {
  const r = texteA('relance')
  const m = texteA('mandat')
  const yl = [700, 860]
  if (b < r.a + 0.15) {
    // recul quand la carte arrive, explosion à l'éclatement
    let a = 1, s = 1
    if (b > M.carte) s = 1 - 0.05 * sortieCubique(prog(T(M.carte), T(M.carte) + 0.5, t))
    if (t > T(M.eclatement)) {
      const q = clamp((t - T(M.eclatement)) / 0.09)
      a = 1 - q
      s *= 1 + 0.08 * q
    }
    ctx.save()
    ctx.globalAlpha = a
    ctx.translate(CX, 780)
    ctx.scale(s, s)
    ctx.translate(-CX, -780)
    const t1 = ajuster(ctx, r.lignes[0], 168, 800, 740)
    const t2 = ajuster(ctx, r.lignes[1], 168, 800, 740)
    claque(ctx, r.lignes[0], CX, yl[0], Math.min(t1, t2), t, T(r.temps[0]))
    claque(ctx, r.lignes[1], CX, yl[1], Math.min(t1, t2), t, T(r.temps[1]), 'degrade')
    ctx.restore()
  }
  if (b >= m.de - 0.02) {
    const g = b >= M.glitch[0] ? glitchTexte(t) : [0, 0]
    ctx.save()
    ctx.translate(g[0], g[1])
    const tl = ajuster(ctx, m.lignes[0], 190, 800, 740)
    claque(ctx, m.lignes[0], CX, yl[0], tl, t, T(m.temps[0]))
    claque(ctx, m.lignes[1], CX, yl[1], tl, t, T(m.temps[0]) + 0.05, 'degrade')
    ctx.restore()
  }
  return 1.25
}
function glitchTexte(t) {
  const pas = Math.floor(t / ((T(1) / 8)))
  const r = alea(pas * 13 + 5)
  return r() > 0.45 ? [(r() - 0.5) * 60, (r() - 0.5) * 16] : [0, 0]
}

function calqueCoupure(ctx, t, b) {
  const j = texteA('jamais')
  if (b < j.de) return 1
  const dt = t - T(j.de)
  const scintille = dt < 0.3 ? (Math.sin(dt * 90) > -0.2 ? 1 : 0.25) : 1
  const fin = T(M.aspiration[1])
  let s = 1 + 0.07 * prog(T(M.aspiration[0]), fin, t)
  let a = clamp(dt / 0.12) * scintille
  if (t > fin) {
    const q = clamp((t - fin) / 0.06)
    s *= 1 - 0.97 * q
    a *= 1 - q
  }
  ctx.save()
  ctx.globalAlpha = a
  ctx.translate(CX, 940)
  ctx.scale(s, s)
  police(ctx, 76, 600)
  const esp = lerp(28, 4, sortieCubique(clamp(dt / 0.9)))
  ctx.letterSpacing = esp + 'px'
  ctx.textAlign = 'center'
  ctx.fillStyle = '#ffffff'
  ctx.fillText(j.lignes[0], 0, 0)
  ctx.letterSpacing = '0px'
  // fine ligne lumineuse sous le texte
  const w = 420 * sortieCubique(clamp((dt - 0.15) / 0.7))
  ctx.fillStyle = 'rgba(196,181,253,0.9)'
  ctx.fillRect(-w / 2, 34, w, 3)
  ctx.restore()
  return 1 + 0.9 * prog(T(M.aspiration[0]), fin, t)
}

function calqueDemo(ctx, t, b) {
  const id = b < 16 ? 'reperez' : b < 24 ? 'appui' : b < 32 ? 'zero' : b < 36 ? 'prix' : 'signe'
  const tx = texteA(id)
  const taille = Math.min(ajuster(ctx, tx.lignes[0], 92, 800), ajuster(ctx, tx.lignes[1], 92, 800))
  if (id === 'signe') {
    if (b < tx.a) {
      let a = 1
      if (b > tx.a - 0.3) a = 1 - prog(T(tx.a - 0.3), T(tx.a), t)
      ctx.save()
      ctx.globalAlpha = a
      claque(ctx, tx.lignes[0], CX, 346, 104, t, T(tx.temps[0]))
      claque(ctx, tx.lignes[1], CX, 450, 104, t, T(tx.temps[0]) + 0.05, 'degrade')
      ctx.restore()
    }
    return 1.2
  }
  const sortie = id === 'prix' ? T(tx.a) - 0.03 : T(tx.a) - 0.12
  revele(ctx, tx.lignes[0], CX, 346, taille, 800, t, T(tx.temps[0]), 'blanc', sortie)
  revele(ctx, tx.lignes[1], CX, 442, taille, 800, t, T(tx.temps[1]), 'degrade', sortie)
  return 1.15
}

function calqueManifeste(ctx, t, b) {
  const m1 = texteA('m1'), m2 = texteA('m2'), m3 = texteA('m3')
  if (b < 44) {
    const ys = [760, 935, 1110]
    m1.lignes.forEach((s, i) => lettres(ctx, s, CX, ys[i], 158, t, T(m1.temps[i]), 'monte', i === 2 ? 'degrade' : 'blanc', T(M.sortie1)))
  } else if (b < 48) {
    const ys = [760, 935, 1110]
    m2.lignes.forEach((s, i) => lettres(ctx, s, CX, ys[i], 158, t, T(m2.temps[i]), 'glisse', i === 2 ? 'degrade' : 'blanc', T(M.sortie2)))
  } else {
    const vib = b > 50 ? (b - 50) * 3.5 : 0
    const r = alea(Math.floor(t * 60) + 3)
    ctx.save()
    ctx.translate((r() - 0.5) * vib, (r() - 0.5) * vib)
    const blanc = prog(T(M.blanc[0]), T(M.blanc[1]), t)
    const s = 1 + 0.12 * blanc
    ctx.translate(CX, 930)
    ctx.scale(s, s)
    ctx.translate(-CX, -930)
    lettres(ctx, m3.lignes[0], CX, 860, 236, t, T(m3.temps[0]), 'claque', 'blanc', null)
    lettres(ctx, m3.lignes[1], CX, 1090, 236, t, T(m3.temps[1]), 'claque', 'degrade', null)
    ctx.restore()
    return 1.3 + 1.6 * blanc
  }
  return 1.3
}

function calqueFin(ctx, t, b) {
  // logo qui se construit
  const t0 = T(M.logo)
  const e = {
    carre: clamp(ressort(t - t0, 1.6, 7), 0, 1.25),
    maison: clamp(prog(t0 + 0.08, t0 + 0.5, t)),
    lettre: clamp(ressort(t - t0 - 0.42, 2, 8), 0, 1.3),
    point: clamp(ressort(t - T(M.point), 2.6, 8), 0, 1.6),
    ombrePortee: true,
  }
  const taille = 300
  const yIcone = 600
  ctx.save()
  // reflet qui balaie l'icône
  peindreIcone(ctx, CX - taille / 2, yIcone, taille, e)
  for (const [bb, f] of [[M.reflet, 1], [M.refletFinal, 0.7]]) {
    const p = prog(T(bb), T(bb) + 0.45, t)
    if (p > 0 && p < 1) {
      ctx.save()
      rr(ctx, CX - taille / 2, yIcone, taille, taille, (taille * 120) / 512)
      ctx.clip()
      const x = lerp(CX - taille, CX + taille, p)
      const g = ctx.createLinearGradient(x - 60, 0, x + 60, 0)
      g.addColorStop(0, 'rgba(255,255,255,0)')
      g.addColorStop(0.5, `rgba(255,255,255,${0.55 * f})`)
      g.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.fillStyle = g
      ctx.translate(x, yIcone + taille / 2)
      ctx.rotate(0.35)
      ctx.fillRect(-60, -taille, 120, taille * 2)
      ctx.restore()
    }
  }
  ctx.restore()
  // nom de l'application, lettre par lettre
  const tm = T(M.marque)
  if (t > tm - 0.01) {
    police(ctx, 100, 800)
    const mot = 'Prospect’Immo'
    const W = ctx.measureText(mot).width
    const k = Math.min(1, 820 / W)
    ctx.save()
    ctx.translate(CX, 1020)
    ctx.scale(k, k)
    for (let i = 0; i < mot.length; i++) {
      const avant = ctx.measureText(mot.slice(0, i)).width
      const lw = ctx.measureText(mot[i]).width
      const dt = t - tm - i * 0.025
      if (dt < 0) continue
      const p = sortieExpo(clamp(dt / 0.4))
      ctx.save()
      ctx.beginPath()
      ctx.rect(-W / 2 - 20, -110, W + 40, 140)
      ctx.clip()
      ctx.globalAlpha = clamp(dt / 0.1)
      ctx.textAlign = 'center'
      ctx.fillStyle = i >= 8 ? degradeTexte(ctx, -W / 2, W / 2, 0) : '#ffffff'
      ctx.fillText(mot[i], -W / 2 + avant + lw / 2, 80 * (1 - p))
      ctx.restore()
    }
    ctx.restore()
  }
  // slogan : trois mots sur les temps
  const sl = texteA('slogan')
  police(ctx, 50, 700)
  const phrase = sl.lignes.join(' ')
  const Wp = ctx.measureText(phrase).width
  let x = CX - Wp / 2
  sl.lignes.forEach((mot, i) => {
    const w = ctx.measureText(mot).width
    const dt = t - T(sl.temps[i])
    if (dt > 0) {
      const p = sortieExpo(clamp(dt / 0.35))
      ctx.save()
      ctx.globalAlpha = clamp(dt / 0.1)
      police(ctx, 50, 700)
      ctx.textAlign = 'left'
      ctx.fillStyle = i === 2 ? '#ffffff' : '#c7d2fe'
      ctx.fillText(mot, x, 1116 + 24 * (1 - p))
      ctx.restore()
    }
    x += w + ctx.measureText(' ').width
  })
  // bouton S’abonner
  const tb = T(M.bouton)
  if (t > tb) {
    const tTap = T(M.tapAbonner)
    const s0 = clamp(ressort(t - tb, 1.9, 7.5), 0, 1.2)
    const puls = 0.06 * impulsionPos(t, T(M.pulsation), 5)
    const presse = t > tTap ? 1 - 0.09 * Math.exp(-(t - tTap) * 14) * Math.sin(Math.min(Math.PI, (t - tTap) * 30)) : 1
    const abonne = t > tTap + 0.07
    const s = s0 * (1 + puls) * presse
    const bw = abonne ? 520 : 500, bh = 136
    ctx.save()
    ctx.translate(CX, 1300)
    ctx.scale(s, s)
    // halo
    const halo = ctx.createRadialGradient(0, 0, 30, 0, 0, 230)
    halo.addColorStop(0, `rgba(139,92,246,${0.45 + 0.4 * puls * 10})`)
    halo.addColorStop(1, 'rgba(139,92,246,0)')
    ctx.fillStyle = halo
    ctx.fillRect(-300, -124, 600, 248)
    ctx.fillStyle = abonne ? '#ffffff' : degrade(ctx, -bw / 2, -bh / 2, bw / 2, bh / 2)
    rr(ctx, -bw / 2, -bh / 2, bw, bh, bh / 2)
    ctx.fill()
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'
    ctx.lineWidth = 2
    ctx.stroke()
    police(ctx, 52, 800)
    ctx.textAlign = 'left'
    const lib = abonne ? 'Abonné' : 'S’abonner'
    const lw = ctx.measureText(lib).width
    const ic = 50
    const x0 = -(lw + ic + 18) / 2
    icone(ctx, abonne ? 'check' : 'bell-ring', x0, -ic / 2, ic, abonne ? C.primaire : '#ffffff', 2.6)
    ctx.fillStyle = abonne ? C.primaire : '#ffffff'
    ctx.fillText(lib, x0 + ic + 18, 18)
    ctx.restore()
    // doigt qui vient taper
    const ta = T(M.approche)
    if (t > ta && t < tTap + 0.5) {
      const p = sortieCubique(prog(ta, tTap, t))
      const fx = lerp(CX + 330, CX + 70, p), fy = lerp(1410, 1318, p)
      const a = t > tTap + 0.2 ? 1 - (t - tTap - 0.2) / 0.3 : clamp((t - ta) / 0.1)
      ctx.save()
      ctx.globalAlpha = a
      ctx.fillStyle = 'rgba(255,255,255,0.32)'
      ctx.beginPath()
      ctx.arc(fx, fy, t > tTap ? 30 : 38, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = 'rgba(255,255,255,0.9)'
      ctx.lineWidth = 4
      ctx.stroke()
      ctx.restore()
    }
    if (t > tTap) {
      const p = clamp((t - tTap) / 0.55)
      ctx.strokeStyle = `rgba(255,255,255,${0.8 * (1 - p)})`
      ctx.lineWidth = 6 * (1 - p) + 1
      ctx.beginPath()
      ctx.arc(CX + 70, 1318, 30 + 105 * sortieCubique(p), 0, Math.PI * 2)
      ctx.stroke()
    }
  }
  return 1.08
}
const impulsionPos = (t, t0, k) => (t < t0 ? 0 : Math.exp(-(t - t0) * k) * Math.sin(Math.min(Math.PI, (t - t0) * 8)))
