// Chef d'orchestre : rend une image (avec flou de mouvement), l'envoie au serveur local, rend le son.
import { rendreAudio, versWav } from './audio.js'
import { Moteur, maillageRect, maillageTelephone } from './gl.js'
import { CARTE, TAMPON, TELEPHONE, composer, derriereA, echantillons, fondA, postA, preparerScene } from './scene.js'
import { BPM, CUES, DUREE, EFFETS, FPS, HAUTEUR, LARGEUR, M, T, TEXTES, ZONE_SURE } from './timeline.js'
import { TEL, chargerPolices, peindreCalque, peindreCarteAlerte, peindreTampon, preparerImages } from './ui.js'

const L = LARGEUR, H = HAUTEUR
let moteur, toile

const halton = (i, base) => {
  let f = 1, r = 0
  while (i > 0) {
    f /= base
    r += f * (i % base)
    i = Math.floor(i / base)
  }
  return r
}
const journal = (s) => fetch('/journal', { method: 'POST', body: String(s) })

async function initialiser() {
  await chargerPolices()
  preparerImages()
  preparerScene()
  const canvas = document.getElementById('sortie')
  canvas.width = L
  canvas.height = H
  moteur = new Moteur(canvas, L, H)
  const toileVide = (w, h) => {
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    return c
  }
  const cEcran = toileVide(TEL.W, TEL.H)
  const cCalque = toileVide(L, H)
  const cCarte = toileVide(CARTE.w * 2, CARTE.h * 2)
  const cTampon = toileVide(TAMPON.w * 2, TAMPON.h * 2)
  peindreCarteAlerte(cCarte)
  peindreTampon(cTampon)
  moteur.textureCanvas('ecran', cEcran, true)
  moteur.textureCanvas('calque', cCalque, false)
  moteur.textureCanvas('carte', cCarte, true)
  moteur.textureCanvas('tampon', cTampon, true)
  const tel = maillageTelephone(TELEPHONE.w, TELEPHONE.h, TELEPHONE.r, TELEPHONE.ep)
  moteur.maille('telephone', tel.donnees)
  moteur.maille('carte', maillageRect(CARTE.w, CARTE.h))
  moteur.maille('tampon', maillageRect(TAMPON.w, TAMPON.h))
  moteur.maille('plein', maillageRect(L, H))
  toile = { ctxEcran: cEcran.getContext('2d'), ctxCalque: cCalque.getContext('2d'), partiesTelephone: tel.parties }
}

/**
 * Une image = N sous-images réparties sur un obturateur à 180°, accumulées (flou de mouvement + anticrénelage).
 * `texteSeul` : contrôle de la zone sûre — seul le calque de textes est rendu, avec la même caméra et la même
 * post-production (glitch, aberration, onde de choc, extinction), sur fond noir, sans lumière ni grain.
 */
function rendreImage(f, texteSeul = false) {
  const t = f / FPS
  moteur.debutImage(fondA(t))
  if (texteSeul) moteur.fondNoir()
  const N = echantillons(t)
  const obturateur = 0.5 / FPS
  toile.dernierB = undefined
  for (let s = 0; s < N; s++) {
    const ts = t + ((s + 0.5) / N - 0.5) * obturateur
    const sc = composer(ts, toile)
    if (sc.ecran) moteur.majTexture('ecran')
    // On n'envoie au GPU que la zone utile, mais unie à la zone précédente (+2 px) : sinon d'anciens pixels
    // restent dans la texture juste au bord de la zone et ressortent par le filtrage bilinéaire.
    const z = sc.zone, zp = toile.zonePrecedente ?? z
    moteur.majTextureZone('calque', [
      Math.max(0, Math.min(z[0], zp[0]) - 2),
      Math.max(0, Math.min(z[1], zp[1]) - 2),
      Math.min(L, Math.max(z[2], zp[2]) + 2),
      Math.min(H, Math.max(z[3], zp[3]) + 2),
    ])
    toile.zonePrecedente = z
    const jitter = [((halton(s + 1, 2) - 0.5) * 2) / L, ((halton(s + 1, 3) - 0.5) * 2) / H]
    moteur.sousImage(texteSeul ? { ...sc, elements: sc.elements.filter((e) => e.texture === 'calque') } : sc, 1 / N, jitter)
  }
  const post = postA(t, f)
  if (texteSeul) moteur.finImage({ ...post, bloom: 0, flash: 0, grain: 0, vignette: 0, ondeLum: 0 }, [])
  else moteur.finImage(post, derriereA(t))
  return N
}

window.rendreApercus = async (liste, prefixe = 'apercu') => {
  const c2 = document.createElement('canvas')
  c2.width = L
  c2.height = H
  const x2 = c2.getContext('2d')
  const img = x2.createImageData(L, H)
  for (const f of liste) {
    const t0 = performance.now()
    const N = rendreImage(f)
    const px = moteur.lirePixels()
    for (let y = 0; y < H; y++) img.data.set(px.subarray((H - 1 - y) * L * 4, (H - y) * L * 4), y * L * 4)
    x2.putImageData(img, 0, 0)
    const blob = await new Promise((r) => c2.toBlob(r, 'image/png'))
    await fetch(`/png?nom=${prefixe}-${String(f).padStart(4, '0')}`, { method: 'POST', body: blob })
    await journal(`aperçu ${f} (${N} sous-images) : ${Math.round(performance.now() - t0)} ms`)
  }
}

window.rendreSequence = async (debut, fin, flux) => {
  const t0 = performance.now()
  for (let f = debut; f < fin; f++) {
    rendreImage(f)
    const px = moteur.lirePixels()
    await fetch(`/image?flux=${flux}&i=${f}`, { method: 'POST', body: px })
    if ((f - debut) % 60 === 59) await journal(`flux ${flux} : image ${f + 1}/${fin} — ${((performance.now() - t0) / (f - debut + 1)).toFixed(0)} ms/image`)
  }
}

window.rendreSon = async () => {
  const t0 = performance.now()
  const { buf, rapport } = await rendreAudio()
  await fetch('/audio', { method: 'POST', body: versWav(buf) })
  await journal(`son rendu et masterisé en ${Math.round(performance.now() - t0)} ms — ${rapport}`)
}

/** Pour la vérification de la zone sûre : boîte englobante des textes (calque) à chaque image demandée. */
window.boitesCalque = (images) => {
  const ctx = toile.ctxCalque
  const res = []
  for (const f of images) {
    const t = f / FPS
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, L, H)
    peindreCalque(ctx, t, t / (60 / BPM))
    const d = ctx.getImageData(0, 0, L, H).data
    let x0 = L, y0 = H, x1 = -1, y1 = -1
    for (let y = 0; y < H; y += 2)
      for (let x = 0; x < L; x += 2)
        if (d[(y * L + x) * 4 + 3] > 24) {
          if (x < x0) x0 = x
          if (x > x1) x1 = x
          if (y < y0) y0 = y
          if (y > y1) y1 = y
        }
    res.push(x1 < 0 ? [f, null] : [f, [x0, y0, x1, y1]])
  }
  return res
}

/**
 * Zone sûre mesurée sur l'image finale : boîte englobante des pixels de texte (rendu `texteSeul`), image par image.
 * Les pixels > 24/255 comptent (même seuil que le contrôle du calque) ; le noir de fond du rendu final vaut ~7/255.
 */
window.boitesFinales = async (images) => {
  const res = []
  for (const f of images) {
    rendreImage(f, true)
    const px = moteur.lirePixels()
    let x0 = L, y0 = H, x1 = -1, y1 = -1
    for (let r = 0; r < H; r++) {
      const base = r * L * 4
      for (let x = 0; x < L; x++) {
        const i = base + x * 4
        if (px[i] > 24 || px[i + 1] > 24 || px[i + 2] > 24) {
          const y = H - 1 - r
          if (x < x0) x0 = x
          if (x > x1) x1 = x
          if (y < y0) y0 = y
          if (y > y1) y1 = y
        }
      }
    }
    res.push(x1 < 0 ? [f, null] : [f, [x0, y0, x1, y1]])
    if (res.length % 150 === 0) await journal(`zones finales : ${res.length}/${images.length}`)
  }
  return res
}

window.exporterTimeline = () => JSON.stringify({ BPM, FPS, DUREE, CUES: CUES.map((c) => ({ ...c, t: T(c.b) })), EFFETS, M, ZONE_SURE, TEXTES })

initialiser()
  .then(() => (window.pret = true))
  .catch((e) => (window.erreur = String(e.stack || e)))
