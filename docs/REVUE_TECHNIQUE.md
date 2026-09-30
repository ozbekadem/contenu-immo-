# Revue technique complète (30/09)

Relecture de A à Z de l'application (étapes 1 à 3), vérifiée par les tests automatiques
(114 tests de l'application, 9 scénarios SQL du serveur) et des parcours dans un vrai navigateur.

## Bugs corrigés

| # | Problème | Gravité | Correction |
|---|---|---|---|
| 1 | Formulaire ouvert pendant qu'un collègue modifie la même fiche : à l'enregistrement, **ses modifications étaient écrasées** (même sur les champs non touchés) | 🔴 perte de données | Seuls les champs réellement modifiés dans le formulaire sont envoyés ; vérifié avec deux onglets |
| 2 | Un appareil déconnecté à distance pouvait annuler lui-même sa déconnexion via le serveur | 🔴 sécurité | Seul un administrateur peut réactiver un appareil (contrôle côté serveur + test SQL) |
| 3 | On pouvait écrire au journal au nom d'un collègue | 🟠 traçabilité | Le serveur refuse un auteur différent de la personne connectée |
| 4 | Couleurs figées si l'application reste ouverte après minuit (l'« aujourd'hui » de la veille) | 🟠 | Recalcul au changement de jour et au retour dans l'application |
| 5 | Filtre « Sans contact depuis 6 mois » : une fiche créée hier et jamais appelée y apparaissait | 🟠 | Pour une fiche jamais contactée, on compte depuis sa création |
| 6 | Adresse effacée dans le formulaire → une adresse vide restait affichée sur la fiche | 🟡 | Adresse vide enregistrée comme « aucune adresse » |
| 7 | Modifier une fiche inexistante (lien périmé) → écran blanc | 🟡 | Message « Ce contact n'existe pas » + retour |
| 8 | Confirmations du navigateur (archiver, quitter…) : aspect différent selon le téléphone, et bloquées dans certains cadres | 🟡 | Fenêtre de confirmation intégrée à l'application |
| 9 | Lien d'annonce ouvert par `window.open` : peu fiable dans l'application installée sur iPhone | 🟡 | Ouverture par un vrai lien |
| 10 | Tuile « À jour » de l'accueil → ouvrait tous les contacts | 🟡 | Ouvre la liste filtrée « À jour » |
| 11 | Libellé « contact jamais » peu clair dans les listes | 🟡 | « jamais contacté » / « contacté il y a X jours » |
| 12 | Accessibilité : le nom lu de certains champs (liste « Origine ») incluait tout le texte des options | 🟡 | Libellés reliés précisément à leur champ |
| 13 | Connexion : messages d'erreur du navigateur en anglais | 🟡 | Messages en français |
| 14 | Boutons « Lien Internet » et « Contacté aujourd'hui » coupés sur petit écran | 🟡 | Mise en page corrigée |

## Ajouts

- **Origine du contact** (affiche, repérage, Immoweb, 2ememain, autre site, autre agence,
  recommandation, ancien client) : dans le formulaire, sur la fiche et dans la recherche.
- **3 nouveaux exemples de prospection** :
  1. affiche « À vendre » collée sur une fenêtre, Rue de la Montagne 88 à Charleroi :
     seul le numéro est connu, premier appel à faire aujourd'hui ;
  2. annonce 2ememain d'un particulier à Gosselies (M. Hermans), lien de l'annonce joint,
     baisse de prix notée, relance dans 2 jours ;
  3. Mme Renard, propriétaire bailleresse recommandée par un partenaire, à rappeler dans 3 mois.
- Prospect sans nom : affiché par son adresse, avec une maison dans l'avatar.

## Points à vérifier sur un vrai téléphone (pas testables ici)

- Ouverture d'un PDF joint dans l'application installée sur **iPhone** (limitation connue
  d'iOS avec les fichiers stockés localement ; une visionneuse intégrée sera ajoutée si besoin).
- Déconnexion à distance : l'appareil est prévenu à sa prochaine connexion ; pour couper
  immédiatement tout accès d'une personne, désactiver son compte (Supabase → table
  `profils` → `actif` = false).
