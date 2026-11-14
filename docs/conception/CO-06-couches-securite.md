# CO-06 — Architecture logicielle : couches et sécurité

**Projet :** Innov'Events Manager  
**Schéma associé :** `CO-06-architecture.drawio.xml` (local et production)  
**État de référence :** premier déploiement test du 13/11/2026. Les parcours d'authentification et les fonctions métier décrits constituent la conception à implémenter et à tester.

## Couches et responsabilités

| Couche / service | Rôle | Sécurité prévue ou appliquée |
|---|---|---|
| Angular web et Ionic/Angular mobile | Interfaces ; l'application mobile est une PWA servie par nginx. | Chaque navigateur appelle `/api` sur sa propre origine. Aucun secret dans le code client. Les guards facilitent la navigation ; les autorisations sont contrôlées dans l'API. |
| nginx web et nginx mobile | Servir les fichiers statiques et relayer `/api` vers Express. | Écrase `X-Innov-Proxy-Secret` avec la valeur serveur `INTERNAL_PROXY_SECRET`. HTTPS vers l'API en production, CSP et en-têtes transmis sous contrôle. La restitution de l'IP réelle reste à vérifier dans la chaîne des proxys Render. |
| Middlewares Express | Vérifier les requêtes avant le traitement métier. | Refus de l'accès sans secret proxy, sauf `GET /api/sante` ; Helmet ; limitation globale de débit ; session en cookie HttpOnly / SameSite / Secure en production ; CSRF via `GET /api/csrf` puis `X-CSRF-Token`. Validation des entrées, contrôle des rôles et limite dédiée à la connexion à ajouter avec l'authentification. |
| Routes et contrôleurs | Associer les URL aux traitements ; traduire les requêtes et réponses HTTP/JSON. | Appellent les services métier après les contrôles. Retours d'erreur sans détails techniques ni secrets. |
| Services métier, classes TypeScript | Authentification, règles de statuts, calculs, PDF, e-mails et purges. | Argon2id ; autorisations et transitions contrôlées. Le mot de passe provisoire est stocké à part, ne remplace pas le mot de passe habituel, n'est utilisable qu'une fois et impose le choix d'un nouveau mot de passe. |
| Repositories | Accès aux données métier dans PostgreSQL avec `pg`, et aux journaux MongoDB avec le pilote officiel. | SQL paramétré, colonnes sélectionnées explicitement, droits applicatifs limités. Aucun hachage ni secret renvoyé aux interfaces. Le rôle effectivement utilisé sur Neon et ses permissions restent à vérifier. |
| Infrastructure de session | Persister la session Express dans `innov_events.sessions` via `connect-pg-simple`. | Exception technique au circuit des repositories métier : le store accède à sa table de sessions. Le middleware CSRF manipule `req.session`, sans requête SQL directe. Régénération de la session après authentification ; nouveau jeton CSRF après régénération. |
| PostgreSQL | Données structurées, utilisateurs, devis et sessions. | Contraintes et transactions du script CO-04. Rôle `innov_events_app` configuré en local ; cloisonnement du rôle de production à vérifier. |
| MongoDB / Atlas | Collection `logs` : connexions, administration et PDF. | Accès restreint ; journaux horodatés. Connexions avec IP conservées six mois par index TTL partiel ; autres journaux conservés un an puis purgés. Aucun mot de passe, hachage ou jeton CSRF dans les journaux. |
| Mailpit local / Brevo en production | Intercepter les e-mails locaux ; envoyer les messages transactionnels via l'API HTTPS Brevo en production. | Clé Brevo côté API uniquement ; aucun envoi réel par Mailpit. Expéditeur Brevo et envoi réel restant à vérifier. |

## Vue locale — Docker Compose

Six services : `web`, `mobile`, `api`, `postgres`, `mongo`, `mailpit`. Les fronts sont accessibles sur `127.0.0.1:8080` et `127.0.0.1:8100`. L'API ne publie aucun port sur le poste ; les deux nginx lui transmettent `/api` en écrasant l'en-tête secret.

PostgreSQL (`127.0.0.1:5432`), MongoDB (`127.0.0.1:27017`), l'interface Mailpit (`127.0.0.1:8025`) et son SMTP (`127.0.0.1:1025`) sont accessibles depuis le poste seulement. Les services communiquent sur le réseau Docker `interne`. La liaison SQL locale n'utilise pas TLS. PostgreSQL et MongoDB disposent des volumes `postgres_data` et `mongo_data`. Les secrets restent dans `.env`, non versionné. PostgreSQL initialise le schéma depuis CO-04.

## Vue production — Render, Neon, Atlas, Brevo

Render héberge trois services Docker à **Francfort** : nginx web, nginx mobile et API Express. Chaque front appelle `/api` sur sa propre origine ; nginx relaie vers l'URL HTTPS publique de l'API et injecte le secret proxy côté serveur. L'API refuse les appels sans secret valide, sauf `GET /api/sante`. Les variables d'environnement des services contiennent les secrets.

L'API accède à **Neon PostgreSQL à Francfort** pour les données et sessions, à **MongoDB Atlas sur AWS Paris (`eu-west-3`)** pour les journaux, et à **Brevo** pour les e-mails HTTPS. Les connexions SQL et MongoDB sont chiffrées en production. Atlas autorise les plages de sortie Render identifiées pour l'API ; son utilisateur est limité à la base de journaux. Le rôle Neon effectivement utilisé par l'API doit encore faire l'objet d'un contrôle de ses permissions.

GitHub Actions valide l'API, le web et le mobile. Les trois services Render suivent `main` et sont configurés sur « After CI Checks Pass ». La preuve complète d'un déploiement déclenché automatiquement après la CI reste à recueillir au prochain merge vers `main`.

Les offres gratuites peuvent mettre les services en veille. L'API prévoit le rattrapage des purges au démarrage, puis une exécution quotidienne tant qu'elle fonctionne ; aucune exécution à heure fixe n'est garantie pendant une veille.

## Contrôles et limites

- **Vérifié au déploiement test du 13/11/2026 :** santé de l'API et connexion aux bases, accès HTTPS via les fronts, refus 403 d'un appel direct sans secret, sessions, cookie Secure et échange de jeton CSRF sur le socle.
- **Restant à vérifier :** IP réelle après la chaîne des proxys et résistance aux en-têtes falsifiés, limitation de débit effective par visiteur, permissions du rôle Neon, expéditeur Brevo et envoi réel, preuve du déploiement automatique après la CI.
- **À implémenter et tester avec l'authentification :** limite spécifique à la connexion, contrôles de rôle, session restreinte pour le mot de passe provisoire, usage unique résistant aux tentatives concurrentes, renouvellement de session et de CSRF après connexion, révocation des sessions dès la suspension d'un compte. CO-11 décrit ces parcours cibles ; les contrôles du socle ne prouvent pas leur réalisation.
- **À documenter :** sauvegardes, conservation des données, quotas et limites des offres gratuites.

## Éco-conception

- PWA accessible par navigateur, sans build natif obligatoire.
- Routes Angular chargées à la demande pour limiter le JavaScript initial ; listes paginées côté API et interface pour limiter les transferts et le nombre d'éléments affichés.
- Images adaptées à l'affichage, compressées et chargées de façon différée hors du premier écran. Les URL externes sont facultatives et limitées à HTTPS ; une alternative textuelle est fournie.
- PDF générés à la demande, sans stockage permanent ; notes centralisées visibles après enregistrement, sans WebSocket supplémentaire.
- Ces dispositions sont des objectifs d'implémentation. Les gains énergétiques ne sont pas quantifiés et restent à évaluer sur les interfaces réalisées.
