# Notifications sur le téléphone — mise en place

Durée : environ 20 minutes, **une seule fois** (par l'administrateur). Gratuit.
À faire après l'installation du serveur Supabase (`GUIDE_INSTALLATION.md`).

## Ce que vous recevrez

- **📞 Relance** à l'heure prévue : « Relancer Marc Dupont — Téléphone : 0472 18 90 33 ».
  Un appui ouvre directement la fiche.
- **📅 Rendez-vous** 30 minutes avant (réglable : à l'heure, 15 min, 1 h, 2 h).
- **Résumé du matin** à 8 h 30 (réglable) : « Bonjour ! 5 relances, 2 rendez-vous aujourd'hui ».
  Pas le week-end, sauf si vous le demandez.
- Une **pastille** sur l'icône de Prospect’Immo indique le nombre de relances à traiter.

Chacun ne reçoit que **ses** relances (fiches qui lui sont attribuées, ou qu'il a créées).
Une notification n'est jamais envoyée deux fois.

## Comment ça marche (en bref)

Toutes les 5 minutes, le serveur regarde ce qui est dû et envoie les notifications aux
téléphones abonnés. Les téléphones n'ont donc pas besoin d'avoir l'application ouverte.
Tant que cette mise en place n'est pas faite, l'application affiche déjà les rappels
**quand elle est ouverte** (pratique sur l'ordinateur du bureau).

## Étape 1 — Mettre à jour la base

Supabase → **SQL Editor** → **New query** → collez tout le fichier `supabase/installation.sql`
→ **Run**. (Il peut être relancé sans risque : il ne modifie pas vos données.)

## Étape 2 — Générer les clés

1. Dans Prospect’Immo : **Plus → Paramètres → Notifications → Mise en place → Générer les clés**.
2. Deux clés s'affichent. Les clés sont créées sur votre appareil ; rien n'est envoyé.
   - **Clé publique** : à m'envoyer (elle n'est pas secrète).
   - **Clé privée** : à coller **uniquement** dans Supabase (étape 4). Ne l'envoyez à personne.

## Étape 3 — Installer la fonction d'envoi

1. Supabase → **Edge Functions** → **Deploy a new function** → **Via Editor**.
2. Nom : `rappels-push`.
3. Effacez l'exemple et collez le contenu du fichier `supabase/functions/rappels-push/index.ts`.
4. **Deploy**.
5. Ouvrez la fonction → **Details / Settings** → désactivez **« Verify JWT » (Enforce JWT
   verification)** → enregistrez. (La fonction est protégée par son propre mot de passe, étape 4.)

## Étape 4 — Les secrets de la fonction

Supabase → **Edge Functions** → **Secrets** → ajoutez :

| Nom | Valeur |
|---|---|
| `VAPID_PUBLIC_KEY` | la clé publique (étape 2) |
| `VAPID_PRIVATE_KEY` | la clé privée (étape 2) |
| `VAPID_SUJET` | `mailto:` suivi de votre adresse, ex. `mailto:prenom.nom@gmail.com` |
| `CLE_PLANIFICATION` | un mot de passe long inventé par vous (ex. 30 caractères au hasard) |

## Étape 5 — Lancer l'envoi toutes les 5 minutes

1. Supabase → **Integrations** → **Cron** → activez-le si demandé.
2. **Create job** :
   - Nom : `rappels-push`
   - Planification : `*/5 * * * *` (toutes les 5 minutes)
   - Type : **Supabase Edge Function** → méthode **POST** → fonction `rappels-push`
   - **En-tête HTTP** (Header) : nom `x-linkimmo-cle`, valeur = le même mot de passe que
     `CLE_PLANIFICATION`
   - Délai : 30 secondes → **Create**.

## Étape 6 — Chaque utilisateur

1. Installer l'application sur le téléphone : **Plus → Installer l'application** (indispensable
   sur iPhone, iOS 16.4 ou plus récent).
2. Ouvrir Prospect’Immo **depuis l'icône**, se connecter.
3. **Plus → Paramètres → Notifications → Activer** → accepter.
   Une notification d'essai s'affiche ; la mention « même application fermée » confirme
   l'abonnement au serveur.

## En cas de souci

- *Rien ne s'affiche sur iPhone* : l'application doit être ouverte depuis l'icône de l'écran
  d'accueil (pas depuis Safari). Réglages iPhone → Notifications → Prospect’Immo → Autoriser.
- *« Notifications bloquées »* : réglages du téléphone ou du navigateur → Prospect’Immo →
  Notifications → Autoriser, puis « Activer » à nouveau.
- Dans Supabase → Edge Functions → `rappels-push` → **Logs** : chaque passage affiche le nombre
  de notifications envoyées.
