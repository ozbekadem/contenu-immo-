# Linkimmo

Application de prospection, de relances et de fidélisation d'IMMO VISION (Charleroi).
PWA installable, pensée d'abord pour le smartphone, fonctionnant hors ligne.

> Projet en cours de construction, étape par étape — voir `docs/PROPOSITION.md`.
> Le README complet (Supabase, Google, déploiement, installation smartphone) sera livré à l'étape 14.

## Démarrer en local

Prérequis : [Node.js](https://nodejs.org) 20 ou plus récent.

```bash
npm install
npm run dev        # application sur http://localhost:5173
npm test           # tests automatiques
npm run build      # version de production dans dist/
npm run preview    # tester la version de production (installable, hors ligne)
```

## Organisation du code

| Dossier | Rôle |
|---|---|
| `src/domain/` | Règles métier pures et testées (couleurs de relance, téléphone +32…) |
| `src/features/` | Un dossier par module (Aujourd'hui, Prospection, Contacts…) |
| `src/components/ui/` | Composants visuels réutilisables |
| `src/app/` | Démarrage, navigation, thème clair/sombre |
| `public/` | Icônes de l'application |
