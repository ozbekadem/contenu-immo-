# Vidéo Prospect’Immo — 30 s, 1080 × 1920, 60 i/s

Vidéo de motion design entièrement générée par le code : aucune image, aucun son, aucun modèle externe.
Une page HTML est animée image par image (Canvas 2D + WebGL 2), rendue par Chromium sans écran
(Playwright), puis encodée par ffmpeg. La musique et les bruitages sont synthétisés en Web Audio.

## Principe

- **Une seule timeline** (`src/timeline.js`) : 128 BPM, 16 mesures = 30 s pile. Chaque événement
  (impact, déclencheur photo, tap, tampon, mot du manifeste…) est un temps musical. L'image
  (`src/scene.js`, `src/ui.js`) et le son (`src/audio.js`) lisent ces mêmes temps : la synchro est
  exacte par construction.
- **Image** : interface de l'application dessinée en Canvas 2D (police Plus Jakarta Sans, couleurs et
  icônes Lucide de l'application), composée en 3D par WebGL (téléphone avec tranche métallique,
  éclats de verre, particules, confettis), puis post-production : flou de mouvement par
  accumulation de sous-images (obturateur 180°, anticrénelage par décalage sous-pixel), bloom HDR,
  aberration chromatique, onde de choc, glitch, vignettage et grain argentique (2 px).
  Les flashs sont eux aussi intégrés sur l'obturateur : un événement apparaît dès l'image qui le « voit ».
- **Son** : `OfflineAudioContext` 48 kHz stéréo — kick, clap, charleys, basse « pompée » par
  sidechain, nappes, arpège, piano FM, cloches, risers, impacts, déclencheur photo, taps,
  sonnerie, tampon, éclats de verre, arrêt de bande… Égalisation pensée pour les haut-parleurs de
  téléphone (sous-graves retenus, médium et présence en avant).
- **Mastering sans latence** (`src/mastering.js`, JavaScript pur) : le tampon entier étant connu, le
  limiteur lit l'avenir au lieu de retarder le signal — les attaques restent exactement sur la
  timeline (les compresseurs Web Audio de Chrome, eux, décalent le son de 6 ms chacun). Silence
  numérique avant le drop, compresseur de bus 2:1, limiteur à crête vraie (×8), gain ajusté jusqu'à
  **-14 LUFS** intégrés (BS.1770-4), fondu final.
- **AAC contrôlé** : le codec fait remonter certaines crêtes ; `rendu.mjs final` encode, décode et
  mesure le fichier AAC lui-même (loudness et crête vraie), corrige (gain global, creux locaux de
  quelques dixièmes de dB) et recommence jusqu'à -14 LUFS et ≤ -1,2 dBTP.
- **Zone sûre TikTok** : tous les textes tiennent dans x 80–940, y 250–1460 (rien sous les boutons
  de droite ni sous la légende), y compris pendant les entrées « claquées » et après la caméra
  et la post-production (glitch, aberration, onde de choc).

## Structure (temps musicaux)

| Temps | Séquence | À l'écran |
|---|---|---|
| 0–6 | Accroche choc | « Relance oubliée ? » puis « Mandat perdu. » — la notification vole en éclats |
| 6–8 | Coupure | extinction façon téléviseur, « Plus jamais. », silence avant le drop |
| 8–40 | Démonstration au beat | Repérer la rue (5 photos hors ligne) · Un appui suffit (appel, résultat, relance +3 mois) · Zéro relance oubliée (Aujourd'hui, notification, agenda) · Prix du quartier → **Mandat signé** |
| 40–52 | Manifeste | « Chaque maison compte. » « Chaque appel aussi. » « Zéro oubli. » |
| 52–64 | Logo + s'abonner | icône qui se construit, « Prospect’Immo », « Prospectez. Relancez. Signez. », bouton S’abonner → Abonné |

## Rendu

Prérequis : Node 20+, ffmpeg (avec libx264), Chromium (Playwright), Python 3 + numpy, scipy, pillow (vérifications).

```bash
cd video
npm install
SORTIE=/chemin/sortie node rendu.mjs son          # musique + bruitages, masterisés à -14 LUFS (WAV)
SORTIE=/chemin/sortie node rendu.mjs video 3      # 1800 images, 3 navigateurs en parallèle
SORTIE=/chemin/sortie node rendu.mjs final        # AAC contrôlé + assemblage → prospectimmo-30s.mp4
SORTIE=/chemin/sortie node rendu.mjs zones        # textes : calque + image finale (contrôle zone sûre)
python3 outils/verifier.py /chemin/sortie         # loudness, synchro, zone sûre, planches contact
node rendu.mjs apercu 0 225 600                   # quelques images PNG de contrôle
```

`verifier.py` écrit `rapport-verification.txt` : loudness (ffmpeg ebur128 + seconde mesure
BS.1770-4 indépendante), décalage du son dans le MP4, attaques sonores vs timeline, première image
de chaque flash vs image attendue, coupure, silence avant le drop, zone sûre image par image, et
les planches contact (toutes les 0,5 s, zones TikTok en rouge, plus des « ralentis » de 12 images).

Sans carte graphique, WebGL tourne sur SwiftShader (logiciel) : compter 15 à 30 minutes pour les 1 800 images.
