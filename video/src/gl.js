// Moteur WebGL2 : composition 3D, flou de mouvement par accumulation de sous-images,
// bloom HDR, aberration chromatique, onde de choc, glitch, grain, vignettage.

const VS_PLEIN = `#version 300 es
in vec2 aPos; out vec2 vUv;
void main(){ vUv = aPos * .5 + .5; gl_Position = vec4(aPos, 0., 1.); }`

const BRUIT = `
float h21(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.-2.*f);
  return mix(mix(h21(i), h21(i+vec2(1,0)), f.x), mix(h21(i+vec2(0,1)), h21(i+vec2(1,1)), f.x), f.y); }
float fbm(vec2 p){ float s = 0., a = .5; for(int k = 0; k < 4; k++){ s += a * vnoise(p); p = p * 2.03 + vec2(1.7, 9.2); a *= .5; } return s; }`

const FS_FOND = `#version 300 es
precision highp float;
in vec2 vUv; out vec4 o;
uniform float uT, uIntensite, uRayons, uHalo, uPulse, uSombre, uGrandHalo;
uniform vec3 uA, uB, uC;
uniform vec2 uCentre, uDecal;
uniform vec4 uL1, uL2;
uniform vec3 uC1, uC2;
${BRUIT}
void main(){
  vec2 p = (vUv - .5) * vec2(.5625, 1.) * 2. + uDecal;
  float t = uT;
  vec2 q = vec2(fbm(p * 1.05 + vec2(0., t * .07)), fbm(p * 1.05 + vec2(5.2, -t * .06)));
  float n = fbm(p * 1.55 + q * 1.9 + vec2(t * .045, -t * .03));
  vec3 col = mix(uA, uB, smoothstep(.22, .8, n));
  col = mix(col, uC, smoothstep(.6, 1.02, n) * .75);
  col *= uIntensite;
  vec2 d = vUv - uCentre; d.x *= .5625; float r = length(d);
  float a = atan(d.y, d.x);
  float ray = vnoise(vec2(a * 6.5 + 3., t * .35)) * vnoise(vec2(a * 13. - 7., -t * .5 + 4.));
  ray = pow(ray, 1.6);
  col += uC * ray * uRayons * exp(-r * 1.6) * 1.6;
  col += uC * uHalo * exp(-r * r * 10.);
  col += mix(uB, uC, .5) * uGrandHalo * exp(-r * r * 2.2);
  vec2 e1 = (vUv - uL1.xy) * vec2(.5625, 1.);
  col += uC1 * uL1.w * exp(-dot(e1, e1) / max(uL1.z * uL1.z, 1e-4));
  vec2 e2 = (vUv - uL2.xy) * vec2(.5625, 1.);
  col += uC2 * uL2.w * exp(-dot(e2, e2) / max(uL2.z * uL2.z, 1e-4));
  col *= 1. + uPulse * .14;
  col *= 1. - uSombre;
  o = vec4(col, 1.);
}`

const FS_COPIE = `#version 300 es
precision highp float;
in vec2 vUv; out vec4 o;
uniform sampler2D uTex; uniform float uPoids, uPoidsA;
void main(){ vec4 c = texture(uTex, vUv); o = vec4(c.rgb * uPoids, c.a * uPoidsA); }`

const VS_MAILLE = `#version 300 es
in vec3 aPos; in vec2 aUv; in vec3 aNor;
uniform mat4 uMV; uniform vec2 uRes; uniform float uF; uniform vec2 uJitter;
out vec2 vUv; out vec3 vNor; out vec3 vPos;
void main(){
  vec4 P = uMV * vec4(aPos, 1.);
  float w = (P.z + uF) / uF;
  vUv = aUv; vNor = mat3(uMV) * aNor; vPos = P.xyz;
  gl_Position = vec4(P.x / (uRes.x * .5) + uJitter.x * w, -P.y / (uRes.y * .5) + uJitter.y * w, (P.z / 5000.) * w, w);
}`

const FS_MAILLE = `#version 300 es
precision highp float;
in vec2 vUv; in vec3 vNor; in vec3 vPos; out vec4 o;
uniform sampler2D uTex; uniform int uMode; uniform float uLum, uAlpha, uReflet, uRefletI, uEchelle;
uniform vec3 uTeinte;
void main(){
  if (uMode == 0) {
    vec4 c = texture(uTex, vUv);
    c.rgb *= uLum * uTeinte;
    float bande = exp(-pow((vUv.x * .85 + vUv.y * .55 - uReflet) * 5.5, 2.));
    c.rgb += vec3(.95, .97, 1.) * bande * uRefletI * c.a;
    o = c * uAlpha;
    o.rgb *= uEchelle;
  } else if (uMode == 3) {
    vec4 c = texture(uTex, vUv);
    c.rgb *= uLum;
    o = c * clamp(vNor.z, 0., 1.);
    o.rgb *= uEchelle;
  } else {
    vec3 N = normalize(vNor);
    vec3 L = normalize(vec3(-.45, -.65, -.9));
    float dif = max(dot(N, L), 0.);
    vec3 V = vec3(0., 0., -1.);
    float spec = pow(max(dot(reflect(-L, N), V), 0.), 22.);
    float rim = pow(1. - abs(N.z), 3.);
    vec3 base = uMode == 1 ? vec3(.16, .17, .25) : vec3(.07, .08, .12);
    vec3 col = base * (.35 + .9 * dif) + vec3(.75, .72, 1.) * spec * .9 + vec3(.55, .45, 1.) * rim * .25;
    o = vec4(col * uLum * uEchelle, 1.) * uAlpha;
  }
}`

const VS_SPRITE = `#version 300 es
in vec3 aPos; in vec2 aUv; in vec4 aCol; in float aMode;
uniform vec2 uRes; uniform float uF; uniform vec2 uJitter;
out vec2 vUv; out vec4 vCol; out float vMode;
void main(){
  float w = (aPos.z + uF) / uF;
  vUv = aUv; vCol = aCol; vMode = aMode;
  gl_Position = vec4(aPos.x / (uRes.x * .5) + uJitter.x * w, -aPos.y / (uRes.y * .5) + uJitter.y * w, (aPos.z / 5000.) * w, w);
}`

const FS_SPRITE = `#version 300 es
precision highp float;
in vec2 vUv; in vec4 vCol; in float vMode; out vec4 o;
uniform float uEchelle;
void main(){
  if (vMode < .5) {
    float r2 = dot(vUv, vUv);
    float a = exp(-r2 * 3.2) * smoothstep(1., .7, r2);
    o = vCol * a;
  } else if (vMode < 1.5) {
    float e = max(abs(vUv.x), abs(vUv.y));
    o = vCol * smoothstep(1., .82, e);
  } else {
    float r2 = dot(vUv, vUv);
    float anneau = smoothstep(1., .9, sqrt(r2)) * smoothstep(.72, .86, sqrt(r2));
    o = vCol * anneau;
  }
  o.rgb *= uEchelle;
}`

const FS_SEUIL = `#version 300 es
precision highp float;
in vec2 vUv; out vec4 o;
uniform sampler2D uTex, uFond; uniform vec2 uTexel; uniform float uSeuil, uGenou;
void main(){
  vec4 a = vec4(0.);
  a += texture(uTex, vUv + uTexel * vec2(-1., -1.));
  a += texture(uTex, vUv + uTexel * vec2( 1., -1.));
  a += texture(uTex, vUv + uTexel * vec2(-1.,  1.));
  a += texture(uTex, vUv + uTexel * vec2( 1.,  1.));
  a *= .25;
  vec3 c = a.rgb + texture(uFond, vUv).rgb * (1. - clamp(a.a, 0., 1.));
  float l = max(c.r, max(c.g, c.b));
  float s = clamp(l - uSeuil + uGenou, 0., 2. * uGenou);
  s = s * s / (4. * uGenou + 1e-4);
  float f = max(s, l - uSeuil) / max(l, 1e-4);
  o = vec4(c * f, 1.);
}`

const FS_BAS = `#version 300 es
precision highp float;
in vec2 vUv; out vec4 o;
uniform sampler2D uTex; uniform vec2 uTexel;
void main(){
  vec2 t = uTexel;
  vec3 A = texture(uTex, vUv + t * vec2(-2., -2.)).rgb, B = texture(uTex, vUv + t * vec2(0., -2.)).rgb, C = texture(uTex, vUv + t * vec2(2., -2.)).rgb;
  vec3 D = texture(uTex, vUv + t * vec2(-1., -1.)).rgb, E = texture(uTex, vUv + t * vec2(1., -1.)).rgb;
  vec3 F = texture(uTex, vUv + t * vec2(-2., 0.)).rgb, G = texture(uTex, vUv).rgb, H = texture(uTex, vUv + t * vec2(2., 0.)).rgb;
  vec3 I = texture(uTex, vUv + t * vec2(-1., 1.)).rgb, J = texture(uTex, vUv + t * vec2(1., 1.)).rgb;
  vec3 K = texture(uTex, vUv + t * vec2(-2., 2.)).rgb, L = texture(uTex, vUv + t * vec2(0., 2.)).rgb, M = texture(uTex, vUv + t * vec2(2., 2.)).rgb;
  vec3 c = (D + E + I + J) * .125 + (A + B + G + F) * .03125 + (B + C + H + G) * .03125 + (F + G + L + K) * .03125 + (G + H + M + L) * .03125;
  o = vec4(c, 1.);
}`

const FS_HAUT = `#version 300 es
precision highp float;
in vec2 vUv; out vec4 o;
uniform sampler2D uTex; uniform vec2 uTexel; uniform float uPoids;
void main(){
  vec2 t = uTexel;
  vec3 c = texture(uTex, vUv).rgb * 4.;
  c += (texture(uTex, vUv + vec2(-t.x, 0.)).rgb + texture(uTex, vUv + vec2(t.x, 0.)).rgb + texture(uTex, vUv + vec2(0., -t.y)).rgb + texture(uTex, vUv + vec2(0., t.y)).rgb) * 2.;
  c += texture(uTex, vUv + vec2(-t.x, -t.y)).rgb + texture(uTex, vUv + vec2(t.x, -t.y)).rgb + texture(uTex, vUv + vec2(-t.x, t.y)).rgb + texture(uTex, vUv + vec2(t.x, t.y)).rgb;
  o = vec4(c / 16. * uPoids, 1.);
}`

const FS_FINAL = `#version 300 es
precision highp float;
in vec2 vUv; out vec4 o;
uniform sampler2D uScene, uBloom, uFond, uBruit;
uniform float uBloomI, uCA, uGlitch, uFlash, uGrain, uImage, uVignette, uCrtX, uCrtY, uFondu, uExpo, uSat, uOndeLum;
uniform vec4 uOnde;
uniform vec3 uFlashCoul;
float h12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
vec3 epaule(vec3 x){ vec3 k = vec3(.8); vec3 y = k + (1. - k) * (1. - exp(-(x - k) / (1. - k))); return mix(x, y, step(k, x)); }
void main(){
  vec2 asp = vec2(1., 1.7778);
  vec2 uv = vUv;
  vec2 c0 = uv - .5;
  c0.y /= max(uCrtY, 1e-4); c0.x /= max(uCrtX, 1e-4);
  uv = c0 + .5;
  float dedans = step(0., uv.x) * step(uv.x, 1.) * step(0., uv.y) * step(uv.y, 1.);
  vec2 dv = (uv - uOnde.xy) * asp; float r = length(dv);
  float anneau = exp(-pow((r - uOnde.z) / .055, 2.)) * uOnde.w;
  uv -= dv / max(r, 1e-4) / asp * anneau * .03;
  float g = 0.;
  if (uGlitch > 0.) {
    float bande = floor(uv.y * 54.);
    g = step(1. - uGlitch * .55, h12(vec2(bande, floor(uImage * .5)))) * uGlitch;
    uv.x += (h12(vec2(bande, uImage + 3.)) - .5) * .07 * g;
  }
  vec2 d = uv - .5; float rr = dot(d * asp, d * asp);
  vec2 dec = d * (uCA * (.5 + 1.8 * rr)) + vec2(g * .008, 0.);
  vec3 col;
  vec4 sr = texture(uScene, uv + dec), sg = texture(uScene, uv), sb = texture(uScene, uv - dec);
  vec3 fo = texture(uFond, uv).rgb;
  col.r = sr.r + fo.r * (1. - clamp(sr.a, 0., 1.));
  col.g = sg.g + fo.g * (1. - clamp(sg.a, 0., 1.));
  col.b = sb.b + fo.b * (1. - clamp(sb.a, 0., 1.));
  vec3 bl = texture(uBloom, uv).rgb;
  col += bl * uBloomI;
  col += anneau * .22 * uOndeLum * vec3(.75, .7, 1.);
  col = col * uExpo + uFlash * uFlashCoul;
  col = epaule(col);
  float l0 = dot(col, vec3(.299, .587, .114));
  col = mix(vec3(l0), col, uSat);
  float vig = 1. - uVignette * smoothstep(.3, 1.05, length(d * vec2(1., 1.2)) * 1.3);
  col *= vig;
  col = mix(vec3(.010, .012, .028), vec3(1.), col);
  col *= dedans * (1. - uFondu);
  vec2 px = vUv * vec2(1080., 1920.);
  // grain « argentique » : bruit interpolé à l'échelle de 2 px (doux comme un grain de film, et il survit à la
  // compression au lieu de devenir des blocs) ; ×1,35 compense la variance perdue par l'interpolation
  vec4 bz = texture(uBruit, (px * .5 + vec2(fract(uImage * .6180339), fract(uImage * .7548777)) * 256.) / 256.);
  float n = (bz.r + bz.g - 1.) * 1.35;
  float l = dot(col, vec3(.299, .587, .114));
  col += n * uGrain * (1. - .65 * l);
  col += (h12(px + fract(uImage * .0137) * 977.) - .5) / 255.; // tramage contre les bandes dans les dégradés
  o = vec4(clamp(col, 0., 1.), 1.);
}`

export class Moteur {
  constructor(canvas, L, H) {
    this.L = L
    this.H = H
    const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, depth: false, premultipliedAlpha: false, preserveDrawingBuffer: false })
    if (!gl) throw new Error('WebGL2 indisponible')
    if (!gl.getExtension('EXT_color_buffer_float')) throw new Error('EXT_color_buffer_float indisponible')
    gl.getExtension('OES_texture_float_linear')
    this.gl = gl
    this.F = 1650 // focale (px) : champ vertical ≈ 60°
    this.p = {
      fond: this.programme(VS_PLEIN, FS_FOND),
      copie: this.programme(VS_PLEIN, FS_COPIE),
      maille: this.programme(VS_MAILLE, FS_MAILLE),
      sprite: this.programme(VS_SPRITE, FS_SPRITE),
      seuil: this.programme(VS_PLEIN, FS_SEUIL),
      bas: this.programme(VS_PLEIN, FS_BAS),
      haut: this.programme(VS_PLEIN, FS_HAUT),
      final: this.programme(VS_PLEIN, FS_FINAL),
    }
    // Triangle plein écran
    this.vaoPlein = gl.createVertexArray()
    gl.bindVertexArray(this.vaoPlein)
    const b = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, b)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
    gl.enableVertexAttribArray(0)
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)
    gl.bindVertexArray(null)

    // Cibles de rendu
    this.cFond = this.cible(360, 640, false)
    this.cScene = this.cible(L, H, true, gl.RGBA8)
    this.ECHELLE = 0.5 // la scène est stockée en 8 bits : couleur ÷ 2 (plage HDR 0 → 2)
    this.texBruit = this.textureBruit(256)
    this.cAccu = this.cible(L, H, false)
    this.niveaux = []
    let w = L >> 2, h = H >> 2
    for (let i = 0; i < 5; i++) {
      this.niveaux.push(this.cible(Math.max(8, w), Math.max(8, h), false))
      w >>= 1
      h >>= 1
    }
    this.cSortie = this.cible(L, H, false, gl.RGBA8)
    this.pixels = new Uint8Array(L * H * 4)

    // Tampons dynamiques
    this.mailles = new Map()
    this.vaoSprites = this.tamponSprites()
    this.vaoDyn = this.tamponMaille(4096)
    this.textures = new Map()
  }

  programme(vs, fs) {
    const gl = this.gl
    const sh = (type, src) => {
      const s = gl.createShader(type)
      gl.shaderSource(s, src)
      gl.compileShader(s)
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) + '\n' + src)
      return s
    }
    const prog = gl.createProgram()
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, vs))
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, fs))
    gl.bindAttribLocation(prog, 0, 'aPos')
    gl.linkProgram(prog)
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog))
    const u = {}
    const n = gl.getProgramParameter(prog, gl.ACTIVE_UNIFORMS)
    for (let i = 0; i < n; i++) {
      const info = gl.getActiveUniform(prog, i)
      u[info.name] = gl.getUniformLocation(prog, info.name)
    }
    return { prog, u }
  }

  cible(w, h, profondeur, format) {
    const gl = this.gl
    const tex = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, tex)
    if (format === gl.RGBA8) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
    else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    const fbo = gl.createFramebuffer()
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo)
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0)
    if (profondeur) {
      const rb = gl.createRenderbuffer()
      gl.bindRenderbuffer(gl.RENDERBUFFER, rb)
      gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, w, h)
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, rb)
    }
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error('FBO incomplet')
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    return { tex, fbo, w, h }
  }

  textureBruit(n) {
    const gl = this.gl
    const d = new Uint8Array(n * n * 4)
    let a = 12345
    for (let i = 0; i < d.length; i++) {
      a = (a * 1664525 + 1013904223) >>> 0
      d[i] = a >>> 24
    }
    const tex = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, tex)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, n, n, 0, gl.RGBA, gl.UNSIGNED_BYTE, d)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT)
    return tex
  }

  /** Texture liée à un canvas 2D (mise à jour à la demande, avec mipmaps pour la réduction). */
  textureCanvas(nom, canvas, mip = true) {
    const gl = this.gl
    const tex = gl.createTexture()
    const t = { tex, canvas, mip, w: canvas.width, h: canvas.height }
    this.textures.set(nom, t)
    this.majTexture(nom)
    return t
  }
  majTexture(nom) {
    const gl = this.gl
    const t = this.textures.get(nom)
    gl.bindTexture(gl.TEXTURE_2D, t.tex)
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, t.canvas)
    if (t.mip) {
      gl.generateMipmap(gl.TEXTURE_2D)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR)
    } else gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  }

  /** Maillage statique (positions, UV, normales entrelacées). */
  maille(nom, donnees) {
    const gl = this.gl
    const vao = gl.createVertexArray()
    gl.bindVertexArray(vao)
    const b = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, b)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(donnees), gl.STATIC_DRAW)
    this.attributsMaille()
    gl.bindVertexArray(null)
    const bornes = [Infinity, -Infinity, Infinity, -Infinity, Infinity, -Infinity]
    for (let i = 0; i < donnees.length; i += 8)
      for (let k = 0; k < 3; k++) {
        bornes[k * 2] = Math.min(bornes[k * 2], donnees[i + k])
        bornes[k * 2 + 1] = Math.max(bornes[k * 2 + 1], donnees[i + k])
      }
    this.mailles.set(nom, { vao, n: donnees.length / 8, bornes })
  }
  attributsMaille() {
    const gl = this.gl
    const p = this.p.maille.prog
    const att = (nom, taille, dec) => {
      const loc = gl.getAttribLocation(p, nom)
      if (loc < 0) return
      gl.enableVertexAttribArray(loc)
      gl.vertexAttribPointer(loc, taille, gl.FLOAT, false, 32, dec * 4)
    }
    att('aPos', 3, 0)
    att('aUv', 2, 3)
    att('aNor', 3, 5)
  }
  tamponMaille(max) {
    const gl = this.gl
    const vao = gl.createVertexArray()
    gl.bindVertexArray(vao)
    const b = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, b)
    gl.bufferData(gl.ARRAY_BUFFER, max * 32, gl.DYNAMIC_DRAW)
    this.attributsMaille()
    gl.bindVertexArray(null)
    return { vao, b, max }
  }
  tamponSprites() {
    const gl = this.gl
    const vao = gl.createVertexArray()
    gl.bindVertexArray(vao)
    const b = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, b)
    const max = 6 * 6000
    gl.bufferData(gl.ARRAY_BUFFER, max * 40, gl.DYNAMIC_DRAW)
    const p = this.p.sprite.prog
    const att = (nom, taille, dec) => {
      const loc = gl.getAttribLocation(p, nom)
      gl.enableVertexAttribArray(loc)
      gl.vertexAttribPointer(loc, taille, gl.FLOAT, false, 40, dec * 4)
    }
    att('aPos', 3, 0)
    att('aUv', 2, 3)
    att('aCol', 4, 5)
    att('aMode', 1, 9)
    gl.bindVertexArray(null)
    return { vao, b, max, donnees: new Float32Array(max * 10) }
  }

  dessinerPlein(cible, prog, uniformes, textures = []) {
    const gl = this.gl
    gl.bindFramebuffer(gl.FRAMEBUFFER, cible ? cible.fbo : null)
    gl.viewport(0, 0, cible ? cible.w : this.L, cible ? cible.h : this.H)
    gl.useProgram(prog.prog)
    textures.forEach(([nom, tex], i) => {
      gl.activeTexture(gl.TEXTURE0 + i)
      gl.bindTexture(gl.TEXTURE_2D, tex)
      gl.uniform1i(prog.u[nom], i)
    })
    this.uniformes(prog, uniformes)
    gl.bindVertexArray(this.vaoPlein)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
    gl.bindVertexArray(null)
  }
  uniformes(prog, u) {
    const gl = this.gl
    for (const [k, v] of Object.entries(u)) {
      const loc = prog.u[k]
      if (loc == null) continue
      if (typeof v === 'number') gl.uniform1f(loc, v)
      else if (v.length === 2) gl.uniform2fv(loc, v)
      else if (v.length === 3) gl.uniform3fv(loc, v)
      else if (v.length === 4) gl.uniform4fv(loc, v)
      else if (v.length === 16) gl.uniformMatrix4fv(loc, false, v)
    }
  }

  // ———————————————— une image ————————————————
  debutImage(fond) {
    const gl = this.gl
    gl.disable(gl.BLEND)
    gl.disable(gl.DEPTH_TEST)
    this.dessinerPlein(this.cFond, this.p.fond, fond)
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.cAccu.fbo)
    gl.viewport(0, 0, this.L, this.H)
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)
  }
  /** Fond noir à la place du décor (contrôle de la zone sûre : seuls les textes restent). */
  fondNoir() {
    const gl = this.gl
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.cFond.fbo)
    gl.viewport(0, 0, this.cFond.w, this.cFond.h)
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.cAccu.fbo)
    gl.viewport(0, 0, this.L, this.H)
  }
  /** Envoie seulement une zone du canvas (x0, y0, x1, y1) vers sa texture. */
  majTextureZone(nom, [x0, y0, x1, y1]) {
    const gl = this.gl
    const t = this.textures.get(nom)
    gl.bindTexture(gl.TEXTURE_2D, t.tex)
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false)
    gl.pixelStorei(gl.UNPACK_SKIP_PIXELS, x0)
    gl.pixelStorei(gl.UNPACK_SKIP_ROWS, y0)
    gl.texSubImage2D(gl.TEXTURE_2D, 0, x0, y0, x1 - x0, y1 - y0, gl.RGBA, gl.UNSIGNED_BYTE, t.canvas)
    gl.pixelStorei(gl.UNPACK_SKIP_PIXELS, 0)
    gl.pixelStorei(gl.UNPACK_SKIP_ROWS, 0)
  }

  /** Projette un point de l'espace caméra (pixels, origine au centre) vers l'écran (origine en haut à gauche). */
  projeter(x, y, z) {
    const d = this.F + z
    if (d < 20) return null
    const k = this.F / d
    return [this.L / 2 + x * k, this.H / 2 + y * k, k]
  }
  /** Rectangle écran couvert par les éléments d'une sous-image (on ne compose que là). */
  boiteElements(elements) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
    let plein = false
    const ajouter = (p, rx = 0, ry = 0) => {
      if (!p) return (plein = true)
      x0 = Math.min(x0, p[0] - rx)
      x1 = Math.max(x1, p[0] + rx)
      y0 = Math.min(y0, p[1] - ry)
      y1 = Math.max(y1, p[1] + ry)
    }
    for (const el of elements) {
      if (el.type === 'sprites')
        for (const sp of el.liste) {
          if (sp.coins) for (const [x, y, z] of sp.coins) ajouter(this.projeter(x, y, z))
          else {
            const p = this.projeter(sp.p[0], sp.p[1], sp.p[2])
            ajouter(p, p ? sp.w * 0.5 * p[2] : 0, p ? sp.h * 0.5 * p[2] : 0)
          }
        }
      else if (el.type === 'triangles') {
        const d = el.donnees
        for (let i = 0; i < d.length; i += 8) ajouter(this.projeter(d[i], d[i + 1], d[i + 2]))
      } else if (el.type === 'maille') {
        const [a, b, c, e, f, g] = this.mailles.get(el.maille).bornes
        const m = el.mv
        for (const x of [a, b]) for (const y of [c, e]) for (const z of [f, g]) ajouter(this.projeter(m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]))
      }
    }
    if (plein) return [0, 0, this.L, this.H]
    if (x0 === Infinity) return null
    const r = [Math.max(0, Math.floor(x0) - 4), Math.max(0, Math.floor(y0) - 4), Math.min(this.L, Math.ceil(x1) + 4), Math.min(this.H, Math.ceil(y1) + 4)]
    return r[2] > r[0] && r[3] > r[1] ? r : null
  }

  /** Compose une sous-image (scène à un instant) et l'ajoute à l'accumulateur avec le poids donné. */
  sousImage(scene, poids, jitter) {
    const gl = this.gl
    const boite = this.boiteElements(scene.elements)
    if (!boite) return
    const [x0, y0, x1, y1] = boite
    const c = this.cScene
    gl.bindFramebuffer(gl.FRAMEBUFFER, c.fbo)
    gl.viewport(0, 0, c.w, c.h)
    gl.enable(gl.SCISSOR_TEST)
    gl.scissor(x0, this.H - y1, x1 - x0, y1 - y0)
    gl.clearColor(0, 0, 0, 0)
    gl.clearDepth(1)
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
    gl.disable(gl.DEPTH_TEST)
    gl.disable(gl.BLEND)
    for (const el of scene.elements) {
      if (el.type === 'sprites') this.dessinerSprites(el.liste, el.additif, jitter)
      else if (el.type === 'maille') this.dessinerMaille(el, jitter)
      else if (el.type === 'triangles') this.dessinerTriangles(el, jitter)
    }
    // Accumulation pondérée (flou de mouvement), limitée à la zone composée
    gl.disable(gl.DEPTH_TEST)
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.cAccu.fbo)
    gl.viewport(0, 0, this.L, this.H)
    gl.enable(gl.BLEND)
    gl.blendFunc(gl.ONE, gl.ONE)
    gl.useProgram(this.p.copie.prog)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, c.tex)
    gl.uniform1i(this.p.copie.u.uTex, 0)
    gl.uniform1f(this.p.copie.u.uPoids, poids / this.ECHELLE)
    gl.uniform1f(this.p.copie.u.uPoidsA, poids)
    gl.bindVertexArray(this.vaoPlein)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
    gl.disable(gl.BLEND)
    gl.disable(gl.SCISSOR_TEST)
  }

  preparerMaille(jitter) {
    const gl = this.gl
    gl.useProgram(this.p.maille.prog)
    this.uniformes(this.p.maille, { uRes: [this.L, this.H], uF: this.F, uJitter: jitter, uEchelle: this.ECHELLE })
  }
  dessinerMaille(el, jitter) {
    const gl = this.gl
    const m = this.mailles.get(el.maille)
    this.preparerMaille(jitter)
    if (el.profondeur) {
      gl.enable(gl.DEPTH_TEST)
      gl.depthFunc(gl.LEQUAL)
    } else gl.disable(gl.DEPTH_TEST)
    gl.enable(gl.BLEND)
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
    const tex = el.texture ? this.textures.get(el.texture).tex : null
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, tex)
    gl.uniform1i(this.p.maille.u.uTex, 0)
    this.uniformes(this.p.maille, { uMV: el.mv, uLum: el.lum ?? 1, uAlpha: el.alpha ?? 1, uReflet: el.reflet ?? -5, uRefletI: el.refletI ?? 0, uTeinte: el.teinte ?? [1, 1, 1] })
    gl.bindVertexArray(m.vao)
    for (const [mode, debut, nb] of el.parties) {
      gl.uniform1i(this.p.maille.u.uMode, mode)
      gl.drawArrays(gl.TRIANGLES, debut, nb)
    }
    gl.bindVertexArray(null)
    gl.disable(gl.DEPTH_TEST)
  }
  /** Triangles dynamiques texturés (éclats, calque de textes), déjà placés dans l'espace caméra ; alpha par sommet. */
  dessinerTriangles(el, jitter) {
    const gl = this.gl
    const t = this.vaoDyn
    this.preparerMaille(jitter)
    gl.disable(gl.DEPTH_TEST)
    gl.enable(gl.BLEND)
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
    gl.bindBuffer(gl.ARRAY_BUFFER, t.b)
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, el.donnees)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.textures.get(el.texture).tex)
    gl.uniform1i(this.p.maille.u.uTex, 0)
    this.uniformes(this.p.maille, { uMV: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], uLum: el.lum ?? 1, uAlpha: 1, uReflet: -5, uRefletI: 0, uTeinte: [1, 1, 1] })
    gl.uniform1i(this.p.maille.u.uMode, 3)
    gl.bindVertexArray(t.vao)
    gl.drawArrays(gl.TRIANGLES, 0, el.donnees.length / 8)
    gl.bindVertexArray(null)
  }
  /** Sprites : liste d'objets {p:[x,y,z] (caméra), coins:[[x,y,z]×4] optionnel, w, h, c:[r,g,b,a], mode}. */
  dessinerSprites(liste, additif, jitter, derriere = false) {
    if (!liste.length) return
    const gl = this.gl
    const s = this.vaoSprites
    const d = s.donnees
    let k = 0
    const coinsUv = [[-1, -1], [1, -1], [1, 1], [-1, -1], [1, 1], [-1, 1]]
    for (const sp of liste) {
      if (k / 10 >= s.max - 6) break
      const c = sp.c
      for (let i = 0; i < 6; i++) {
        const [u, v] = coinsUv[i]
        let x, y, z
        if (sp.coins) {
          const idx = [0, 1, 2, 0, 2, 3][i]
          ;[x, y, z] = sp.coins[idx]
        } else {
          x = sp.p[0] + u * sp.w * 0.5
          y = sp.p[1] + v * sp.h * 0.5
          z = sp.p[2]
        }
        d[k++] = x
        d[k++] = y
        d[k++] = z
        d[k++] = u
        d[k++] = v
        d[k++] = c[0] * c[3]
        d[k++] = c[1] * c[3]
        d[k++] = c[2] * c[3]
        d[k++] = additif ? 0 : c[3]
        d[k++] = sp.mode ?? 0
      }
    }
    gl.useProgram(this.p.sprite.prog)
    this.uniformes(this.p.sprite, { uRes: [this.L, this.H], uF: this.F, uJitter: jitter, uEchelle: derriere ? 1 : this.ECHELLE })
    gl.disable(gl.DEPTH_TEST)
    gl.enable(gl.BLEND)
    if (derriere) gl.blendFunc(gl.ONE_MINUS_DST_ALPHA, gl.ONE)
    else if (additif) gl.blendFunc(gl.ONE, gl.ONE)
    else gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
    gl.bindBuffer(gl.ARRAY_BUFFER, s.b)
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, d, 0, k)
    gl.bindVertexArray(s.vao)
    gl.drawArrays(gl.TRIANGLES, 0, k / 10)
    gl.bindVertexArray(null)
    gl.disable(gl.BLEND)
  }

  /**
   * Fin d'image : les éléments lents (bokeh, poussière) passent derrière l'accumulation, puis bloom et passe finale.
   * Le fond (calculé une fois) est composé sous l'accumulation dans la passe finale :
   * équivalent exact à le composer à chaque sous-image, car la composition est linéaire.
   */
  finImage(post, derriere = []) {
    const gl = this.gl
    gl.disable(gl.DEPTH_TEST)
    if (derriere.length) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.cAccu.fbo)
      gl.viewport(0, 0, this.L, this.H)
      this.dessinerSprites(derriere, true, [0, 0], true)
    }
    gl.disable(gl.BLEND)
    const n = this.niveaux
    this.dessinerPlein(n[0], this.p.seuil, { uTexel: [2 / this.L, 2 / this.H], uSeuil: post.seuil ?? 0.9, uGenou: 0.35 }, [['uTex', this.cAccu.tex], ['uFond', this.cFond.tex]])
    for (let i = 1; i < n.length; i++) this.dessinerPlein(n[i], this.p.bas, { uTexel: [1 / n[i - 1].w, 1 / n[i - 1].h] }, [['uTex', n[i - 1].tex]])
    gl.enable(gl.BLEND)
    gl.blendFunc(gl.ONE, gl.ONE)
    for (let i = n.length - 1; i > 0; i--) this.dessinerPlein(n[i - 1], this.p.haut, { uTexel: [1 / n[i].w, 1 / n[i].h], uPoids: 0.9 }, [['uTex', n[i].tex]])
    gl.disable(gl.BLEND)
    this.dessinerPlein(
      this.cSortie,
      this.p.final,
      {
        uBloomI: post.bloom,
        uCA: post.ca,
        uGlitch: post.glitch,
        uFlash: post.flash,
        uFlashCoul: post.flashCoul ?? [1, 0.97, 1],
        uGrain: post.grain,
        uImage: post.image,
        uVignette: post.vignette,
        uCrtX: post.crtX ?? 1,
        uCrtY: post.crtY ?? 1,
        uFondu: post.fondu ?? 0,
        uExpo: post.expo ?? 1,
        uSat: post.sat ?? 1,
        uOnde: post.onde ?? [0.5, 0.5, -1, 0],
        uOndeLum: post.ondeLum ?? 1,
      },
      [['uScene', this.cAccu.tex], ['uBloom', n[0].tex], ['uFond', this.cFond.tex], ['uBruit', this.texBruit]],
    )
  }

  lirePixels() {
    const gl = this.gl
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.cSortie.fbo)
    gl.readPixels(0, 0, this.L, this.H, gl.RGBA, gl.UNSIGNED_BYTE, this.pixels)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    return this.pixels
  }
  /** Copie la sortie sur le canvas visible (aperçu PNG). */
  afficher() {
    const gl = this.gl
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, this.cSortie.fbo)
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null)
    gl.blitFramebuffer(0, 0, this.L, this.H, 0, this.H, this.L, 0, gl.COLOR_BUFFER_BIT, gl.NEAREST)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
  }
}

/** Maillage d'un téléphone : face avant (texturée), tranche métallique et dos. Unités : pixels. */
export function maillageTelephone(w, h, r, ep, seg = 12) {
  const pts = []
  const coins = [
    [w / 2 - r, -h / 2 + r, -90, 0],
    [w / 2 - r, h / 2 - r, 0, 90],
    [-w / 2 + r, h / 2 - r, 90, 180],
    [-w / 2 + r, -h / 2 + r, 180, 270],
  ]
  for (const [cx, cy, a0, a1] of coins)
    for (let i = 0; i <= seg; i++) {
      const a = ((a0 + ((a1 - a0) * i) / seg) * Math.PI) / 180
      pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)])
    }
  const v = []
  const pousser = (x, y, z, u, vv, nx, ny, nz) => v.push(x, y, z, u, vv, nx, ny, nz)
  const n = pts.length
  // face avant (z = 0, tournée vers la caméra)
  for (let i = 0; i < n; i++) {
    const a = pts[i], b = pts[(i + 1) % n]
    pousser(0, 0, 0, 0.5, 0.5, 0, 0, -1)
    pousser(a[0], a[1], 0, a[0] / w + 0.5, a[1] / h + 0.5, 0, 0, -1)
    pousser(b[0], b[1], 0, b[0] / w + 0.5, b[1] / h + 0.5, 0, 0, -1)
  }
  const avant = n * 3
  // tranche
  for (let i = 0; i < n; i++) {
    const a = pts[i], b = pts[(i + 1) % n]
    const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2
    let nx = b[1] - a[1], ny = -(b[0] - a[0])
    const l = Math.hypot(nx, ny) || 1
    nx /= l
    ny /= l
    if (nx * mx + ny * my < 0) {
      nx = -nx
      ny = -ny
    }
    // léger arrondi de la tranche : deux bandes avec normales inclinées
    for (const [z0, z1, nz0, nz1] of [[0, ep / 2, -0.55, 0], [ep / 2, ep, 0, 0.55]]) {
      const k0 = Math.sqrt(1 - nz0 * nz0), k1 = Math.sqrt(1 - nz1 * nz1)
      pousser(a[0], a[1], z0, 0, 0, nx * k0, ny * k0, nz0)
      pousser(b[0], b[1], z0, 0, 0, nx * k0, ny * k0, nz0)
      pousser(b[0], b[1], z1, 0, 0, nx * k1, ny * k1, nz1)
      pousser(a[0], a[1], z0, 0, 0, nx * k0, ny * k0, nz0)
      pousser(b[0], b[1], z1, 0, 0, nx * k1, ny * k1, nz1)
      pousser(a[0], a[1], z1, 0, 0, nx * k1, ny * k1, nz1)
    }
  }
  const tranche = n * 12
  for (let i = 0; i < n; i++) {
    const a = pts[i], b = pts[(i + 1) % n]
    pousser(0, 0, ep, 0, 0, 0, 0, 1)
    pousser(b[0], b[1], ep, 0, 0, 0, 0, 1)
    pousser(a[0], a[1], ep, 0, 0, 0, 0, 1)
  }
  const dos = n * 3
  return { donnees: v, parties: [[2, avant + tranche, dos], [1, avant, tranche], [0, 0, avant]] }
}

/** Rectangle texturé centré (w × h), face caméra. */
export function maillageRect(w, h) {
  const x = w / 2, y = h / 2
  return [
    -x, -y, 0, 0, 0, 0, 0, -1,
    x, -y, 0, 1, 0, 0, 0, -1,
    x, y, 0, 1, 1, 0, 0, -1,
    -x, -y, 0, 0, 0, 0, 0, -1,
    x, y, 0, 1, 1, 0, 0, -1,
    -x, y, 0, 0, 1, 0, 0, -1,
  ]
}
