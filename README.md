# Innov'Events Manager

Application de gestion d'événements pour l'agence Innov'Events :
- un site web public (accueil, événements, avis, demande de devis, contact) ;
- un espace client (devis, suivi de la demande, événements, avis, profil) ;
- un espace de l'équipe (prospects, clients, événements, devis, notes, tâches, avis, comptes, journaux) ;
- une application mobile pour les employés (événements, fiches client, notes).

| Partie | Technologie | Dossier |
|---|---|---|
| API REST | Node.js, Express, TypeScript | `services/api` |
| Site web | Angular | `apps/web` |
| Application mobile | Ionic et Angular (application web servie par nginx, utilisée dans le navigateur du téléphone) | `apps/mobile` |
| Base relationnelle | PostgreSQL 16 | `database` |
| Journaux | MongoDB 8.0 | collection `logs` |

La documentation technique complète se trouve dans [`docs/technique/`](docs/technique/README.md) : environnement, architecture, bases de données, sécurité, tests, CI/CD, déploiement, éco-conception, veille et journal des incidents.

## Prérequis

Versions utilisées pour le développement (Windows 11, x64) :

| Outil | Version |
|---|---|
| Node.js (LTS) | 24.22.0 |
| npm | 11.19.1 |
| Angular CLI | 22.2.5 |
| Ionic CLI | 7.2.1 |
| Git | 2.56.0 |
| Docker Engine | 29.9.2 |
| Docker Desktop | 4.98.0 |
| VS Code | 1.146.0 |

Docker Desktop suffit pour lancer l'application complète. Node.js et npm servent aux tests, au lint et à la création du compte administrateur.

Les commandes ci-dessous sont écrites pour Windows PowerShell 5.1. Sous PowerShell, utiliser `npm.cmd` et `npx.cmd` plutôt que `npm` et `npx`, car la politique d'exécution des scripts peut bloquer `npm.ps1`.

## Démarrage local

### 1. Cloner le dépôt

```powershell
git clone https://github.com/Onizuka-05/innov-events-manager.git
cd innov-events-manager
git switch dev
```

`main` contient le code en production et `dev` la branche d'intégration.

### 2. Créer le fichier `.env`

Le fichier `.env` contient les secrets locaux. Il n'est jamais commité (`.gitignore`). Pour le créer avec des valeurs aléatoires :

```powershell
function Nouveau-Secret { $b = New-Object byte[] 32; $g = [Security.Cryptography.RandomNumberGenerator]::Create(); $g.GetBytes($b); $g.Dispose(); [Convert]::ToBase64String($b).TrimEnd('=').Replace('+','-').Replace('/','_') }
@("POSTGRES_ADMIN_PASSWORD=$(Nouveau-Secret)", "POSTGRES_APP_PASSWORD=$(Nouveau-Secret)", "SESSION_SECRET=$(Nouveau-Secret)", "INTERNAL_PROXY_SECRET=$(Nouveau-Secret)") | Set-Content -Encoding ASCII .env
```

| Variable | Rôle |
|---|---|
| `POSTGRES_ADMIN_PASSWORD` | Mot de passe du propriétaire de la base (`postgres`) |
| `POSTGRES_APP_PASSWORD` | Mot de passe du rôle applicatif `innov_events_app`, aux droits limités |
| `SESSION_SECRET` | Signature du cookie de session (32 caractères au moins) |
| `INTERNAL_PROXY_SECRET` | Secret ajouté par les deux nginx pour accéder à l'API (32 à 128 caractères base64url) |

Les mots de passe des bases sont pris en compte **à la première création des volumes** seulement. Pour les changer ensuite, voir « Arrêter et réinitialiser ».

### 3. Lancer la pile Docker Compose

> Le fichier Compose fixe le nom du projet (`innov-events-manager`), donc le nom des volumes. Sur un poste qui a déjà cette pile, un second clone retrouverait ses volumes et ses données. Pour un essai à côté d'une pile existante : arrêter l'autre pile (mêmes ports), puis, dans une fenêtre PowerShell dédiée et avant toute commande Compose, `$env:COMPOSE_PROJECT_NAME = 'innov-events-essai'` ; garder ce nom jusqu'au nettoyage.

```powershell
docker compose up -d --build
docker compose ps
```

Le premier lancement construit les images et prend quelques minutes. Les six services doivent finir à l'état `healthy` : `postgres`, `mongo`, `mailpit`, `api`, `web`, `mobile`. PostgreSQL crée le schéma au premier démarrage (`database/CO-04-script-postgresql.sql`, puis `database/init/`).

| Adresse | Service |
|---|---|
| http://localhost:8080 | Site web |
| http://localhost:8100 | Application mobile |
| http://localhost:8025 | Mailpit : boîte de réception des e-mails envoyés en local (aucun envoi réel) |

L'API n'est pas exposée sur le poste : elle n'accepte que les requêtes relayées par les deux nginx. PostgreSQL (`127.0.0.1:5432`) et MongoDB (`127.0.0.1:27017`) ne sont joignables que depuis le poste.

### 4. Créer le compte administrateur

Le compte administrateur n'est jamais créé depuis l'application : il est créé par un script, une seule fois. Depuis la racine du dépôt :

```powershell
cd services\api
npm.cmd ci
$env:DATABASE_URL = 'postgresql://innov_events_app:' + ((Get-Content ..\..\.env | Select-String '^POSTGRES_APP_PASSWORD=').Line -split '=', 2)[1] + '@localhost:5432/innov_events'
$env:ADMIN_EMAIL = 'admin@example.org'; $env:ADMIN_IDENTIFIANT = 'admin'; $env:ADMIN_PRENOM = 'Chloé'; $env:ADMIN_NOM = 'Admin'
$s = Read-Host 'Mot de passe administrateur' -AsSecureString; $env:ADMIN_MOT_DE_PASSE = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($s))
npm.cmd run admin:create
Remove-Item Env:DATABASE_URL, Env:ADMIN_MOT_DE_PASSE; cd ..\..
```

Résultat attendu : `Compte administrateur créé.` `DATABASE_URL` est fixée explicitement sur la base locale : le script lui donne priorité sur toute autre configuration. Le mot de passe doit contenir au moins 8 caractères, dont une majuscule, une minuscule, un chiffre et un caractère spécial. Le script refuse de créer un second administrateur.

Se connecter ensuite sur http://localhost:8080 avec l'adresse et le mot de passe choisis. Les comptes des employés et des clients se créent depuis l'application (rubrique « Comptes » de l'administration, inscription, envoi du premier devis) ; leurs e-mails arrivent dans Mailpit.

### 5. Données de démonstration (facultatif)

Un jeu d'essai couvrant tous les rôles et tous les statuts existe pour une base **neuve et jetable** : `database/CO-05-jeu-essai.sql`, procédure dans `docs/tests/CO-05-resultats.md`. Il ne doit jamais être chargé en production.

## Tests et contrôles

Dans chaque application (`services/api`, `apps/web`, `apps/mobile`), après `npm.cmd ci` :

```powershell
npm.cmd run format:check
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run test:coverage
npm.cmd run build
```

Les tests d'intégration de l'API demandent une base PostgreSQL de test dédiée (variable `TEST_DATABASE_URL`) : la procédure est au §4.2 de `docs/tests/plan-de-tests.md`. Sans cette variable, ils sont ignorés. MongoDB y est remplacé par un double en mémoire. Les tests de bout en bout (`npm.cmd run test:e2e`, Playwright) se lancent sur le poste : ceux du site web sur la pile Compose démarrée, ceux du mobile sur le serveur de développement Angular (port 4200), avec des réponses d'API simulées.

Les mêmes contrôles (hors tests de bout en bout) s'exécutent dans GitHub Actions à chaque push et à chaque pull request sur `dev` et `main` (`.github/workflows/ci.yml`).

## Arrêter et réinitialiser

```powershell
docker compose down
```

arrête la pile et **conserve** les données (volumes `postgres_data` et `mongo_data`).

> **Attention :** `docker compose down -v` supprime aussi les volumes, donc **toutes les données locales** (comptes, devis, journaux). À réserver à une pile explicitement jetable (par exemple une pile d'essai lancée avec son propre `COMPOSE_PROJECT_NAME`, à supprimer par `docker compose -p <nom> down -v`).

Changer un secret ne demande pas de supprimer les volumes :
- `SESSION_SECRET` ou `INTERNAL_PROXY_SECRET` : modifier `.env`, puis `docker compose up -d --force-recreate api web mobile` (les sessions ouvertes sont perdues) ;
- `POSTGRES_APP_PASSWORD` : modifier `.env`, puis changer le mot de passe du rôle existant avec `docker compose exec postgres psql -U postgres -d innov_events -c '\password innov_events_app'` (saisir et confirmer à l'invite la valeur de `.env` : elle n'apparaît ni dans la commande ni dans l'historique), puis `docker compose up -d --force-recreate api`.

## Documentation

- [`docs/technique/`](docs/technique/README.md) : documentation technique consolidée.
- [`docs/utilisateur/guide-utilisateur.md`](docs/utilisateur/guide-utilisateur.md) : guide d'utilisation, un parcours par profil.
- [`docs/conception/CO-12-dossier-de-conception.md`](docs/conception/CO-12-dossier-de-conception.md) : dossier de conception (besoins, règles métier, livrables, traçabilité) ; [`docs/conception/`](docs/conception/) : cas d'utilisation, cycles de statuts, MCD, MLD, architecture, wireframes, charte graphique, maquettes.
- [`docs/tests/`](docs/tests/) : plan de tests, tableau des tests, couverture, rapports de vérification.
- [`docs/qualite.md`](docs/qualite.md) : branches, définition de « terminé », revues, CI/CD.
- [`docs/sauvegarde-restauration.md`](docs/sauvegarde-restauration.md) : sauvegarde et restauration des bases.
- [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md) : composants tiers et licences.
