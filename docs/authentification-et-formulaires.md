# Authentification et formulaires

## Routes

Toutes les routes utilisent la même origine via nginx. Les écritures exigent un jeton obtenu avec `GET /api/csrf`, envoyé dans `X-CSRF-Token`.

| Méthode et route | Accès | Effet |
|---|---|---|
| GET /api/csrf | Public ; également session restreinte | Jeton pour la session courante |
| POST /api/inscriptions | Public | Compte client uniquement ; confirmation par e-mail |
| POST /api/sessions | Public | Connexion, cookie régénéré, journal de connexion |
| GET /api/sessions/courante | Client, employé, admin | Identité publique ; aucun haché |
| DELETE /api/sessions | Session anonyme, normale ou restreinte | Déconnexion ; CSRF obligatoire |
| POST /api/mots-de-passe-oublies | Public | Mot de passe temporaire, réponse neutre |
| PATCH /api/mot-de-passe | Session restreinte valide uniquement | Nouveau mot de passe et session normale régénérée |
| POST /api/contacts | Visiteur ou utilisateur connecté | E-mail vers l’adresse générique |
| GET /api/types-evenement | Public | Options du formulaire depuis PostgreSQL |
| POST /api/prospects | Visiteur ou utilisateur connecté | Demande au statut `a_contacter`, notification, remerciement |
| GET /api/parametres/remerciement | Admin | Texte courant |
| PATCH /api/parametres/remerciement | Admin | Modification du texte des prochaines demandes |

La session restreinte ne donne accès qu’au renouvellement, au jeton CSRF nécessaire et à la déconnexion. La sonde de santé reste indépendante des sessions. Le rôle et le statut sont relus dans PostgreSQL pour chaque requête protégée. Le script administrateur n’est exposé par aucune route HTTP.

## Mots de passe et sessions

Les mots de passe sont hachés avec Argon2id : mémoire 64 Mio, trois passes, parallélisme 1. Le serveur exige au moins huit caractères, dont une majuscule, une minuscule, un chiffre et un caractère spécial, avec une limite de 256 unités UTF-16 pour borner le travail. Le nom d’utilisateur et les champs d’identité ne peuvent pas fixer un rôle.

Un oubli ne remplace pas le mot de passe permanent. Il crée un temporaire aléatoire, haché dans les champs séparés, valide une heure. La réponse HTTP est identique pour un compte absent, suspendu ou actif. Une erreur d’envoi ne révèle pas l’existence du compte ; elle produit un événement technique neutre. Le mot de passe transmis par e-mail reste un compromis imposant un risque : un lien aléatoire de réinitialisation serait préférable pour un produit réel.

Après comparaison du haché, un `UPDATE` conditionnel ramène l’expiration temporaire à l’instant présent seulement si le même haché est encore valide. PostgreSQL départage les requêtes concurrentes : une seule peut réussir. Le haché et sa date restent présents jusqu’au renouvellement pour respecter les contraintes SQL. La session obtenue expire côté serveur au bout de quinze minutes, indépendamment du cookie.

Le renouvellement compare le haché consommé et sa date exacte, enregistre le nouveau haché et efface ensemble les deux champs temporaires. Il régénère la session et invalide les anciennes sessions normales. Une nouvelle demande d’oubli invalide les anciennes sessions restreintes. Si une session échoue à être sauvegardée après consommation, le temporaire reste consommé : il faut en demander un nouveau. L’abandon volontaire est possible depuis le formulaire de renouvellement.

Les sessions utilisent `innov_events.sessions` via `connect-pg-simple`. Le cookie est `HttpOnly`, `SameSite=Lax` et `Secure` en production. Aucune information d’authentification n’est placée dans le stockage local du navigateur. Un nouveau jeton CSRF est demandé pour chaque écriture, notamment après une régénération de session. La destination Angular est conservée dans un chemin interne, y compris pendant le renouvellement.

## IP et journaux

Les deux nginx écrasent `X-Innov-Client-Ip` avec `$remote_addr` en local ou `$http_cf_connecting_ip` sur Render. Le paramètre d’environnement n’accepte que ces deux sources cohérentes avec le protocole configuré. Le secret du proxy est lui aussi écrasé. Le passage par un proxy authentifié est contrôlé avant de lire l’IP.

L’API ne lit que `X-Innov-Client-Ip`, validé avec `net.isIP` : aucune valeur de repli depuis `CF-Connecting-IP`, `X-Forwarded-For` ou le socket. Une absence, une liste ou une valeur invalide est refusée. La même valeur sert aux journaux et aux quotas. Pour les quotas, les IPv6 sont regroupées en préfixes /56. Le stockage des compteurs est en mémoire, adapté au service à une instance ; un redémarrage réinitialise les compteurs.

Chaque document de `logs` contient `horodatage` (BSON Date), `type_action`, `id_utilisateur` et `details`. Une réussite contient l’identifiant et l’IP ; un échec contient un identifiant nul, l’e-mail tenté et l’IP. Aucun mot de passe, haché, cookie, jeton, secret ou corps HTTP n’est journalisé. L’écriture est attendue avant la création de session : un échec de journalisation ne donne pas accès au compte.

Les journaux de connexion, qui contiennent l’IP, sont effacés automatiquement après 180 jours par un index TTL partiel `ttl_journaux_connexion` sur `horodatage`, limité aux types `CONNEXION_REUSSIE` et `CONNEXION_ECHOUEE`. L’API crée cet index au démarrage, sans bloquer celui-ci : la création est idempotente et un échec est signalé par la ligne JSON `index_expiration_journaux_echec`, puis retenté au démarrage suivant. Les autres journaux ne sont pas concernés par cet index.

Les tests traversent un nginx réel pour chacun des deux fronts et vérifient que les IP forgées par le client n’apparaissent pas dans le journal. Le test de bout en bout sur Render doit encore vérifier la chaîne Cloudflare → Render → nginx. Les autres actions métier et la conservation d’un an des autres journaux sont réalisées avec leurs fonctionnalités respectives.

Quand `/api/sante` répond 503, une ligne JSON est émise sur la sortie standard avec `evenement: sante_degradee` et les états PostgreSQL/MongoDB, sans détail d’erreur ni secret.

## Formulaires et e-mails

Le devis reprend W1 : entreprise et contact, événement, trois étapes et confirmation. Tous les champs sont obligatoires, y compris nom et prénom séparés ; le groupe « nom/prénom » explique le décompte synthétique des neuf rubriques. Le formulaire n’exige pas de compte. Le serveur valide les champs et le type d’événement, impose le statut et ne reçoit aucun identifiant de client.

Les paramètres et types de référence sont initialisés par `database/init/03-parametres-et-types.sql`, rejouable avec le propriétaire de la base. Le rôle applicatif ne possède que SELECT/UPDATE sur les paramètres : l’application ne tente aucun INSERT sur cette table. Le schéma et le script de création CO-04 restent inchangés.

Le contact impose un e-mail quand le nom d’utilisateur est absent. Un nom saisi est déclaratif et ne prouve pas une identité. Les e-mails sont envoyés en texte brut, via Nodemailer/Mailpit en local et l’API HTTPS Brevo en production. L’expéditeur est configuré côté serveur ; le destinataire des formulaires est l’adresse générique configurée, jamais une valeur fournie par le client.

Une demande de devis enregistrée reste conservée si sa notification échoue ; la confirmation indique alors de ne pas la renvoyer. Le message de remerciement est relu pour chaque demande suivante et affiché comme texte. Il n’existe pas encore de reprise automatique des notifications échouées ni des confirmations d’inscription : les événements techniques permettent leur diagnostic.

## Dépendances ajoutées

| Bibliothèque | Version verrouillée | Licence |
|---|---|---|
| argon2 | 0.45.2 | MIT |
| nodemailer | 10.5.0 | MIT-0 |
| @types/nodemailer | 8.0.2 | MIT |

Les versions exactes et leurs dépendances transitives sont dans le lockfile. Les licences complètes sont distribuées dans les paquets correspondants.
