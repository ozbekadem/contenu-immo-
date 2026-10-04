// Rendu de la vidéo : un serveur local sert la page animée et reçoit les images brutes,
// Playwright (Chromium sans écran) calcule chaque image, ffmpeg encode.
//
//   node rendu.mjs apercu 0 225 600 …   → images PNG de contrôle
//   node rendu.mjs son                  → musique et bruitages (WAV 48 kHz, brut)
//   node rendu.mjs video [processus]    → les 1800 images, encodées en H.264 (plusieurs navigateurs en parallèle)
//   node rendu.mjs final                → AAC contrôlé (-14 LUFS, crête vraie ≤ -1,2 dBTP mesurées après décodage) + assemblage
//   node rendu.mjs tout                 → son + vidéo + final
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'
import { cretesVraies, loudnessIntegree } from './src/mastering.js'

const RACINE = path.dirname(fileURLToPath(import.meta.url))
const SORTIE = process.env.SORTIE || path.join(RACINE, 'sortie')
const FFMPEG = process.env.FFMPEG || 'ffmpeg'
const CHROME = process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
const NB_IMAGES = 1800
fs.mkdirSync(path.join(SORTIE, 'apercus'), { recursive: true })

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.woff2': 'font/woff2', '.json': 'application/json' }
const flux = new Map()

function lireCorps(req) {
  return new Promise((ok) => {
    const morceaux = []
    req.on('data', (m) => morceaux.push(m))
    req.on('end', () => ok(Buffer.concat(morceaux)))
  })
}

const serveur = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://localhost')
  if (req.method === 'GET') {
    const f = path.join(RACINE, decodeURIComponent(u.pathname === '/' ? '/index.html' : u.pathname))
    if (!f.startsWith(RACINE) || !fs.existsSync(f)) return res.writeHead(404).end()
    res.writeHead(200, { 'content-type': TYPES[path.extname(f)] ?? 'application/octet-stream' })
    return fs.createReadStream(f).pipe(res)
  }
  if (u.pathname === '/image') {
    const ff = flux.get(u.searchParams.get('flux'))
    req.on('data', (m) => {
      if (!ff.stdin.write(m)) {
        req.pause()
        ff.stdin.once('drain', () => req.resume())
      }
    })
    req.on('end', () => res.end('ok'))
    return
  }
  const corps = await lireCorps(req)
  if (u.pathname === '/png') fs.writeFileSync(path.join(SORTIE, 'apercus', `${u.searchParams.get('nom')}.png`), corps)
  else if (u.pathname === '/audio') fs.writeFileSync(path.join(SORTIE, 'son-brut.wav'), corps)
  else if (u.pathname === '/journal') console.log('  ·', corps.toString())
  res.end('ok')
})
await new Promise((ok) => serveur.listen(0, '127.0.0.1', ok))
const ADRESSE = `http://127.0.0.1:${serveur.address().port}/index.html`

async function ouvrirPage() {
  const navigateur = await chromium.launch({
    executablePath: CHROME,
    args: ['--use-gl=angle', '--use-angle=swiftshader-webgl', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-background-timer-throttling', '--disable-renderer-backgrounding'],
  })
  const page = await navigateur.newPage({ viewport: { width: 600, height: 1000 } })
  page.on('console', (m) => m.type() === 'error' && console.log('  [page]', m.text()))
  page.on('pageerror', (e) => console.log('  [erreur page]', e.message))
  await page.goto(ADRESSE)
  await page.waitForFunction(() => window.pret || window.erreur, null, { timeout: 120000 })
  const erreur = await page.evaluate(() => window.erreur)
  if (erreur) throw new Error(erreur)
  return { navigateur, page }
}

function executer(args, { sortieTexte = false } = {}) {
  return new Promise((ok, ko) => {
    const p = spawn(FFMPEG, args, { stdio: ['ignore', 'pipe', 'pipe'] })
    let err = ''
    p.stderr.on('data', (d) => (err += d))
    p.on('close', (code) => (code === 0 ? ok(err) : ko(new Error(`ffmpeg ${code}\n${err.slice(-3000)}`))))
  })
}

/** ffmpeg avec entrée et sortie binaires (tuyaux), pour travailler sur le son en mémoire. */
function ffmpegFlux(args, entree) {
  return new Promise((ok, ko) => {
    const p = spawn(FFMPEG, ['-hide_banner', '-loglevel', 'error', ...args], { stdio: ['pipe', 'pipe', 'pipe'] })
    const sortie = []
    let err = ''
    p.stdout.on('data', (d) => sortie.push(d))
    p.stderr.on('data', (d) => (err += d))
    p.on('close', (code) => (code === 0 ? ok(Buffer.concat(sortie)) : ko(new Error(`ffmpeg ${code}\n${err.slice(-2000)}`))))
    p.stdin.on('error', () => {})
    p.stdin.end(entree ?? Buffer.alloc(0))
  })
}
const versCanaux = (buf) => {
  const v = new Float32Array(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length))
  const n = v.length / 2
  const c = [new Float32Array(n), new Float32Array(n)]
  for (let i = 0; i < n; i++) {
    c[0][i] = v[2 * i]
    c[1][i] = v[2 * i + 1]
  }
  return c
}
const entrelacer = (c) => {
  const v = new Float32Array(c[0].length * 2)
  for (let i = 0; i < c[0].length; i++) {
    v[2 * i] = c[0][i]
    v[2 * i + 1] = c[1][i]
  }
  return Buffer.from(v.buffer)
}
const RAW = ['-f', 'f32le', '-ar', '48000', '-ac', '2']
const AAC = ['-c:a', 'aac', '-b:a', '320k', '-ar', '48000']
const dbtp = (x) => 20 * Math.log10(Math.max(x, 1e-12))

/**
 * Encodage AAC contrôlé. Le codec fait remonter certaines crêtes (surtout une attaque franche après un silence,
 * comme le drop) et retire un peu d'énergie. On encode, on décode, on mesure le résultat :
 *   - loudness intégrée hors de `cible` ± 0,03 LU → gain global corrigé ;
 *   - crête vraie au-dessus de `limite` → gain creusé juste autour de la crête (plateau 8 ms, rampes cosinus 25 ms),
 *     de quelques dixièmes de dB : inaudible et sans effet sur la loudness.
 * puis on recommence, jusqu'à ce que le fichier AAC lui-même respecte les deux.
 */
async function aacControle(pcm, fichierAac, { cible = -14, limite = -1.2 } = {}) {
  const sr = 48000, n = pcm[0].length
  const F = Math.round(0.008 * sr), R = Math.round(0.025 * sr)
  const creux = new Float32Array(n).fill(1)
  let global = 1
  const journalAac = []
  for (let k = 0; k < 10; k++) {
    const entree = pcm.map((x) => x.map((v, i) => v * creux[i] * global))
    await ffmpegFlux(['-y', ...RAW, '-i', '-', ...AAC, fichierAac], entrelacer(entree))
    const decode = versCanaux(await ffmpegFlux(['-i', fichierAac, ...RAW, '-']))
    const I = loudnessIntegree(decode, sr)
    const p = cretesVraies(decode)
    let max = 0
    for (let i = 0; i < p.length; i++) if (p[i] > max) max = p[i]
    journalAac.push(`passe ${k + 1} : ${I.toFixed(2)} LUFS, crête vraie ${dbtp(max).toFixed(2)} dBTP`)
    if (Math.abs(I - cible) <= 0.03 && dbtp(max) <= limite) return { pcm: entree, journal: journalAac, I, tp: dbtp(max) }
    if (Math.abs(I - cible) > 0.03) global *= Math.pow(10, (cible - I) / 20)
    const lim = Math.pow(10, limite / 20)
    const passe = new Float32Array(n).fill(1)
    for (let i = 0; i < Math.min(n, p.length); i++) {
      if (p[i] <= lim) continue
      const g = (lim / p[i]) * Math.pow(10, -0.05 / 20)
      for (let j = Math.max(0, i - F - R); j < Math.min(n, i + F + R); j++) {
        const d = Math.abs(j - i)
        const w = d <= F ? 1 : 0.5 + 0.5 * Math.cos((Math.PI * (d - F)) / R)
        const gj = 1 - (1 - g) * w
        if (gj < passe[j]) passe[j] = gj
      }
    }
    for (let i = 0; i < n; i++) creux[i] *= passe[i]
  }
  throw new Error('AAC non maîtrisé : ' + journalAac.join(' · '))
}

async function apercu(images) {
  const { navigateur, page } = await ouvrirPage()
  await page.evaluate((l) => window.rendreApercus(l), images)
  fs.writeFileSync(path.join(SORTIE, 'timeline.json'), await page.evaluate(() => window.exporterTimeline()))
  await navigateur.close()
}

/**
 * Zone sûre : (1) boîte des textes dans le calque, toutes les images ; (2) boîte des pixels de texte sur l'image
 * finale (caméra + post-production comprises), rendue en `nbProcessus` navigateurs parallèles.
 */
async function zones(nbProcessus = 3) {
  const { navigateur, page } = await ouvrirPage()
  const images = Array.from({ length: NB_IMAGES }, (_, i) => i)
  fs.writeFileSync(path.join(SORTIE, 'zones-textes.json'), JSON.stringify(await page.evaluate((l) => window.boitesCalque(l), images)))
  await navigateur.close()
  const parts = await Promise.all(
    Array.from({ length: nbProcessus }, async (_, k) => {
      const { navigateur, page } = await ouvrirPage()
      const liste = images.filter((f) => f % nbProcessus === k)
      const r = await page.evaluate((l) => window.boitesFinales(l), liste)
      await navigateur.close()
      return r
    }),
  )
  fs.writeFileSync(path.join(SORTIE, 'zones-finales.json'), JSON.stringify(parts.flat().sort((a, b) => a[0] - b[0])))
}

async function son() {
  const { navigateur, page } = await ouvrirPage()
  await page.evaluate(() => window.rendreSon())
  fs.writeFileSync(path.join(SORTIE, 'timeline.json'), await page.evaluate(() => window.exporterTimeline()))
  await navigateur.close()
}

async function video(nbProcessus = 2, debut = 0, fin = NB_IMAGES) {
  const t0 = Date.now()
  const total = fin - debut
  const segments = []
  for (let k = 0; k < nbProcessus; k++) {
    const a = debut + Math.round((total * k) / nbProcessus), b = debut + Math.round((total * (k + 1)) / nbProcessus)
    segments.push({ k, a, b, fichier: path.join(SORTIE, `segment-${k}.mp4`) })
  }
  await Promise.all(
    segments.map(async (s) => {
      const ff = spawn(FFMPEG, [
        '-y', '-loglevel', 'error',
        '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', '1080x1920', '-r', '60', '-i', '-',
        '-vf', 'vflip,scale=out_color_matrix=bt709:out_range=tv,format=yuv420p',
        // CRF 18 plafonné à 20 Mbit/s : qualité « master » pour l'envoi sur TikTok, fichier d'environ 70 Mo
        '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-maxrate', '20M', '-bufsize', '40M', '-tune', 'film',
        '-profile:v', 'high', '-level', '4.2', '-g', '60', '-keyint_min', '60', '-sc_threshold', '0',
        '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709',
        s.fichier,
      ], { stdio: ['pipe', 'inherit', 'inherit'] })
      flux.set(String(s.k), ff)
      const fini = new Promise((ok, ko) => ff.on('close', (c) => (c === 0 ? ok() : ko(new Error('ffmpeg segment ' + c)))))
      const { navigateur, page } = await ouvrirPage()
      await page.evaluate(([a, b, k]) => window.rendreSequence(a, b, k), [s.a, s.b, s.k])
      await navigateur.close()
      ff.stdin.end()
      await fini
    }),
  )
  const liste = path.join(SORTIE, 'segments.txt')
  fs.writeFileSync(liste, segments.map((s) => `file '${s.fichier}'`).join('\n'))
  await executer(['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', liste, '-c', 'copy', path.join(SORTIE, 'image.mp4')])
  console.log(`vidéo : ${total} images en ${((Date.now() - t0) / 60000).toFixed(1)} min`)
}

async function final() {
  // Le son arrive déjà masterisé à -14 LUFS / -1,8 dBTP (mastering.js, BS.1770-4). Ici : encodage AAC contrôlé
  // (loudness et crête vraie mesurées sur le fichier AAC décodé), puis assemblage avec l'image.
  const brut = path.join(SORTIE, 'son-brut.wav')
  const pcm = versCanaux(await ffmpegFlux(['-i', brut, ...RAW, '-']))
  console.log('master :', loudnessIntegree(pcm, 48000).toFixed(2), 'LUFS')
  const aac = path.join(SORTIE, 'son.m4a')
  const { pcm: corrige, journal } = await aacControle(pcm, aac)
  journal.forEach((l) => console.log('aac :', l))
  // référence PCM 24 bits (exactement le signal encodé), pour la vérification
  await ffmpegFlux(['-y', ...RAW, '-i', '-', '-c:a', 'pcm_s24le', path.join(SORTIE, 'son-14lufs.wav')], entrelacer(corrige))
  const sortie = path.join(SORTIE, 'prospectimmo-30s.mp4')
  await executer([
    '-y', '-loglevel', 'error', '-i', path.join(SORTIE, 'image.mp4'), '-i', aac,
    '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'copy',
    '-movflags', '+faststart', sortie,
  ])
  console.log('fichier final :', sortie, (fs.statSync(sortie).size / 1e6).toFixed(1), 'Mo')
}

const [mode, ...args] = process.argv.slice(2)
try {
  if (mode === 'apercu') await apercu(args.map(Number))
  else if (mode === 'son') await son()
  else if (mode === 'zones') await zones(Number(args[0] ?? 3))
  else if (mode === 'video') await video(Number(args[0] ?? 2), Number(args[1] ?? 0), Number(args[2] ?? NB_IMAGES))
  else if (mode === 'final') await final()
  else if (mode === 'tout') {
    await son()
    await video(Number(args[0] ?? 2))
    await final()
  } else console.log('mode inconnu :', mode)
} finally {
  serveur.close()
}
