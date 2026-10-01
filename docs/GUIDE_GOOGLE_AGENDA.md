# Relier Linkimmo à Google Agenda — guide pas à pas

Durée : environ 15 minutes, une seule fois pour toute l'équipe. Gratuit.

## Ce que fait la liaison

- Chaque utilisateur relie **son propre** compte Gmail. Linkimmo crée dans son Google Agenda un
  calendrier séparé nommé **« Linkimmo »** : vos autres calendriers ne sont ni lus ni modifiés.
- Vos **relances** (« 📞 Relancer Marc Dupont ») et vos **rendez-vous** y apparaissent, avec un
  rappel sur le téléphone, le numéro à appeler et un lien vers la fiche.
- Dans les deux sens : si vous **déplacez** une relance dans Google Agenda, la date change dans
  Linkimmo ; si vous la **supprimez**, la fiche passe dans « Sans prochaine action » (rien n'est perdu) ;
  un rendez-vous **ajouté à la main** dans le calendrier « Linkimmo » entre dans l'agenda de l'application.
- Si la même chose est modifiée des deux côtés en même temps, c'est la version de Linkimmo qui est gardée.

## Ce dont j'ai besoin à la fin

Uniquement l'**ID client** (il ressemble à `123456789-abc…apps.googleusercontent.com`).
Il est public : ce n'est pas un mot de passe.
**N'envoyez jamais le « code secret du client »** (Client secret) : Linkimmo n'en a pas besoin.

---

## Étape 1 — Créer le projet Google

1. Ouvrez <https://console.cloud.google.com> et connectez-vous avec votre compte Gmail.
2. Acceptez les conditions si Google le demande.
3. En haut, cliquez sur le sélecteur de projet → **Nouveau projet**.
4. Nom : `Linkimmo` → **Créer**. Attendez quelques secondes, puis sélectionnez ce projet.

## Étape 2 — Activer Google Agenda

1. Dans la barre de recherche en haut, tapez **Google Calendar API**.
2. Ouvrez le résultat, puis cliquez sur **Activer**.

## Étape 3 — L'écran d'autorisation

1. Recherchez **Google Auth Platform** (ou « Écran de consentement OAuth ») et ouvrez-le.
2. Cliquez sur **Commencer** :
   - Nom de l'application : `Linkimmo`
   - Adresse e-mail d'assistance : votre Gmail
   - Audience : **Externe**
   - Coordonnées : votre Gmail
   - Acceptez le règlement → **Créer**.
3. Menu **Audience** → **Utilisateurs tests** → **Add users** : ajoutez les adresses Gmail des
   4 utilisateurs de Linkimmo (vous compris) → **Enregistrer**.
   > L'application reste en mode « Test » : c'est normal et suffisant pour une petite équipe
   > (jusqu'à 100 personnes). Aucune validation par Google n'est nécessaire.

## Étape 4 — Créer l'ID client

1. Menu **Clients** → **Créer un client**.
2. Type d'application : **Application Web**. Nom : `Linkimmo`.
3. **Origines JavaScript autorisées** → **Ajouter un URI** :
   - l'adresse de votre application Netlify, par exemple `https://linkimmo-charleroi.netlify.app`
     (sans « / » à la fin) ;
   - plus tard, l'adresse définitive (nom de domaine) quand elle existera.
4. Laissez « URI de redirection autorisés » vide → **Créer**.
5. Copiez l'**ID client** et envoyez-le-moi. Je l'ajoute à la configuration et je publie la mise à jour.

## Étape 5 — Dans Linkimmo (chaque utilisateur)

1. **Plus → Paramètres → Google Agenda → Connecter.**
2. Choisissez votre compte Gmail.
3. Google affiche « Google n'a pas validé cette application » : c'est normal (mode Test).
   Cliquez sur **Continuer**.
4. Cochez les deux autorisations (créer le calendrier Linkimmo, voir la liste de vos agendas)
   → **Continuer**.
5. Le calendrier « Linkimmo » apparaît dans votre Google Agenda en quelques secondes.

Sur le téléphone, ouvrez l'application Google Agenda → menu → vérifiez que **Linkimmo** est coché.

## Bon à savoir

- **Reconnexion** : pour des raisons de sécurité, Google donne à l'application un accès valable
  1 heure. Quand il expire, l'application affiche **« Reconnecter »** : un appui suffit (pas de
  mot de passe à retaper). Les changements faits entre-temps partent à la reconnexion.
  Si cela devient gênant, une version « toujours connectée » est possible plus tard
  (elle demande une petite fonction sur le serveur Supabase).
- **Déconnecter** (Paramètres) n'efface rien, ni dans Google ni dans Linkimmo.
- Les **données de démonstration** ne sont jamais envoyées dans Google Agenda.
- Les relances de plus de 30 jours de retard ne sont pas envoyées (elles restent dans Linkimmo).
