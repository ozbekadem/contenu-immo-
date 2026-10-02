# Guide d'installation — serveur et mise en ligne

Environ **20 minutes**, une seule fois. Tout est gratuit pendant la phase de test.
Les écrans de Supabase et Netlify sont en anglais : les mots exacts à chercher sont
indiqués **en gras**.

> 🔒 **Ne m'envoyez jamais** : le mot de passe de la base de données, ni la clé
> « **secret** » / « **service_role** ». Je n'ai besoin que de deux informations
> publiques (partie 1, étape 7).

---

## Partie 1 — Supabase (base de données, connexion, fichiers)

1. Allez sur **supabase.com** → **Start your project** → **Continue with GitHub**
   (le même compte GitHub que pour le projet) et acceptez.
2. Si on vous demande une organisation : le nom de votre choix (par ex. `Linkimmo`), plan **Free** → **Create organization**.
3. **New project** :
   - **Name** : `linkimmo`
   - **Database Password** : cliquez **Generate a password**, puis **copiez-le dans un endroit sûr**
     (gestionnaire de mots de passe). Ne le partagez avec personne.
   - **Region** : **Central EU (Frankfurt)** — obligatoire pour le RGPD
   - → **Create new project** (patientez ± 2 minutes).
4. Installer la base :
   - Ouvrez sur GitHub le fichier `supabase/installation.sql` du projet → bouton **Raw** →
     sélectionnez tout et copiez.
   - Dans Supabase, menu de gauche **SQL Editor** → **New query** → collez → **Run**.
   - Le message **Success. No rows returned** doit apparaître.
5. Réserver l'accès à l'agence : menu **Authentication** → **Sign In / Providers** →
   désactivez **Allow new users to sign up** → **Save**.
   (Ainsi, seules les personnes que vous ajoutez peuvent se connecter.)
6. Créer votre compte : **Authentication** → **Users** → **Add user** → **Create new user** :
   votre email, un mot de passe (8 caractères minimum), cochez **Auto Confirm User** → **Create user**.
   Le **premier compte créé devient automatiquement administrateur**.
7. Me transmettre les 2 informations publiques : menu **Project Settings** (roue dentée) → **API Keys**
   (ou bouton **Connect** en haut) :
   - **Project URL** : ressemble à `https://abcdefgh.supabase.co`
   - **Publishable key** (ou **anon public** dans l'ancien écran) : commence par `sb_publishable_` ou `eyJ`
   Envoyez-les-moi ici. Ce sont des valeurs publiques, prévues pour être dans l'application.

## Partie 2 — Netlify (mise en ligne de l'application)

1. Allez sur **netlify.com** → **Sign up** → **Sign up with GitHub**.
2. **Add new project** (ou **Add new site**) → **Import an existing project** → **GitHub** →
   autorisez l'accès au dépôt `contenu-immo-`.
3. Choisissez le dépôt `ozbekadem/contenu-immo-`, puis :
   - **Branch to deploy** : `claude/linkimmo-proposition`
   - le reste est rempli automatiquement → **Deploy**.
4. Donnez un joli nom : **Project configuration** → **Change project name** → par exemple
   `linkimmo-charleroi`. L'adresse devient `https://linkimmo-charleroi.netlify.app`.
5. Envoyez-moi cette adresse.
6. Retour dans Supabase : **Authentication** → **URL Configuration** :
   - **Site URL** : votre adresse Netlify
   - **Redirect URLs** → **Add URL** : la même adresse suivie de `/**`

Chaque nouvelle version que j'envoie sur GitHub est mise en ligne **automatiquement** en 1 à 2 minutes.

## Partie 3 — Installer l'application sur votre téléphone

- **iPhone** (Safari obligatoire) : ouvrez l'adresse → bouton **Partager** ⬆️ →
  **Sur l'écran d'accueil** → **Ajouter**.
- **Android** (Chrome) : ouvrez l'adresse → menu **⋮** → **Installer l'application**.
- **Ordinateur** (Chrome ou Edge) : icône d'installation ⊕ à droite de la barre d'adresse.

Le même guide, illustré, se trouve dans l'application : **Plus** → **Installer l'application**.

## Partie 4 — Ajouter la secrétaire et les stagiaires

1. Supabase → **Authentication** → **Users** → **Add user** → **Create new user** :
   leur email + un mot de passe provisoire, cochez **Auto Confirm User**.
2. Communiquez-leur l'adresse de l'application et ce mot de passe provisoire (de vive voix).
3. Choisir leur rôle : dans l'application, **Plus** → **Équipe** (administrateur seulement) :
   administrateur, collaborateur ou stagiaire.

> ℹ️ **Emails automatiques (invitation, mot de passe oublié)** : le service d'envoi gratuit
> intégré à Supabase n'envoie qu'aux membres de l'équipe Supabase et en petite quantité.
> C'est pourquoi on crée les comptes avec un mot de passe (étape 1). Pour activer les emails
> vers tout le monde, il faudra brancher un service d'envoi gratuit (Brevo, 300 emails/jour) :
> je vous guiderai quand ce sera utile.

## Téléphone perdu ?

Dans l'application : **Plus** → **Paramètres** → **Compte et synchronisation** → à côté de
l'appareil, **Déconnecter**. Ses données sont effacées dès qu'il se reconnecte à Internet.
Un **code de verrouillage** sur chaque téléphone reste indispensable ; Linkimmo peut en plus
demander son propre code ou Face ID : **Paramètres** → **Verrouillage**.

## Coûts

Tout est gratuit pendant la phase de test (Supabase Free + Netlify Free). Pour l'utilisation
réelle, je conseille Supabase **Pro** (± 25 $/mois) : sauvegardes quotidiennes et pas de mise en
veille (l'offre gratuite se met en pause après 7 jours sans utilisation).
