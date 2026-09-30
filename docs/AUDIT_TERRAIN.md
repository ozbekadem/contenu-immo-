# Linkimmo — Audit « terrain » (agent immobilier / investisseur)

> Mise en situation : je prospecte à Charleroi, je repère des panneaux et des maisons vides,
> je suis des annonces d'autres agences et de particuliers, je rappelle pendant des mois,
> et je veux acheter ou rentrer des mandats. J'ai utilisé l'application telle qu'elle est
> (étapes 1-2 + documents) sur un smartphone simulé, puis relu le plan des étapes 3 à 14.
> Rien n'est encore modifié : ce document liste des propositions à valider.

---

## A. Ce que j'ai constaté en utilisant l'application (testé)

| # | Test réalisé | Résultat | Gravité |
|---|---|---|---|
| A1 | Créer « Marc **Dupond** » alors que « Marc **Dupont** » existe (sans téléphone) | Aucune alerte | 🔴 Doublon garanti |
| A2 | Saisir l'email d'un contact existant en majuscules | Aucune alerte | 🔴 |
| A3 | Saisir l'adresse d'un contact existant (Rue Puissant 7, Gilly) | Aucune alerte | 🔴 |
| A4 | Prénom et nom inversés (« Dupont Marc ») | Aucune alerte | 🟠 |
| A5 | Rechercher « dupond » ou « rosi » (faute de frappe) | 0 résultat | 🟠 |
| A6 | Rechercher un mot des notes (« hiver ») | 0 résultat | 🟡 |
| A7 | Planifier une relance à la création ou en modifiant un contact | Impossible (prévu étape 4 uniquement) | 🔴 Pas de suivi possible aujourd'hui |
| A8 | Quitter un formulaire rempli sans enregistrer | Tout est perdu sans avertissement | 🟠 |
| A9 | Trier la liste (par relance, dernier contact, date d'ajout) | Pas de tri, seulement alphabétique | 🟠 |
| A10 | Taper le code postal 6001 | La localité ne se remplit pas (« Marcinelle ») → orthographes différentes = doublons d'adresse | 🟠 |
| A11 | Email invalide | Bloqué par un message du navigateur (pas en français sur tous les téléphones) | 🟡 |
| A12 | Sur le terrain, je n'ai souvent **que le numéro** de l'affiche | Le téléphone est en 2ᵉ position dans le formulaire, après l'identité | 🟡 |

Ce qui fonctionne bien : doublon de téléphone (tous formats), recherche par numéro et
par ville, fluidité à 5 000 contacts, hors ligne, documents et liens, archivage sans perte.

---

## B. Anti-doublons : proposition complète (7 niveaux)

Aujourd'hui, seul le **téléphone** est contrôlé. Or un même vendeur ou une même maison peut
arriver par 4 chemins : panneau dans la rue, Immoweb, une autre agence, une recommandation.

1. **« Chercher avant de créer »** : pendant la saisie du formulaire (nom, téléphone, email,
   adresse), un encart « Fiches similaires » montre en direct les fiches existantes, avec
   « Ouvrir » ou « C'est une autre personne ».
2. **Téléphone** (fait) : comparaison au format +32, fiches archivées comprises.
3. **Email** : comparaison sans majuscules ni espaces.
4. **Nom « qui se prononce pareil »** : comparaison phonétique adaptée au français
   (Dupont/Dupond, Lefèvre/Lefebvre, El Amrani/Elamrani, prénom et nom inversés),
   combinée à la même commune pour éviter les fausses alertes.
5. **Adresse normalisée** : « Av. » = « avenue », « Chée » = « chaussée », « r. » = « rue »,
   accents et majuscules ignorés, code postal ↔ localité automatique (6001 → Marcinelle).
6. **Bien = une seule fiche, plusieurs sources** (le plus important pour un investisseur) :
   un bien est reconnu par, dans l'ordre :
   - sa **parcelle cadastrale** (capakey CadGIS) : identifiant unique officiel ;
   - son **adresse normalisée** (rue + n° + boîte + CP) ;
   - sa **position GPS** (autre fiche à moins de 25 m → « Est-ce le même bien ? ») ;
   - l'**identifiant d'annonce** (ex. le n° Immoweb dans le lien) : coller deux fois la même
     annonce est signalé immédiatement.
7. **Contrôle après synchronisation** (étape 3) : deux collaborateurs peuvent créer la même
   fiche hors ligne au même moment. Le serveur compare alors toutes les fiches et alimente une
   liste **« Doublons à vérifier »**, avec **fusion guidée** champ par champ. Rien n'est
   fusionné automatiquement : la fusion reprend documents, photos et historique, et reste
   annulable (journal).
   → Je propose d'avancer cette fusion guidée de l'étape 12 aux étapes 3-5.

---

## C. Ce qui manque pour le métier (par moment de la journée)

### C1. Sur le terrain (repérage)
- **Formulaire « terrain » ultra court** : photo, téléphone, catégorie. Tout le reste plus tard.
  Le **téléphone en premier**.
- **Lecture du numéro sur la photo de l'affiche** (reconnaissance de texte sur le téléphone,
  sans envoi sur Internet). Utile, mais c'est un « plus » : l'outil pèse quelques Mo.
- **Note vocale** : enregistrer 30 secondes au lieu de taper au volant ou sous la pluie
  (jointe à la fiche comme un document).
- **Indices d'inoccupation** pour les maisons vides, en cases à cocher : boîte aux lettres
  pleine, volets fermés, jardin à l'abandon, compteurs coupés, affiche « à louer » ancienne,
  vitres cassées… Cela donne un **score « maison vide probable »** et de quoi argumenter.
- **« Autour de moi »** : les biens déjà repérés à moins de 500 m, pour ne pas repérer deux
  fois la même maison et pour organiser une **tournée**.
- **Repasser devant** : pour une maison vide, une tâche récurrente « repasser tous les 2 mois »,
  avec photo datée à chaque passage (preuve de l'évolution).

### C2. Au bureau (qualification)
- **Fiche bien plus complète**, tout facultatif : type, façades, chambres, surface habitable
  et terrain, année, PEB, revenu cadastral, état (à rénover / habitable / rénové), occupation
  (vide, occupé propriétaire, loué), urbanisme connu, prix demandé.
- **Plusieurs annonces pour un même bien** : source (panneau, Immoweb, autre agence,
  particulier…), lien, agence concurrente, **historique des prix** (baisses), **date de première
  apparition → « en vente depuis 142 jours »**, statut de l'annonce (en ligne, retirée, vendue).
  C'est l'argument n° 1 face à un vendeur fatigué ou pour négocier un achat.
- **Fin probable du mandat concurrent** : quand un bien est chez une autre agence, relance
  automatique proposée à 3 mois et à 6 mois (durées habituelles des mandats), le moment
  où le vendeur est le plus ouvert.
- **Plusieurs propriétaires et liens entre personnes** : couples, **indivisions et
  successions** (très fréquent pour les maisons vides : 3 héritiers, dont un décideur),
  voisins informateurs, notaire de la succession. → rôles sur le bien + lien entre contacts.
- **Recherche du propriétaire** (maisons vides) : une liste d'étapes cochables avec dates :
  voisins interrogés, lettre déposée dans la boîte, demande d'extrait cadastral
  (SPF Finances / MyMinfin), commune, notaire, réseaux sociaux. Chaque étape a son résultat.
- **Lettre de prospection** prête à imprimer (PDF à l'adresse du bien : « Madame, Monsieur
  le propriétaire… »), journalisée comme interaction « Courrier ».

### C3. Au téléphone (relances)
- **Planifier une relance sans attendre l'étape 4** : un champ « Prochaine relance »
  (+1 sem., +1 mois, +3 mois, +6 mois, date) dans le formulaire et sur la fiche. (A7)
- **Résultats d'appel réalistes** en plus de ceux prévus : *Pas de réponse*, *Messagerie*
  (message laissé ou non), *Numéro erroné*, *Rappeler à une heure précise*. Pas de réponse
  → relance automatique le lendemain ; **compteur de tentatives** (« 3ᵉ essai »).
- **Créneaux** : « préfère être appelé après 18 h », « ne pas appeler le mercredi ».
- **Session d'appels** (prévue étape 6) : je propose d'y ajouter un **objectif du jour**
  (ex. 20 appels) avec une jauge de progression.

### C4. Investisseur (décision d'achat)
- **Calculette de rentabilité** sur la fiche bien : prix, droits d'enregistrement wallons,
  frais de notaire estimés, travaux, loyer estimé → **rendement brut/net**, prix au m²,
  comparaison avec la **médiane Statbel du quartier** (déjà prévue en 4 bis).
- **Offre** : montant proposé, date, réponse, contre-offre → historique de négociation.
- **Score de potentiel** (prévu étape 12) : j'y ajouterais durée de mise en vente, nombre
  de baisses de prix, indices d'inoccupation, écart avec le prix médian du quartier.

### C5. Conformité (à ne pas oublier)
- **Origine de la donnée** (RGPD art. 14) : pour chaque contact prospecté, noter d'où vient
  le numéro (panneau, annonce, voisin…). Je propose de le remplir **automatiquement** à
  partir de la source de la piste.
- **Liste « Ne m'appelez plus » (DNCM)** : pour la prospection téléphonique de particuliers,
  la liste belge DNCM doit être respectée. Je propose une case « inscrit DNCM » bloquant
  les appels de prospection (vérification manuelle ; l'accès officiel à la liste est payant).
  À valider avec votre conseiller juridique / l'IPI.

### C6. Confort quotidien
- **Tri** de la liste : prochaine relance, dernier contact, date d'ajout, nom. (A9)
- **Recherche tolérante aux fautes** et **dans les notes et tags**. (A5, A6)
- **Avertissement avant de quitter** un formulaire modifié + **brouillon** conservé. (A8)
- **« Annuler »** pendant 5 secondes après un archivage.
- **Récemment consultés** en haut de la recherche.
- **Codes postaux belges** : localité remplie automatiquement, liste des sections de
  Charleroi (Marcinelle, Jumet, Gosselies…). (A10)
- **Envoyer une annonce vers Linkimmo depuis « Partager »** (Android ; iPhone : copier-coller).

---

## D. Priorités proposées

**Tout de suite (avant l'étape 3, environ 1 étape de travail)**
1. Anti-doublons niveaux 1 à 5 : fiches similaires en direct, email, nom phonétique,
   adresse normalisée, CP → localité. (A1-A4, A10)
2. Champ « Prochaine relance » + « Dernier contact » éditables. (A7)
3. Tri de la liste, recherche tolérante aux fautes et dans les notes. (A5, A6, A9)
4. Téléphone en premier, avertissement avant de quitter, email vérifié en français. (A8, A11, A12)

**Dans les étapes déjà prévues (sans les rallonger beaucoup)**
- Étape 3 : contrôle des doublons après synchronisation + fusion guidée (avancée de l'étape 12).
- Étape 4 : résultats « pas de réponse / messagerie / numéro erroné », tentatives, créneaux.
- Étape 5 : formulaire terrain court, « Autour de moi », indices d'inoccupation, origine de la
  donnée, sources « autre agence » et « particulier », annonce reconnue par son lien.
- Étape 7 : fiche bien complète, plusieurs annonces par bien avec historique des prix et
  « en vente depuis X jours », propriétaires multiples / succession, recherche du propriétaire,
  lettre de prospection.
- Étape 10 : calculette de rentabilité branchée sur les médianes Statbel.

**Options, à décider plus tard**
- Lecture automatique du numéro sur la photo de l'affiche.
- Note vocale.
- Partage Android vers Linkimmo.
- Case DNCM (à valider juridiquement).
- Objectif d'appels du jour, offres et contre-offres.
