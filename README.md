# Studio Photo Immobilier IA

Application web pour retoucher et améliorer par IA jusqu'à 10 photos immobilières
à la fois — import par lot, analyse automatique, traitement en parallèle,
harmonisation du lot, avant/après, export ZIP haute qualité.

## Démarrer en local

```bash
npm install
npm run dev
```

Ouvrez [http://localhost:3000](http://localhost:3000).

Les projets, photos et versions non destructives sont stockés sur disque sous
`storage/` (ignoré par git).

## Architecture

- **`src/lib/engine/`** — moteur de traitement d'image, réel (pas de mock) :
  pipeline de tons par pixel (exposition, balance des blancs gray-world,
  récupération ombres/hautes lumières, contraste, saturation, ciel, fenêtres),
  redressement vertical et correction grand-angle (détection de bord Sobel +
  remap bilinéaire), netteté/débruitage (sharp/libvips), score qualité,
  naturalité, pHash pour les doublons.
- **`src/lib/ai/`** — interface `AIProvider` pour les opérations génératives
  (suppression/ajout d'objet, remplacement de ciel, virtual staging,
  désencombrement). Implémentation OpenAI (`images/edits`) active dès que
  `OPENAI_API_KEY` est défini ; sinon un fournisseur honnête renvoie un
  message « non configuré » plutôt que de simuler un résultat.
- **`src/lib/jobQueue.ts`** — file de traitement par lot en mémoire, avec
  parallélisme borné, pour que l'échec d'une photo ne bloque jamais le reste
  du lot.
- **`src/app/api/`** — routes Next.js (projets, photos, analyse, retouche,
  export ZIP).
- **`src/components/`** — interface (import, galerie, retouche pro,
  avant/après, historique non destructif, export).

## Variables d'environnement optionnelles

- `OPENAI_API_KEY` — active les modifications IA génératives.
- `OPENAI_IMAGE_MODEL`, `OPENAI_VISION_MODEL` — remplacent les modèles par défaut.
- `BATCH_CONCURRENCY` — nombre de photos traitées en parallèle (défaut 3).
