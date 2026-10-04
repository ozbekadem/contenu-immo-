// Chorégraphie : où est chaque objet à l'instant t, quelles particules, quels réglages de post-production.
// Tout est calculé à partir de la timeline partagée (aucun état : chaque instant se calcule seul).
import { B, CX, EFFETS, FOUETS, FPS, M, RYTHME, T } from './timeline.js'
import { alea, bruit1, clamp, deg, entreeCubique, entreeSortieCubique, lerp, lisse, mat, prog, ressort, sortieCubique, sortieExpo } from './outils.js'
import { peindreCalque, peindreTelephone } from './ui.js'

const OX = CX - 540 // −30 : décalage horizontal vers le centre de la zone sûre
export const TELEPHONE = { h: 930, w: (930 * 414) / 868, r: (62 * 930) / 868, ep: 26 }
export const CARTE = { w: 860, h: 280 }
export const TAMPON = { w: 560, h: 261 }

const hexa = (h, i = 1) => {
  const n = parseInt(h.slice(1), 16)
  return [((n >> 16) & 255) / 255 * i, ((n >> 8) & 255) / 255 * i, (n & 255) / 255 * i]
}
const PALETTE = ['#4f46e5', '#8b5cf6', '#c4b5fd', '#60a5fa', '#ffffff', '#a5b4fc']

// ———————————————————— caméra ————————————————————
function secousse(t) {
  let x = 0, y = 0, rz = 0
  for (const e of EFFETS) {
    if (!e.secousse || t < e.t || t > e.t + 1.4) continue
    const a = e.secousse * Math.exp(-(t - e.t) * 7)
    x += a * 24 * bruit1(t * 34, e.b * 7.1)
    y += a * 24 * bruit1(t * 34, e.b * 3.3 + 50)
    rz += a * 0.011 * bruit1(t * 26, e.b + 90)
  }
  return { x, y, rz }
}
export function pulsation(t) {
  let p = 0
  for (const k of RYTHME.kick) {
    const dt = t - T(k)
    if (dt >= 0 && dt < 0.6) p += Math.exp(-dt * 9)
  }
  return p
}
/** Interpolation douce entre des clés [temps (b), valeur]. */
function piste(b, cles) {
  if (b <= cles[0][0]) return cles[0][1]
  for (let i = 1; i < cles.length; i++) {
    const [b1, v1] = cles[i]
    const [b0, v0] = cles[i - 1]
    if (b <= b1) return lerp(v0, v1, entreeSortieCubique((b - b0) / (b1 - b0)))
  }
  return cles[cles.length - 1][1]
}

// ———————————————————— téléphone ————————————————————
const POSES = [
  { de: 8, ry: -13, rx: 5, rz: -1.5 },
  { de: 16, ry: 12, rx: 4, rz: 1.2 },
  { de: 24, ry: -10, rx: 6, rz: -1 },
  { de: 32, ry: 9, rx: 4, rz: 1 },
]
function poseTelephone(t, b) {
  const pose = POSES.filter((p) => b >= p.de).pop() ?? POSES[0]
  let { ry, rx, rz } = pose
  let x = OX, y = 30, z = 0
  // respiration
  ry += 2.6 * Math.sin(t * 1.1)
  rx += 1.4 * Math.sin(t * 0.83 + 1)
  y += 7 * Math.sin(t * 1.4)
  // poussées de caméra par démo
  const local = b - pose.de
  z -= 150 * sortieCubique(clamp(local / 7.5))
  if (pose.de === 8) {
    z -= 90 * lisse(prog(9.6, 10, b)) * (1 - lisse(prog(12.3, 12.9, b)))
    ry += 7 * lisse(prog(9.6, 10.2, b)) * (1 - lisse(prog(12.3, 12.9, b)))
  }
  if (pose.de === 16) {
    ry = lerp(ry, 0, lisse(prog(18.8, 19.3, b)) * (1 - lisse(prog(20.8, 21.3, b))))
    z -= 60 * lisse(prog(18.8, 19.3, b)) * (1 - lisse(prog(20.8, 21.3, b)))
  }
  if (pose.de === 24) {
    rx += 3 * Math.exp(-Math.max(0, t - T(M.notification)) * 6) * (t > T(M.notification) ? 1 : 0)
    ry = lerp(ry, 7, entreeSortieCubique(prog(T(M.agenda), T(M.agenda) + 0.5, t)))
  }
  if (pose.de === 32) {
    const approche = lisse(prog(34, 35.9, b))
    ry = lerp(ry, 0, approche)
    rx = lerp(rx, 2, approche)
    z -= 160 * approche
    const dtT = t - T(M.tampon)
    if (dtT > 0) {
      z += 170 * Math.exp(-dtT * 5) * Math.sin(Math.min(Math.PI, dtT * 14))
      rx += 5 * Math.exp(-dtT * 6) * Math.sin(dtT * 22)
      z += 80 * lisse(clamp(dtT / 0.8))
    }
  }
  // petit rebond sur les kicks
  z -= 10 * pulsation(t)
  // entrée au drop
  const tD = T(M.drop)
  if (t < tD + T(0.95)) {
    const p = sortieExpo(clamp((t - tD) / T(0.95)))
    z = lerp(2600, z, p)
    ry = lerp(78, ry, p)
    rx = lerp(26, rx, p)
    rz = lerp(-14, rz, p)
  }
  // coups de fouet entre les démos
  for (const f of FOUETS) {
    const d = b - f
    if (d > -0.3 && d <= 0) {
      const p = entreeCubique((d + 0.3) / 0.3)
      x -= 1550 * p
      ry -= 38 * p
    } else if (d > 0 && d < 0.32) {
      const q = 1 - sortieCubique(d / 0.32)
      x += 1550 * q
      ry += 38 * q
    }
  }
  // sortie vers le manifeste
  const ps = entreeCubique(prog(T(M.sortie[0]), T(M.sortie[1]), t))
  y -= 1700 * ps
  z += 900 * ps
  rx += 40 * ps
  ry -= 22 * ps
  return { x, y, z, rx, ry, rz }
}
const modele = (p) => mat.chaine(mat.trans(p.x, p.y, p.z), mat.rotY(deg(p.ry)), mat.rotX(deg(p.rx)), mat.rotZ(deg(p.rz)))

// ———————————————————— carte d'alerte et éclats ————————————————————
let ECLATS = null
function preparerEclats() {
  const r = alea(404)
  const nx = 10, ny = 4
  const pts = []
  for (let j = 0; j <= ny; j++)
    for (let i = 0; i <= nx; i++) {
      const bordX = i === 0 || i === nx, bordY = j === 0 || j === ny
      pts.push([(i / nx - 0.5) * CARTE.w + (bordX ? 0 : (r() - 0.5) * 60), (j / ny - 0.5) * CARTE.h + (bordY ? 0 : (r() - 0.5) * 50)])
    }
  const P = (i, j) => pts[j * (nx + 1) + i]
  const eclats = []
  const impact = [-60, 10]
  for (let j = 0; j < ny; j++)
    for (let i = 0; i < nx; i++) {
      const a = P(i, j), b2 = P(i + 1, j), c = P(i + 1, j + 1), d = P(i, j + 1)
      const tris = (i + j) % 2 ? [[a, b2, c], [a, c, d]] : [[a, b2, d], [b2, c, d]]
      for (const tri of tris) {
        const cx = (tri[0][0] + tri[1][0] + tri[2][0]) / 3, cy = (tri[0][1] + tri[1][1] + tri[2][1]) / 3
        let dx = cx - impact[0], dy = cy - impact[1]
        const l = Math.hypot(dx, dy) || 1
        dx /= l
        dy /= l
        const v = 500 + r() * 1300
        eclats.push({
          c: [cx, cy],
          s: tri.map(([x, y]) => [x - cx, y - cy]),
          uv: tri.map(([x, y]) => [x / CARTE.w + 0.5, y / CARTE.h + 0.5]),
          v: [dx * v + (r() - 0.5) * 300, dy * v * 0.8 - 250 - r() * 400, -(500 + r() * 1300)],
          axe: (() => {
            const ax = [r() - 0.5, r() - 0.5, r() - 0.5]
            const n = Math.hypot(...ax)
            return ax.map((x) => x / n)
          })(),
          w: 5 + r() * 13,
          retard: (l / 600) * 0.02,
        })
      }
    }
  ECLATS = eclats
}
function rotAxe(ax, a, [x, y, z]) {
  const c = Math.cos(a), s = Math.sin(a), [u, v, w] = ax
  const d = u * x + v * y + w * z
  return [u * d * (1 - c) + x * c + (-w * y + v * z) * s, v * d * (1 - c) + y * c + (w * x - u * z) * s, w * d * (1 - c) + z * c + (-v * x + u * y) * s]
}
function poseCarte(t) {
  const t0 = T(M.carte)
  const p = sortieExpo(clamp((t - t0) / 0.55))
  return {
    x: OX,
    y: lerp(1300, 220, p) + 8 * Math.sin(t * 2.4),
    z: lerp(700, 0, p),
    rx: lerp(-70, 0, p) + 5 * Math.sin(t * 2),
    ry: 7 * Math.sin(t * 1.3),
    rz: lerp(8, -1.5, p),
  }
}

// ———————————————————— particules ————————————————————
let BOKEH = null, POUSSIERE = null, ASPIRATION = null
function preparerParticules() {
  const r = alea(3)
  BOKEH = Array.from({ length: 30 }, (_, i) => ({
    x: (r() - 0.5) * 1700,
    y: (r() - 0.5) * 2600,
    z: 700 + r() * 2200,
    t: 70 + r() * 210,
    c: r() > 0.5 ? [0.77, 0.71, 0.99] : [0.38, 0.6, 0.98],
    a: 0.08 + r() * 0.16,
    ph: r() * 6.28,
    v: 10 + r() * 22,
  }))
  const r2 = alea(8)
  POUSSIERE = Array.from({ length: 80 }, () => ({ x: (r2() - 0.5) * 1300, y: (r2() - 0.5) * 2300, z: -200 + r2() * 1400, t: 3 + r2() * 5, a: 0.3 + r2() * 0.5, v: 25 + r2() * 45, ph: r2() * 6.28 }))
  const r3 = alea(9)
  ASPIRATION = Array.from({ length: 150 }, () => ({ a0: r3() * 6.28, r0: 650 + r3() * 900, d: r3() * 0.4, t: 4 + r3() * 7, spin: 1.5 + r3() * 2.5, z: (r3() - 0.5) * 600 }))
}

const SALVES = [
  { b: M.eclatement, o: [OX - 60, 230, 0], n: 80, v: [700, 2100], vie: [0.45, 1.1], cols: ['#ffffff', '#c4b5fd', '#a5b4fc', '#ff9a9a'], g: 900 },
  { b: M.drop, o: [OX, -20, 0], n: 140, v: [1200, 3400], vie: [0.4, 1.0], cols: ['#ffffff', '#c4b5fd', '#8b5cf6', '#60a5fa'], g: 300 },
  { b: M.tampon, o: [OX, 70, -260], n: 100, v: [900, 2600], vie: [0.4, 0.9], cols: ['#ffffff', '#c4b5fd', '#60a5fa'], g: 500 },
  { b: M.logo, o: [OX, -210, 0], n: 120, v: [900, 2800], vie: [0.5, 1.2], cols: ['#ffffff', '#ffd166', '#c4b5fd', '#8b5cf6'], g: 250 },
  { b: M.tapAbonner, o: [OX + 70, 358, 0], n: 60, v: [500, 1500], vie: [0.4, 0.9], cols: ['#ffffff', '#c4b5fd', '#60a5fa'], g: 400 },
]
function etincelles(t, liste) {
  for (const s of SALVES) {
    const t0 = T(s.b)
    const dt = t - t0
    if (dt < 0 || dt > 1.3) continue
    const r = alea(Math.round(s.b * 100))
    for (let i = 0; i < s.n; i++) {
      const a = r() * Math.PI * 2, el = (r() - 0.5) * 1.2
      const v = lerp(s.v[0], s.v[1], Math.pow(r(), 1.5))
      const vie = lerp(s.vie[0], s.vie[1], r())
      const col = hexa(s.cols[Math.floor(r() * s.cols.length)])
      const taille = 5 + r() * 12
      if (dt > vie) continue
      const k = 2.6
      const d = (1 - Math.exp(-k * dt)) / k
      const x = s.o[0] + Math.cos(a) * Math.cos(el) * v * d
      const y = s.o[1] + Math.sin(a) * Math.cos(el) * v * d + 0.5 * s.g * dt * dt
      const z = s.o[2] + Math.sin(el) * v * d
      const f = Math.pow(1 - dt / vie, 1.4)
      liste.push({ p: [x, y, z], w: taille, h: taille, c: [col[0] * 1.9, col[1] * 1.9, col[2] * 1.9, f], mode: 0 })
    }
  }
}
const CONFETTIS = [
  { b: M.tampon, o: [OX, 60, -220], n: 130, v: [700, 1900] },
  { b: M.tapAbonner, o: [OX + 70, 330, 0], n: 80, v: [500, 1400] },
]
function confettis(t, liste, V) {
  for (const s of CONFETTIS) {
    const dt = t - T(s.b)
    if (dt < 0 || dt > 3.2) continue
    const r = alea(Math.round(s.b * 31))
    for (let i = 0; i < s.n; i++) {
      const a = -Math.PI / 2 + (r() - 0.5) * 2.6
      const v = lerp(s.v[0], s.v[1], r())
      const col = hexa(PALETTE[Math.floor(r() * PALETTE.length)])
      const w = 14 + r() * 14, h = 8 + r() * 8
      const wx = (r() - 0.5) * 16, wz = (r() - 0.5) * 12, ph = r() * 6
      const vz = (r() - 0.5) * 900
      const k = 3.2
      const d = (1 - Math.exp(-k * dt)) / k
      const chute = 260 * dt + 0.5 * 200 * dt * dt * Math.exp(-dt * 0.4)
      const cx = s.o[0] + Math.cos(a) * v * d + 34 * Math.sin(dt * 5 + ph)
      const cy = s.o[1] + Math.sin(a) * v * d + chute
      const cz = s.o[2] + vz * d
      const rx = wx * dt + ph, rz = wz * dt
      const coins = [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]].map(([px, py]) => {
        let [x, y, z] = [px, py, 0]
        ;[y, z] = [y * Math.cos(rx) - z * Math.sin(rx), y * Math.sin(rx) + z * Math.cos(rx)]
        ;[x, y] = [x * Math.cos(rz) - y * Math.sin(rz), x * Math.sin(rz) + y * Math.cos(rz)]
        return mat.appliquer(V, cx + x, cy + y, cz + z)
      })
      const lum = 0.55 + 0.45 * Math.abs(Math.cos(rx))
      const f = clamp((3.2 - dt) / 0.6)
      liste.push({ coins, c: [col[0] * lum * 1.1, col[1] * lum * 1.1, col[2] * lum * 1.1, f], mode: 1 })
    }
  }
}

// ———————————————————— composition d'un instant ————————————————————
let pret = false
export function preparerScene() {
  preparerEclats()
  preparerParticules()
  pret = true
}

/** Renvoie la scène à l'instant t et met à jour les canvas (écran du téléphone, calque de textes). */
export function composer(t, canvas) {
  if (!pret) preparerScene()
  let b = B(t)
  const tc = T(M.coupure)
  // la coupure « éteint » l'image de l'accroche comme un vieux téléviseur : on fige l'accroche
  let tScene = t
  if (t >= tc && t < tc + 0.17) {
    tScene = tc - 0.0005
    b = B(tScene)
  }
  const cam = secousse(tScene)
  const V = mat.chaine(mat.rotZ(cam.rz), mat.trans(cam.x, cam.y, 0))
  const fond = [], devant = [], solides = []
  const elements = [{ type: 'sprites', liste: fond, additif: true }]
  let ecran = false

  if (b < 6) composerAccroche(tScene, b, V, elements, fond, devant)
  else if (b < 8) composerCoupure(t, b, V, fond, devant)
  else if (b < 40) ecran = composerDemo(t, b, V, elements, fond, devant, solides, canvas)

  etincelles(tScene, devant)
  confettis(tScene, solides, V)
  // éclats lumineux (flares anamorphiques) sur les impacts
  for (const e of EFFETS) {
    if (!e.flash || e.flash < 0.35) continue
    const dt = tScene - e.t
    if (dt < 0 || dt > 0.8) continue
    const f = e.flash * Math.exp(-dt * 6)
    const o = centreEffet(e.b)
    const [x, y, z] = mat.appliquer(V, o[0], o[1], 0)
    devant.push({ p: [x, y, z], w: 1900, h: 26, c: [0.75 * 2.2, 0.68 * 2.2, 2.2, f * 0.6], mode: 0 })
    devant.push({ p: [x, y, z], w: 420, h: 420, c: [1.2, 1.1, 1.6, f * 0.45], mode: 0 })
    if (e.onde) {
      const q = clamp(dt / 0.6)
      const tl = 160 + 2300 * sortieCubique(q)
      devant.push({ p: [x, y, z], w: tl, h: tl, c: [0.8, 0.75, 1.4, 0.45 * (1 - q) * e.onde], mode: 2 })
    }
  }
  elements.push({ type: 'sprites', liste: devant, additif: true })
  elements.push({ type: 'sprites', liste: solides, additif: false })

  // calque des textes (toujours au-dessus) : il suit la secousse de caméra à moitié seulement (lisible, et jamais
  // poussé hors de la zone sûre) ; seule la zone utile est composée
  const { lum, zone } = peindreCalque(canvas.ctxCalque, tScene, B(tScene))
  const [x0, y0, x1, y1] = zone
  const Vt = mat.chaine(mat.rotZ(cam.rz * 0.5), mat.trans(cam.x * 0.5, cam.y * 0.5, 0))
  const coin = (x, y) => [...mat.appliquer(Vt, x - 540, y - 960, 0), x / 1080, y / 1920, 0, 0, 1]
  const q = [coin(x0, y0), coin(x1, y0), coin(x1, y1), coin(x0, y0), coin(x1, y1), coin(x0, y1)].flat()
  elements.push({ type: 'triangles', texture: 'calque', donnees: new Float32Array(q), lum })
  return { elements, ecran, zone }
}

function centreEffet(b) {
  if (b === M.eclatement) return [OX - 60, 230]
  if (b === M.tampon) return [OX, 60]
  if (b === M.logo) return [OX, -210]
  if (b === M.tapAbonner) return [OX + 70, 358]
  if (b === M.impact1 || b === M.impact2) return [OX, -180]
  if (b === M.zero || b === M.oubli) return [OX, -30]
  return [OX, -20]
}

function composerAccroche(t, b, V, elements, fond, devant) {
  const t0 = T(M.carte)
  const tE = T(M.eclatement)
  if (t >= t0 && t < tE) {
    const p = poseCarte(t)
    const mv = mat.mul(V, modele(p))
    // halo rouge qui pulse derrière la pastille « En retard »
    let puls = 0.35 + 0.15 * Math.sin(t * 9)
    for (const pb of M.pulsRouge) if (t >= T(pb)) puls += 0.9 * Math.exp(-(t - T(pb)) * 7)
    const [x, y, z] = mat.appliquer(mv, -232, 80, -2)
    fond.push({ p: [x, y, z], w: 260, h: 260, c: [2.2, 0.35, 0.35, 0.25 * puls], mode: 0 })
    elements.push({ type: 'maille', maille: 'carte', texture: 'carte', mv, lum: 1.3, parties: [[0, 0, 6]], reflet: 0.6 + 0.4 * Math.sin(t * 0.9), refletI: 0.08 })
  } else if (t >= tE) {
    // éclatement : chaque éclat garde sa part de texture et s'envole vers la caméra
    const p = poseCarte(tE)
    const mvC = mat.mul(V, modele(p))
    const dt = t - tE
    const d = []
    for (const e of ECLATS) {
      const de = Math.max(0, dt - e.retard)
      const k = 1.6
      const s = (1 - Math.exp(-k * de)) / k
      const cx = e.c[0] + e.v[0] * s
      const cy = e.c[1] + e.v[1] * s + 0.5 * 1500 * de * de
      const cz = e.v[2] * s
      const ang = e.w * de
      const a = clamp(1 - (de - 0.35) / 0.55)
      if (a <= 0) continue
      for (let k2 = 0; k2 < 3; k2++) {
        const [lx, ly, lz] = rotAxe(e.axe, ang, [e.s[k2][0], e.s[k2][1], 0])
        const [x, y, z] = mat.appliquer(mvC, cx + lx, cy + ly, cz + lz)
        d.push(x, y, z, e.uv[k2][0], e.uv[k2][1], 0, 0, a)
      }
    }
    // l'alpha est porté par le 8e flottant (normale z inutilisée ici) : on le passe via la luminance
    if (d.length) elements.push({ type: 'triangles', texture: 'carte', donnees: new Float32Array(d), lum: 1 + 1.4 * Math.exp(-dt * 10) })
  }
}

function composerCoupure(t, b, V, fond, devant) {
  const ta = T(M.aspiration[0]), tf = T(M.aspiration[1])
  const centre = [OX, -20]
  if (t >= ta && t < tf) {
    for (const p of ASPIRATION) {
      const q = clamp((t - ta - p.d * 0.3) / (tf - ta - p.d * 0.3))
      if (q <= 0) continue
      const r = p.r0 * (1 - Math.pow(q, 1.6))
      const a = p.a0 + p.spin * q * q * 3
      const [x, y, z] = mat.appliquer(V, centre[0] + Math.cos(a) * r, centre[1] + Math.sin(a) * r * 0.85, p.z * (1 - q))
      devant.push({ p: [x, y, z], w: p.t, h: p.t, c: [1.6, 1.4, 2.4, 0.25 + 0.75 * q], mode: 0 })
    }
  }
  if (t >= tf) {
    // point lumineux suspendu pendant le silence, juste avant le drop
    const q = prog(tf, T(M.drop), t)
    const [x, y, z] = mat.appliquer(V, centre[0], centre[1], 0)
    devant.push({ p: [x, y, z], w: 70 + 30 * Math.sin(q * 20), h: 70 + 30 * Math.sin(q * 20), c: [1.9, 1.8, 2, 1], mode: 0 })
    devant.push({ p: [x, y, z], w: 520, h: 14, c: [1.2, 1.1, 2, 0.6], mode: 0 })
  }
}

function composerDemo(t, b, V, elements, fond, devant, solides, canvas) {
  const pose = poseTelephone(t, b)
  const mvT = mat.mul(V, modele(pose))
  // téléphone (si visible) ; son écran est redessiné une fois par image
  const visible = Math.abs(pose.x - OX) < 1500 && pose.y > -1650
  let redessine = false
  if (visible) {
    if (canvas.dernierB === undefined || Math.abs(b - canvas.dernierB) > 0.03) {
      peindreTelephone(canvas.ctxEcran, b)
      canvas.dernierB = b
      redessine = true
    }
    elements.push({
      type: 'maille',
      maille: 'telephone',
      texture: 'ecran',
      mv: mvT,
      profondeur: true,
      lum: 1,
      parties: canvas.partiesTelephone,
      reflet: 1.25 - pose.ry * 0.018 + 0.15 * Math.sin(t * 0.7),
      refletI: 0.07,
    })
    // tampon « Mandat signé »
    const dtT = t - T(M.tampon)
    if (dtT > -0.14) {
      const p = clamp((dtT + 0.14) / 0.14)
      const zLoc = lerp(-1350, -4, entreeCubique(p))
      const ech = dtT > 0 ? 1 + 0.08 * Math.exp(-dtT * 12) * Math.cos(dtT * 40) : 1
      const mvS = mat.chaine(mvT, mat.trans(0, 70, zLoc), mat.rotZ(deg(-11 + 25 * (1 - p))), mat.ech(ech))
      const alpha = dtT < 0 ? 0.35 + 0.65 * p : 0.94
      elements.push({ type: 'maille', maille: 'tampon', texture: 'tampon', mv: mvS, lum: 1, alpha, parties: [[0, 0, 6]] })
    }
  }
  return redessine
}

/** Éléments lents (bokeh, poussière) : calculés une fois par image et composés derrière tout le reste. */
export function derriereA(t) {
  if (!pret) preparerScene()
  const b = B(t)
  const liste = []
  const cam = secousse(t)
  const V = mat.chaine(mat.rotZ(cam.rz), mat.trans(cam.x, cam.y, 0))
  const intBokeh = b < 6 ? 0.35 : b < 8 ? 0 : b < 40 ? 1 : b < 52 ? 1.15 : 1.35
  if (intBokeh > 0)
    for (const [i, p] of BOKEH.entries()) {
      const y = ((p.y - p.v * t + 1300) % 2600 + 2600) % 2600 - 1300
      const [x, yy, z] = mat.appliquer(V, p.x + 30 * Math.sin(t * 0.3 + i), y, p.z)
      const a = p.a * intBokeh * (0.75 + 0.25 * Math.sin(t * 1.6 + p.ph))
      liste.push({ p: [x, yy, z], w: p.t, h: p.t, c: [...p.c, a], mode: 0 })
    }
  if (b >= 40) {
    const int = b < 52 ? 1 : 1.3
    for (const p of POUSSIERE) {
      const y = ((p.y - p.v * t + 1150) % 2300 + 2300) % 2300 - 1150
      const [x, yy, z] = mat.appliquer(V, p.x + 20 * Math.sin(t * 0.7 + p.ph), y, p.z)
      liste.push({ p: [x, yy, z], w: p.t, h: p.t, c: [1.4, 1.3, 2, p.a * 0.5 * int * (0.6 + 0.4 * Math.sin(t * 2 + p.ph))], mode: 0 })
    }
  }
  return liste
}

// ———————————————————— fond, post-production, échantillons ————————————————————
const FONDS = {
  accroche: { A: [0.012, 0.016, 0.04], B: [0.05, 0.07, 0.17], C: [0.22, 0.3, 0.62], i: 0.8, ray: 0.05, halo: 0, gh: 0.12, ctr: [0.472, 0.42] },
  coupure: { A: [0, 0, 0], B: [0.02, 0.02, 0.05], C: [0.15, 0.12, 0.38], i: 0, ray: 0, halo: 0, gh: 0, ctr: [0.472, 0.51] },
  demo: { A: [0.015, 0.018, 0.05], B: [0.13, 0.1, 0.4], C: [0.5, 0.36, 0.95], i: 0.82, ray: 0.17, halo: 0.22, gh: 0.16, ctr: [0.472, 0.49] },
  manifeste: { A: [0.012, 0.008, 0.04], B: [0.2, 0.14, 0.62], C: [0.62, 0.52, 1.0], i: 0.95, ray: 0.42, halo: 0.2, gh: 0.2, ctr: [0.472, 0.3] },
  fin: { A: [0.018, 0.016, 0.06], B: [0.13, 0.1, 0.42], C: [0.46, 0.36, 0.95], i: 0.85, ray: 0.12, halo: 0.12, gh: 0.1, ctr: [0.472, 0.6] },
}
function melange(a, b, k) {
  const r = {}
  for (const c of Object.keys(a)) r[c] = Array.isArray(a[c]) ? a[c].map((v, i) => lerp(v, b[c][i], k)) : lerp(a[c], b[c], k)
  return r
}
export function fondA(t) {
  const b = B(t)
  let f
  if (b < 6) f = FONDS.accroche
  else if (b < 8) {
    f = { ...FONDS.coupure }
    const k = prog(T(M.aspiration[0]), T(M.aspiration[1]), t)
    f.i = b < 6.4 ? 0 : 0.35 + 0.65 * k * k
    f.gh = 0.4 * k * k
    if (b >= M.aspiration[1]) f.i = 0
  } else if (b < 40) f = FONDS.demo
  else if (b < 52) f = melange(FONDS.demo, FONDS.manifeste, lisse(prog(T(40), T(40.5), t)))
  else f = melange(FONDS.manifeste, FONDS.fin, lisse(prog(T(52), T(52.6), t)))
  let rayons = f.ray
  if (b >= 40 && b < 52) for (const m of [...M.mots1, ...M.mots2, M.zero, M.oubli]) if (t >= T(m)) rayons += 0.5 * Math.exp(-(t - T(m)) * 3.5)
  if (b >= 52 && t >= T(M.logo)) rayons += 0.6 * Math.exp(-(t - T(M.logo)) * 2.5)
  // lumières douces calculées dans le fond (halo du téléphone, de la carte, du logo…)
  const proj = (x, y, z) => {
    const k = 1650 / (1650 + z)
    return [(540 + x * k) / 1080, 1 - (960 + y * k) / 1920]
  }
  let L1 = [0.5, 0.5, 0.3, 0], C1 = [0, 0, 0], L2 = [0.5, 0.5, 0.3, 0], C2 = [0, 0, 0]
  if (b < 6) {
    L1 = [0.47, 0.62, 0.42, 0.16 + 0.07 * Math.sin(t * 3)]
    C1 = [0.25, 0.3, 0.75]
    if (b >= M.carte) {
      const p = poseCarte(t)
      L2 = [...proj(p.x, p.y, p.z), 0.26, b < M.eclatement ? 0.22 : 0.4 * Math.exp(-(t - T(M.eclatement)) * 4)]
      C2 = [0.4, 0.42, 1]
    }
  } else if (b < 8 && b < M.aspiration[1]) {
    const k = prog(T(M.aspiration[0]), T(M.aspiration[1]), t)
    L1 = [0.472, 0.51, 0.3, 0.3 * k * k]
    C1 = [0.5, 0.4, 1.2]
  } else if (b >= 8 && b < 40) {
    const p = poseTelephone(t, b)
    L1 = [...proj(p.x, p.y, p.z + 200), 0.36, 0.3 + 0.1 * pulsation(t)]
    C1 = [0.42, 0.32, 1]
  } else if (b >= 52) {
    const k = clamp(ressort(t - T(M.logo), 1.2, 5), 0, 1.1)
    L1 = [0.472, 1 - 750 / 1920, 0.26 * k, 0.28]
    C1 = [0.55, 0.45, 1.2]
  }
  return {
    uL1: L1,
    uC1: C1,
    uL2: L2,
    uC2: C2,
    uT: t,
    uA: f.A,
    uB: f.B,
    uC: f.C,
    uIntensite: f.i,
    uRayons: rayons,
    uHalo: f.halo,
    uGrandHalo: f.gh,
    uCentre: f.ctr,
    uPulse: b >= 8 ? pulsation(t) : 0,
    uSombre: 0,
    uDecal: [0.04 * Math.sin(t * 0.13), 0.02 * t],
  }
}

/**
 * Moyenne, sur l'ouverture de l'obturateur (180°, centrée sur t), d'une décroissance exp(-k·(τ − te)) qui démarre en te.
 * Comme le flou de mouvement de la scène : un flash qui part au milieu de l'obturation n'éclaire qu'une partie de l'image,
 * donc l'événement apparaît dès la première image qui le « voit », jamais une image plus tard que le son.
 */
function moyenneObturateur(t, te, k) {
  const h = 0.25 / FPS
  const lo = Math.max(t - h, te), hi = t + h
  if (hi <= te) return 0
  return (Math.exp(-k * (lo - te)) - Math.exp(-k * (hi - te))) / (k * 2 * h)
}

export function postA(t, image) {
  const b = B(t)
  let flash = 0, ca = 0.0011, onde = [0.5, 0.5, -1, 0], glitch = 0
  for (const e of EFFETS) {
    if (e.flash) flash += e.flash * moyenneObturateur(t, e.t, 13)
    if (e.ca) ca += 0.0055 * e.ca * moyenneObturateur(t, e.t, 6)
    if (t < e.t) continue
    const dt = t - e.t
    if (e.onde && dt < 0.8) {
      const [ox, oy] = centreEffet(e.b)
      onde = [(ox + 540) / 1080, 1 - (oy + 960) / 1920, dt * 1.25, 1.0 * e.onde * (1 - dt / 0.8)]
    }
  }
  // montée au blanc à la fin du manifeste, puis le logo apparaît dans la lumière qui retombe
  if (t < T(M.blanc[1])) flash += Math.pow(prog(T(M.blanc[0]), T(M.blanc[1]), t), 2.4) * 1.8
  else flash += 1.8 * Math.exp(-(t - T(M.blanc[1])) * 7)
  if (b >= M.glitch[0] && b < M.coupure) {
    const pas = Math.floor((t - T(M.glitch[0])) / (T(1) / 8))
    const r = alea(pas * 7 + 1)
    glitch = r() > 0.3 ? 0.45 + 0.55 * r() : 0.04
  }
  if (t >= T(M.eclatement) && t < T(M.eclatement) + 0.12) glitch = Math.max(glitch, 0.6)
  if (t < 0.07) glitch = Math.max(glitch, 0.6)
  // extinction « téléviseur » à la coupure
  let crtX = 1, crtY = 1, expo = 1
  const tc = T(M.coupure)
  if (t >= tc && t < tc + 0.17) {
    const p = t - tc
    crtY = Math.max(0.004, 1 - entreeCubique(clamp(p / 0.07)))
    crtX = p > 0.07 ? Math.max(0.002, 1 - sortieCubique(clamp((p - 0.07) / 0.09))) : 1
    expo = 1 + 3 * (1 - crtY) + 4 * (1 - crtX)
    glitch = 0
  }
  if (b >= M.aspiration[1] && b < M.drop) flash = 0
  const sect = b < 6 ? 'accroche' : b < 8 ? 'coupure' : b < 40 ? 'demo' : b < 52 ? 'manifeste' : 'fin'
  const R = {
    accroche: { bloom: 0.55, grain: 0.045, vig: 0.55, sat: 0.62, seuil: 0.85 },
    coupure: { bloom: 0.9, grain: 0.05, vig: 0.5, sat: 0.9, seuil: 0.8 },
    demo: { bloom: 0.5, grain: 0.03, vig: 0.42, sat: 1.04, seuil: 0.92 },
    manifeste: { bloom: 0.72, grain: 0.034, vig: 0.45, sat: 1.06, seuil: 0.9 },
    fin: { bloom: 0.55, grain: 0.027, vig: 0.45, sat: 1.04, seuil: 0.95 },
  }[sect]
  return {
    bloom: R.bloom,
    seuil: R.seuil,
    ca,
    glitch,
    flash,
    flashCoul: b < 8 ? [0.92, 0.95, 1] : [0.95, 0.92, 1],
    grain: R.grain,
    image,
    vignette: R.vig,
    crtX,
    crtY,
    expo,
    sat: R.sat,
    onde,
    fondu: 0,
  }
}

/** Nombre de sous-images de flou de mouvement pour l'image à t (plus élevé quand ça bouge vite). */
export function echantillons(t) {
  const b = B(t)
  let n = 4
  for (const f of FOUETS) if (Math.abs(b - f) < 0.38) n = 12
  for (const e of EFFETS) if (e.secousse && t >= e.t - 0.03 && t < e.t + 0.22) n = Math.max(n, 9)
  if (b >= 8 && b < 9.1) n = Math.max(n, 9)
  if (b >= 38.6 && b < 40.1) n = Math.max(n, 9)
  if (b >= 4 && b < 5.6) n = Math.max(n, 8)
  if (b >= 6 && b < 6.45) n = Math.max(n, 8)
  if (b >= 40 && b < 52) n = Math.max(n, 6)
  if (b >= 35.7 && b < 37) n = Math.max(n, 9)
  return n
}
