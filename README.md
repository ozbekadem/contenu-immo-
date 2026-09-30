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

## Serveur (Supabase) et mise en ligne

Sans configuration, l'application fonctionne en **mode local** (un seul appareil).
Pour activer la connexion et la synchronisation : suivre `docs/GUIDE_INSTALLATION.md`,
puis renseigner `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` (voir `.env.example`).

```bash
bash supabase/tests/lancer.sh   # tests SQL du serveur (PostgreSQL local requis)
```

## Organisation du code

| Dossier | Rôle |
|---|---|
| `src/domain/` | Règles métier pures et testées (couleurs de relance, téléphone +32…) |
| `src/features/` | Un dossier par module (Aujourd'hui, Prospection, Contacts…) |
| `src/components/ui/` | Composants visuels réutilisables |
| `src/app/` | Démarrage, navigation, thème, connexion |
| `src/data/` | Base locale (Dexie), repositories, synchronisation (`sync/`) |
| `supabase/` | Schéma du serveur, sécurité, fusion champ par champ, tests SQL |
| `public/` | Icônes de l'application |
