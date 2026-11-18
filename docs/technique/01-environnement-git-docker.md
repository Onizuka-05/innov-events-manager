# 1. Environnement, Git et Docker

## 1.1 Poste de développement

| Élément | Choix |
|---|---|
| Système | Windows 11 x64, Windows PowerShell 5.1 |
| Éditeur | VS Code |
| Exécution | Node.js 24 (LTS) et npm ; `npm.cmd` et `npx.cmd` sous PowerShell |
| Conteneurs | Docker Desktop (moteur Docker et Docker Compose) |
| Versionnement | Git, dépôt GitHub public `Onizuka-05/innov-events-manager` |

Les versions exactes sont dans le [`README.md`](../../README.md). Node.js 24 et PostgreSQL 16.15 sont identiques sur le poste, en CI et en production ; MongoDB 8.0 l'est sur le poste et en production (la CI n'en lance pas : les tests de l'API utilisent un double en mémoire).

## 1.2 Git

### Mise en place

1. Dépôt créé sur GitHub, public, avec `main` comme branche par défaut ; branche `dev` créée depuis `main`.
2. Adresse e-mail personnelle masquée dans les commits (option GitHub « Keep my email addresses private ») : les commits portent l'adresse `…@users.noreply.github.com`.
3. Fichier `.gitattributes` : tous les fichiers texte sont stockés et extraits avec des fins de ligne LF (`* text=auto eol=lf`). Sous Windows, Git convertissait sinon les fichiers en CRLF (`core.autocrlf=true`) et le contrôle de formatage échouait (voir le [journal des incidents](09-journal-des-incidents.md)).
4. Fichier `.gitignore` : `node_modules/`, sorties de build, rapports de couverture et de tests, fichier `.env` (secrets locaux).
5. Protection de `main` (Settings → Branches) : pull request obligatoire, les trois contrôles de la CI exigés, règle appliquée aux administrateurs, force push et suppression interdits.
6. Modèle de pull request (`.github/pull_request_template.md`) : type, branche cible, description, issues concernées, checklist qualité, résultats des vérifications, observations.

### Branches et circuit

| Branche | Rôle |
|---|---|
| `main` | Production : chaque fusion déclenche le déploiement (après la CI) |
| `dev` | Intégration |
| `feature/*` | Une fonctionnalité ou un lot de fonctionnalités |
| `fix/*` | Correction d'une anomalie (issue GitHub, test qui la reproduit avant la correction) |
| `docs/*` | Documentation |

1. Créer la branche depuis `dev` à jour : `git switch dev; git pull --ff-only; git switch -c feature/nom`.
2. Développer, puis lancer les contrôles locaux (formatage, lint, types, tests, build).
3. Commiter avec la convention `type: message` (`feat`, `fix`, `docs`, `chore`, `test`, `refactor`), pousser, ouvrir une PR vers `dev`.
4. Attendre la CI verte, relire, fusionner par **merge commit** (jamais squash ni rebase) : l'historique garde chaque commit et `dev` ne diverge pas artificiellement de `main`.
5. Pour livrer : PR de `dev` vers `main`, fusion par merge commit ; les mots-clés `Closes #N` de la description ferment les issues terminées.

Le suivi des tâches se fait dans un tableau Kanban GitHub Projects (une issue par exigence), décrit dans [`docs/qualite.md`](../qualite.md).

## 1.3 Docker

### Images

Chaque application a son `Dockerfile`, construit en deux étapes (« multi-stage ») : une image `node:24-alpine` installe les dépendances par `npm ci` et construit l'application ; l'image finale ne garde que le résultat.

| Application | Image finale | Contenu |
|---|---|---|
| API (`services/api/Dockerfile`) | `node:24-alpine` | Code compilé (`dist/`) et dépendances de production seulement ; exécution sous un utilisateur non root |
| Web (`apps/web/Dockerfile`) | `nginx:1.30-alpine` | Fichiers statiques Angular, `nginx.conf`, `entrypoint.sh` |
| Mobile (`apps/mobile/Dockerfile`) | `nginx:1.30-alpine` | Fichiers statiques Ionic, `nginx.conf`, `entrypoint.sh` |

Le script `entrypoint.sh` des deux nginx vérifie la configuration avant le démarrage et refuse de démarrer si une variable manque ou est incohérente : `API_UPSTREAM` (origine de l'API, sans chemin ni barre finale), `NGINX_SCHEME` (`http` en local, `https` en production), `INTERNAL_PROXY_SECRET` (32 à 128 caractères base64url), `NGINX_CLIENT_IP_SOURCE` (source de l'adresse IP du visiteur, cohérente avec le protocole).

### Docker Compose pas à pas

Le fichier `docker-compose.yml` décrit la pile locale complète :

| Service | Image | Port sur le poste | Rôle |
|---|---|---|---|
| `postgres` | `postgres:16.15-alpine` | `127.0.0.1:5432` | Base relationnelle ; schéma créé au premier démarrage |
| `mongo` | `mongo:8.0` | `127.0.0.1:27017` | Journaux |
| `mailpit` | `axllent/mailpit:v1.32.0` | `127.0.0.1:8025` (interface), `127.0.0.1:1025` (SMTP) | Capture des e-mails, aucun envoi réel |
| `api` | construite depuis `services/api` | aucun | API Express |
| `web` | construite depuis `apps/web` | `127.0.0.1:8080` | Site web et relais `/api` |
| `mobile` | construite depuis `apps/mobile` | `127.0.0.1:8100` | Application mobile et relais `/api` |

1. **Secrets** : copier `.env.example` en `.env` et le remplir (le README donne une commande qui génère des valeurs aléatoires). Compose refuse de démarrer si une variable manque (`${VAR:?message}`).
2. **Initialisation de PostgreSQL** : au premier démarrage, l'image exécute dans l'ordre les fichiers montés dans `/docker-entrypoint-initdb.d/` : `01-CO-04-script-postgresql.sql` (schéma, contraintes, rôle applicatif, droits), `02-configurer-role.sh` (mot de passe du rôle `innov_events_app` depuis `POSTGRES_APP_PASSWORD`), `03-parametres-et-types.sql` (paramètres et types d'événement).
3. **Ordre de démarrage** : chaque service a un contrôle de santé (`healthcheck`) ; l'API attend que PostgreSQL et MongoDB soient sains (`depends_on: condition: service_healthy`), les deux nginx attendent que l'API réponde sur `/api/sante`.
4. **Réseau** : tous les services sont sur le réseau privé `interne` et se joignent par leur nom (`postgres`, `mongo`, `api`…). Les ports publiés sont liés à `127.0.0.1` : rien n'est exposé au réseau local.
5. **Données** : volumes nommés `postgres_data` et `mongo_data`, conservés par `docker compose down`, supprimés par `docker compose down -v`.
6. **Lancement** : `docker compose up -d --build`, puis `docker compose ps` (six services `healthy`) ; journaux d'un service : `docker compose logs api`.

### Tests avec Docker

- Tests d'intégration de l'API : conteneur PostgreSQL jetable dédié (`innov-events-tests`, port `127.0.0.1:55432`), procédure au §4.2 de [`docs/tests/plan-de-tests.md`](../tests/plan-de-tests.md). La base de développement n'est jamais utilisée pour les tests.
- Tests de bout en bout (Playwright), lancés sur le poste et non par la CI : site web sur la pile Compose démarrée (e-mails vérifiés dans Mailpit) ; mobile sur le serveur de développement Angular (port 4200), réponses d'API simulées.
- Sauvegarde et restauration : les outils `pg_dump`, `mongodump`… viennent des images Docker, sans installation sur le poste ([`docs/sauvegarde-restauration.md`](../sauvegarde-restauration.md)).
