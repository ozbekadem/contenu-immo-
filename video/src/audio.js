// Musique et bruitages, entièrement synthétisés (Web Audio, rendu hors ligne).
// Chaque son est programmé à partir de la timeline partagée : mêmes instants que l'image.
import { ACCORDS, BEAT, CUES, DUREE, M, RYTHME, T, accordA } from './timeline.js'
import { masteriser } from './mastering.js'
import { alea } from './outils.js'

export const FREQ_ECH = 48000
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12)

export async function rendreAudio() {
  const ctx = new OfflineAudioContext(2, Math.round(DUREE * FREQ_ECH), FREQ_ECH)
  const s = new Studio(ctx)
  s.programmer()
  const buf = await ctx.startRendering()
  // Mastering hors ligne, sans latence (voir mastering.js) : silence avant le drop, bus, limiteur, -14 LUFS, fondu.
  const rapport = masteriser([buf.getChannelData(0), buf.getChannelData(1)], FREQ_ECH, {
    cible: -14,
    plafond: -1.8, // marge pour l'encodage AAC, qui fait remonter les crêtes d'environ 0,5 dB
    silences: [[T(M.silence[0]), T(M.silence[1])]],
    fondu: [T(M.fondu[0]), T(M.fondu[1])],
  })
  return { buf, rapport }
}

class Studio {
  constructor(ctx) {
    this.ctx = ctx
    this.hasard = alea(20261004)
    // Bruit blanc partagé (4 s, stéréo décorrélée)
    this.bruit = ctx.createBuffer(2, FREQ_ECH * 4, FREQ_ECH)
    const r = alea(7)
    for (let c = 0; c < 2; c++) {
      const d = this.bruit.getChannelData(c)
      for (let i = 0; i < d.length; i++) d[i] = r() * 2 - 1
    }

    // —— Bus de sortie : égalisation pensée pour les haut-parleurs de téléphone (qui ne rendent rien sous ~150 Hz) :
    // passe-haut à 28 Hz (infra inaudibles qui mangent la marge), graves un peu retenus, médium et présence en avant.
    // Compression, limitation et fondu sont faits ensuite en JavaScript, sans latence (mastering.js).
    this.master = this.g(0.2)
    const grave = this.filtre('lowshelf', 140)
    grave.gain.value = -2.5
    const medium = this.filtre('peaking', 1000, 0.7)
    medium.gain.value = 2
    const presence = this.filtre('peaking', 3200, 0.8)
    presence.gain.value = 2.5
    this.master.connect(this.filtre('highpass', 28, 0.7)).connect(grave).connect(medium).connect(presence).connect(ctx.destination)

    // Réverbération (réponse impulsionnelle générée) et écho ping-pong au temps pointé
    this.rev = ctx.createConvolver()
    this.rev.buffer = this.reponse(2.6)
    this.revRetour = this.g(0.55)
    this.rev.connect(this.revRetour).connect(this.master)
    this.delai = this.pingPong(BEAT * 0.75, 0.38)

    // Bus « pompé » par le kick (basse, nappes, arpège) : sidechain programmé sur la timeline
    this.pompe = this.g(1)
    this.pompe.connect(this.master)
    this.batterie = this.g(0.95)
    this.batterie.connect(this.master)
    this.sfx = this.g(0.85)
    this.sfx.connect(this.master)
  }

  // ———————————————————— utilitaires ————————————————————
  g(v = 1) {
    const n = this.ctx.createGain()
    n.gain.value = v
    return n
  }
  osc(type, f) {
    const o = this.ctx.createOscillator()
    o.type = type
    o.frequency.value = f
    return o
  }
  filtre(type, f, q = 0.7) {
    const b = this.ctx.createBiquadFilter()
    b.type = type
    b.frequency.value = f
    b.Q.value = q
    return b
  }
  pan(p) {
    const n = this.ctx.createStereoPanner()
    n.pan.value = Math.max(-1, Math.min(1, p))
    return n
  }
  envoi(noeud, vers, v) {
    const g = this.g(v)
    noeud.connect(g).connect(vers)
  }
  source(t, duree) {
    const s = this.ctx.createBufferSource()
    s.buffer = this.bruit
    const decalage = this.hasard() * (4 - duree - 0.05)
    s.start(t, Math.max(0, decalage), duree + 0.02)
    return s
  }
  /** Enveloppe : montée linéaire jusqu'à `pic`, maintien, puis décroissance exponentielle (tau). */
  env(param, t, a, pic, tau, maintien = 0) {
    param.setValueAtTime(0, t)
    param.linearRampToValueAtTime(pic, t + a)
    if (maintien) param.setValueAtTime(pic, t + a + maintien)
    param.setTargetAtTime(0, t + a + maintien, tau)
  }
  reponse(duree) {
    const n = Math.round(duree * FREQ_ECH)
    const b = this.ctx.createBuffer(2, n, FREQ_ECH)
    const r = alea(99)
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c)
      let lp = 0
      for (let i = 0; i < n; i++) {
        const t = i / FREQ_ECH
        const amp = t < 0.012 ? 0 : Math.pow(1 - i / n, 2.2) * Math.exp(-t * 1.6)
        lp += ((r() * 2 - 1) - lp) * (0.35 + 0.5 * (1 - t / duree)) // queue de plus en plus sombre
        d[i] = lp * amp
      }
    }
    return b
  }
  pingPong(temps, retour) {
    const ctx = this.ctx
    const entree = this.g(1)
    const g = ctx.createDelay(2)
    const d = ctx.createDelay(2)
    g.delayTime.value = temps
    d.delayTime.value = temps
    const fg = this.g(retour)
    const fd = this.g(retour)
    const lp = this.filtre('lowpass', 4200)
    const merger = ctx.createChannelMerger(2)
    entree.connect(lp).connect(g)
    g.connect(fg).connect(d)
    d.connect(fd).connect(g)
    g.connect(merger, 0, 0)
    d.connect(merger, 0, 1)
    const sortie = this.g(0.4)
    merger.connect(sortie).connect(this.master)
    return entree
  }

  // ———————————————————— programmation ————————————————————
  programmer() {
    const ctx = this.ctx
    // Sidechain : la basse, les nappes et l'arpège s'effacent à chaque kick.
    const p = this.pompe.gain
    p.setValueAtTime(1, 0)
    for (const b of RYTHME.kick) {
      const t = T(b)
      p.setValueAtTime(1, t)
      p.linearRampToValueAtTime(0.25, t + 0.006)
      p.setTargetAtTime(1, t + 0.03, 0.075)
    }

    for (const b of RYTHME.kick) this.kick(T(b), b >= 40 && b < 52 ? 0.95 : b >= 52 ? 0.85 : 1)
    for (const b of RYTHME.clap) this.clap(T(b), b >= 52 ? 0.75 : 1)
    for (const h of RYTHME.hatFerme) this.hat(T(h.b), h.v * 0.6, false)
    for (const h of RYTHME.hatOuvert) this.hat(T(h.b), h.v * 0.5, true)
    for (const n of RYTHME.basse) (n.longue ? this.basseLongue : this.bassePluck).call(this, T(n.b), T(n.d), ACCORDS[n.accord].basse)
    for (const g of [8, 12, 16, 20, 24, 28, 32, 36, 40, 44, 48, 52, 56, 60]) {
      const a = accordA(g)
      this.nappe(T(g), T(g === 60 ? 4 : a.d), a.accord, g >= 52 ? 1.15 : g >= 40 ? 1.1 : g < 16 ? 0.7 : 1)
    }
    for (const n of RYTHME.arpege) {
      const notes = ACCORDS[n.accord].notes
      const midi = notes[n.degre] + (n.cloche ? 24 : 12)
      if (n.cloche) this.cloche(T(n.b), mtof(midi), 0.06 * n.v, 0.7, this.hasard() * 1.2 - 0.6)
      else this.arpege(T(n.b), mtof(midi), n.v, (n.b * 4) % 2 ? 0.35 : -0.35)
    }
    for (const n of RYTHME.claviers) this.clavier(T(n.b), n.accord)
    for (const [a, b] of RYTHME.roulements) this.roulement(T(a), T(b))
    for (const c of RYTHME.crash) this.crash(T(c.b), c.v)
    for (const c of CUES) this.cue(c)
  }

  cue(c) {
    const t = T(c.b)
    switch (c.son) {
      case 'impact': return this.impact(t, c.force)
      case 'stab': return this.stab(t, c.accord, c.octave ?? 0)
      case 'drone': return this.drone(t, T(c.fin))
      case 'tic': return this.tic(t, c.n)
      case 'whoosh': return this.whoosh(t, T(c.duree), c.force ?? 0.6)
      case 'notifSombre': return this.notifSombre(t)
      case 'verre': return this.verre(t)
      case 'montee': return this.montee(t, T(c.fin), c.force ?? 1)
      case 'glitch': return this.glitch(t, T(c.fin))
      case 'arretBande': return this.arretBande(t)
      case 'souffle': return this.souffle(t)
      case 'cymbaleInverse': return this.cymbaleInverse(t, T(c.fin))
      case 'souffleLarge': return this.whoosh(t, T(c.duree), 0.7, true)
      case 'bip': return this.bip(t)
      case 'declencheur': return this.declencheur(t, c.n)
      case 'epingle': return this.epingle(t)
      case 'pop': return this.pop(t, c.note)
      case 'tap': return this.tap(t)
      case 'valide': return this.valide(t)
      case 'sonnerie': return this.sonnerie(t, T(c.fin))
      case 'raccroche': return this.raccroche(t)
      case 'scintille': return this.scintille(t, T(c.duree), c.force ?? 0.7)
      case 'ligne': return this.ligne(t, c.n)
      case 'notification': return this.notification(t)
      case 'goutte': return this.goutte(t, c.n)
      case 'cran': return this.cran(t, c.n)
      case 'ping': return this.cloche(t, mtof(84), 0.16, 1.4, 0, 0.35)
      case 'tampon': return this.tampon(t)
      case 'mot': return this.mot(t, c.n)
      case 'souffleCourt': return this.whoosh(t - 0.12, 0.34, 0.3)
      case 'ding': return this.ding(t)
      case 'reflet': return this.reflet(t, c.force ?? 1)
      case 'pluck': return this.pluck(t, c.n)
      case 'clic': return this.clic(t)
      case 'succes': return this.succes(t)
      default: console.warn('son inconnu', c.son)
    }
  }

  // ———————————————————— batterie ————————————————————
  kick(t, v = 1) {
    // corps : sinus en glissando 230 → 62 → 50 Hz, saturé (harmoniques impaires = punch sur petit haut-parleur)
    const o = this.osc('sine', 200)
    o.frequency.setValueAtTime(230, t)
    o.frequency.exponentialRampToValueAtTime(62, t + 0.04)
    o.frequency.exponentialRampToValueAtTime(50, t + 0.28)
    const ws = this.ctx.createWaveShaper()
    ws.curve = courbe((x) => Math.tanh(2.6 * x))
    const g = this.g(0)
    this.env(g.gain, t, 0.0012, 0.9 * v, 0.085, 0.03)
    o.connect(ws).connect(g).connect(this.batterie)
    o.start(t)
    o.stop(t + 0.7)
    // « knock » médium
    const k = this.osc('triangle', 200)
    k.frequency.setValueAtTime(270, t)
    k.frequency.exponentialRampToValueAtTime(140, t + 0.03)
    const gk = this.g(0)
    this.env(gk.gain, t, 0.0008, 0.3 * v, 0.022)
    k.connect(gk).connect(this.batterie)
    k.start(t)
    k.stop(t + 0.2)
    // clic d'attaque
    const n = this.source(t, 0.03)
    const hp = this.filtre('highpass', 2400)
    const pk = this.filtre('peaking', 4200, 1.4)
    pk.gain.value = 6
    const gn = this.g(0)
    this.env(gn.gain, t, 0.0004, 0.4 * v, 0.005)
    n.connect(hp).connect(pk).connect(gn).connect(this.batterie)
  }
  clap(t, v = 1) {
    for (const k of [0, 0.011, 0.023]) {
      const n = this.source(t + k, 0.05)
      const bp = this.filtre('bandpass', 1150, 1.1)
      const g = this.g(0)
      this.env(g.gain, t + k, 0.0008, 0.95 * v, 0.0045)
      n.connect(bp).connect(g).connect(this.batterie)
    }
    const n = this.source(t + 0.028, 0.4)
    const bp = this.filtre('bandpass', 1350, 0.75)
    const g = this.g(0)
    this.env(g.gain, t + 0.028, 0.001, 0.64 * v, 0.05)
    n.connect(bp).connect(g)
    g.connect(this.batterie)
    this.envoi(g, this.rev, 0.35)
  }
  hat(t, v, ouvert) {
    const n = this.source(t, ouvert ? 0.5 : 0.1)
    const hp = this.filtre('highpass', ouvert ? 7600 : 8200)
    const pk = this.filtre('peaking', 10500, 1.2)
    pk.gain.value = 5
    const g = this.g(0)
    this.env(g.gain, t, 0.0008, v, ouvert ? 0.075 : 0.011)
    const p = this.pan(ouvert ? 0.18 : (Math.round(t / (BEAT / 4)) % 2 ? 0.22 : -0.12))
    n.connect(hp).connect(pk).connect(g).connect(p).connect(this.batterie)
  }
  caisse(t, v) {
    const o = this.osc('triangle', 200)
    o.frequency.setValueAtTime(205, t)
    o.frequency.exponentialRampToValueAtTime(160, t + 0.06)
    const go = this.g(0)
    this.env(go.gain, t, 0.001, 0.35 * v, 0.03)
    o.connect(go).connect(this.batterie)
    o.start(t)
    o.stop(t + 0.3)
    const n = this.source(t, 0.25)
    const bp = this.filtre('bandpass', 1900, 0.7)
    const hp = this.filtre('highpass', 700)
    const g = this.g(0)
    this.env(g.gain, t, 0.001, 0.55 * v, 0.04)
    n.connect(bp).connect(hp).connect(g).connect(this.batterie)
    this.envoi(g, this.rev, 0.2)
  }
  roulement(t0, t1) {
    // doubles croches puis triples croches, crescendo
    const milieu = t0 + (t1 - t0) * 0.5
    let t = t0
    while (t < t1 - 0.005) {
      const k = (t - t0) / (t1 - t0)
      this.caisse(t, 0.25 + 0.75 * k * k)
      t += t < milieu ? BEAT / 4 : BEAT / 8
    }
  }
  crash(t, v) {
    const n = this.source(t, 2.5)
    const hp = this.filtre('highpass', 4200)
    const g = this.g(0)
    this.env(g.gain, t, 0.002, 0.42 * v, 0.55)
    const p = this.pan(0.1)
    n.connect(hp).connect(g).connect(p).connect(this.batterie)
    this.envoi(g, this.rev, 0.3)
    // timbre métallique : oscillateurs carrés inharmoniques
    const m = this.g(0)
    this.env(m.gain, t, 0.002, 0.05 * v, 0.35)
    const hp2 = this.filtre('highpass', 6500)
    for (const f of [205.3, 304.4, 369.6, 522.7, 540, 800]) {
      const o = this.osc('square', f * 1.7)
      o.connect(hp2)
      o.start(t)
      o.stop(t + 2.2)
    }
    hp2.connect(m).connect(this.batterie)
  }

  // ———————————————————— basse, nappes, mélodie ————————————————————
  bassePluck(t, duree, midi) {
    const f = mtof(midi)
    const lp = this.filtre('lowpass', 1800, 4)
    lp.frequency.setValueAtTime(2600, t)
    lp.frequency.setTargetAtTime(420, t + 0.005, 0.07)
    const g = this.g(0)
    this.env(g.gain, t, 0.003, 0.4, duree * 0.3)
    for (const [type, mult, v, cents] of [['sawtooth', 1, 1, 0], ['square', 1, 0.5, 7], ['sawtooth', 2, 0.35, -5]]) {
      const o = this.osc(type, f * mult)
      o.detune.value = cents
      const gv = this.g(v)
      o.connect(gv).connect(lp)
      o.start(t)
      o.stop(t + duree + 0.3)
    }
    lp.connect(g).connect(this.pompe)
    const sub = this.osc('sine', f)
    const gs = this.g(0)
    this.env(gs.gain, t, 0.006, 0.36, 0.03, duree * 0.75)
    sub.connect(gs).connect(this.pompe)
    sub.start(t)
    sub.stop(t + duree + 0.3)
  }
  basseLongue(t, duree, midi) {
    const f = mtof(midi)
    const sub = this.osc('sine', f)
    const gs = this.g(0)
    gs.gain.setValueAtTime(0, t)
    gs.gain.linearRampToValueAtTime(0.34, t + 0.04)
    gs.gain.setValueAtTime(0.34, t + duree - 0.2)
    gs.gain.linearRampToValueAtTime(0, t + duree)
    sub.connect(gs).connect(this.pompe)
    sub.start(t)
    sub.stop(t + duree + 0.1)
    const o = this.osc('sawtooth', f)
    const lp = this.filtre('lowpass', 650, 1.2)
    const g = this.g(0)
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(0.2, t + 0.08)
    g.gain.setValueAtTime(0.2, t + duree - 0.2)
    g.gain.linearRampToValueAtTime(0, t + duree)
    o.connect(lp).connect(g).connect(this.pompe)
    o.start(t)
    o.stop(t + duree + 0.1)
  }
  nappe(t, duree, accord, v = 1) {
    const notes = ACCORDS[accord].notes
    const lp = this.filtre('lowpass', 1500, 0.6)
    lp.frequency.setValueAtTime(1300, t)
    lp.frequency.linearRampToValueAtTime(3400, t + duree * 0.6)
    const g = this.g(0)
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(0.095 * v, t + 0.18)
    g.gain.setValueAtTime(0.095 * v, t + duree - 0.12)
    g.gain.linearRampToValueAtTime(0, t + duree + 0.25)
    notes.forEach((m, i) => {
      const p = this.pan(-0.55 + (1.1 * i) / (notes.length - 1))
      for (const cents of [-11, 0, 12]) {
        const o = this.osc('sawtooth', mtof(m))
        o.detune.value = cents
        o.connect(p)
        o.start(t)
        o.stop(t + duree + 0.4)
      }
      p.connect(lp)
    })
    lp.connect(g)
    g.connect(this.pompe)
    this.envoi(g, this.rev, 0.3)
  }
  arpege(t, f, v, panoramique) {
    const o = this.osc('square', f)
    const o2 = this.osc('sawtooth', f * 2)
    o2.detune.value = 6
    const lp = this.filtre('lowpass', 3600, 3)
    lp.frequency.setValueAtTime(5000, t)
    lp.frequency.setTargetAtTime(700, t + 0.003, 0.055)
    const g = this.g(0)
    this.env(g.gain, t, 0.002, 0.1 * v, 0.06)
    const p = this.pan(panoramique)
    const g2 = this.g(0.35)
    o.connect(lp)
    o2.connect(g2).connect(lp)
    lp.connect(g).connect(p).connect(this.pompe)
    this.envoi(p, this.delai, 0.35)
    this.envoi(p, this.rev, 0.12)
    o.start(t)
    o2.start(t)
    o.stop(t + 0.5)
    o2.stop(t + 0.5)
  }
  /** Cloche FM (porteuse sinus, modulatrice au rapport 3,5). */
  cloche(t, f, v, duree = 1, panoramique = 0, rev = 0.3, rapport = 3.5) {
    const c = this.osc('sine', f)
    const m = this.osc('sine', f * rapport)
    const gm = this.g(0)
    this.env(gm.gain, t, 0.001, f * 2.2, duree * 0.18)
    m.connect(gm).connect(c.frequency)
    const g = this.g(0)
    this.env(g.gain, t, 0.002, v, duree * 0.3)
    const p = this.pan(panoramique)
    c.connect(g).connect(p).connect(this.sfx)
    this.envoi(p, this.rev, rev)
    c.start(t)
    m.start(t)
    c.stop(t + duree * 2)
    m.stop(t + duree * 2)
    return p
  }
  /** Piano électrique FM pour les mots du manifeste. */
  clavier(t, accord) {
    const notes = ACCORDS[accord].notes.map((m) => m + 12)
    notes.forEach((m, i) => {
      const f = mtof(m)
      const c = this.osc('sine', f)
      const mo = this.osc('sine', f)
      const gm = this.g(0)
      this.env(gm.gain, t, 0.001, f * 1.6, 0.18)
      mo.connect(gm).connect(c.frequency)
      const g = this.g(0)
      this.env(g.gain, t + i * 0.012, 0.003, 0.13, 0.55)
      const p = this.pan(-0.4 + i * 0.27)
      c.connect(g).connect(p).connect(this.sfx)
      this.envoi(p, this.rev, 0.45)
      this.envoi(p, this.delai, 0.12)
      c.start(t)
      mo.start(t)
      c.stop(t + 3)
      mo.stop(t + 3)
    })
  }
  stab(t, accord, octave) {
    const notes = ACCORDS[accord].notes
    const ws = this.ctx.createWaveShaper()
    ws.curve = courbe((x) => Math.tanh(3.2 * x))
    const lp = this.filtre('lowpass', 2400, 1.2)
    lp.frequency.setValueAtTime(4000, t)
    lp.frequency.setTargetAtTime(900, t + 0.01, 0.18)
    const g = this.g(0)
    this.env(g.gain, t, 0.004, 0.28, 0.16)
    for (const m of notes) {
      for (const cents of [-13, 13]) {
        const o = this.osc('sawtooth', mtof(m + octave))
        o.detune.value = cents
        o.connect(ws)
        o.start(t)
        o.stop(t + 1.4)
      }
    }
    ws.connect(lp).connect(g).connect(this.sfx)
    this.envoi(g, this.rev, 0.45)
    const sub = this.osc('sine', mtof(ACCORDS[accord].basse))
    const gs = this.g(0)
    this.env(gs.gain, t, 0.004, 0.3, 0.18)
    sub.connect(gs).connect(this.sfx)
    sub.start(t)
    sub.stop(t + 1.2)
  }
  drone(t0, t1) {
    // Bourdon de tension (fa + do), filtre qui s'ouvre, puis « arrêt de bande » à la coupure.
    const lp = this.filtre('lowpass', 140, 5)
    lp.frequency.setValueAtTime(140, t0)
    lp.frequency.exponentialRampToValueAtTime(900, t1)
    lp.frequency.setValueAtTime(900, t1)
    lp.frequency.exponentialRampToValueAtTime(90, t1 + 0.4)
    const g = this.g(0)
    g.gain.setValueAtTime(0, t0)
    g.gain.linearRampToValueAtTime(0.16, t0 + 0.05)
    g.gain.linearRampToValueAtTime(0.26, t1)
    g.gain.setTargetAtTime(0, t1 + 0.16, 0.07)
    for (const [m, cents] of [[29, -8], [29, 8], [36, -5], [36, 6], [41, 0]]) {
      const o = this.osc('sawtooth', mtof(m))
      o.detune.value = cents
      o.frequency.setValueAtTime(mtof(m), t1)
      o.frequency.exponentialRampToValueAtTime(mtof(m) * 0.14, t1 + 0.42)
      o.connect(lp)
      o.start(t0)
      o.stop(t1 + 0.7)
    }
    lp.connect(g).connect(this.sfx)
    this.envoi(g, this.rev, 0.2)
  }

  // ———————————————————— impacts et transitions ————————————————————
  impact(t, force = 1) {
    const sub = this.osc('sine', 90)
    sub.frequency.setValueAtTime(100, t)
    sub.frequency.exponentialRampToValueAtTime(40, t + 0.7)
    const gs = this.g(0)
    this.env(gs.gain, t, 0.002, 0.6 * Math.min(force, 1.2), 0.22 * force)
    sub.connect(gs).connect(this.sfx)
    sub.start(t)
    sub.stop(t + 1.8)
    // corps saturé : la « masse » de l'impact, restituée par un haut-parleur de téléphone
    const corps = this.osc('sine', 160)
    corps.frequency.setValueAtTime(200, t)
    corps.frequency.exponentialRampToValueAtTime(72, t + 0.2)
    const ws = this.ctx.createWaveShaper()
    ws.curve = courbe((x) => Math.tanh(3 * x))
    const gc = this.g(0)
    this.env(gc.gain, t, 0.001, 0.3 * Math.min(force, 1.2), 0.08)
    corps.connect(ws).connect(gc).connect(this.sfx)
    corps.start(t)
    corps.stop(t + 0.7)
    // pas de second kick si la batterie en joue déjà un au même instant (deux kicks en phase = +6 dB de crête)
    if (!RYTHME.kick.some((b) => Math.abs(T(b) - t) < 1e-6)) this.kick(t, 0.9 * Math.min(force, 1.1))
    const n = this.source(t, 1.6)
    const lp = this.filtre('lowpass', 6500, 0.8)
    lp.frequency.setValueAtTime(8000, t)
    lp.frequency.exponentialRampToValueAtTime(700, t + 0.9)
    const g = this.g(0)
    this.env(g.gain, t, 0.002, 0.5 * force, 0.18)
    n.connect(lp).connect(g).connect(this.sfx)
    this.envoi(g, this.rev, 0.6)
    const n2 = this.source(t, 0.05)
    const hp = this.filtre('highpass', 3000)
    const g2 = this.g(0)
    this.env(g2.gain, t, 0.0006, 0.55 * force, 0.009)
    n2.connect(hp).connect(g2).connect(this.sfx)
  }
  whoosh(t, duree, force = 0.6, large = false) {
    const n = this.source(t, duree + 0.1)
    const bp = this.filtre('bandpass', 400, large ? 0.8 : 1.4)
    bp.frequency.setValueAtTime(large ? 2600 : 320, t)
    bp.frequency.exponentialRampToValueAtTime(large ? 380 : 3200, t + duree * (large ? 0.9 : 0.55))
    if (!large) bp.frequency.exponentialRampToValueAtTime(600, t + duree)
    const g = this.g(0)
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(0.5 * force, t + duree * (large ? 0.08 : 0.55))
    g.gain.linearRampToValueAtTime(0, t + duree)
    const p = this.pan(0)
    p.pan.setValueAtTime(-0.85, t)
    p.pan.linearRampToValueAtTime(0.85, t + duree)
    n.connect(bp).connect(g).connect(p).connect(this.sfx)
    this.envoi(p, this.rev, 0.18)
  }
  montee(t0, t1, force = 1) {
    const n = this.source(t0, t1 - t0 + 0.05)
    const bp = this.filtre('bandpass', 400, 1.6)
    bp.frequency.setValueAtTime(380, t0)
    bp.frequency.exponentialRampToValueAtTime(9500, t1)
    const g = this.g(0)
    g.gain.setValueAtTime(0.0001, t0)
    g.gain.exponentialRampToValueAtTime(0.42 * force, t1 - 0.008)
    g.gain.linearRampToValueAtTime(0, t1 + 0.004)
    n.connect(bp).connect(g).connect(this.sfx)
    this.envoi(g, this.rev, 0.25)
    const o = this.osc('sawtooth', 220)
    o.frequency.setValueAtTime(110, t0)
    o.frequency.exponentialRampToValueAtTime(880, t1)
    const lp = this.filtre('lowpass', 1200, 2)
    lp.frequency.setValueAtTime(300, t0)
    lp.frequency.exponentialRampToValueAtTime(4000, t1)
    const go = this.g(0)
    go.gain.setValueAtTime(0.0001, t0)
    go.gain.exponentialRampToValueAtTime(0.07 * force, t1 - 0.008)
    go.gain.linearRampToValueAtTime(0, t1 + 0.004)
    o.connect(lp).connect(go).connect(this.sfx)
    o.start(t0)
    o.stop(t1 + 0.05)
  }
  cymbaleInverse(t0, t1) {
    const n = this.source(t0, t1 - t0 + 0.05)
    const hp = this.filtre('highpass', 2400)
    const g = this.g(0)
    g.gain.setValueAtTime(0.0001, t0)
    g.gain.exponentialRampToValueAtTime(0.5, t1 - 0.006)
    g.gain.linearRampToValueAtTime(0, t1)
    n.connect(hp).connect(g).connect(this.sfx)
    // aspiration grave qui monte
    const o = this.osc('sine', 80)
    o.frequency.setValueAtTime(70, t0)
    o.frequency.exponentialRampToValueAtTime(720, t1)
    const go = this.g(0)
    go.gain.setValueAtTime(0.0001, t0)
    go.gain.exponentialRampToValueAtTime(0.22, t1 - 0.006)
    go.gain.linearRampToValueAtTime(0, t1)
    o.connect(go).connect(this.sfx)
    o.start(t0)
    o.stop(t1 + 0.02)
  }
  arretBande(t) {
    // l'accord s'effondre comme une bande qu'on arrête
    const lp = this.filtre('lowpass', 2000, 1)
    lp.frequency.setValueAtTime(2000, t)
    lp.frequency.exponentialRampToValueAtTime(120, t + 0.45)
    const g = this.g(0)
    g.gain.setValueAtTime(0.0001, t)
    g.gain.linearRampToValueAtTime(0.2, t + 0.01)
    g.gain.setTargetAtTime(0, t + 0.22, 0.08)
    for (const m of ACCORDS.Db.notes) {
      const o = this.osc('sawtooth', mtof(m))
      o.frequency.setValueAtTime(mtof(m), t)
      o.frequency.exponentialRampToValueAtTime(mtof(m) * 0.12, t + 0.45)
      o.connect(lp)
      o.start(t)
      o.stop(t + 0.6)
    }
    lp.connect(g).connect(this.sfx)
  }
  souffle(t) {
    const o = this.osc('sine', 72)
    const g = this.g(0)
    this.env(g.gain, t, 0.006, 0.3, 0.09)
    o.connect(g).connect(this.sfx)
    o.start(t)
    o.stop(t + 0.6)
    const n = this.source(t, 1.4)
    const bp = this.filtre('bandpass', 900, 0.6)
    const gn = this.g(0)
    gn.gain.setValueAtTime(0, t)
    gn.gain.linearRampToValueAtTime(0.07, t + 0.25)
    gn.gain.setTargetAtTime(0, t + 0.3, 0.25)
    n.connect(bp).connect(gn).connect(this.sfx)
    for (const m of [72, 79]) {
      const s = this.osc('sine', mtof(m))
      const gs = this.g(0)
      gs.gain.setValueAtTime(0, t)
      gs.gain.linearRampToValueAtTime(0.035, t + 0.3)
      gs.gain.setTargetAtTime(0, t + 0.45, 0.2)
      s.connect(gs).connect(this.sfx)
      this.envoi(gs, this.rev, 0.6)
      s.start(t)
      s.stop(t + 1.6)
    }
  }
  verre(t) {
    // craquement + éclats de verre (bruits résonants aléatoires) + débris
    const n = this.source(t, 0.2)
    const hp = this.filtre('highpass', 1800)
    const g = this.g(0)
    this.env(g.gain, t, 0.0008, 0.55, 0.03)
    n.connect(hp).connect(g).connect(this.sfx)
    const r = alea(4242)
    for (let i = 0; i < 46; i++) {
      const ti = t + 0.012 + Math.pow(r(), 1.8) * 0.95
      const f = 2600 + r() * 6800
      const bp = this.filtre('bandpass', f, 22 + r() * 30)
      const gi = this.g(0)
      const amp = (0.35 + r() * 0.65) * (1 - (ti - t) / 1.1) * 1.4
      this.env(gi.gain, ti, 0.0006, amp, 0.015 + r() * 0.035)
      const p = this.pan(r() * 1.8 - 0.9)
      const s = this.source(ti, 0.25)
      s.connect(bp).connect(gi).connect(p).connect(this.sfx)
      this.envoi(p, this.rev, 0.25)
    }
    for (let i = 0; i < 6; i++) {
      const ti = t + 0.08 + r() * 0.6
      const s = this.source(ti, 0.1)
      const lp = this.filtre('lowpass', 500)
      const gi = this.g(0)
      this.env(gi.gain, ti, 0.001, 0.18, 0.02)
      s.connect(lp).connect(gi).connect(this.sfx)
    }
  }
  glitch(t0, t1) {
    const r = alea(555)
    const pas = BEAT / 8
    const crush = this.ctx.createWaveShaper()
    crush.curve = courbe((x) => Math.round(x * 5) / 5)
    const sortie = this.g(1)
    crush.connect(sortie).connect(this.sfx)
    for (let t = t0, i = 0; t < t1 - 0.01; t += pas, i++) {
      if (i % 7 === 5) continue
      const o = this.osc('square', mtof([65, 72, 68, 77, 60][Math.floor(r() * 5)]))
      const g = this.g(0)
      const d = pas * (0.4 + r() * 0.45)
      g.gain.setValueAtTime(0, t)
      g.gain.linearRampToValueAtTime(0.12, t + 0.002)
      g.gain.setValueAtTime(0.12, t + d)
      g.gain.linearRampToValueAtTime(0, t + d + 0.003)
      const p = this.pan(r() * 1.4 - 0.7)
      o.connect(g).connect(p).connect(crush)
      o.start(t)
      o.stop(t + d + 0.01)
      const n = this.source(t, 0.06)
      const gn = this.g(0)
      this.env(gn.gain, t, 0.001, 0.12, 0.008)
      n.connect(gn).connect(p)
    }
  }

  // ———————————————————— interface et bruitages de la démo ————————————————————
  tic(t, n) {
    const f = n % 2 ? 1550 : 2100
    const o = this.osc('sine', f)
    const g = this.g(0)
    this.env(g.gain, t, 0.0008, 0.16, 0.012)
    const p = this.pan(n % 2 ? 0.25 : -0.25)
    o.connect(g).connect(p).connect(this.sfx)
    o.start(t)
    o.stop(t + 0.12)
    const s = this.source(t, 0.05)
    const bp = this.filtre('bandpass', f * 1.5, 6)
    const gs = this.g(0)
    this.env(gs.gain, t, 0.0006, 0.3, 0.006)
    s.connect(bp).connect(gs).connect(p)
    this.envoi(p, this.rev, 0.15)
  }
  notifSombre(t) {
    this.cloche(t, mtof(80), 0.2, 1.3, -0.1, 0.5, 2)
    this.cloche(t + 0.14, mtof(79), 0.2, 1.6, 0.1, 0.5, 2)
  }
  bip(t) {
    for (const k of [0, 0.075]) {
      const o = this.osc('sine', mtof(100))
      const g = this.g(0)
      this.env(g.gain, t + k, 0.002, 0.06, 0.015, 0.025)
      o.connect(g).connect(this.sfx)
      o.start(t + k)
      o.stop(t + k + 0.15)
    }
  }
  declencheur(t, n) {
    const p = this.pan(-0.15 + n * 0.08)
    const s1 = this.source(t, 0.05)
    const hp1 = this.filtre('highpass', 3500)
    const g1 = this.g(0)
    this.env(g1.gain, t, 0.0004, 0.55, 0.0035)
    s1.connect(hp1).connect(g1).connect(p)
    const o = this.osc('sine', 520)
    o.frequency.setValueAtTime(560, t)
    o.frequency.exponentialRampToValueAtTime(170, t + 0.025)
    const go = this.g(0)
    this.env(go.gain, t, 0.001, 0.32, 0.014)
    o.connect(go).connect(p)
    o.start(t)
    o.stop(t + 0.12)
    const s2 = this.source(t + 0.058, 0.05)
    const hp2 = this.filtre('highpass', 2400)
    const g2 = this.g(0)
    this.env(g2.gain, t + 0.058, 0.0004, 0.36, 0.005)
    s2.connect(hp2).connect(g2).connect(p)
    p.connect(this.sfx)
    this.envoi(p, this.rev, 0.12)
  }
  epingle(t) {
    const o = this.osc('sine', 500)
    o.frequency.setValueAtTime(420, t)
    o.frequency.exponentialRampToValueAtTime(1150, t + 0.035)
    const g = this.g(0)
    this.env(g.gain, t, 0.002, 0.2, 0.04)
    o.connect(g).connect(this.sfx)
    o.start(t)
    o.stop(t + 0.3)
    const th = this.osc('sine', 170)
    th.frequency.setValueAtTime(190, t + 0.05)
    th.frequency.exponentialRampToValueAtTime(80, t + 0.12)
    const gt = this.g(0)
    this.env(gt.gain, t + 0.05, 0.002, 0.35, 0.04)
    th.connect(gt).connect(this.sfx)
    th.start(t + 0.05)
    th.stop(t + 0.4)
  }
  pop(t, note) {
    const f = mtof([72, 75, 77, 80, 84][note % 5])
    const o = this.osc('sine', f)
    o.frequency.setValueAtTime(f * 0.55, t)
    o.frequency.exponentialRampToValueAtTime(f, t + 0.028)
    const g = this.g(0)
    this.env(g.gain, t, 0.002, 0.2, 0.05)
    const o2 = this.osc('triangle', f * 2)
    const g2 = this.g(0)
    this.env(g2.gain, t, 0.002, 0.05, 0.03)
    o.connect(g).connect(this.sfx)
    o2.connect(g2).connect(this.sfx)
    this.envoi(g, this.rev, 0.15)
    o.start(t)
    o2.start(t)
    o.stop(t + 0.4)
    o2.stop(t + 0.3)
  }
  tap(t) {
    const o = this.osc('sine', 1400)
    o.frequency.setValueAtTime(1500, t)
    o.frequency.exponentialRampToValueAtTime(650, t + 0.02)
    const g = this.g(0)
    this.env(g.gain, t, 0.0008, 0.13, 0.012)
    o.connect(g).connect(this.sfx)
    o.start(t)
    o.stop(t + 0.12)
    const s = this.source(t, 0.03)
    const hp = this.filtre('highpass', 6000)
    const gs = this.g(0)
    this.env(gs.gain, t, 0.0004, 0.12, 0.0025)
    s.connect(hp).connect(gs).connect(this.sfx)
  }
  valide(t) {
    this.cloche(t, mtof(84), 0.1, 0.6, -0.1, 0.25, 2)
    this.cloche(t + 0.07, mtof(89), 0.1, 0.8, 0.1, 0.25, 2)
  }
  sonnerie(t0, t1) {
    // sonnerie en deux salves par temps (trilles mi♭ – la♭)
    const lp = this.filtre('lowpass', 5200)
    const sortie = this.g(1)
    lp.connect(sortie).connect(this.sfx)
    this.envoi(sortie, this.rev, 0.2)
    for (let tb = t0; tb < t1 - 0.01; tb += BEAT) {
      for (let k = 0; k < 6; k++) {
        const t = tb + k * (BEAT / 8)
        const o = this.osc('sine', mtof(k % 2 ? 92 : 87))
        const g = this.g(0)
        g.gain.setValueAtTime(0, t)
        g.gain.linearRampToValueAtTime(0.055, t + 0.004)
        g.gain.setValueAtTime(0.055, t + BEAT / 8 - 0.012)
        g.gain.linearRampToValueAtTime(0, t + BEAT / 8 - 0.002)
        o.connect(g).connect(lp)
        o.start(t)
        o.stop(t + BEAT / 8)
      }
    }
  }
  raccroche(t) {
    for (const [k, m] of [[0, 80], [0.09, 75]]) {
      const o = this.osc('sine', mtof(m))
      const g = this.g(0)
      this.env(g.gain, t + k, 0.002, 0.08, 0.02, 0.04)
      o.connect(g).connect(this.sfx)
      o.start(t + k)
      o.stop(t + k + 0.25)
    }
  }
  scintille(t, duree, force) {
    const r = alea(Math.round(t * 1000))
    const gamme = [77, 80, 82, 84, 87, 89, 92, 94, 96, 99]
    const nb = Math.round(10 + duree * 8)
    for (let i = 0; i < nb; i++) {
      const ti = t + Math.pow(r(), 1.4) * duree
      const m = gamme[Math.floor(r() * gamme.length)]
      const p = this.cloche(ti, mtof(m), (0.025 + r() * 0.035) * force, 0.5 + r() * 0.5, r() * 1.6 - 0.8, 0.5, 3.5)
      this.envoi(p, this.delai, 0.25)
    }
  }
  ligne(t, n) {
    const f = [1150, 1300, 1460, 1640][n]
    const o = this.osc('sine', f)
    const g = this.g(0)
    this.env(g.gain, t, 0.0008, 0.12, 0.016)
    o.connect(g).connect(this.sfx)
    o.start(t)
    o.stop(t + 0.15)
    const s = this.source(t, 0.03)
    const bp = this.filtre('bandpass', f * 2.2, 5)
    const gs = this.g(0)
    this.env(gs.gain, t, 0.0005, 0.2, 0.005)
    s.connect(bp).connect(gs).connect(this.sfx)
  }
  notification(t) {
    this.cloche(t, mtof(80), 0.17, 1, -0.15, 0.35, 2)
    this.cloche(t + 0.11, mtof(87), 0.17, 1.4, 0.15, 0.35, 2)
  }
  goutte(t, n) {
    const m = [65, 68, 73, 77, 80, 85, 89, 92][n]
    const f = mtof(m)
    const o = this.osc('triangle', f)
    const lp = this.filtre('lowpass', 5000)
    const g = this.g(0)
    this.env(g.gain, t, 0.002, 0.12, 0.07)
    const p = this.pan(n % 2 ? 0.3 : -0.3)
    o.connect(lp).connect(g).connect(p).connect(this.sfx)
    this.envoi(p, this.delai, 0.3)
    this.envoi(p, this.rev, 0.2)
    o.start(t)
    o.stop(t + 0.6)
  }
  cran(t, n) {
    const s = this.source(t, 0.02)
    const hp = this.filtre('highpass', 5200)
    const g = this.g(0)
    this.env(g.gain, t, 0.0004, 0.09 + n * 0.004, 0.0022)
    s.connect(hp).connect(g).connect(this.sfx)
    const o = this.osc('sine', 2900 + n * 40)
    const go = this.g(0)
    this.env(go.gain, t, 0.0005, 0.03, 0.004)
    o.connect(go).connect(this.sfx)
    o.start(t)
    o.stop(t + 0.05)
  }
  tampon(t) {
    const o = this.osc('sine', 120)
    o.frequency.setValueAtTime(150, t)
    o.frequency.exponentialRampToValueAtTime(52, t + 0.25)
    const g = this.g(0)
    this.env(g.gain, t, 0.002, 0.65, 0.09)
    o.connect(g).connect(this.sfx)
    o.start(t)
    o.stop(t + 0.8)
    const s = this.source(t, 0.3)
    const lp = this.filtre('lowpass', 1600)
    const gs = this.g(0)
    this.env(gs.gain, t, 0.001, 0.6, 0.05)
    s.connect(lp).connect(gs).connect(this.sfx)
    const s2 = this.source(t + 0.004, 0.1)
    const bp = this.filtre('bandpass', 2300, 1)
    const g2 = this.g(0)
    this.env(g2.gain, t + 0.004, 0.0006, 0.5, 0.016)
    s2.connect(bp).connect(g2).connect(this.sfx)
    this.envoi(g2, this.rev, 0.4)
    this.envoi(gs, this.rev, 0.3)
  }
  mot(t, n) {
    // coup grave doux sous chaque mot du manifeste
    const o = this.osc('sine', 80)
    o.frequency.setValueAtTime(92, t)
    o.frequency.exponentialRampToValueAtTime(46, t + 0.5)
    const g = this.g(0)
    this.env(g.gain, t, 0.003, 0.3 + n * 0.06, 0.14)
    o.connect(g).connect(this.sfx)
    o.start(t)
    o.stop(t + 1)
    const c = this.osc('triangle', 200)
    c.frequency.setValueAtTime(230, t)
    c.frequency.exponentialRampToValueAtTime(115, t + 0.08)
    const gc = this.g(0)
    this.env(gc.gain, t, 0.001, 0.16 + n * 0.03, 0.04)
    c.connect(gc).connect(this.sfx)
    c.start(t)
    c.stop(t + 0.4)
    const s = this.source(t, 0.6)
    const bp = this.filtre('bandpass', 2500 + n * 900, 0.9)
    const gs = this.g(0)
    this.env(gs.gain, t, 0.002, 0.14, 0.06)
    s.connect(bp).connect(gs).connect(this.sfx)
    this.envoi(gs, this.rev, 0.5)
  }
  ding(t) {
    this.cloche(t, mtof(96), 0.13, 1.6, 0.1, 0.45, 3.5)
    this.cloche(t + 0.02, mtof(99), 0.08, 1.4, -0.1, 0.45, 3.5)
  }
  reflet(t, force) {
    const s = this.source(t, 0.4)
    const bp = this.filtre('bandpass', 5000, 2)
    bp.frequency.setValueAtTime(4500, t)
    bp.frequency.exponentialRampToValueAtTime(13000, t + 0.28)
    const g = this.g(0)
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(0.11 * force, t + 0.12)
    g.gain.linearRampToValueAtTime(0, t + 0.3)
    const p = this.pan(0)
    p.pan.setValueAtTime(-0.6, t)
    p.pan.linearRampToValueAtTime(0.6, t + 0.3)
    s.connect(bp).connect(g).connect(p).connect(this.sfx)
    this.envoi(p, this.rev, 0.3)
    this.cloche(t + 0.1, mtof(104), 0.03 * force, 1.2, 0.3, 0.5)
  }
  pluck(t, n) {
    const f = mtof([75, 77, 80][n])
    const p = this.cloche(t, f, 0.14, 0.9, [-0.3, 0, 0.3][n], 0.35, 2)
    this.envoi(p, this.delai, 0.3)
    const o = this.osc('triangle', f / 2)
    const g = this.g(0)
    this.env(g.gain, t, 0.002, 0.1, 0.12)
    o.connect(g).connect(this.sfx)
    o.start(t)
    o.stop(t + 0.7)
  }
  clic(t) {
    this.tap(t)
    const o = this.osc('sine', 150)
    o.frequency.setValueAtTime(170, t)
    o.frequency.exponentialRampToValueAtTime(70, t + 0.1)
    const g = this.g(0)
    this.env(g.gain, t, 0.002, 0.35, 0.04)
    o.connect(g).connect(this.sfx)
    o.start(t)
    o.stop(t + 0.4)
  }
  succes(t) {
    ;[80, 84, 87, 92].forEach((m, i) => {
      const p = this.cloche(t + 0.03 + i * 0.05, mtof(m), 0.13, 1.4, -0.3 + i * 0.2, 0.45, 2)
      this.envoi(p, this.delai, 0.2)
    })
  }
}

function courbe(fn, n = 2048) {
  const c = new Float32Array(n)
  for (let i = 0; i < n; i++) c[i] = fn((i / (n - 1)) * 2 - 1)
  return c
}

/** AudioBuffer → fichier WAV 32 bits flottants (stéréo entrelacée). */
export function versWav(buf) {
  const nc = buf.numberOfChannels
  const n = buf.length
  const octets = 44 + n * nc * 4
  const ab = new ArrayBuffer(octets)
  const v = new DataView(ab)
  const ecrire = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)))
  ecrire(0, 'RIFF')
  v.setUint32(4, octets - 8, true)
  ecrire(8, 'WAVE')
  ecrire(12, 'fmt ')
  v.setUint32(16, 16, true)
  v.setUint16(20, 3, true) // IEEE float
  v.setUint16(22, nc, true)
  v.setUint32(24, buf.sampleRate, true)
  v.setUint32(28, buf.sampleRate * nc * 4, true)
  v.setUint16(32, nc * 4, true)
  v.setUint16(34, 32, true)
  ecrire(36, 'data')
  v.setUint32(40, n * nc * 4, true)
  const canaux = [...Array(nc)].map((_, c) => buf.getChannelData(c))
  let o = 44
  for (let i = 0; i < n; i++)
    for (let c = 0; c < nc; c++) {
      v.setFloat32(o, canaux[c][i], true)
      o += 4
    }
  return new Uint8Array(ab)
}
