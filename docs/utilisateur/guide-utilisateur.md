# Guide d'utilisation — Innov'Events Manager

Un parcours par profil : visiteur, client, employé (site web et application mobile), administratrice. Les captures d'écran de référence sont les maquettes de `docs/conception/CO-10-maquettes.pdf`.

**À savoir** : les services sont hébergés sur des offres gratuites mises en veille après 15 minutes sans visite. Si la page « Le service est momentanément indisponible » apparaît à la première visite après une période d'inactivité, l'API peut être en veille. Pour la réveiller : ouvrir un nouvel onglet, garder le nom de domaine du site ou de l'application mobile et remplacer le reste de l'adresse par `/api/sante` (adresse de la forme `https://<domaine du site>/api/sante`). Pendant le réveil, cet onglet peut afficher une erreur (502) : le recharger après une minute, jusqu'à une réponse contenant `"statut":"ok"`, puis recharger la page du site ou de l'application. Une réponse contenant `"statut":"degrade"` signale une base de données momentanément indisponible : réessayer quelques minutes plus tard. Si le message apparaît juste après l'envoi d'un formulaire, alors que le reste du site répond, voir la dernière question de la section 6.

## 1. Visiteur

| Pour… | Faire |
|---|---|
| Découvrir l'agence | Page d'accueil ; menu en haut de chaque page : Accueil, Événements, Avis, Contact, Demander un devis, Connexion |
| Voir des réalisations | **Événements** : filtres par période, type et thème ; **Rechercher**, puis ouvrir une carte pour le détail et la section « Prestations et Devis ». Aucun prix n'est affiché |
| Lire les avis | **Avis** : avis validés par l'équipe, sans nom de client |
| Demander un devis | **Demander un devis** (accueil ou menu) : entreprise, nom, prénom, e-mail, téléphone, lieu souhaité, date souhaitée, type d'événement, nombre de participants, description du besoin. Tous les champs sont obligatoires ; une erreur s'affiche sous le champ concerné. Après l'envoi, un message de remerciement confirme l'enregistrement : ne pas renvoyer la demande. Aucun compte n'est nécessaire |
| Écrire à l'agence | **Contact** : titre et message ; l'e-mail est obligatoire si le nom d'utilisateur n'est pas renseigné |
| Créer un compte | **Connexion** → **Créer un compte** : e-mail, mot de passe, prénom, nom, nom d'utilisateur. Le mot de passe contient au moins 8 caractères, dont une majuscule, une minuscule, un chiffre et un caractère spécial |
| Lire les conditions | Pied de page : mentions légales, CGU, CGV, politique de confidentialité |

Une demande de devis ne crée pas de compte. À l'envoi du premier devis, l'e-mail du devis suit l'un de ces trois cas :

- aucun compte n'existe à l'adresse de contact : le compte est créé et l'e-mail contient un mot de passe temporaire ;
- un compte existe déjà à cette adresse sans être rattaché à une fiche client (inscription faite auparavant) : il est rattaché à la fiche à cette occasion, son ancien mot de passe cesse de fonctionner, ses sessions sont fermées et l'e-mail contient un mot de passe temporaire ;
- le compte est déjà rattaché à la fiche (devis précédent) : aucun mot de passe n'est envoyé, garder ses identifiants.

## 2. Client

### Se connecter

1. **Connexion** : e-mail et mot de passe.
2. Avec un mot de passe temporaire (reçu avec le premier devis, y compris pour un compte déjà inscrit, ou après **Mot de passe oublié ?**) : la page « Choisir un nouveau mot de passe » s'impose ; choisir son mot de passe dans les 15 minutes. Un mot de passe temporaire ne sert qu'une fois ; une fois expiré (7 jours après l'envoi d'un devis, environ 1 heure après un oubli), passer par **Mot de passe oublié ?**.
3. Le menu de l'espace client s'affiche : Accueil, Mes devis, Mes événements, Mon profil.

### Suivre sa demande et ses événements

- **Accueil** : les 3 prochains événements et le suivi de la demande (demande reçue, prise en charge, événement, devis envoyé avec sa date). Une demande apparaît dans ce suivi une fois convertie par l'agence et rattachée à la fiche client ; si elle est classée sans suite, un e-mail l'indique.
- **Mes événements** : statut de chaque événement.

### Répondre à un devis

1. **Mes devis** : liste des devis reçus et leur statut ; **Ouvrir** pour le détail des prestations, HT, TVA et TTC ; **Télécharger le PDF**.
2. Choisir la réponse : accepter, demander une modification (motif obligatoire) ou refuser, puis **Valider ma réponse**.
3. Après une acceptation, les autres formules du même événement passent à « refusé » ; un événement en brouillon passe à « accepté », un événement déjà en cours garde son statut. Après une demande de modification, l'agence renvoie une nouvelle proposition.
4. Pour un événement annulé ou terminé, un devis encore en étude peut seulement être refusé.

### Évaluer un événement et autoriser sa publication

- **Mes événements**, événement terminé : note de 1 à 5 et commentaire. L'avis est publié sur la page Avis après validation par l'équipe, sans nom.
- Accord de publication : l'activer autorise l'agence à présenter l'événement sur la page Événements (sans prix) ; le retirer le retire de la page.

### Gérer ses données

- **Mon profil** : « Mon compte » (identité et adresse de connexion) et « Mes coordonnées » (fiche de l'entreprise). L'e-mail de contact de la fiche n'est pas modifiable par le client : le demander à l'agence. Changer l'adresse de connexion demande le mot de passe actuel.
- **Supprimer mon compte** (Mon profil) : mot de passe et confirmation demandés. Le compte est supprimé et la session fermée.
  - Compte rattaché à une fiche client : les coordonnées de la fiche et les demandes de devis liées sont effacées ; devis, événements et avis sont conservés sans nom. Si le service des journaux est momentanément indisponible, la suppression est refusée sans rien effacer : réessayer plus tard.
  - Compte créé par inscription, sans fiche client : seul le compte est supprimé.

## 3. Employé — site web

1. **Connexion** avec le compte créé par l'administratrice (mot de passe temporaire reçu par e-mail, à changer à la première connexion).
2. Menu de l'équipe : Clients, Événements, Mes tâches, Avis.

| Rubrique | Actions |
|---|---|
| Clients | Rechercher un client, ouvrir sa fiche : coordonnées, historique des événements |
| Événements | Liste et fiche détaillée ; dans la fiche : notes (ajouter, modifier, supprimer ses propres notes) et tâches |
| Mes tâches | Liste des tâches assignées. Pour avancer une tâche : **Ouvrir la fiche de l'événement**, puis **Démarrer** (« à faire » → « en cours ») ou **Terminer** (→ « terminé » ; une tâche terminée ne se rouvre pas) |
| Avis | Avis en attente : valider (publié) ou refuser |

Les rubriques réservées à l'administratrice n'apparaissent pas ; une adresse saisie à la main est refusée.

## 4. Employé — application mobile

1. Ouvrir l'adresse de l'application mobile dans le navigateur du téléphone et se connecter (mêmes identifiants que sur le site).
2. **Événements à venir** : liste triée par date ; recherche et filtre ; **Actualiser** pour recharger.
3. Toucher un événement : fiche (dates, lieu, client, statut, notes). **Ajouter une note** : saisir, enregistrer ; la note est aussi visible sur le site.
4. Depuis la fiche, ouvrir le client : **Appeler**, envoyer un e-mail ou lancer l'itinéraire vers son adresse (application du téléphone). Une coordonnée absente, par exemple pour un client anonymisé, désactive le bouton correspondant.
5. CGU et CGV accessibles depuis l'écran de connexion et la liste ; **Se déconnecter** depuis la liste.

## 5. Administratrice

Connexion avec le compte créé par script ; arrivée sur le **Tableau de bord** (chiffres clés, notes récentes, notes globales). Menu : Tableau de bord, Prospects, Clients, Événements, Devis, Tâches, Avis, Comptes, Journaux, Paramètres.

### Traiter une demande jusqu'au devis accepté

1. **Prospects** : liste des demandes, recherche et filtre par statut. Pour une demande irréalisable : **Classer sans suite**, saisir le message, **Envoyer et classer** (e-mail au demandeur).
2. **Convertir** : vérifier les coordonnées et saisir l'adresse postale (obligatoire). Si une fiche existe déjà avec la même adresse e-mail, l'écran affiche côte à côte l'entreprise et le contact de la demande et de la fiche : cocher la confirmation seulement s'il s'agit bien de la même entreprise ; sinon, classer la demande ou corriger la fiche. Si deux fiches portent la même adresse, corriger le doublon dans **Clients** avant de convertir.
3. La rubrique **Devis** s'ouvre sur l'événement prérempli : nom, dates, lieu, type, thème, statut (« Brouillon » par défaut, ou « Accepté » si l'accord est déjà obtenu), visibilité publique, image (adresse `https`). **Créer l'événement**.
4. **Créer le devis** (intitulé de la formule ; plusieurs formules possibles par événement), **Ajouter une prestation** (libellé, montant HT), **Enregistrer les prestations** : HT, TVA et TTC sont calculés.
5. **Télécharger le PDF** pour vérifier, puis **Envoyer au client** : e-mail avec le PDF.
   - Fiche encore sans compte : un compte est créé, ou un compte déjà inscrit à l'adresse de contact est rattaché à la fiche (son ancien mot de passe cesse de fonctionner) ; dans les deux cas, l'e-mail contient un mot de passe temporaire. Si l'envoi signale un conflit à l'adresse de contact (compte de l'équipe, compte suspendu ou rattaché à une autre fiche), vérifier l'adresse dans **Clients** et le compte correspondant dans **Comptes**, corriger les coordonnées si elles sont erronées, puis renvoyer.
   - Fiche qui a déjà un compte client actif : le devis est envoyé à son adresse de connexion, sans nouveau mot de passe. Si ce compte est suspendu, l'envoi est refusé : vérifier la situation dans **Comptes**, réactiver le compte uniquement si la suspension doit être levée, puis renvoyer le devis. Modifier l'adresse de contact de la fiche ne change rien dans ce cas.
6. Réponse du client : acceptation (e-mail à l'agence ; l'événement passe à « accepté » s'il était en brouillon), refus, ou demande de modification avec motif ; dans ce cas, modifier les prestations et renvoyer la contre-proposition.
7. Vue des devis acceptés dans la rubrique Devis ; **Passer l'événement en cours** au démarrage.

### Gérer l'activité

| Rubrique | Actions |
|---|---|
| Clients | Créer, modifier, supprimer une fiche (un client qui a des événements est anonymisé, pas supprimé) |
| Événements | Modifier, changer le statut (en cours, terminé, annulé ; un événement terminé ne s'annule pas), visibilité publique ; notes et tâches dans la fiche ; un événement qui a un devis s'annule, il ne se supprime pas |
| Tâches | Liste de toutes les tâches, avec **Ouvrir la fiche de l'événement**. Pour créer une tâche, y compris la première d'un événement : **Événements** → ouvrir la fiche concernée → formulaire **Créer une tâche** (titre, description, **Affecter à** un employé ou à soi-même, échéance facultative) → **Créer la tâche**. Dans la même fiche, **Réaffecter à** change l'affectataire d'une tâche non terminée |
| Avis | Valider ou refuser |
| Comptes | Créer un compte employé ou client (mot de passe temporaire envoyé par e-mail au titulaire, jamais affiché) ; suspendre ou réactiver (un compte suspendu ne peut plus se connecter, ses sessions sont fermées) ; supprimer un compte employé (ses tâches en cours reviennent à l'administratrice) |
| Journaux | Connexions et actions de gestion, filtrées par type ; journaux de connexion conservés 6 mois, autres 1 an |
| Paramètres | Message de remerciement affiché après une demande de devis |

## 6. Questions fréquentes

| Situation | Que faire |
|---|---|
| « Trop de demandes » | Les connexions, inscriptions, demandes de devis et messages sont limités par adresse IP sur 15 minutes : patienter |
| Mot de passe temporaire refusé | Il a déjà servi ou il a expiré : **Mot de passe oublié ?** |
| Page « Le service est momentanément indisponible » à la première visite après une pause | API peut-être en veille : voir « À savoir » en tête du guide |
| Formulaire refusé juste après l'envoi, avec une page de blocage ou le message « Le service est momentanément indisponible » | La protection de l'hébergeur refuse certains textes qui ressemblent à du code : reformuler le texte saisi, ou passer par le formulaire de contact ou le téléphone. Recharger la page ne suffit pas |
