# 2. Architecture et code

Schémas et description détaillée : [`docs/conception/CO-06-architecture.drawio.xml`](../conception/CO-06-architecture.drawio.xml) et [`docs/conception/CO-06-couches-securite.md`](../conception/CO-06-couches-securite.md).

## 2.1 Vue d'ensemble

```text
Navigateur (site web)        Navigateur (mobile)
        │ HTTPS                     │ HTTPS
        ▼                           ▼
  nginx « web »               nginx « mobile »        fichiers statiques Angular / Ionic
        │  /api : en-tête secret + IP du visiteur     │
        └──────────────┬──────────────────────────────┘
                       ▼
                 API Express (Node.js, TypeScript)
          ┌────────────┼──────────────┬──────────────┐
          ▼            ▼              ▼              ▼
     PostgreSQL     MongoDB      E-mails         PDF (PDFKit,
  (données, sessions) (journaux) (Mailpit / Brevo) généré à la demande)
```

Une seule API sert les deux interfaces : les règles métier, les contrôles d'accès et la validation ne sont écrits qu'une fois. Chaque interface appelle `/api` sur sa propre origine ; son nginx relaie la requête vers l'API. Aucun secret n'est présent dans le code des interfaces.

L'application mobile est une application web (Ionic et Angular) servie par nginx dans un conteneur Docker : elle s'ouvre dans le navigateur d'un téléphone Android ou iOS, sans passage par les magasins d'applications. Elle a été essayée sur iPhone (Safari) : parcours I1 à I6 de `docs/tests/J10-mobile-resultats.md`. Elle ne déclare pas de manifeste d'application web : son installation sur l'écran d'accueil comme application n'est pas revendiquée.

## 2.2 API : couches

| Couche | Dossier | Rôle |
|---|---|---|
| Configuration | `src/config/` | Lecture et contrôle des variables d'environnement ; démarrage refusé si une variable obligatoire manque |
| Middlewares | `src/middlewares/` | Accès réservé aux deux nginx, IP du visiteur, limitation de débit, authentification et rôles, gestion centrale des erreurs |
| Routes | `src/routes/` | Association des URL aux contrôleurs, middlewares propres à chaque route |
| Contrôleurs | `src/controllers/` | Lecture et validation de la requête HTTP, appel du service, réponse JSON |
| Services | `src/services/` | Règles métier (statuts, totaux, envoi des devis, comptes, purges), e-mails, PDF, journaux |
| Repositories | `src/repositories/` | Accès aux données : SQL paramétré (`pg`) pour PostgreSQL, pilote officiel pour MongoDB |
| Utilitaires HTTP | `src/http/` | Erreur HTTP typée, fonctions de validation des entrées |
| Scripts | `src/scripts/` | Création du compte administrateur, hors HTTP |

Ordre de traitement d'une requête (`src/app.ts`) : en-têtes de sécurité (helmet) → contrôle du secret des nginx → JSON limité à 32 ko → IP du visiteur → limitation globale de débit → session → contrôle de la session restreinte → jeton CSRF → routes → route absente (404) → gestionnaire d'erreurs.

Les services et les repositories sont des classes TypeScript ; leurs dépendances (pool PostgreSQL, base MongoDB, service d'e-mails) sont passées au constructeur. Les tests peuvent ainsi remplacer un service d'e-mails par un double et utiliser une base de test.

## 2.3 Interfaces web et mobile

| Élément | Site web (`apps/web/src/app`) | Mobile (`apps/mobile/src/app`) |
|---|---|---|
| Pages | `pages/` : accueil, événements, demande de devis, contact, authentification, espace client, espace de l'équipe (`gestion/`), pages légales | `home/` (liste), `evenement/`, `client/`, `connexion/`, `page-legale/` |
| Services communs | `core/` : appels à l'API (`api.service.ts`), authentification, gardes de navigation, modèles, table des statuts (`statuts.ts`) | `core/` : mêmes rôles |
| Navigation | Routes chargées à la demande, gardes selon le rôle ; un menu par rôle | Routes Ionic, garde de connexion |

Les gardes de navigation améliorent le parcours (une page interdite n'est pas affichée), mais l'autorisation est toujours vérifiée par l'API. Les libellés et les couleurs des statuts viennent d'une table unique (`core/statuts.ts`) pour que chaque statut s'affiche de la même façon partout.

## 2.4 Conventions de code

| Élément | Convention | Exemple |
|---|---|---|
| Langue | Noms métier en français, comme les tables | `DevisService`, `envoyerDevis`, `id_evenement` |
| Classes | PascalCase, suffixe du rôle | `EspaceClientRepository`, `GestionController` |
| Fonctions et variables | camelCase, verbe à l'infinitif pour une action | `verifierAccesProxy`, `chargerConfiguration` |
| Fichiers | kebab-case, suffixe du rôle | `espace-client.service.ts`, `authentification.guard.ts` |
| Tables et colonnes SQL | snake_case, schéma `innov_events` | `lignes_devis`, `date_accord_publication` |
| Routes HTTP | noms au pluriel, en minuscules | `POST /api/prospects`, `GET /api/evenements-publics` |
| Tests | à côté du fichier testé, `.spec.ts` ; intégration de l'API dans `src/routes/*.integration.spec.ts` | `devis.service.spec.ts` |

Contrôles automatiques, dans chaque application et dans la CI : ESLint sans erreur (et sans avertissement pour le web et le mobile), Prettier (formatage), vérification TypeScript. Les fonctions publiques, middlewares et requêtes non évidentes sont commentés en JSDoc (`/** … */`), en particulier les choix de sécurité et de concurrence (ordre des verrous, contrôles faits dans la même instruction SQL).

## 2.5 Gestion des erreurs

- **Gestionnaire central** (`src/middlewares/erreurs.middleware.ts`) : toute erreur remonte à un seul middleware, qui renvoie un statut et un message sans détail technique (ni trace, ni requête SQL, ni nom de table).
- **Erreurs attendues** : levées comme `ErreurHttp` (statut, message en clair, code éventuel, par exemple `409 FICHES_EN_DOUBLE`), affichées telles quelles par les interfaces.
- **Erreurs de la base traduites** : doublon (`23505`) → 409 « Cette valeur est déjà utilisée » ; référence absente ou utilisée (`23503`) → 409 ; contrainte non respectée (`23514`) → 400 ; JSON mal formé → 400 ; requête trop volumineuse → 413 ; jeton CSRF invalide → 403.
- **Ressource absente** : 404 neutre (« Ressource introuvable »). Une ressource d'un autre client répond aussi 404, pour ne pas révéler son existence.
- **Services externes** : base de journaux indisponible → la connexion est refusée (le journal de connexion est obligatoire) et l'effacement d'un compte répond 503 sans rien supprimer ; échec d'envoi d'un e-mail, selon l'opération : envoi d'un devis → annulé en entier (statut du devis, compte créé ou rattaché), qu'il contienne ou non un mot de passe ; compte créé par l'administratrice → non créé ; inscription publique → compte créé et utilisable, échec tracé ; demande de devis → enregistrée, l'écran invite à ne pas la renvoyer ; mot de passe oublié → temporaire enregistré, échec tracé sans révéler l'existence du compte, mot de passe habituel toujours utilisable s'il existe ; état dégradé signalé par `/api/sante` (503) et une ligne JSON sans secret.
- **Validation** : chaque entrée est contrôlée côté serveur (types, longueurs, formats, champs inconnus refusés), même si l'interface l'a déjà contrôlée.
- **Cas limites testés** : données invalides, doublons, ressource absente ou d'un autre client, transitions de statut interdites, opérations simultanées (deux connexions PostgreSQL dans les tests d'intégration) ; liste dans [`docs/tests/tableau-des-tests.md`](../tests/tableau-des-tests.md).
