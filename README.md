# Site internet Immo Vision

Site vitrine de l'agence **Immo Vision** (Charleroi), aux couleurs de la marque : jaune, noir et blanc.
Le site est en HTML, CSS et JavaScript, sans outil ni base de données à installer : il fonctionne chez n'importe quel hébergeur (OVH, Combell, one.com, Netlify, GitHub Pages…).

## Pages

| Fichier | Contenu |
|---|---|
| `index.html` | Accueil : bandeau, recherche, derniers biens, estimation, services, agence, chiffres, avis Google, blog |
| `biens-a-vendre.html` | Biens à vendre avec filtres (type, commune, budget, chambres) |
| `biens-a-louer.html` | Biens à louer avec filtres |
| `agence.html` | Présentation de l'agence et d'Adem Özbek, services, méthode en 5 étapes |
| `estimation.html` | Formulaire de demande d'estimation gratuite |
| `blog.html` | Articles (liens vers les articles existants sur immobiliervision.be) |
| `contact.html` | Coordonnées, horaires, formulaire, plan Google Maps |
| `mentions-legales.html` | Mentions légales, IPI, vie privée (RGPD), cookies |

## Ajouter ou modifier un bien

Tout se passe dans **`js/biens.js`** : chaque bien est un bloc `{ ... }` (transaction, type, titre, commune, prix, chambres, surface, PEB, photo, lien).
Les photos vont dans `images/biens/`.

> Plus tard, cette liste pourra être alimentée automatiquement par votre logiciel immobilier (Whise, Omnicasa, Sweepbright…) ou par un flux Immoweb.

## À compléter avant la mise en ligne

- [ ] **Biens** : prix, communes, caractéristiques et photos réelles dans `js/biens.js` (seules les rues étaient connues).
- [ ] **Photos** : remplacer `images/hero.svg` (bandeau d'accueil) et `images/agence.svg` (photo d'Adem / de l'agence) par de vraies photos.
- [ ] **Logo** : remplacer le logo dessiné dans l'en-tête par le logo officiel, si vous en avez un.
- [ ] **Mentions légales** : numéro BCE, numéro de TVA, assurance RC professionnelle et hébergeur (repérés par `[À COMPLÉTER]`).
- [ ] **Téléphone fixe** : vérifier le 071 11 53 91 (trouvé sur la fiche IPI).
- [ ] **Formulaires** : pour l'instant, ils ouvrent la messagerie du visiteur. Pour un envoi direct, indiquer une adresse d'envoi dans l'attribut `action` du formulaire (Formspree, Netlify Forms ou script PHP chez l'hébergeur).
- [ ] **Facebook** : ajouter le lien s'il existe une page (seul Instagram est présent).

## Voir le site en local

Ouvrez `index.html` dans un navigateur, ou lancez `python3 -m http.server` dans ce dossier puis ouvrez http://localhost:8000.
