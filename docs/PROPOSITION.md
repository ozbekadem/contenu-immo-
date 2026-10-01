# Linkimmo — Proposition d'architecture (à valider)

> Document de travail pour validation avant tout développement.
> Rien n'est codé tant que vous n'avez pas validé (ou corrigé) ce document.

---

## 1. Structure du projet

```
linkimmo/
├── src/
│   ├── app/                 # démarrage, routes, mise en page, onglets du bas, bouton « Repérer »
│   ├── features/            # un dossier par module (écrans + composants propres)
│   │   ├── aujourdhui/
│   │   ├── prospection/     # pistes, capture terrain, carte, session d'appels
│   │   ├── contacts/        # liste virtualisée, fiche, doublons, segments
│   │   ├── biens/           # liste, carte, fiche, galerie, cadastre, PDF
│   │   ├── marche/          # encart « Marché du quartier » + vue « Marché local »
│   │   ├── agenda/          # jour/semaine/mois/année, Google Agenda
│   │   ├── communication/   # modèles, campagnes, RGPD
│   │   ├── equipe/          # utilisateurs, rôles, statistiques
│   │   ├── parametres/
│   │   └── import-export/
│   ├── components/ui/       # boutons, feuilles (bottom sheets), pastilles, listes virtuelles…
│   ├── domain/              # RÈGLES MÉTIER PURES, sans interface ni base → 100 % testées
│   │   ├── relance.ts       #   calcul couleur 🟢🟡🟠🔴⚪, « il y a X jours »
│   │   ├── telephone.ts     #   normalisation +32, liens tel:/sms:/wa.me
│   │   ├── doublons.ts      #   détection téléphone / adresse / nom
│   │   ├── score.ts         #   score de potentiel /100 avec détail
│   │   ├── resultats.ts     #   résultats d'appel par catégorie → statut, relance auto
│   │   └── jours-feries.ts  #   jours fériés belges
│   ├── data/
│   │   ├── db.ts            # base locale IndexedDB (Dexie)
│   │   ├── repositories/    # SEULE porte d'accès aux données (ContactRepo, BienRepo, PisteRepo…)
│   │   └── sync/            # moteur de synchronisation (file d'envoi, réception, temps réel, fusion)
│   ├── services/            # géocodage, photos (compression en arrière-plan), push, Google
│   ├── workers/             # Web Workers : compression photos, recherche
│   └── i18n/                # textes fr-BE
├── supabase/
│   ├── migrations/          # schéma SQL, sécurité par rôle (RLS), fonctions de fusion
│   └── functions/           # fonctions serveur : notifications, Google Agenda, Statbel, sauvegarde
├── scripts/                 # import Statbel, import ancienne app CRM Immo
├── tests/
├── docs/
└── README.md
```

Bibliothèques principales (en plus de celles imposées) : `@tanstack/react-virtual` (listes de 5 000+),
`react-router`, `dexie-react-hooks` (écrans qui se mettent à jour tout seuls),
`maplibre-gl` + tuiles gratuites OpenFreeMap (carte, chargée seulement quand on l'ouvre),
`libphonenumber-js` (numéros), `date-fns` (dates fr-BE), `zod` (validation des imports).

---

## 2. Modèle de données

Colonnes communes à **toutes** les tables synchronisées :
`id` (UUID créé sur l'appareil → fonctionne hors ligne), `created_at/by`, `updated_at/by`,
`archived_at` (archivage, jamais d'effacement silencieux), `_ts` (horodatage **par champ**
pour la fusion), `server_seq` (numéro d'ordre serveur pour la synchronisation).

### Personnes
| Table | Contenu principal |
|---|---|
| **profils** | utilisateur : nom, rôle (admin / collaborateur / stagiaire), couleur, préférences de notifications (types, heure du résumé, heures de silence) |
| **appareils** | appareils connectés : nom, dernière activité, abonnement push, `revoque` (déconnexion à distance + effacement des données locales) |
| **contacts** | civilité, prénom, nom, société, date de naissance, photo, **statuts multiples** (prospect vendeur, vendeur, acheteur, locataire, propriétaire bailleur, partenaire, ancien client…), température (chaud/tiède/froid), canal préféré, compteur d'utilisation des canaux (pour mettre le plus utilisé en premier), collaborateur attitré, tags, notes, `ne_pas_contacter`, et champs calculés : `dernier_contact_at`, `prochaine_relance_at` |
| *(dans contacts)* | téléphones et emails (plusieurs possibles) ; les numéros normalisés (+32…) sont indexés → détection de doublon instantanée. *Simplification retenue à l'étape 2 : stockés dans la fiche contact plutôt que dans une table séparée.* |
| *(dans contacts)* | adresse actuelle + historique des anciennes adresses (date de fin) — jamais effacées |
| **consentements** | par contact et par finalité (appel, SMS, email, WhatsApp, newsletter) : accordé / refusé / retiré, date, preuve, date d'expiration |

### Biens et marché
| Table | Contenu principal |
|---|---|
| **biens** | adresse (rue, n°, boîte, CP, commune), GPS, **code secteur statistique** et **code INS commune** (calculés automatiquement), type (maison 2-3 façades, 4 façades, appartement, terrain, immeuble de rapport, commerce…), état (occupé, vide, à l'abandon), chambres, surface, source, lien CadGIS / capakey, notes |
| **photos** | liée à un bien, une piste ou un contact : chemin fichier + miniature, dimensions, ordre, date/GPS de prise, état d'envoi |
| **piecesJointes** | documents (PDF, Word, Excel, photos) **et liens Internet** joints à un contact, un bien ou une piste : annonce Immoweb / 2ememain / site d'agence, annonce enregistrée en PDF, cadastre, PEB, compromis… Le fichier est gardé sur l'appareil (hors ligne) puis envoyé au serveur |
| **bien_contacts** | lien bien ↔ contact avec un rôle (propriétaire, copropriétaire, locataire, acheteur, voisin, notaire…) et des dates |
| **transactions** | historique d'un bien : mandat, vente, location, achat privé — date, prix, contacts concernés |
| **stat_secteurs**, **stat_ventes_secteur**, **stat_prix_commune**, **stat_prix_region**, **stat_imports** | données Statbel (contours simplifiés des secteurs, médianes, quartiles, nb de ventes par année et par type, données masquées, date d'import) — non personnelles |

### Prospection et suivi
| Table | Contenu principal |
|---|---|
| **pistes** | catégorie (Portefeuille / Annonce de particulier / Maison vide), bien lié, contact lié (**facultatif** : propriétaire inconnu), statut, étape d'entonnoir (Repéré → Appelé → RDV/Visite → Mandat/Achat), source (panneau, repérage rue, Immoweb, 2ememain, recommandation, autre) + lien de l'annonce, prix affiché, collaborateur attitré, dernier résultat, `dernier_contact_at`, `prochaine_relance_at`, température. **La couleur n'est pas stockée : elle est recalculée à l'affichage** (toujours juste, même à minuit) |
| **interactions** | appel, SMS, email, WhatsApp, visite, RDV, note, courrier — date/heure, auteur, résultat, commentaire, liée à un contact et/ou un bien et/ou une piste, et au modèle/campagne utilisé |
| **taches** | relances, rappels et tâches : échéance (date + heure facultative), récurrence (ex. tous les ans, tous les 3 mois), statut, assignée à, liens contact/bien/piste, identifiant Google Agenda |
| **evenements** | RDV et visites : début, fin, lieu, participants, identifiant Google Agenda |
| **modeles_message** | SMS / email / WhatsApp, avec variables `{{prenom}}`, `{{nom}}`, `{{ville}}`… |
| **campagnes** + **campagne_destinataires** | canal, modèle, segment ; par destinataire : à envoyer / envoyé / **bloqué RGPD** / ignoré |
| **segments** | filtres de listes enregistrés (personnels ou partagés) |
| **doublons** | doublons signalés (raison, statut : ouvert / ignoré / fusionné manuellement) — jamais de fusion automatique |
| **parametres** | seuils de couleur, intervalles de relance par catégorie, zone de prospection (communes) |
| **journal** | chaque modification : table, fiche, champ, ancienne → nouvelle valeur, auteur, appareil, date, **conflit oui/non** |

### Côté serveur uniquement (jamais sur les téléphones)
`google_comptes` (jetons Google chiffrés), `push_envois` (anti-doublon de notifications), `sauvegardes`.

**Conversion automatique** : quand une piste passe à « Mandat signé » ou « Accord d'achat »,
le contact reçoit le statut « vendeur » (ou « vendeur – achat privé »), une transaction est
créée sur le bien, l'étape d'entonnoir passe à « Signé » — sans rien ressaisir.

---

## 3. Architecture de synchronisation (« local-first »)

```
 Téléphone / PC                                   Supabase (Europe – Francfort)
┌────────────────────────────────────┐          ┌──────────────────────────────────┐
│ Écran ──► Repository ──► Dexie     │          │ PostgreSQL + sécurité par rôle   │
│  (lecture instantanée, hors ligne) │  envoi   │  fonction sync_push : fusion     │
│               │                    │ ───────► │  champ par champ + journal       │
│               └─► File d'envoi     │          │                                  │
│                   (outbox)         │ ◄─────── │  sync_pull : « tout ce qui a     │
│ Photos : compressées → file photos │ réception│  changé depuis n° X »            │
│  → envoi en arrière-plan ─────────►│──────────│► Stockage photos (privé)         │
│ ◄── signal temps réel ─────────────│──────────│─ Realtime (« il y a du nouveau ») │
└────────────────────────────────────┘          └──────────────────────────────────┘
```

1. **Écriture** : chaque modification est enregistrée immédiatement en local (l'écran réagit en
   quelques millisecondes), puis ajoutée à une **file d'envoi** avec l'heure de modification de
   chaque champ.
2. **Envoi** : dès qu'il y a du réseau, la file part par lots vers le serveur.
3. **Fusion « dernière modification gagnante par champ »** : si deux personnes modifient la même
   fiche hors ligne, chaque **champ** garde la valeur la plus récente. Exemple : vous changez le
   téléphone, la secrétaire change l'adresse → les deux modifications sont gardées. Si vous
   modifiez tous les deux le **même** champ, la plus récente gagne **et l'autre valeur est
   inscrite au journal comme conflit**, avec un bouton « Restaurer ». Aucune perte silencieuse.
   Les horloges des appareils pouvant être décalées, on utilise une horloge hybride (HLC)
   qui corrige ces décalages.
4. **Réception** : chaque appareil demande « ce qui a changé depuis la dernière fois ».
   Le canal temps réel de Supabase prévient les autres appareils en ~1 seconde → une fiche
   créée sur le téléphone apparaît sur l'ordinateur en quelques secondes.
5. **Photos** : compressées sur l'appareil au moment de la prise (1600 px, WebP ; JPEG si
   l'iPhone ne sait pas produire du WebP), miniature 400 px, stockées localement puis envoyées
   une par une en arrière-plan. Les autres appareils ne téléchargent que les miniatures,
   l'originale à la demande.
6. **Sécurité** : chaque requête passe par les règles d'accès (RLS) de PostgreSQL selon le rôle.
   Un appareil révoqué est déconnecté et efface ses données locales à la prochaine connexion.

**Limites honnêtes à connaître**
- iPhone : pas d'envoi en arrière-plan quand l'application est fermée → les photos repérées
  hors ligne partent dès que l'application est rouverte avec du réseau.
- Hors ligne, l'adresse automatique (à partir du GPS) n'est pas disponible : la position est
  gardée et l'adresse est complétée automatiquement au retour du réseau (ou saisie à la main).
- Un téléphone perdu **et hors ligne** garde ses données tant qu'il ne se reconnecte pas →
  un code de verrouillage sur les téléphones est indispensable.
- Notifications sur iPhone : uniquement si l'application est installée sur l'écran d'accueil
  (iOS 16.4 minimum). Le guide intégré l'expliquera pas à pas.

---

## 4. Coûts d'hébergement prévisibles

| Poste | Solution | Coût mensuel |
|---|---|---|
| Base de données, connexion, photos, temps réel, fonctions serveur | **Supabase Pro** (région Francfort) : 8 Go de base, 100 Go de photos, sauvegardes quotidiennes 7 jours, pas de mise en veille | **≈ 25 $ ≈ 23 €** |
| Site de l'application (fichiers statiques) | Cloudflare Pages ou Netlify (gratuit), relié au futur nom de domaine (à définir) | 0 € |
| Google Agenda (API) | gratuit | 0 € |
| Notifications push (Web Push) | gratuit | 0 € |
| Carte | MapLibre + OpenFreeMap | 0 € |
| Adresse automatique (géocodage) | OpenStreetMap/Nominatim (gratuit, suffisant pour 4 personnes) ; Google possible plus tard | 0 € |
| Emails de connexion / mot de passe oublié | Brevo (offre gratuite 300 emails/jour) | 0 € |
| Nom de domaine | déjà possédé | 0 € |
| **Total** | | **≈ 23-25 € / mois** |

Estimation de volume : ~3 000 photos/an ≈ 1 Go/an → marge de plusieurs dizaines d'années
dans l'offre Pro. L'offre gratuite de Supabase existe (utile pour le développement) mais elle se
met en veille après 7 jours sans activité et n'a pas de sauvegarde : **déconseillée en production**.

---

## 5. Découpage en étapes

Chaque étape se termine par : compilation OK, tests OK, commit git, résumé en français
de ce qui fonctionne et de ce que vous devez tester.

| # | Étape | Ce que vous pourrez tester |
|---|---|---|
| 1 | **Socle** : projet Vite/React/TS/Tailwind, PWA installable, design (jaune #FFF000, clair/sombre), onglets du bas, bouton « Repérer », règles métier pures + tests (couleurs, téléphone +32) | l'application s'ouvre et s'installe sur le téléphone |
| 2 | **Données locales** : base Dexie, repositories, données de démo (Charleroi), liste contacts virtualisée + recherche instantanée, fiche contact de base, test avec 5 000 contacts | liste fluide, recherche, fonctionne en mode avion |
| 3 | **Serveur et synchronisation** : schéma Supabase, connexion, rôles, moteur de sync, fusion par champ, journal, temps réel. *Vous créez le compte Supabase (guide fourni).* | une fiche créée sur le téléphone apparaît sur le PC |
| 4 | **Actions en un appui** : menu Appel/SMS/WhatsApp/Email, retour dans l'appli → résultat + prochaine relance, interactions journalisées | critère WhatsApp + noter « +3 mois » |
| 5 | **Prospection** : pistes 3 catégories, capture terrain (multi-photos, GPS, adresse, doublons), file d'envoi photos, résultats par catégorie, conversion automatique en client | critère « maison vide + 5 photos < 30 s hors ligne », doublon, mandat → client |
| 6 | **Aujourd'hui** : à appeler / en retard, filtres rapides, entonnoir, prospects à maturité, anniversaires ; **session d'appels** plein écran | critère « rouge sur l'accueil » |
| 7 | **Biens** : liste, carte colorée, fiche, galerie, cadastre, PDF, contacts liés, historique | |
| 8 | **Agenda** + **Google Agenda** (deux sens, agenda « Linkimmo »). *Vous créez le projet Google Cloud (guide fourni).* | la relance apparaît dans Google Agenda |
| 9 | **Notifications** : résumé du matin, rappels à l'heure, passage au rouge, badge, heures de silence, guide d'installation iPhone/Android | notification le jour de la relance |
| 10 | **Statbel** : a) vérification des jeux de données → **rapport + votre validation** ; b) import serveur, secteur automatique, encart « Marché du quartier », vue « Marché local », mise à jour semestrielle | critère « Charleroi < 2 s » |
| 11 | **Communication** : modèles, aperçu, campagnes, blocage RGPD, journalisation | |
| 12 | **Équipe, statistiques, paramètres** : rôles, attribution, stats, score /100, fusion manuelle guidée des doublons, suppression démo en un clic | |
| 13 | **Import / export / sauvegarde** : CSV/Excel (en-têtes français), JSON complet, restauration, import CRM Immo, sauvegarde quotidienne serveur | |
| 14 | **Finitions** : mesures de performance (ouverture < 2 s), README complet, mise en ligne sur le nom de domaine définitif | tous les critères d'acceptation |

Prévu dans l'architecture pour plus tard : Outlook (même interface que Google Agenda),
assistant IA sur les fiches (propositions toujours validées par vous).

---

## 6. Questions sur les règles métier (avec ma proposition par défaut)

Répondez simplement « OK » pour garder ma proposition, ou corrigez.

1. **Règle des couleurs** (ordre de priorité) :
   ⚪ archivé / ne pas rappeler → 🔴 relance dépassée **ou** aucun contact depuis plus que le seuil
   → 🟠 relance aujourd'hui → 🟡 relance dans les **7** prochains jours
   → 🟢 dernier résultat positif, contact il y a moins de **14** jours, ou relance planifiée plus loin.
2. **Seuils « rouge » par défaut** : Portefeuille **90 j**, Annonces de particuliers **30 j**,
   Maisons vides **60 j**. Intervalle de relance par défaut du Portefeuille : 3 mois.
3. **Résultats « positifs »** (→ vert) : RDV obtenu, Visite obtenue, Mandat signé, Accord d'achat,
   ainsi que tout contact marqué « chaud ».
4. **Rôles** : le stagiaire voit toutes les fiches mais ne peut ni exporter, ni supprimer/archiver
   définitivement, ni modifier les paramètres ; la secrétaire = collaborateur (tout sauf
   paramètres et gestion des comptes). Correct ?
5. **Google** : utilisez-vous des comptes Gmail personnels ou Google Workspace (adresse
   adresse professionnelle) ? Chaque collaborateur a-t-il son propre agenda « Linkimmo » avec
   **ses** relances seulement (ma proposition), ou un agenda commun de l'agence ?
6. **Hébergement** : quel nom de domaine ? Chez qui est géré le domaine
   (OVH, Combell, One.com…) ?
7. **Données existantes** : pouvez-vous me fournir un exemple de sauvegarde JSON de CRM Immo
   (avec 2-3 fiches, éventuellement anonymisées) ? Et faut-il aussi importer les données de
   l'actuel Linkimmo (quel format d'export) ?
8. **RGPD et prospection** : le blocage sans consentement s'applique aux **campagnes et modèles**
   uniquement ; un appel individuel à un prospect (intérêt légitime) reste possible, avec un
   avertissement si le contact est marqué « ne pas contacter ». Correct ?

---

## 7. Décisions validées

- **Q5 – Google Agenda** : oui. Chaque collaborateur a son agenda « Linkimmo » dans son Google
  Agenda, où apparaissent ses relances et tâches pour qu'il y pense.
  L'**email** reste une action disponible dans l'application : rare, mais indispensable.
- **Q6 – Hébergement** : tout reste fictif pour l'instant. On met l'application en ligne sur une
  adresse gratuite provisoire (ex. `linkimmo-demo.pages.dev`). Le vrai nom de domaine viendra
  quand l'application sera officielle : il suffira de le brancher, sans changer de code.
- **Comptes Google** : Gmail (@gmail.com) pour tous → pas de Google Workspace.
- **Aucun champ obligatoire** (demande du 30/09) : dans tous les formulaires (contacts, biens,
  vendeurs, pistes…), on complète ce qu'on veut, quand on veut. Une fiche sans nom s'affiche avec
  son téléphone, son email ou son adresse.
- **Documents et liens** (demande du 30/09) : sur chaque fiche, ajout de PDF, Word, Excel, photos
  et de liens Internet (annonces d'autres agences ou de particuliers), avec source reconnue
  automatiquement. À l'étape 5, les sources de prospection comprendront aussi « Autre agence »
  et « Site Internet de particulier ».
- **Nouvelle interface** (demande du 30/09) : le jaune/noir est remplacé par un design clair et
  lumineux (fond gris très pâle, cartes blanches, police Plus Jakarta Sans), couleur principale
  en dégradé au choix dans les Paramètres : **Indigo** (par défaut), **Lagon** ou **Corail**.
  Les couleurs de catégories (bleu / orange / violet) et de suivi (vert → rouge) restent inchangées.
- **Q7 – Données existantes** : on construit l'application à partir de zéro, uniquement sur la
  base du cahier des charges. L'import spécifique de l'ancienne application CRM Immo est mis
  de côté ; il sera ajouté plus tard si un fichier exemple est fourni. Les anciennes données
  pourront aussi être reprises via l'import CSV / Excel (étape 13).
