# Relier Prospect’Immo à Google Agenda — guide pas à pas

Durée : environ 15 minutes, une seule fois pour toute l'équipe. Gratuit.

## Ce que fait la liaison

- Chaque utilisateur relie **son propre** compte Gmail. Prospect’Immo crée dans son Google Agenda un
  calendrier séparé nommé **« Prospect’Immo »** : vos autres calendriers ne sont ni lus ni modifiés.
- Vos **relances** (« 📞 Relancer Marc Dupont ») et vos **rendez-vous** y apparaissent, avec un
  rappel sur le téléphone, le numéro à appeler et un lien vers la fiche.
- Dans les deux sens : si vous **déplacez** une relance dans Google Agenda, la date change dans
  Prospect’Immo ; si vous la **supprimez**, la fiche passe dans « Sans prochaine action » (rien n'est perdu) ;
  un rendez-vous **ajouté à la main** dans le calendrier « Prospect’Immo » entre dans l'agenda de l'application.
- Si la même chose est modifiée des deux côtés en même temps, c'est la version de Prospect’Immo qui est gardée.
- **Estimations du secrétariat** : tout rendez-vous dont le titre commence par **« Estimation »**,
  dans votre agenda ou dans celui de la secrétaire (partagé avec vous), arrive dans Prospect’Immo,
  dans la liste **« À encoder »** de la page Aujourd'hui (voir plus bas).

## Ce dont j'ai besoin à la fin

Uniquement l'**ID client** (il ressemble à `123456789-abc…apps.googleusercontent.com`).
Il est public : ce n'est pas un mot de passe.
**N'envoyez jamais le « code secret du client »** (Client secret) : Prospect’Immo n'en a pas besoin.

---

## Étape 1 — Créer le projet Google

1. Ouvrez <https://console.cloud.google.com> et connectez-vous avec votre compte Gmail.
2. Acceptez les conditions si Google le demande.
3. En haut, cliquez sur le sélecteur de projet → **Nouveau projet**.
4. Nom : `ProspectImmo` (sans apostrophe) → **Créer**. Attendez quelques secondes, puis sélectionnez ce projet.

## Étape 2 — Activer Google Agenda

1. Dans la barre de recherche en haut, tapez **Google Calendar API**.
2. Ouvrez le résultat, puis cliquez sur **Activer**.

## Étape 3 — L'écran d'autorisation

1. Recherchez **Google Auth Platform** (ou « Écran de consentement OAuth ») et ouvrez-le.
2. Cliquez sur **Commencer** :
   - Nom de l'application : `ProspectImmo`
   - Adresse e-mail d'assistance : votre Gmail
   - Audience : **Externe**
   - Coordonnées : votre Gmail
   - Acceptez le règlement → **Créer**.
3. Menu **Audience** → **Utilisateurs tests** → **Add users** : ajoutez les adresses Gmail des
   4 utilisateurs de Prospect’Immo (vous compris) → **Enregistrer**.
   > L'application reste en mode « Test » : c'est normal et suffisant pour une petite équipe
   > (jusqu'à 100 personnes). Aucune validation par Google n'est nécessaire.

## Étape 4 — Créer l'ID client

1. Menu **Clients** → **Créer un client**.
2. Type d'application : **Application Web**. Nom : `ProspectImmo`.
3. **Origines JavaScript autorisées** → **Ajouter un URI** :
   - l'adresse de votre application Netlify, par exemple `https://prospectimmo-charleroi.netlify.app`
     (sans « / » à la fin) ;
   - plus tard, l'adresse définitive (nom de domaine) quand elle existera.
4. Laissez « URI de redirection autorisés » vide → **Créer**.
5. Copiez l'**ID client** et envoyez-le-moi. Je l'ajoute à la configuration et je publie la mise à jour.

## Étape 5 — Dans Prospect’Immo (chaque utilisateur)

1. **Plus → Paramètres → Google Agenda → Connecter.**
2. Choisissez votre compte Gmail.
3. Google affiche « Google n'a pas validé cette application » : c'est normal (mode Test).
   Cliquez sur **Continuer**.
4. Cochez les trois autorisations (créer le calendrier Prospect’Immo, voir la liste de vos agendas,
   voir les événements de vos agendas) → **Continuer**.
   La troisième sert uniquement à repérer les « Estimation… » ; Prospect’Immo ne modifie jamais
   vos autres agendas.
5. Le calendrier « Prospect’Immo » apparaît dans votre Google Agenda en quelques secondes.

Sur le téléphone, ouvrez l'application Google Agenda → menu → vérifiez que **Prospect’Immo** est coché.

## Les estimations notées par la secrétaire

1. **La secrétaire partage son agenda avec vous** (une seule fois, sur ordinateur) :
   Google Agenda → à gauche, survolez son agenda → **⋮ → Paramètres et partage** →
   **Partager avec des personnes spécifiques** → **Ajouter** → votre adresse Gmail →
   autorisation **« Afficher tous les détails des événements »** → **Envoyer**.
   Vous acceptez l'invitation reçue par e-mail.
   *(Autre possibilité : vous partagez votre agenda avec elle, avec « Modifier les événements »,
   et elle note les estimations directement dans votre agenda.)*
2. Elle note le rendez-vous en commençant le titre par **« Estimation »**, par exemple :
   `Estimation – M. Lambert 0475 12 34 56 – Rue de Gosselies 12, Jumet`
   (les coordonnées peuvent aussi être dans le lieu ou la description).
3. Dans Prospect’Immo : **Paramètres → Google Agenda → Estimations du secrétariat** : vérifiez que
   son agenda est coché (tous les agendas le sont au départ ; décochez ceux à ignorer).
4. Le rendez-vous apparaît dans **Aujourd'hui → À encoder**, avec le nom, le téléphone et
   l'adresse repérés. **Créer la fiche** ouvre le formulaire déjà rempli (vous corrigez et
   enregistrez) ; si le numéro est déjà connu, **Relier** suffit. **Ignorer** le retire de la liste.
5. Ensuite, si elle déplace le rendez-vous dans Google, il se déplace dans Prospect’Immo ; si elle le
   supprime (ou retire « Estimation » du titre), il est retiré de Prospect’Immo (archivé, jamais effacé).
   Vos propres corrections (titre, notes, fiche reliée) ne sont pas écrasées.

Les estimations sont lues de la veille jusqu'à 6 mois à l'avance, à chaque synchronisation
(à l'ouverture de l'application, puis toutes les 5 minutes tant qu'elle est ouverte).

## Bon à savoir

- **Reconnexion** : pour des raisons de sécurité, Google donne à l'application un accès valable
  1 heure. Quand il expire, l'application affiche **« Reconnecter »** : un appui suffit (pas de
  mot de passe à retaper). Les changements faits entre-temps partent à la reconnexion.
  Si cela devient gênant, une version « toujours connectée » est possible plus tard
  (elle demande une petite fonction sur le serveur Supabase).
- **Déconnecter** (Paramètres) n'efface rien, ni dans Google ni dans Prospect’Immo.
- Les **données de démonstration** ne sont jamais envoyées dans Google Agenda.
- Les relances de plus de 30 jours de retard ne sont pas envoyées (elles restent dans Prospect’Immo).
