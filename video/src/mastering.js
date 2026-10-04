// Mastering du mixage, en JavaScript pur, après le rendu Web Audio.
// Le tampon entier est disponible : le limiteur lit l'avenir au lieu de retarder le signal.
// Aucune latence, donc chaque attaque reste exactement à l'instant prévu par la timeline
// (les compresseurs Web Audio de Chrome, eux, retardent le son de 6 ms chacun).
//   1. montage : vrai silence avant le drop ;
//   2. compresseur de bus 2:1, détection RMS filtrée passe-haut (les infra-basses ne le font pas pomper) ;
//   3. limiteur à crête vraie (interpolation ×8, anticipation 3 ms, relâchement 80 ms) ;
//   4. gain ajusté par itérations jusqu'à la loudness cible (BS.1770-4) ;
//   5. fondu final.

const enDb = (x) => 20 * Math.log10(Math.max(x, 1e-12))
const depuisDb = (d) => Math.pow(10, d / 20)

/** Filtre biquadratique (forme directe II transposée) ; coefficients [b0, b1, b2, a1, a2]. */
function biquad(x, [b0, b1, b2, a1, a2]) {
  const y = new Float32Array(x.length)
  let z1 = 0, z2 = 0
  for (let i = 0; i < x.length; i++) {
    const v = x[i]
    const o = b0 * v + z1
    z1 = b1 * v - a1 * o + z2
    z2 = b2 * v - a2 * o
    y[i] = o
  }
  return y
}

function passeHaut(f, sr, q = Math.SQRT1_2) {
  const w = (2 * Math.PI * f) / sr, al = Math.sin(w) / (2 * q), c = Math.cos(w), a0 = 1 + al
  return [(1 + c) / 2 / a0, -(1 + c) / a0, (1 + c) / 2 / a0, (-2 * c) / a0, (1 - al) / a0]
}

/** Pondération K de la norme BS.1770-4 (coefficients analytiques, comme libebur128). */
function filtresK(sr) {
  let K = Math.tan((Math.PI * 1681.974450955533) / sr)
  const Q1 = 0.7071752369554196, Vh = Math.pow(10, 3.999843853973347 / 20), Vb = Math.pow(Vh, 0.4996667741545416)
  let a0 = 1 + K / Q1 + K * K
  const etagere = [(Vh + (Vb * K) / Q1 + K * K) / a0, (2 * (K * K - Vh)) / a0, (Vh - (Vb * K) / Q1 + K * K) / a0, (2 * (K * K - 1)) / a0, (1 - K / Q1 + K * K) / a0]
  K = Math.tan((Math.PI * 38.13547087602444) / sr)
  const Q2 = 0.5003270373238773
  a0 = 1 + K / Q2 + K * K
  return [etagere, [1, -2, 1, (2 * (K * K - 1)) / a0, (1 - K / Q2 + K * K) / a0]]
}

/** Loudness intégrée (LUFS) : blocs de 400 ms, recouvrement 75 %, portes absolue (-70) et relative (-10 LU). */
export function loudnessIntegree(canaux, sr) {
  const [k1, k2] = filtresK(sr)
  const seg = Math.round(0.1 * sr)
  const nSeg = Math.floor(canaux[0].length / seg)
  const e = new Float64Array(nSeg)
  for (const x of canaux) {
    const y = biquad(biquad(x, k1), k2)
    for (let s = 0; s < nSeg; s++) {
      let a = 0
      for (let i = s * seg, f = i + seg; i < f; i++) a += y[i] * y[i]
      e[s] += a
    }
  }
  const z = []
  for (let s = 0; s + 4 <= nSeg; s++) z.push((e[s] + e[s + 1] + e[s + 2] + e[s + 3]) / (4 * seg))
  const lufs = (v) => -0.691 + 10 * Math.log10(v)
  const moyenne = (a) => a.reduce((s, v) => s + v, 0) / a.length
  const portes = z.filter((v) => v > 0 && lufs(v) > -70)
  const relative = lufs(moyenne(portes)) - 10
  return lufs(moyenne(portes.filter((v) => lufs(v) > relative)))
}

/**
 * Crête vraie de chaque intervalle [n, n+1[ : l'échantillon et 7 valeurs interpolées entre n et n+1
 * (suréchantillonnage ×8, sinc à fenêtre de Kaiser β = 8,6 sur 32 points), maximum sur les canaux.
 */
export function cretesVraies(canaux) {
  const n = canaux[0].length
  const P = 16
  const i0 = (x) => {
    let s = 1, t = 1
    for (let k = 1; k < 40; k++) {
      t *= (x / (2 * k)) ** 2
      s += t
    }
    return s
  }
  const kaiser = (u) => (Math.abs(u) >= 1 ? 0 : i0(8.6 * Math.sqrt(1 - u * u)) / i0(8.6))
  const sinc = (u) => (u === 0 ? 1 : Math.sin(Math.PI * u) / (Math.PI * u))
  const phases = [1, 2, 3, 4, 5, 6, 7].map((k) => {
    const d = k / 8
    const c = new Float64Array(2 * P)
    for (let j = 0; j < 2 * P; j++) {
      const u = d - (j - P + 1)
      c[j] = sinc(u) * kaiser(u / (P + 0.5))
    }
    const somme = c.reduce((s, v) => s + v, 0)
    return c.map((v) => v / somme)
  })
  const p = new Float32Array(n)
  for (const x of canaux) {
    for (let i = 0; i < n; i++) {
      let m = Math.abs(x[i])
      if (i >= P - 1 && i + P < n) {
        const base = i - P + 1
        for (const c of phases) {
          let a = 0
          for (let j = 0; j < 2 * P; j++) a += c[j] * x[base + j]
          if (a > m) m = a
          else if (-a > m) m = -a
        }
      }
      if (m > p[i]) p[i] = m
    }
  }
  return p
}

/** Compresseur de bus (lié en stéréo), gain calculé puis appliqué en place. Renvoie la réduction maximale (dB). */
function glue(canaux, sr, { seuil, ratio = 2, genou = 8, attaque = 0.012, relache = 0.16, hp = 90 }) {
  const [L, R] = canaux
  const n = L.length
  const coefs = passeHaut(hp, sr)
  const lh = biquad(L, coefs), rh = biquad(R, coefs)
  const aRms = 1 - Math.exp(-1 / (0.005 * sr))
  const aA = Math.exp(-1 / (attaque * sr)), aR = Math.exp(-1 / (relache * sr))
  let ms = 0, gs = 0, pire = 0
  for (let i = 0; i < n; i++) {
    ms += ((lh[i] * lh[i] + rh[i] * rh[i]) * 0.5 - ms) * aRms
    const d = 10 * Math.log10(ms + 1e-12) - seuil
    let gc = 0
    if (2 * d > genou) gc = (1 / ratio - 1) * d
    else if (2 * d > -genou) gc = ((1 / ratio - 1) * (d + genou / 2) ** 2) / (2 * genou)
    gs = gc < gs ? aA * gs + (1 - aA) * gc : aR * gs + (1 - aR) * gc
    if (gs < pire) pire = gs
    const g = Math.pow(10, gs / 20)
    L[i] *= g
    R[i] *= g
  }
  return -pire
}

/**
 * Enveloppe de gain du limiteur. Garantie : g[n] × gain d'entrée × crête[n] ≤ plafond, car
 * m[k] = min(r[k..k+A]) ≤ r[n] pour tout k de [n−A, n], et g[n] est une moyenne de tels m (après relâchement,
 * qui ne fait que baisser m). L'attaque est donc une rampe de A échantillons qui finit pile sur la crête.
 */
function enveloppeLimiteur(crete, gainEntree, plafond, sr, anticipation = 0.003, relache = 0.08) {
  const n = crete.length
  const A = Math.round(anticipation * sr)
  const c = depuisDb(plafond)
  const r = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const p = Math.max(crete[i], i ? crete[i - 1] : 0) * gainEntree
    r[i] = p > c ? c / p : 1
  }
  // minimum glissant sur [i, i + A] (file monotone)
  const m = new Float32Array(n)
  const file = new Int32Array(n)
  let tete = 0, queue = 0
  for (let j = 0; j < n + A; j++) {
    if (j < n) {
      while (queue > tete && r[file[queue - 1]] >= r[j]) queue--
      file[queue++] = j
    }
    const i = j - A
    if (i >= 0) {
      while (file[tete] < i) tete++
      m[i] = r[file[tete]]
    }
  }
  // relâchement exponentiel (la réduction peut s'approfondir instantanément, elle ne remonte que lentement)
  const aR = 1 - Math.exp(-1 / (relache * sr))
  let v = 1
  for (let i = 0; i < n; i++) {
    v = m[i] < v ? m[i] : v + (m[i] - v) * aR
    m[i] = v
  }
  // moyenne glissante sur A + 1 échantillons (avant le début : m[0])
  const g = new Float32Array(n)
  let s = (A + 1) * m[0]
  for (let i = 0; i < n; i++) {
    s += m[i] - (i - A - 1 >= 0 ? m[i - A - 1] : m[0])
    g[i] = s / (A + 1)
  }
  return g
}

/**
 * Chaîne complète, en place sur `canaux` (Float32Array, un par canal).
 * `silences` : intervalles [t0, t1[ (s) rendus muets avant traitement ; `fondu` : [t0, t1] fondu de sortie.
 */
export function masteriser(canaux, sr, { cible = -14, plafond = -1.5, silences = [], fondu = null, glueSeuil = -22 } = {}) {
  const n = canaux[0].length
  const rapport = []
  const Lmix = loudnessIntegree(canaux, sr)
  // 1. silences (rampe de 3 ms pour ne pas cliquer)
  for (const [t0, t1] of silences) {
    const i0 = Math.round(t0 * sr), i1 = Math.round(t1 * sr), r = Math.round(0.003 * sr)
    for (const x of canaux) {
      for (let i = i0; i < i1; i++) x[i] *= i < i0 + r ? 1 - (i - i0) / r : 0
    }
  }
  // 2. compresseur de bus, sur un mixage préalablement ramené à -18 LUFS
  const pre = depuisDb(-18 - Lmix)
  for (const x of canaux) for (let i = 0; i < n; i++) x[i] *= pre
  const reductionGlue = glue(canaux, sr, { seuil: glueSeuil })
  const apresGlue = loudnessIntegree(canaux, sr)
  // 3–5. limiteur + fondu, gain d'entrée ajusté jusqu'à la cible
  const crete = cretesVraies(canaux)
  const courbeFondu = new Float32Array(n).fill(1)
  if (fondu) {
    const i0 = Math.round(fondu[0] * sr), i1 = Math.min(n, Math.round(fondu[1] * sr))
    for (let i = i0; i < n; i++) courbeFondu[i] = i >= i1 ? 0 : Math.pow(Math.cos(((i - i0) / (i1 - i0)) * Math.PI * 0.5), 1.5)
  }
  const sortie = canaux.map(() => new Float32Array(n))
  let gainDb = cible - apresGlue
  let L = 0, g = null
  for (let k = 0; k < 8; k++) {
    const G = depuisDb(gainDb)
    g = enveloppeLimiteur(crete, G, plafond, sr)
    canaux.forEach((x, c) => {
      const y = sortie[c]
      for (let i = 0; i < n; i++) y[i] = x[i] * G * g[i] * courbeFondu[i]
    })
    L = loudnessIntegree(sortie, sr)
    if (Math.abs(L - cible) < 0.01) break
    gainDb += cible - L
  }
  canaux.forEach((x, c) => x.set(sortie[c]))
  // statistiques
  let gmin = 1, sous1 = 0
  for (let i = 0; i < n; i++) {
    if (g[i] < gmin) gmin = g[i]
    if (g[i] < 0.891) sous1++
  }
  const tp = enDb(cretesVraies(canaux).reduce((a, v) => (v > a ? v : a), 0))
  // où le limiteur travaille le plus (fenêtres de 0,25 s)
  const fen = Math.round(0.25 * sr), pics = []
  for (let i0 = 0; i0 < n; i0 += fen) {
    let mn = 1
    for (let i = i0; i < Math.min(n, i0 + fen); i++) if (g[i] < mn) mn = g[i]
    pics.push([i0 / sr, -enDb(mn)])
  }
  pics.sort((a, b) => b[1] - a[1])
  const grDb = Array.from(g, (v) => -enDb(v)).sort((a, b) => a - b)
  const centile = (q) => grDb[Math.floor(q * (n - 1))].toFixed(2)
  rapport.push(`réduction du limiteur : médiane ${centile(0.5)} dB, 90 % ${centile(0.9)} dB, 99 % ${centile(0.99)} dB`)
  rapport.push('plus fortes réductions : ' + pics.slice(0, 8).map(([t, d]) => `${t.toFixed(2)} s ${d.toFixed(1)} dB`).join(', '))
  rapport.push(`mixage ${Lmix.toFixed(1)} LUFS → bus 2:1 (réduction max ${reductionGlue.toFixed(1)} dB)`)
  rapport.push(`limiteur : gain d'entrée ${gainDb.toFixed(2)} dB, réduction max ${(-enDb(gmin)).toFixed(1)} dB, ${((100 * sous1) / n).toFixed(1)} % du temps au-delà de 1 dB`)
  rapport.push(`sortie : ${L.toFixed(2)} LUFS, crête vraie ${tp.toFixed(2)} dBTP (PLR ${(tp - L).toFixed(1)} dB)`)
  return rapport.join(' · ')
}
