# Prospect’Immo

Application de **prospection, de relances et de fidélisation** pour une petite agence immobilière
(région de Charleroi, 4 utilisateurs). Elle s'installe comme une vraie application sur le
smartphone (PWA), fonctionne **sans réseau** et se synchronise toute seule entre les téléphones
et l'ordinateur du bureau.

- Pensée d'abord pour le téléphone, utilisable à une main, sur le terrain.
- Tout est enregistré **d'abord sur l'appareil** (ouverture instantanée, mode avion), puis
  envoyé au serveur dès que la connexion revient.
- Sans serveur configuré, elle fonctionne en **mode local** sur un seul appareil : pratique pour l'essayer.

---

## Sommaire

1. [Ce que fait l'application](#1-ce-que-fait-lapplication)
2. [Mise en service, pas à pas](#2-mise-en-service-pas-à-pas)
3. [Réglages (fichier `.env`)](#3-réglages-fichier-env)
4. [Sécurité et vie privée](#4-sécurité-et-vie-privée)
5. [Critères d'acceptation et performances](#5-critères-dacceptation-et-performances)
6. [Entretien courant](#6-entretien-courant)
7. [Pour le développeur](#7-pour-le-développeur)
8. [Questions fréquentes](#8-questions-fréquentes)

---

## 1. Ce que fait l'application

| Écran | En bref |
|---|---|
| **Aujourd'hui** | Les personnes à appeler (rouge → orange → jaune → vert), les fiches sans prochaine action, l'entonnoir de la semaine, les prospects « à maturité » (fin de bail, projet de vente…), les anniversaires, les rendez-vous du jour, les estimations reçues par la secrétaire, et le vendredi la **revue de la semaine**. |
| **Session d'appels** | Plein écran : un appel après l'autre, avec l'argumentaire adapté et le résultat noté en un appui. |
| **Prospection** | Trois catégories de pistes : annonces/affiches, maisons vides, portefeuille. Suivi des annonces (toujours en ligne ? prix changé ?). |
| **Repérer** (bouton violet) | Dans la rue : photos (plusieurs d'un coup), position GPS, adresse retrouvée automatiquement, alerte si le numéro ou le bien est déjà connu. **Fonctionne hors ligne**. |
| **Contacts** | Liste rapide même avec 5 000 fiches, recherche instantanée, fiche complète (coordonnées, historique, biens, documents et liens, consentements RGPD). Aucun champ obligatoire. |
| **Actions en un appui** | Appeler, SMS, WhatsApp, email. Au retour dans l'application : « Comment ça s'est passé ? » et la prochaine relance (+1 semaine, +1 mois, +3 mois…). |
| **Biens** | Liste et **carte** colorée, fiche du bien avec photos, propriétaires, pistes, documents et **prix du marché**. |
| **Agenda** | Rendez-vous et relances jour par jour, synchronisés avec **Google Agenda** (agenda « Prospect’Immo »). Les rendez-vous « Estimation… » notés par la secrétaire dans Google Agenda arrivent dans Prospect’Immo pour être encodés. |
| **Marché local** | Prix médians **Statbel** (ventes réelles) par commune et type de bien, sur plusieurs années, avec correction de l'inflation. Affichés aussi sur chaque bien et chaque piste. |
| **Communication** | Modèles de messages, campagnes SMS / WhatsApp / email avec **blocage RGPD** (uniquement les contacts qui ont donné leur accord), lien de désinscription, suivi envoi par envoi. |
| **Équipe** | Statistiques (appels, personnes jointes, RDV, mandats), attribution des fiches à un collaborateur, rôles, appareils connectés. |
| **Doublons** | Fiches probablement identiques, fusion guidée (rien n'est perdu, rien n'est effacé). |
| **Import / export** | Import CSV / Excel (colonnes reconnues automatiquement, annulable), export Excel / CSV, **sauvegarde complète** et restauration. |
| **Notifications** | Rappel à l'heure de la relance, avant un rendez-vous, résumé du matin, pastille sur l'icône. |
| **Paramètres** | Compte et synchronisation, nom de l'agence, Google Agenda, notifications, **verrouillage par code / Face ID**, couleurs (Indigo, Lagon, Corail ; clair / sombre), seuils des couleurs de relance, données de démonstration. |

Des **données de démonstration** (contacts fictifs de la région de Charleroi) sont créées au premier
lancement pour découvrir l'application. Elles portent l'étiquette « Démo » et se suppriment en un clic
(Paramètres → Données de démonstration).

---

## 2. Mise en service, pas à pas

Comptez une heure au total, une seule fois. Chaque partie a son guide détaillé, avec les mots exacts
à chercher dans les écrans (souvent en anglais).

| # | Quoi | Guide | Obligatoire ? |
|---|---|---|---|
| 1 | **Serveur Supabase** : base de données, comptes, photos | [`docs/GUIDE_INSTALLATION.md`](docs/GUIDE_INSTALLATION.md) partie 1 | Oui, pour travailler à plusieurs |
| 2 | **Mise en ligne Netlify** : l'adresse de l'application | même guide, partie 2 | Oui |
| 3 | **Installer sur les téléphones** | même guide, partie 3 (et écran « Installer » dans l'application) | Oui |
| 4 | **Créer les comptes de l'équipe** (secrétaire, stagiaires) puis choisir leur rôle dans l'écran **Équipe** | même guide, partie 4 | Oui |
| 5 | **Google Agenda** | [`docs/GUIDE_GOOGLE_AGENDA.md`](docs/GUIDE_GOOGLE_AGENDA.md) | Facultatif |
| 6 | **Notifications** (même application fermée) | [`docs/GUIDE_NOTIFICATIONS.md`](docs/GUIDE_NOTIFICATIONS.md) | Facultatif |
| 7 | **Prix du marché Statbel** | [`docs/GUIDE_STATBEL.md`](docs/GUIDE_STATBEL.md) | Déjà inclus (mise à jour 2× par an) |

**Ce que vous m'envoyez** (ce sont des informations publiques, sans danger) :

- l'adresse du projet Supabase (`https://….supabase.co`) et sa clé **publishable** (ou « anon ») ;
- l'adresse Netlify (`https://….netlify.app`) ;
- l'**ID client** Google (si Google Agenda) ;
- la **clé publique** des notifications (si notifications).

Je les ajoute au réglage de l'application (section 3), et la nouvelle version est en ligne 1 à 2 minutes plus tard.

### Nom de domaine définitif

L'application tourne pour l'instant sur une adresse gratuite. Le jour où vous avez un nom de domaine :

1. Netlify → **Domain management** → **Add a domain** → tapez par exemple `app.votre-agence.be`.
2. Chez votre hébergeur de domaine (OVH, Combell, One.com…), ajoutez l'enregistrement **CNAME** que
   Netlify vous indique. Le cadenas (HTTPS) s'active tout seul.
3. Supabase → **Authentication** → **URL Configuration** : remplacez l'ancienne adresse par la nouvelle
   (Site URL **et** Redirect URLs).
4. Google Cloud (si Google Agenda) : ajoutez la nouvelle adresse dans **Authorized JavaScript origins**.
5. Sur chaque téléphone : ouvrez la nouvelle adresse, reconnectez-vous et réinstallez l'icône
   (les données reviennent du serveur ; supprimez l'ancienne icône).

Aucune modification du code n'est nécessaire.

---

## 3. Réglages (fichier `.env`)

Quatre réglages, tous **publics** (ils sont visibles dans l'application, ce ne sont pas des secrets).
Modèle : [`.env.example`](.env.example). Pour la version en ligne, ils se mettent dans Netlify →
**Project configuration** → **Environment variables** (ou je les ajoute dans un fichier `.env.production`),
puis **Deploys** → **Trigger deploy**.

| Réglage | Exemple | Sans ce réglage |
|---|---|---|
| `VITE_SUPABASE_URL` | `https://abcd1234.supabase.co` | mode local (un seul appareil) |
| `VITE_SUPABASE_ANON_KEY` | `sb_publishable_…` | mode local |
| `VITE_GOOGLE_CLIENT_ID` | `1234-abc.apps.googleusercontent.com` | pas de Google Agenda |
| `VITE_VAPID_PUBLIC_KEY` | `BElx…` (clé publique) | rappels seulement quand l'application est ouverte |

Les **secrets**, eux, ne vont **jamais** dans ce fichier ni sur GitHub : la clé privée des notifications
va uniquement dans les secrets Supabase (voir le guide des notifications).

---

## 4. Sécurité et vie privée

> 🔒 **Ne communiquez jamais** (ni à moi, ni dans un fichier, ni dans un email) :
> le mot de passe de la base Supabase, la clé « **secret** » / « **service_role** »,
> le « **code secret du client** » Google, la **clé privée** des notifications.

- **Comptes** : chacun se connecte avec son email et son mot de passe ; l'administrateur invite les
  membres et choisit leur rôle dans l'écran Équipe (administrateur, collaborateur, stagiaire). Le stagiaire ne peut ni
  exporter, ni supprimer, ni modifier les paramètres. Ces règles sont vérifiées **par le serveur**, pas
  seulement à l'écran.
- **Téléphone perdu** : Paramètres → Compte et synchronisation → à côté de l'appareil, « Déconnecter ».
  Dès qu'il retrouve Internet, le téléphone efface toutes les données Prospect’Immo qu'il contient.
- **Verrouillage** (facultatif, par appareil) : Paramètres → Verrouillage. Un code de 4 à 6 chiffres,
  et Face ID / l'empreinte si le téléphone le permet. Il se réactive quand on quitte l'application
  (immédiatement, après 1, 5 ou 15 minutes). Après 5 erreurs, une attente de plus en plus longue est
  imposée. Le code n'est gardé que sous forme d'empreinte, jamais en clair. C'est un verrou d'écran,
  comme celui d'une application bancaire : il protège contre quelqu'un qui prend le téléphone
  déverrouillé, il ne chiffre pas les données. *Code oublié ?* Avec le serveur : se déconnecter, puis se
  reconnecter (tout revient du serveur). En mode local : il faut effacer les données de l'appareil.
- **Rien n'est jamais vraiment effacé** : les fiches sont archivées et chaque modification est
  journalisée (qui, quand, quoi), ce qui permet de revenir en arrière.
- **RGPD** : les campagnes ne partent qu'aux contacts qui ont donné leur accord pour ce canal ; un appel
  ou un message individuel reste possible (intérêt légitime), avec un avertissement si la fiche est
  marquée « ne pas contacter ». Chaque message de campagne contient la possibilité de se désinscrire.
- **Hébergement** : Supabase (serveurs en Europe, région choisie à la création) et Netlify.

---

## 5. Critères d'acceptation et performances

Vérifiés automatiquement dans un navigateur de test (téléphone simulé, 390 × 844), sur la version de production.

| Critère | Résultat |
|---|---|
| Maison vide repérée avec 5 photos en moins de 30 s, **sans réseau** | ✅ enregistré hors ligne (≈ 2 s de manipulation), envoyé au retour du réseau |
| Appui sur le numéro → appel, SMS ou WhatsApp ; WhatsApp s'ouvre sur le bon numéro | ✅ `https://wa.me/32475…` (format international +32) |
| « Rappeler plus tard +3 mois » → relance dans l'agenda de l'application, dans Google Agenda, notification le jour venu | ✅ agenda de l'application ; Google Agenda et notifications vérifiés par les tests automatiques (faux Google, base de test) — à confirmer en réel une fois Google et les notifications configurés |
| Prospect sans contact depuis plus que le seuil → **rouge** sur l'accueil | ✅ |
| Fiche créée sur le téléphone → visible sur l'ordinateur en quelques secondes | ✅ par les tests (synchronisation en temps réel) — à confirmer en réel avec votre serveur |
| Même numéro saisi deux fois → alerte de doublon | ✅ (formulaire contact et repérage) |
| Mandat signé → le prospect devient client sans ressaisie | ✅ |
| Devant une adresse à Charleroi : prix médians de la commune sur 6–7 ans, avec source et année, en moins de 2 s | ✅ ≈ 0,8 s (données Statbel depuis 2010 incluses dans l'application) |
| Liste fluide avec 5 000 contacts | ✅ ≈ 35 images/s en défilement rapide avec un processeur ralenti ×4 ; recherche instantanée |

**Temps d'ouverture** (objectif : moins de 2 s) :

| Situation | Temps jusqu'à l'écran « Aujourd'hui » |
|---|---|
| Ouverture habituelle (application installée), téléphone moyen | **0,6 à 0,8 s** — même hors ligne |
| Toute première ouverture, 4G, téléphone moyen | **1,8 s** |
| Toute première ouverture, 3G lente | ≈ 5 s (une seule fois : ensuite tout est sur le téléphone) |

Pour y arriver : l'accueil s'affiche immédiatement depuis la base du téléphone ; si l'on est déjà connecté,
la session mémorisée est utilisée sans attendre le serveur ; les autres écrans, la carte, les graphiques,
Excel et la bibliothèque du serveur se chargent à la demande, après l'affichage.

---

## 6. Entretien courant

- **Mises à jour de l'application** : automatiques. Quand une nouvelle version est disponible, un bandeau
  « Nouvelle version » propose de recharger.
- **Sauvegarde** : Import / export → « Sauvegarde complète » (un fichier). La revue du vendredi vous le
  rappelle chaque semaine ; rangez le fichier dans votre Google Drive. (Les copies automatiques
  quotidiennes du serveur font partie de l'offre payante de Supabase.)
- **Prix Statbel** : deux fois par an (mars et septembre), voir [`docs/GUIDE_STATBEL.md`](docs/GUIDE_STATBEL.md).
- **Nouveau collaborateur** : créez son compte dans Supabase (guide d'installation, partie 4), puis
  choisissez son rôle dans **Plus → Équipe**. **Départ** : dans Équipe, décochez « Accès actif », puis
  déconnectez ses appareils (Paramètres → Compte et synchronisation).
- **Coûts** : 0 € pendant la phase de test (offres gratuites Supabase et Netlify). Détail dans le guide d'installation.

---

## 7. Pour le développeur

Prérequis : [Node.js](https://nodejs.org) 20 ou plus récent.

```bash
npm install
npm run dev            # application sur http://localhost:5173 (mode local si pas de .env)
npm test               # tests automatiques (Vitest)
npm run typecheck      # vérification TypeScript
npm run build          # version de production dans dist/
npm run preview        # tester la version de production (installable, hors ligne)
npm run build:apercu   # aperçu de démonstration en un seul fichier HTML
```

Tests du serveur (PostgreSQL 16 local) : `bash supabase/tests/lancer.sh`.

**Technologies** : React 19 + TypeScript + Vite, Tailwind CSS 4, Dexie (IndexedDB) pour la base du
téléphone, Supabase (PostgreSQL, Auth, Storage, Realtime, Edge Functions) pour le serveur, Leaflet +
OpenStreetMap pour la carte, Workbox pour le hors-ligne, Vitest pour les tests.

**Synchronisation** (« local-first ») : chaque modification est écrite dans la base du téléphone et dans
une file d'envoi (`outbox`). Le moteur envoie la file au serveur, puis récupère les changements des
autres. Les conflits se règlent **champ par champ** (le plus récent gagne, horloge hybride), si bien que
deux personnes qui modifient des champs différents d'une même fiche ne s'écrasent jamais. Le temps réel
Supabase déclenche la récupération en quelques secondes.

| Dossier | Rôle |
|---|---|
| `src/domain/` | Règles métier pures et testées (couleurs de relance, téléphone +32, doublons, marché, RGPD, import, verrouillage…) |
| `src/data/` | Base locale (Dexie), repositories, données de démo, sauvegarde, synchronisation (`sync/`), Google Agenda (`google/`) |
| `src/features/` | Un dossier par écran (aujourdhui, prospection, contacts, biens, agenda, marche, communication, equipe, importexport, parametres…) |
| `src/services/` | Services du navigateur : Google, notifications, verrouillage, géocodage, installation, équipe |
| `src/components/` | Composants réutilisables (`ui/` pour les briques de base) |
| `src/app/` | Démarrage, navigation, thème, connexion, écran de verrouillage |
| `supabase/migrations/` | Schéma du serveur, sécurité par rôle, fusion champ par champ, notifications |
| `supabase/installation.sql` | Toutes les migrations en un fichier, à coller dans Supabase |
| `supabase/functions/rappels-push/` | Envoi des notifications (toutes les 5 minutes) |
| `supabase/tests/` | Tests SQL du serveur |
| `scripts/statbel.py` | Conversion des fichiers Excel Statbel en données compactes |
| `docs/` | Guides de mise en place et documents de conception |

---

## 8. Questions fréquentes

**L'application marche-t-elle sans réseau ?** Oui : consulter, créer, modifier, repérer avec photos.
Tout part au serveur au retour du réseau (l'icône en haut à droite indique ce qui attend).

**Sur iPhone, les notifications n'arrivent pas.** Elles ne fonctionnent qu'avec l'application
**installée sur l'écran d'accueil** (iOS 16.4 ou plus récent). Voir l'écran « Installer ».

**J'ai archivé une fiche par erreur.** Rien n'est supprimé : Contacts → filtre « Archivés » → ouvrez la
fiche → « Restaurer la fiche ».

**Peut-on importer les données de CRM Immo ?** Oui via un export CSV / Excel (Import / export). Un import
direct du format CRM Immo pourra être ajouté à partir d'un fichier exemple.

**Combien d'utilisateurs ?** Prévu pour une petite équipe (4 personnes) ; l'offre gratuite de Supabase
suffit largement.
