"""Analyse du son : loudness intégrée (BS.1770-4), crête vraie (suréchantillonnage ×4), loudness par section,
spectrogramme annoté avec les temps de la timeline (image PNG pour vérification visuelle)."""
import sys, json, numpy as np
from scipy.io import wavfile
from scipy.signal import lfilter, resample_poly, stft
from PIL import Image, ImageDraw, ImageFont

def lire(f):
    sr, x = wavfile.read(f)
    if x.dtype == np.int16: x = x / 32768.0
    elif x.dtype == np.int32: x = x / 2147483648.0
    return sr, x.astype(np.float64)

def ponderation_k(x, sr):
    # filtres BS.1770-4 (coefficients analytiques pour toute fréquence d'échantillonnage)
    import math
    f0, G, Q = 1681.974450955533, 3.999843853973347, 0.7071752369554196
    K = math.tan(math.pi * f0 / sr); Vh = 10 ** (G / 20); Vb = Vh ** 0.4996667741545416
    a0 = 1 + K / Q + K * K
    b1 = [(Vh + Vb * K / Q + K * K) / a0, 2 * (K * K - Vh) / a0, (Vh - Vb * K / Q + K * K) / a0]
    a1 = [1, 2 * (K * K - 1) / a0, (1 - K / Q + K * K) / a0]
    f0, Q = 38.13547087602444, 0.5003270373238773
    K = math.tan(math.pi * f0 / sr)
    b2 = [1, -2, 1]; a2 = [1, 2 * (K * K - 1) / (1 + K / Q + K * K), (1 - K / Q + K * K) / (1 + K / Q + K * K)]
    return lfilter(b2, a2, lfilter(b1, a1, x, axis=0), axis=0)

def loudness_integree(x, sr):
    y = ponderation_k(x, sr)
    bloc, pas = int(0.4 * sr), int(0.1 * sr)
    z = []
    for i in range(0, len(y) - bloc + 1, pas):
        z.append(np.mean(y[i:i + bloc] ** 2, axis=0).sum())
    z = np.array(z)
    l = -0.691 + 10 * np.log10(z + 1e-12)
    g1 = z[l > -70]
    lg = -0.691 + 10 * np.log10(g1.mean())
    g2 = z[(l > -70) & (l > lg - 10)]
    return -0.691 + 10 * np.log10(g2.mean())

def court_terme(x, sr, fenetre=3.0, pas=0.1):
    y = ponderation_k(x, sr)
    b, p = int(fenetre * sr), int(pas * sr)
    t, v = [], []
    for i in range(0, len(y) - b + 1, p):
        t.append((i + b / 2) / sr)
        v.append(-0.691 + 10 * np.log10(np.mean(y[i:i + b] ** 2, axis=0).sum() + 1e-12))
    return np.array(t), np.array(v)

def crete_vraie(x):
    up = resample_poly(x, 4, 1, axis=0)
    return 20 * np.log10(np.abs(up).max() + 1e-12)

if __name__ == '__main__':
    f, tl, png = sys.argv[1], sys.argv[2], sys.argv[3]
    sr, x = lire(f)
    tlj = json.load(open(tl))
    beat = 60 / tlj['BPM']
    I = loudness_integree(x, sr)
    print(f'durée {len(x)/sr:.3f} s · {sr} Hz · loudness intégrée {I:.2f} LUFS · crête vraie {crete_vraie(x):.2f} dBTP · crête échantillon {20*np.log10(np.abs(x).max()):.2f} dBFS')
    sections = [('accroche', 0, 6), ('coupure', 6, 8), ('démo', 8, 40), ('manifeste', 40, 52), ('fin', 52, 64)]
    for nom, a, b in sections:
        seg = x[int(a * beat * sr):int(b * beat * sr)]
        y = ponderation_k(seg, sr)
        print(f'  {nom:10s} {a*beat:5.2f}–{b*beat:5.2f} s : moyenne {-0.691 + 10*np.log10(np.mean(y**2, axis=0).sum()+1e-12):6.1f} LUFS, crête {20*np.log10(np.abs(seg).max()+1e-12):6.1f} dBFS')
    # spectrogramme annoté
    m = x.mean(axis=1)
    fr, tt, Z = stft(m, sr, nperseg=2048, noverlap=2048 - 480)
    S = 20 * np.log10(np.abs(Z) + 1e-9)
    fmax = 12000
    S = S[fr <= fmax]
    S = np.clip((S + 100) / 80, 0, 1)
    H, W = 420, 1800
    img = (np.flipud(S) * 255).astype(np.uint8)
    im = Image.fromarray(img).resize((W, H))
    im = Image.merge('RGB', [im.point(lambda v: int(v * 0.6)), im.point(lambda v: int(v * 0.45)), im])
    # courbe de loudness court terme
    t, v = court_terme(x, sr, 0.4, 0.05)
    hauteur = H + 160
    tout = Image.new('RGB', (W, hauteur + 40), (12, 12, 20))
    tout.paste(im, (0, 0))
    d = ImageDraw.Draw(tout)
    pts = [(int(ti / 30 * W), H + 150 - int(np.clip((vi + 40) / 40, 0, 1) * 140)) for ti, vi in zip(t, v)]
    d.line(pts, fill=(255, 200, 80), width=2)
    for db in (-30, -20, -14, -10):
        y = H + 150 - int((db + 40) / 40 * 140)
        d.line([(0, y), (W, y)], fill=(70, 70, 90))
        d.text((4, y - 12), f'{db} LUFS', fill=(150, 150, 170))
    for c in tlj['CUES']:
        if c['son'] in ('impact',):
            xx = int(c['t'] / 30 * W)
            d.line([(xx, 0), (xx, hauteur)], fill=(255, 80, 80), width=1)
    for s in range(0, 31):
        d.text((int(s / 30 * W) + 2, hauteur + 4), f'{s}s', fill=(200, 200, 220))
    tout.save(png)
