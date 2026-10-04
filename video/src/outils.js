// Petits outils partagés par l'image et le son (déterministes : même résultat à chaque rendu).

export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x))
export const lerp = (a, b, t) => a + (b - a) * t
/** Avancement normalisé de x entre a et b (0 avant, 1 après). */
export const prog = (a, b, x) => clamp((x - a) / (b - a))
export const lisse = (t) => t * t * (3 - 2 * t)

export const sortieExpo = (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t))
export const entreeExpo = (t) => (t <= 0 ? 0 : Math.pow(2, 10 * t - 10))
export const sortieCubique = (t) => 1 - Math.pow(1 - t, 3)
export const entreeCubique = (t) => t * t * t
export const entreeSortieCubique = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
export const sortieQuint = (t) => 1 - Math.pow(1 - t, 5)
export const sortieRetour = (t, s = 1.70158) => 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2)
export const entreeRetour = (t, s = 1.70158) => (s + 1) * t * t * t - s * t * t
/** Ressort amorti : 0 → 1 avec dépassement (dt en secondes). */
export const ressort = (dt, freq = 3, amort = 7) => (dt <= 0 ? 0 : 1 - Math.exp(-amort * dt) * Math.cos(2 * Math.PI * freq * dt))
/** Impulsion qui décroît après t0 (0 avant). */
export const impulsion = (t, t0, decroissance) => (t < t0 ? 0 : Math.exp(-(t - t0) * decroissance))

/** Générateur pseudo-aléatoire reproductible (mulberry32). */
export function alea(graine) {
  let a = graine >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Bruit 1D lisse et déterministe (valeur entre -1 et 1). */
export function bruit1(x, graine = 0) {
  const h = (n) => {
    const s = Math.sin(n * 127.1 + graine * 311.7) * 43758.5453
    return (s - Math.floor(s)) * 2 - 1
  }
  const i = Math.floor(x)
  const f = x - i
  const u = f * f * (3 - 2 * f)
  return h(i) * (1 - u) + h(i + 1) * u
}

export const hex = (h, a = 1) => {
  const n = parseInt(h.slice(1), 16)
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255, a]
}

/** Matrices 4×4 (colonne majeure, comme WebGL). */
export const mat = {
  id: () => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
  mul(a, b) {
    const r = new Array(16)
    for (let i = 0; i < 4; i++)
      for (let j = 0; j < 4; j++) {
        let s = 0
        for (let k = 0; k < 4; k++) s += a[k * 4 + j] * b[i * 4 + k]
        r[i * 4 + j] = s
      }
    return r
  },
  trans: (x, y, z) => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1],
  ech: (x, y = x, z = x) => [x, 0, 0, 0, 0, y, 0, 0, 0, 0, z, 0, 0, 0, 0, 1],
  rotX(a) {
    const c = Math.cos(a), s = Math.sin(a)
    return [1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1]
  },
  rotY(a) {
    const c = Math.cos(a), s = Math.sin(a)
    return [c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1]
  },
  rotZ(a) {
    const c = Math.cos(a), s = Math.sin(a)
    return [c, s, 0, 0, -s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
  },
  /** Composition gauche → droite : chaine(A, B, C) = A·B·C. */
  chaine(...ms) {
    return ms.reduce((acc, m) => mat.mul(acc, m))
  },
  appliquer(m, x, y, z) {
    return [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]]
  },
}
export const deg = (d) => (d * Math.PI) / 180
