"""Auto-vérification du fichier final :
  1. loudness EBU R128 (ffmpeg ebur128 + mesure indépendante BS.1770-4) et crête vraie ;
  2. synchro : décalage global son (après encodage AAC), attaques sonores vs timeline,
     événements visuels (flashs, coupure) vs attaques sonores ;
  3. zone sûre TikTok : boîte englobante des textes à chaque image ;
  4. planches contact (toutes les 0,5 s, avec masque de la zone sûre) et planches « ralenti ».
Usage : python3 verifier.py <dossier de sortie>
"""
import json, os, subprocess, sys
import numpy as np
from scipy.io import wavfile
sys.path.insert(0, os.path.dirname(__file__))
from analyse_son import loudness_integree, crete_vraie, lire
from planche import planche

D = sys.argv[1]
FINAL = os.path.join(D, 'prospectimmo-30s.mp4')
REF = os.path.join(D, 'son-14lufs.wav')
TL = json.load(open(os.path.join(D, 'timeline.json')))
BEAT = 60 / TL['BPM']
FPS = 60
rapport = []
def dire(s=''):
    print(s)
    rapport.append(s)

def ffmpeg(args, binaire=False):
    r = subprocess.run(['ffmpeg', '-hide_banner', '-nostdin', *args], capture_output=True)
    return r.stdout if binaire else r.stderr.decode('utf8', 'replace')

# ———————————————— 0. le fichier ————————————————
info = ffmpeg(['-i', FINAL])
dire('# Vérification de prospectimmo-30s.mp4')
for l in info.splitlines():
    if 'Stream #' in l or 'Duration' in l:
        dire('  ' + l.strip())
dire(f'  taille : {os.path.getsize(FINAL) / 1e6:.1f} Mo')

# ———————————————— 1. loudness ————————————————
dire('\n## 1. Loudness (cible -14 LUFS, crête vraie ≤ -1 dBTP)')
e = ffmpeg(['-i', FINAL, '-vn', '-af', 'ebur128=peak=true:framelog=quiet', '-f', 'null', '-'])
resume = e[e.rfind('Summary:'):]
def valeur(cle):
    import re
    m = re.search(r'^\s*' + cle + r':\s+(-?[\d.]+|-inf)', resume, re.M)
    return float(m.group(1))
I_ff, LRA_ff, TP_ff = valeur('I'), valeur('LRA'), valeur('Peak')
audio = np.frombuffer(ffmpeg(['-i', FINAL, '-vn', '-ac', '2', '-ar', '48000', '-f', 'f32le', '-'], binaire=True), dtype=np.float32).reshape(-1, 2).astype(np.float64)
I_moi = loudness_integree(audio, 48000)
TP_moi = crete_vraie(audio)
dire(f'  ffmpeg ebur128 : intégrée {I_ff:.1f} LUFS · LRA {LRA_ff:.1f} LU · crête vraie {TP_ff:.1f} dBTP')
dire(f'  mesure indépendante (BS.1770-4, numpy) : {I_moi:.2f} LUFS · crête vraie {TP_moi:.2f} dBTP')
dire(f'  durée audio décodée : {len(audio) / 48000:.3f} s')
ok_loud = abs(I_ff + 14) <= 0.5 and TP_ff <= -1.0 + 0.05
dire('  → ' + ('CONFORME' if ok_loud else 'NON CONFORME'))

# ———————————————— 2. synchro ————————————————
dire('\n## 2. Synchronisation (une seule timeline pour l’image et le son)')
sr, ref = lire(REF)
n = min(len(ref), len(audio), 48000 * 6)
a, b = ref[:n].mean(axis=1), audio[:n].mean(axis=1)
corr = np.fft.irfft(np.fft.rfft(b, 2 * n) * np.conj(np.fft.rfft(a, 2 * n)))
lag = int(np.argmax(np.concatenate([corr[-2000:], corr[:2000]]))) - 2000
dire(f'  décalage global du son dans le MP4 (corrélation avec le son normalisé) : {lag} échantillons = {lag / 48:.2f} ms')

# attaques sonores (son du MP4, tel qu'entendu) : instant où l'énergie des 2 ms suivantes dépasse le plus
# celle des 10 ms précédentes — précis à ~0,5 ms, même quand l'impact suit une montée bruyante.
import math
x = audio.mean(axis=1)
cs = np.concatenate([[0.0], np.cumsum(x ** 2)])
NA, NB = int(0.002 * 48000), int(0.010 * 48000)
def attaque(t, avant=0.012, apres=0.03):
    i0, i1 = max(0, int((t - avant) * 48000)), min(len(x) - NA, int((t + apres) * 48000))
    idx = np.arange(i0, i1)
    e_apres = (cs[idx + NA] - cs[idx]) / NA
    lo = np.maximum(idx - NB, 0)
    e_avant = (cs[idx] - cs[lo]) / np.maximum(idx - lo, 1)
    r = 10 * np.log10((e_apres + 1e-10) / (e_avant + 1e-10))
    k = int(np.argmax(r))
    return idx[k] / 48000, r[k]

types_suivis = {'impact', 'declencheur', 'tap', 'clic', 'tampon', 'pop', 'ligne', 'mot', 'cran', 'tic', 'goutte', 'epingle'}
ecarts, incertains = [], 0
for c in TL['CUES']:
    if c['son'] in types_suivis:
        ta, nette = attaque(c['t'])
        if nette >= 6:
            ecarts.append((c['son'], c['t'], (ta - c['t']) * 1000))
        else:
            incertains += 1
ec = np.array([e[2] for e in ecarts])
dire(f'  attaques sonores vs timeline ({len(ec)} événements nets, {incertains} masqués par la musique) : '
     f'écart médian {np.median(ec):+.1f} ms, moyen {ec.mean():+.1f} ms, max |écart| {np.abs(ec).max():.1f} ms')
pires = sorted(ecarts, key=lambda e: -abs(e[2]))[:3]
dire('    plus grands écarts : ' + ', '.join(f"{s} à {t:.3f} s ({d:+.1f} ms)" for s, t, d in pires))

# événements visuels : luminance et différence d'image, image par image
brut = ffmpeg(['-i', FINAL, '-an', '-vf', 'scale=54:96,format=gray', '-f', 'rawvideo', '-'], binaire=True)
imgs = np.frombuffer(brut, dtype=np.uint8).reshape(-1, 96 * 54).astype(np.float64)
lum = imgs.mean(axis=1)
dlum = np.diff(lum, prepend=lum[0])
dimg = np.concatenate([[0.0], np.abs(np.diff(imgs, axis=0)).mean(axis=1)])
dire(f'  images décodées : {len(lum)} ({len(lum) / FPS:.3f} s à {FPS} i/s)')
OBT = 0.5 / FPS  # obturateur à 180°, centré sur l'instant de l'image
def image_attendue(t):
    """Première image dont l'obturateur se ferme après l'instant t : celle qui doit montrer l'événement."""
    return max(0, math.ceil((t - OBT / 2) * FPS - 1e-9))
def premiere_image(serie, fa, seuil=0.3):
    if fa == 0:
        return 0 if lum[0] > lum[8:20].mean() + 3 else None
    fen = range(max(1, fa - 3), min(len(serie), fa + 4))
    dmax = max(serie[f] for f in fen)
    return next((f for f in fen if serie[f] > seuil * dmax), None) if dmax > 1.5 else None

dire('  flashs : première image éclairée vs image attendue (obturateur 180°), attaque du son :')
ecarts_images = []
for eff in TL['EFFETS']:
    if eff.get('flash', 0) >= 0.35:
        t = eff['t']
        fa = image_attendue(t)
        fd = premiere_image(dlum, fa)
        ta, _ = attaque(t)
        ecarts_images.append(None if fd is None else fd - fa)
        etat = 'non détectée' if fd is None else f'image {fd} ({fd - fa:+d})'
        dire(f'    temps {eff["b"]:5.2f} ({t:6.3f} s) : attendue {fa:4d}, observée {etat} · son à {1000 * (ta - t):+.1f} ms')
fa = image_attendue(6 * BEAT)
fd = premiere_image(dimg, fa)
dire(f'  coupure (temps 6, {6 * BEAT:.3f} s) : changement d\'image attendu à l\'image {fa}, observé à l\'image {fd}')
ok_images = all(e == 0 for e in ecarts_images)
dire(f'  → ' + ('chaque flash apparaît exactement sur l\'image attendue (0 image d\'écart)' if ok_images else f'écarts en images : {ecarts_images}')
     + ' ; 1 image = 16,7 ms (seuil de perception ≈ 45 ms en avance / 125 ms en retard, ITU-R BT.1359)')
# silence avant le drop
i0, i1 = int(TL['M']['silence'][0] * BEAT * 48000) + 200, int(TL['M']['silence'][1] * BEAT * 48000) - 10
dire(f'  silence avant le drop : {20 * np.log10(np.abs(ref[i0:i1]).max() + 1e-12):.0f} dBFS dans le master, '
     f'{20 * np.log10(np.abs(audio[i0:i1]).max() + 1e-12):.0f} dBFS après AAC ; drop à {1000 * (attaque(8 * BEAT)[0] - 8 * BEAT):+.1f} ms')

# ———————————————— 3. zone sûre ————————————————
dire('\n## 3. Zone sûre TikTok (textes : x 80–940, y 250–1460)')
zones = json.load(open(os.path.join(D, 'zones-textes.json')))
Z = TL['ZONE_SURE']
hors, hors_transitoires = [], []
slams = [0, 1, 4, 36, 48, 49]
for f, bb in zones:
    if not bb:
        continue
    x0, y0, x1, y1 = bb
    dehors = x0 < Z['x0'] or x1 > Z['x1'] or y0 < Z['y0'] or y1 > Z['y1']
    if dehors:
        t = f / FPS
        transitoire = any(-0.03 <= t - s * BEAT < 0.2 for s in slams)
        (hors_transitoires if transitoire else hors).append((f, bb))
dire(f'  images contrôlées : {len(zones)} sur {len(lum)}')
dire(f'  textes hors zone au repos : {len(hors)}' + (' → ' + ', '.join(f'image {f} {bb}' for f, bb in hors[:6]) if hors else ' → CONFORME'))
dire(f'  dépassements pendant les entrées « claquées » (< 0,2 s, texte en mouvement flou) : {len(hors_transitoires)} images')

# ———————————————— 4. planches contact ————————————————
dire('\n## 4. Planches contact')
dossier = os.path.join(D, 'planche-final')
os.makedirs(dossier, exist_ok=True)
for f in os.listdir(dossier):
    os.remove(os.path.join(dossier, f))
# images 15, 45, 75… (milieu de chaque demi-seconde), extraites sous un nom provisoire puis renommées
# d'après leur vrai numéro (sans collision possible avec les noms provisoires)
ffmpeg(['-i', FINAL, '-vf', 'select=not(mod(n-15\\,30))', '-fps_mode', 'passthrough', os.path.join(dossier, 'x-%04d.png')])
for i, f in enumerate(sorted(os.listdir(dossier))):
    os.rename(os.path.join(dossier, f), os.path.join(dossier, f'image-{i * 30 + 15:04d}.png'))
fichiers = sorted(os.path.join(dossier, f) for f in os.listdir(dossier))
planche(fichiers[:30], os.path.join(D, 'planche-final-1.png'), colonnes=6, largeur=240, zone=True)
planche(fichiers[30:], os.path.join(D, 'planche-final-2.png'), colonnes=6, largeur=240, zone=True)
for nom, debut in [('drop', 222), ('fouet', 446), ('tampon', 1078), ('abonner', 1684)]:
    sous = os.path.join(D, f'ralenti-{nom}')
    os.makedirs(sous, exist_ok=True)
    for f in os.listdir(sous):
        os.remove(os.path.join(sous, f))
    ffmpeg(['-i', FINAL, '-vf', f'select=between(n\\,{debut}\\,{debut + 11})', '-fps_mode', 'passthrough', os.path.join(sous, 'r-%02d.png')])
    fs = sorted(os.listdir(sous))
    for i, f in enumerate(fs):
        os.rename(os.path.join(sous, f), os.path.join(sous, f'image-{debut + i:04d}.png'))
    planche(sorted(os.path.join(sous, f) for f in os.listdir(sous)), os.path.join(D, f'ralenti-{nom}.png'), colonnes=6, largeur=240)
dire('  planche-final-1.png, planche-final-2.png (toutes les 0,5 s, zones TikTok en rouge), ralenti-*.png (12 images consécutives)')
open(os.path.join(D, 'rapport-verification.txt'), 'w').write('\n'.join(rapport) + '\n')
