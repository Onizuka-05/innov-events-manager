# Composants tiers et licences

Innov'Events Manager utilise les composants open source listés ci-dessous. Chacun reste soumis à sa propre licence ; le texte complet de chaque licence est fourni avec le paquet (fichier `LICENSE` dans `node_modules/<paquet>/` après `npm ci`) ou sur la page du projet.

Relevé du 18/11/2026, à partir des fichiers `package-lock.json` de chaque application (versions installées par `npm ci`). Toutes les licences des dépendances d'exécution (code livré au navigateur ou exécuté par l'API) sont permissives (MIT, MIT-0, ISC, BSD, 0BSD, Apache-2.0) et compatibles avec une exploitation commerciale ; aucune n'est copyleft. L'outillage de développement, non livré, comprend en plus quelques licences d'une autre nature (section « Outillage : autres licences »).

## API (`services/api`)

### Dépendances d'exécution

| Paquet | Version | Licence | Usage |
|---|---|---|---|
| express | 5.3.0 | MIT | Serveur HTTP |
| express-session | 1.19.0 | MIT | Sessions |
| connect-pg-simple | 10.0.0 | MIT | Stockage des sessions dans PostgreSQL |
| @dr.pogodin/csurf | 1.18.2 | MIT | Protection CSRF |
| helmet | 8.3.0 | MIT | En-têtes de sécurité HTTP |
| express-rate-limit | 8.7.4 | MIT | Limitation de débit |
| argon2 | 0.45.2 | MIT | Hachage des mots de passe (Argon2id) |
| pg | 8.23.1 | MIT | Client PostgreSQL |
| mongodb | 6.22.0 | Apache-2.0 | Pilote MongoDB (journaux) |
| nodemailer | 10.5.0 | MIT-0 | Envoi d'e-mails en local (SMTP vers Mailpit) |
| pdfkit | 0.20.2 | MIT | Génération des devis en PDF |

Ensemble des dépendances d'exécution, directes comprises (138 paquets) : 122 MIT, 8 ISC, 4 Apache-2.0, 1 MIT-0, 1 BSD-2-Clause, 1 BSD-3-Clause, et `png-js` 2.0.0 (dépendance de PDFKit), dont le fichier de verrouillage n'indique pas de licence : sa licence MIT a été vérifiée dans le dépôt source du projet (fichier `LICENSE`). Les PDF utilisent les polices standard du format PDF (métriques fournies avec PDFKit) : aucun fichier de police n'est embarqué.

### Outils de développement (non livrés en production)

| Paquet | Version | Licence |
|---|---|---|
| typescript | 5.9.3 | Apache-2.0 |
| tsx | 4.23.15 | MIT |
| vitest, @vitest/coverage-v8 | 5.1.0 | MIT |
| supertest | 7.3.2 | MIT |
| eslint, @eslint/js | 9.39.5 | MIT |
| typescript-eslint | 8.72.2 | MIT |
| eslint-config-prettier | 10.1.8 | MIT |
| prettier | 3.10.1 | MIT |
| @types/node 24.19.2, @types/express 5.0.6, @types/express-session 1.19.0, @types/connect-pg-simple 7.0.3, @types/pg 8.23.1, @types/nodemailer 8.0.2, @types/pdfkit 0.17.7, @types/supertest 6.0.3 | — | MIT |

## Site web (`apps/web`)

### Dépendances d'exécution (intégrées au code livré au navigateur)

| Paquet | Version | Licence |
|---|---|---|
| @angular/core, common, compiler, forms, platform-browser, router | 22.2.6 | MIT |
| rxjs | 7.8.2 | Apache-2.0 |
| tslib | 2.9.1 | 0BSD |

Ensemble des dépendances d'exécution, directes comprises (10 paquets) : 8 MIT, 1 Apache-2.0, 1 0BSD.

### Outils de développement

| Paquet | Version | Licence |
|---|---|---|
| @angular/cli, @angular/build | 22.2.7 | MIT |
| @angular/compiler-cli | 22.2.6 | MIT |
| typescript | 6.0.3 | Apache-2.0 |
| vitest, @vitest/coverage-v8 | 5.1.0 | MIT |
| jsdom | 30.1.3 | MIT |
| @playwright/test | 1.65.1 | Apache-2.0 |
| eslint 10.14.0, @eslint/js 10.0.1, angular-eslint 22.6.0, typescript-eslint 8.71.0 | — | MIT |
| prettier | 3.10.1 | MIT |

`@playwright/test` pilote un navigateur pour les tests de bout en bout ; les navigateurs qu'il télécharge pour les tests ne sont ni modifiés ni redistribués.

## Application mobile (`apps/mobile`)

### Dépendances d'exécution

| Paquet | Version | Licence |
|---|---|---|
| @angular/core, common, compiler, forms, platform-browser, router | 22.2.5 | MIT |
| @ionic/angular | 9.0.11 | MIT |
| ionicons | 8.1.0 | MIT |
| @capacitor/core 8.6.2, @capacitor/app 8.1.2, @capacitor/haptics 8.0.2, @capacitor/keyboard 8.0.6, @capacitor/status-bar 8.0.4 | — | MIT |
| rxjs | 7.8.2 | Apache-2.0 |
| tslib | 2.9.1 | 0BSD |

Ensemble des dépendances d'exécution, directes comprises (28 paquets) : 26 MIT, 1 Apache-2.0, 1 0BSD.

### Outils de développement

| Paquet | Version | Licence |
|---|---|---|
| @angular/cli, @angular/build | 22.2.6 | MIT |
| @angular/compiler-cli, @angular/language-service | 22.2.5 | MIT |
| @capacitor/cli | 8.6.2 | MIT |
| @ionic/angular-toolkit 13.0.0, @ionic/eslint-config 0.5.0 | — | MIT |
| typescript | 6.0.3 | Apache-2.0 |
| vitest, @vitest/coverage-v8 | 5.1.0 | MIT |
| jsdom | 31.0.0 | MIT |
| @playwright/test | 1.65.0 | Apache-2.0 |
| eslint 10.14.0, angular-eslint 22.6.0, typescript-eslint 8.72.2 | — | MIT |
| prettier | 3.10.1 | MIT |
| @types/node | 26.6.6 | MIT |

Pour le site web et l'application mobile, le build de production produit aussi un fichier `3rdpartylicenses.txt` qui reprend le texte des licences des paquets intégrés au code livré.

## Outillage : autres licences

Dépendances indirectes des outils de build et de test, installées par `npm ci` mais absentes du code livré :

| Paquet | Applications | Licence | Remarque |
|---|---|---|---|
| `lightningcss` et ses binaires par plateforme | API, web, mobile (outillage de test et de build) | MPL-2.0 | Copyleft faible, au niveau du fichier : seules des modifications de ses propres fichiers devraient être publiées ; utilisé tel quel comme outil |
| `caniuse-lite` | web, mobile | CC-BY-4.0 | Données de compatibilité des navigateurs, utilisées au build |
| `mdn-data` | web | CC0-1.0 | Données de référence CSS |
| `@bufbuild/protobuf` | web, mobile | Apache-2.0 et BSD-3-Clause | — |
| `big-integer`, `stream-buffers` | mobile (`@capacitor/cli`) | Unlicense (domaine public) | — |

## Images Docker et services

| Composant | Usage | Licence ou conditions |
|---|---|---|
| `node:24-alpine` | Construction des trois applications, exécution de l'API | Node.js : MIT ; Alpine Linux : paquets sous leurs licences respectives |
| `nginx:1.30-alpine` | Service du site web et de l'application mobile | nginx : BSD-2-Clause |
| `postgres:16.15-alpine` | Base locale, tests et CI | PostgreSQL License (permissive) |
| `mongo:8.0` | Base de journaux en local uniquement | MongoDB Community Server : Server Side Public License (SSPL) ; utilisée comme outil local, sans modification ni redistribution, et sans être proposée comme service |
| `axllent/mailpit:v1.32.0` | Réception des e-mails en local | MIT |
| GitHub Actions `actions/checkout`, `actions/setup-node`, `actions/upload-artifact` (v6) | Intégration continue | MIT |

En production, les bases et l'envoi d'e-mails sont des services hébergés, utilisés selon leurs conditions d'utilisation : Render (hébergement des trois services), Neon (PostgreSQL), MongoDB Atlas (journaux), Brevo (e-mails). Aucun de leurs logiciels n'est intégré au dépôt.

## Ressources graphiques

Les illustrations (`apps/web/public/images/*.svg`) et le favicon sont des compositions propres au projet ; aucune photo, police ou illustration tierce n'y est incorporée. Le site utilise la police système de l'utilisateur, sans fichier de police téléchargé. Les icônes de l'application mobile viennent d'Ionicons (MIT). Détail : `docs/ressources-site-public.md`.
