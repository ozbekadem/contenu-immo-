# Suivi de prospection immobilière

Application web autonome (aucun serveur, aucun compte nécessaire) pour suivre vos
prospects issus d'annonces immobilières et organiser vos tournées de dépôt de
flyers efficacement, quartier par quartier / commune par commune.

## Utiliser l'application

Ouvrez simplement `index.html` dans un navigateur (double-clic, ou hébergez le
dossier sur GitHub Pages / Netlify / un simple serveur statique pour y accéder
depuis votre téléphone).

Les données sont stockées **localement dans le navigateur** (`localStorage`).
Pensez à faire un export régulier (onglet Ajouter → Sauvegarde / Restauration)
pour ne rien perdre, ou pour transférer vos données vers un autre appareil
(ex. saisie sur ordinateur depuis vos captures d'écran, puis import sur le
téléphone pour la tournée terrain).

## Fonctionnement

1. **Ajouter** un prospect : adresse relevée sur une annonce/capture d'écran,
   commune et quartier (le regroupement se fait sur ces deux champs — utilisez
   des noms cohérents, l'auto-complétion vous aide). Vous pouvez aussi coller
   une liste d'adresses d'un coup (ajout groupé) si plusieurs biens se trouvent
   dans le même quartier.
2. **Liste** : les prospects sont regroupés par commune / quartier, pour que
   vous puissiez traiter un secteur en entier en un seul déplacement. Chaque
   groupe peut être trié automatiquement par rue/numéro, ou réordonné à la main
   par glisser-déposer pour définir l'ordre exact de votre tournée à pied.
   Marquez un prospect "Flyer déposé ✓" en un clic.
3. **Carte** : géolocalise vos adresses (bouton dédié, gratuit via
   OpenStreetMap/Nominatim) et affiche les prospects sur une carte, colorés par
   statut, pour visualiser d'un coup d'œil les secteurs à couvrir.
4. **Feuille de route** : bouton "🖨️ Feuille de route" dans l'onglet Liste
   pour imprimer (ou exporter en PDF) la liste filtrée/groupée, pratique en cas
   de mauvaise connexion sur le terrain.
5. **Stats** : avancement de la prospection par statut et par commune.

## Statuts

- **À prospecter** : pas encore traité.
- **Flyer déposé** : flyer mis dans la boîte aux lettres (date enregistrée
  automatiquement).
- **Contact établi** : vous avez pu parler au propriétaire/occupant.
- **À revisiter** : personne présent, à repasser.
- **Pas intéressé**.

## Ajouter des adresses à partir de vos captures d'écran

Partagez vos captures d'écran d'annonces dans la conversation : les adresses
lisibles sur l'annonce seront extraites et ajoutées pour vous (commune/quartier
partagé quand plusieurs annonces sont dans le même secteur). Pour les annonces
où l'adresse exacte n'est pas visible, ajoutez-la vous-même via le formulaire
ou l'ajout groupé une fois que vous l'aurez repérée sur place.

## Détails techniques

- Aucune dépendance à installer : HTML/CSS/JS vanilla + [Leaflet](https://leafletjs.com/)
  (carte) chargé depuis un CDN.
- Géocodage via [Nominatim](https://nominatim.org/) (OpenStreetMap), gratuit,
  avec une limite polie d'~1 requête/seconde respectée automatiquement.
- Export/Import JSON pour sauvegarde et transfert entre appareils ; export CSV
  pour ouvrir la liste dans un tableur.
