# 6. Déploiement

## 6.1 Architecture de production

| Service | Fournisseur | Région | Offre | Rôle |
|---|---|---|---|---|
| `innov-events-api` | Render (service web Docker) | Francfort | Gratuite | API Express |
| `innov-events-web` | Render (service web Docker) | Francfort | Gratuite | nginx : site web et relais `/api` |
| `innov-events-mobile` | Render (service web Docker) | Francfort | Gratuite | nginx : application mobile et relais `/api` |
| PostgreSQL 16 | Neon, projet `innov-events-manager`, branche `production`, base `innov_events` | Francfort | Gratuite | Données métier et sessions |
| MongoDB 8.0 | MongoDB Atlas, cluster gratuit `innov-events` | AWS Paris (`eu-west-3`) | Gratuite (M0) | Journaux |
| E-mails | Brevo, API HTTPS | — | Gratuite | E-mails transactionnels |

Les données restent dans l'Union européenne pour les bases et l'hébergement. Toutes les liaisons sont chiffrées (HTTPS, TLS vers Neon et Atlas).

## 6.2 Fichiers de déploiement du dépôt

| Fichier | Rôle |
|---|---|
| `services/api/Dockerfile` | Image de l'API : build TypeScript, puis image finale avec les seules dépendances de production, utilisateur non root |
| `apps/web/Dockerfile`, `apps/mobile/Dockerfile` | Build Angular / Ionic, puis image nginx |
| `apps/web/nginx.conf`, `apps/mobile/nginx.conf` | Fichiers statiques, en-têtes de sécurité, relais `/api` avec en-tête secret et IP du visiteur |
| `apps/web/entrypoint.sh`, `apps/mobile/entrypoint.sh` | Contrôle des variables et génération de la configuration nginx au démarrage ; refus de démarrer si une variable est invalide |
| `database/CO-04-script-postgresql.sql` | Création du schéma, des contraintes, du rôle applicatif et des droits |
| `database/init/03-parametres-et-types.sql` | Paramètres et types d'événement |
| `database/migrations/*.sql` | Modifications d'une base existante, à exécuter avant la fusion du code |
| `services/api/src/scripts/creer-admin.ts` | Création du compte administrateur |
| `.github/workflows/ci.yml` | Contrôles exigés avant tout déploiement |

Chaque fichier est commenté. Aucun secret n'y figure.

## 6.3 Mise en place (ordre à respecter)

### 1. MongoDB Atlas

1. Créer le projet et un cluster gratuit (M0) chez AWS, région Paris, version 8.0, sans données d'exemple.
2. **Database Access** : créer l'utilisateur de l'API avec le seul rôle `readWrite` sur la base `innov_events_logs`.
3. **Network Access** : la liste reste vide pour l'instant ; jamais `0.0.0.0/0`.
4. **Backup** : laissé désactivé (indisponible sur M0 ; voir « Sauvegardes »).
5. Copier la chaîne de connexion (bouton **Connect** → **Drivers**) dans le gestionnaire de mots de passe : elle deviendra `MONGODB_URL`.

### 2. Neon

1. Créer le projet `innov-events-manager` en PostgreSQL 16, région Francfort ; branche `production`, base `innov_events`.
2. Dans l'éditeur SQL de la branche `production`, avec le rôle propriétaire : exécuter `database/CO-04-script-postgresql.sql`, puis `database/init/03-parametres-et-types.sql`. Vérifier les accents des types d'événement.
3. Définir le mot de passe du rôle `innov_events_app` et copier la chaîne de connexion de ce rôle (avec `sslmode=require`) dans le gestionnaire de mots de passe : elle deviendra `DATABASE_URL`.

### 3. Brevo

1. Ajouter et vérifier l'adresse d'expédition (**Senders**).
2. Créer une clé d'API restreinte aux e-mails transactionnels (`BREVO_API_KEY`).
3. Désactiver le blocage des adresses IP inconnues pour les clés d'API : les adresses de sortie de Render ne sont pas fixes.

### 4. Render

1. Créer le service `innov-events-api` : **New** → **Web Service** → dépôt GitHub, branche `main`, **Language** `Docker`, **Root Directory** `services/api`, région Francfort, offre gratuite, **Health Check Path** `/api/sante`, **Auto-Deploy** « After CI Checks Pass ».
2. Copier les adresses de sortie du service (**Connect** → **Outbound**) et les ajouter dans **Network Access** d'Atlas, **avant** le premier déploiement. Sinon `/api/sante` répond 503 et le contrôle de santé échoue.
3. Saisir les variables de l'API (tableau ci-dessous), puis déployer.
4. Créer `innov-events-web` (**Root Directory** `apps/web`) et `innov-events-mobile` (**Root Directory** `apps/mobile`) de la même façon, avec leurs variables.

| Service | Variable | Valeur |
|---|---|---|
| API | `NODE_ENV` | `production` |
| API | `DATABASE_URL` | Chaîne Neon du rôle `innov_events_app` (secret) |
| API | `MONGODB_URL` | Chaîne Atlas (secret) |
| API | `MONGODB_DATABASE` | `innov_events_logs` |
| API | `SESSION_SECRET` | Valeur aléatoire de 32 caractères au moins (secret) |
| API | `INTERNAL_PROXY_SECRET` | Valeur aléatoire base64url de 32 à 128 caractères (secret), identique sur les trois services |
| API | `BREVO_API_KEY` | Clé Brevo restreinte (secret) |
| API | `MAIL_EXPEDITEUR` | Adresse d'expédition vérifiée dans Brevo |
| API | `MAIL_CONTACT` | Adresse qui reçoit les demandes et les messages de contact |
| Web et mobile | `API_UPSTREAM` | Origine HTTPS de l'API (`https://….onrender.com`), sans chemin ni barre finale |
| Web et mobile | `NGINX_SCHEME` | `https` |
| Web et mobile | `NGINX_CLIENT_IP_SOURCE` | `$http_cf_connecting_ip` (IP du visiteur transmise par la couche réseau de Render) |
| Web et mobile | `INTERNAL_PROXY_SECRET` | Même valeur que pour l'API (secret) |

Facultatif pour l'API : `PURGES_ACTIVES` (`false` désactive les purges ; à laisser absent en production).

L'API refuse de démarrer en production si `MONGODB_URL`, `BREVO_API_KEY`, `MAIL_EXPEDITEUR` ou `MAIL_CONTACT` manque, ou si un secret est trop court : une erreur de configuration se voit immédiatement dans les journaux Render.

### 5. Compte administrateur

Le compte est créé une seule fois, depuis le poste, avec le script de l'API. La procédure suit l'étape 4 du `README.md`, mais **la ligne qui fixe `DATABASE_URL` sur `localhost` est remplacée intégralement** par la saisie masquée de la chaîne Neon (sinon le script viserait la base locale) :

```powershell
cd services\api
npm.cmd ci
$u = Read-Host 'Chaîne de connexion Neon' -AsSecureString; $env:DATABASE_URL = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($u))
$env:ADMIN_EMAIL = Read-Host "Adresse e-mail de l'administratrice"; $env:ADMIN_IDENTIFIANT = Read-Host "Identifiant"; $env:ADMIN_PRENOM = Read-Host "Prénom"; $env:ADMIN_NOM = Read-Host "Nom"
$s = Read-Host 'Mot de passe administrateur' -AsSecureString; $env:ADMIN_MOT_DE_PASSE = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($s))
npm.cmd run admin:create
Remove-Item Env:DATABASE_URL, Env:ADMIN_MOT_DE_PASSE
```

Le message de succès ne nomme pas la base : vérifier ensuite la connexion de l'administratrice sur le site de production. La fenêtre PowerShell est fermée après usage. Ni la chaîne ni le mot de passe ne sont écrits dans un fichier.

### 6. Vérifications après le premier déploiement

- Les trois services sont « Live » ; `/api/sante` répond via le site web et le mobile.
- Un appel direct à l'adresse Render de l'API (hors `/api/sante`) répond 403.
- Cookie de session `HttpOnly`, `Secure`, `SameSite=Lax`.
- Une connexion apparaît dans la collection `logs` d'Atlas avec l'adresse IP publique réelle ; l'index `ttl_journaux_connexion` existe.
- Un e-mail réel arrive par Brevo (inscription ou contact).

## 6.4 Livrer une mise à jour

1. Si le schéma change : exécuter le script de `database/migrations/` sur la branche `production` de Neon **avant** la fusion, puis vérifier la contrainte ou la table modifiée.
2. PR de `dev` vers `main` ; les trois contrôles de la CI doivent réussir ; fusion par merge commit.
3. La CI s'exécute sur `main`. Render ne déploie qu'**après** sa réussite, et seulement les services dont le dossier (**Root Directory**) a changé : une fusion qui ne modifie que `docs/` ne redéploie rien ; une fusion qui ne modifie que `services/api/` ne redéploie que l'API. Un service non redéployé peut l'être à la main (**Manual Deploy** → **Deploy latest commit**) ; ne pas choisir « Deploy a specific commit », qui désactive le déploiement automatique.
4. Vérifier chaque service redéployé (« Deploy live » sur le bon commit), puis rejouer les scénarios d'acceptation concernés (§8 de `docs/tests/plan-de-tests.md`).
5. La livraison finale reçoit une étiquette Git (`v1.0.0`) sur le commit de fusion de `main`.

**Retour arrière** : dans Render, **Events** → déploiement précédent → **Rollback** (sur l'offre gratuite, limité aux deux déploiements précédents). Un rollback lancé depuis le tableau de bord **désactive le déploiement automatique** du service : une fusion ultérieure resterait sans effet. Après la correction, rétablir **Settings** → **Auto-Deploy** « After CI Checks Pass » sur chaque service concerné, puis vérifier le commit « Live ». Autre voie : PR qui annule le merge commit (`git revert -m 1`), qui repasse par la CI sans toucher au réglage. Une migration de base n'est pas annulée automatiquement : elle demande un script inverse, exécuté à la main.

**Si la CI échoue sur `main`** : Render ne déploie pas, la production reste sur la version précédente ; la correction passe par une branche `fix/*` vers `dev`, puis `main`.

## 6.5 Limites des offres gratuites

Relevées dans les consoles et la documentation des fournisseurs (novembre 2026) ; elles peuvent évoluer.

| Fournisseur | Limites et comportements | Conséquence pour l'application |
|---|---|---|
| Render | Mise en veille après 15 minutes sans requête ; réveil en une minute environ ; 750 heures d'instance gratuites par mois pour tout l'espace de travail, partagées entre les trois services (les services en veille n'en consomment pas) ; services suspendus jusqu'au mois suivant si le quota est épuisé ; système de fichiers non persistant ; retour arrière limité aux deux derniers déploiements ; quotas de bande passante et de minutes de build du plan | Le premier appel après une veille peut afficher « Le service est momentanément indisponible » (502) : ouvrir l'adresse de l'API la réveille. Rien n'est stocké sur disque (PDF générés à la demande). Une protection placée devant les services refuse certains textes qui ressemblent à du SQL (403) |
| Neon | 1 Go de stockage par projet ; 100 heures de calcul (CU-heures) par projet et par mois ; calcul suspendu après 5 minutes d'inactivité, réveil en quelques centaines de millisecondes ; restauration à un instant donné limitée aux 6 dernières heures | Volume très inférieur au quota ; la sauvegarde repose sur les scripts du projet |
| MongoDB Atlas (M0) | 512 Mo de stockage ; 500 connexions ; 100 opérations par seconde ; 10 Go de transfert sur 7 jours ; pas de sauvegarde ; journaux du serveur non téléchargeables ; cluster mis en pause après une longue période sans connexion ; version 8.0 mise à jour par Atlas | Journaux seulement ; une connexion est refusée si Atlas est indisponible ; l'API fonctionnant chaque jour, la pause ne se produit pas en exploitation |
| Brevo | 300 e-mails par jour, transactionnels et marketing confondus | Suffisant pour le volume de l'agence ; au-delà, offre payante |

Chaque montée en gamme est un changement d'offre chez le même fournisseur, sans migration des données ni modification du code (variables d'environnement inchangées).

## 6.6 Sauvegardes

| Base | Mécanisme du fournisseur | Mécanisme du projet |
|---|---|---|
| Neon | Historique de 6 heures (restauration à un instant donné) | `database/sauvegarde/Sauvegarder-Bases.ps1` : copie en lecture seule, puis restauration de contrôle sur la pile locale |
| Atlas | Aucune sauvegarde sur M0 (laissée désactivée : des instantanés conserveraient aussi un nom effacé à la demande d'un client) | Même script (`mongodump` en lecture seule) |

Procédure, contrôles et restauration d'urgence : [`docs/sauvegarde-restauration.md`](../sauvegarde-restauration.md). Exécutée le 17/11/2026 : 12 tables et 9 journaux restaurés à l'identique sur la pile locale.
