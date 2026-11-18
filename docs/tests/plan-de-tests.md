# Plan de tests — Innov’Events Manager (TST-05)

## 1. Objectifs

- Vérifier que chaque fonctionnalité retenue respecte ses critères d’acceptation, sur le site web, l’application mobile et l’API.
- Prouver la sécurité attendue d’une application qui traite des données personnelles : contrôle d’accès par rôle et par propriété, protection contre les attaques courantes, traçabilité.
- Détecter les régressions à chaque modification, avant la fusion dans `dev` puis dans `main`.
- Garder une trace écrite des résultats obtenus, comparés aux résultats attendus.

## 2. Périmètre

Toutes les fonctionnalités retenues, regroupées comme dans l’index des exigences. Le détail des tests automatisés de chaque groupe est dans `docs/tests/tableau-des-tests.md`.

| Groupe | Exigences | Niveaux de test |
| --- | --- | --- |
| Site public | PUB-01 à PUB-09 | Unitaire (composants web), intégration (API), bout en bout (demande de devis), acceptation |
| Authentification et comptes | AUTH-01 à AUTH-06 | Unitaire, intégration (sessions PostgreSQL réelles, hachage, mots de passe temporaires), acceptation |
| Processus commercial | DEV-01 à DEV-10 | Unitaire (calculs, statuts), intégration (transactions, PDF, envoi), acceptation |
| Espace client | CLI-01 à CLI-07 | Unitaire (écrans), intégration (propriété, effacement, avis, accord de publication), acceptation |
| Espace employé | EMP-01 à EMP-05 | Unitaire, intégration, acceptation |
| Espace administrateur | ADM-01 à ADM-09 | Unitaire, intégration, acceptation |
| Journalisation | LOG-01 à LOG-03 | Unitaire (index d’expiration), intégration (journaux écrits, sans mot de passe ni corps de requête), acceptation dans MongoDB Atlas |
| Application mobile | MOB-01 à MOB-07 | Unitaire (pages), bout en bout (Playwright, API simulée), essai sur iPhone réel |
| Transverse | TR-01 à TR-07 | Unitaire (accessibilité des composants), intégration (sécurité), contrôles manuels (clavier, 375 px, mode sombre) |
| Déploiement | DEP-01, DEP-05, DEP-07 | Système (production), sauvegarde et restauration |

Hors périmètre : les tests de charge et de performance, inadaptés aux offres gratuites d’hébergement (quotas et mise en veille), et les tests de pénétration externes.

## 3. Environnements

| Environnement | Composition | Usage | Données |
| --- | --- | --- | --- |
| Tests automatisés locaux | Node.js 24, Vitest ; base PostgreSQL 16.15 **dédiée et jetable** (`innov_events_tests`, conteneur Docker séparé, port 55432) désignée par `TEST_DATABASE_URL` ; MongoDB et e-mails simulés | Unitaires et intégration, avant chaque commit | Créées puis effacées par chaque test ; le script refuse une base dont le nom ne finit pas par `_tests` |
| Pile locale complète | Docker Compose : web (8080), mobile (8100), API, PostgreSQL, MongoDB, Mailpit (8025) | Tests de bout en bout du web, parcours manuels (système), restauration des sauvegardes | Comptes et demandes fictifs ; bases locales distinctes de la production |
| Intégration continue | GitHub Actions, à chaque push et PR sur `dev` et `main` : trois jobs (API, web, mobile) ; PostgreSQL 16.15 jetable et nginx pour l’API | Formatage, lint, types, tests et couverture, build, audit des dépendances de production | Jetables |
| Production | Render (web, mobile, API), Neon (PostgreSQL), MongoDB Atlas, Brevo | Vérifications finales après déploiement (acceptation), essai sur iPhone réel | Comptes de démonstration ; aucun test destructif |

## 4. Niveaux de test et procédures d’exécution

### 4.1 Tests unitaires

Une fonction, un service ou un composant isolé, ses dépendances simulées (API, base, envoi d’e-mails). Écrits avec chaque fonctionnalité (TST-01).

Procédure, pour chaque application (`services/api`, `apps/web`, `apps/mobile`) :
1. `npm.cmd ci`
2. `npm.cmd run test:coverage`
3. Résultat attendu : tous les tests réussis ; couverture relevée dans `docs/tests/couverture.md`.

### 4.2 Tests d’intégration

L’API Express complète (routes, contrôleurs, services, repositories) interrogée par Supertest, sur une base PostgreSQL réelle créée à partir du script `database/CO-04-script-postgresql.sql` ; tests de nginx réel pour les en-têtes de confiance.

Procédure :
1. `docker run -d --name innov-events-tests -e POSTGRES_PASSWORD=test-ci -e POSTGRES_DB=innov_events_tests -p 127.0.0.1:55432:5432 postgres:16.15-alpine`
2. `docker exec innov-events-tests pg_isready -h 127.0.0.1 -U postgres` jusqu’à « accepting connections »
3. Dans `services/api` : `$env:TEST_DATABASE_URL = 'postgresql://postgres:test-ci@localhost:55432/innov_events_tests'`, puis `npm.cmd run test:coverage`
4. Résultat attendu : tous les tests réussis ; sur un poste sans nginx, 2 tests de nginx ignorés (exécutés par la CI).
5. Nettoyage : `Remove-Item Env:TEST_DATABASE_URL`, puis `docker rm -f innov-events-tests`.

### 4.3 Tests système

L’application complète, conteneurs construits, dans les conditions les plus proches de la production : pile Docker Compose locale.

Procédure :
1. `docker compose up -d --build` à la racine ; attendu : six services démarrés.
2. Tests de bout en bout automatisés du web : dans `apps/web`, `npm.cmd run test:e2e` (demande de devis, contrôle de l’e-mail dans Mailpit). Attendu : tous réussis.
3. Tests de bout en bout du mobile : dans `apps/mobile`, `npm.cmd run test:e2e`. Attendu : tous réussis.
4. Parcours manuels décrits dans les rapports `docs/tests/` de chaque lot (connexion par rôle, devis complet, espace client, mobile, clavier, 375 px).
5. Restauration d’une sauvegarde sur la pile locale (`docs/sauvegarde-restauration.md`).

### 4.4 Tests d’acceptation

Validation des critères d’acceptation des exigences par le Product Owner, sur la production, avec des comptes de démonstration.

Procédure :
1. Après la fusion dans `main` et le déploiement automatique, vérifier `/api/sante` via le site web et le mobile.
2. Dérouler les scénarios du tableau de la section 8, du point de vue de chaque rôle (visiteur, client, employé, administratrice).
3. Noter le résultat obtenu face au résultat attendu ; tout écart est une anomalie (section 9).

## 5. Tests de sécurité

| Risque | Mesure | Preuve |
| --- | --- | --- |
| Accès non autorisé | Rôle et propriété contrôlés côté serveur sur chaque route ; session relue en base à chaque requête | Matrice d’accès de toutes les routes pour les quatre rôles (`j10.integration.spec.ts`) ; ressource d’un autre client en 404 ; rôle et statut relus (`j7.integration.spec.ts`) ; gardes de navigation web et mobile |
| Falsification de requête (CSRF) | Jeton CSRF obligatoire sur toute écriture | « CSRF obligatoire sur … » (`j7.integration.spec.ts`), `csrf.routes.spec.ts` |
| Injection SQL | Requêtes paramétrées uniquement ; champs inconnus refusés | Revue de code ; injection de rôle et de statut refusées (`j7.integration.spec.ts`) ; contrôle manuel S1 (section 8) |
| Injection HTML (XSS) | Échappement par Angular ; texte affiché comme texte ; politique de sécurité du contenu (CSP) et en-têtes posés par nginx et helmet | « affiche un message comme texte, sans executer son contenu HTML » (web) ; e-mails en texte brut (`courriels.service.spec.ts`) ; contrôle manuel S2 |
| Mots de passe | Hachage Argon2id ; mot de passe temporaire à usage unique et limité dans le temps ; aucun haché renvoyé | `j7.integration.spec.ts` (inscription, connexion, oubli, changement imposé) |
| Force brute et abus | Limitation de débit par adresse IP réelle (connexion, formulaires, profil) | « limitation de connexion fondee sur la meme IP dediee » (`j7.integration.spec.ts`) |
| Sessions | Cookie `HttpOnly`, `Secure` en production, `SameSite=Lax` ; session régénérée à la connexion ; sessions détruites à la suppression du compte | `j7.integration.spec.ts`, `j10.integration.spec.ts` ; vérification du cookie en production |
| IP réelle et en-têtes forgés | L’API n’accepte que les appels de ses deux nginx (secret interne) ; en-têtes `X-Forwarded-For` et `CF-Connecting-IP` forgés ignorés | `acces-proxy.middleware.spec.ts`, `ip-client.middleware.spec.ts`, `nginx.integration.spec.ts` |
| Fuite d’informations | Erreurs sans détail technique ; aucune donnée personnelle dans les sorties console | `erreurs.middleware.spec.ts` ; tests des lignes JSON des purges et de l’effacement |
| Données personnelles (RGPD) | Effacement par le client, purges automatiques, adresses IP effacées après 6 mois | `j10.integration.spec.ts`, `purges.service.spec.ts`, `logs.repository.spec.ts` |
| Dépendances vulnérables | `npm audit --omit=dev --audit-level=high` à chaque exécution de la CI | Artefact `artifacts/audit.log` |

## 6. Évolutions technologiques

- **Versions figées** : Node.js 24 (LTS) dans les images Docker et la CI ; PostgreSQL 16.15 et MongoDB 8.0 identiques en local, en CI et en production ; fichiers `package-lock.json` versionnés et installés par `npm ci`.
- **Audit continu** : la CI échoue si une vulnérabilité élevée ou critique touche une dépendance de production.
- **Mises à jour** : aucun outil automatique de mise à jour (Dependabot n’est pas configuré). Procédure manuelle, une fois par mois et à chaque alerte de sécurité :
  1. branche `chore/mise-a-jour-dependances` depuis `dev` ;
  2. `npm.cmd outdated` dans chaque application ; mises à jour mineures et correctives par `npm.cmd update` ; versions majeures (Angular, Ionic, Express, Node.js) une par une, avec leur guide de migration ;
  3. exécution complète des niveaux 4.1 à 4.3, CI verte, puis PR ;
  4. jamais `npm audit fix --force`.
- **Services hébergés** : MongoDB Atlas met à jour lui-même la version 8.0 ; Neon et Render annoncent leurs changements par e-mail. Après une annonce, relancer les tests d’acceptation de la section 8.
- **Veille** : suivie dans la veille technologique et sécurité du projet (DEP-06).

## 7. Critères d’entrée et de sortie

**Entrée** (une PR peut être testée) : branche à jour par rapport à `dev` ; dépendances installées par `npm ci` ; base de test dédiée disponible ; pile Compose démarrée pour les tests système.

**Sortie** (une PR peut être fusionnée) :
- formatage, lint, types, tests, build et audit de production réussis sur le poste et dans les trois jobs de la CI ;
- tests de bout en bout réussis pour les parcours modifiés ;
- couverture sans baisse inexpliquée ;
- parcours manuels du rapport `docs/tests/` complétés, sans anomalie bloquante ouverte ;
- pour `main` : tests d’acceptation de la section 8 rejoués après le déploiement.

## 8. Résultats attendus et obtenus

Scénarios d’acceptation et contrôles manuels. Une ligne non conforme ouvre une anomalie (section 9).

| N° | Exigence | Scénario | Résultat attendu | Résultat obtenu | Date |
| --- | --- | --- | --- | --- | --- |
| A1 | PUB-06 | Demande de devis depuis l’accueil, en visiteur | Remerciement affiché ; ligne « à contacter » ; e-mail reçu à l’adresse de contact | Conforme : bloc « Votre demande a été enregistrée » ; e-mail « Nouvelle demande de devis » reçu à l’adresse de contact ; demande « à contacter » dans « Prospects » | 18/11/2026 |
| A2 | AUTH-01, AUTH-02 | Inscription puis connexion d’un client | Compte créé, e-mail de confirmation ; connexion vers l’espace client | Conforme : compte créé, e-mail de confirmation sans mot de passe ; connexion vers l’espace client | 18/11/2026 |
| A3 | AUTH-03 | Mot de passe oublié | E-mail avec mot de passe temporaire ; changement imposé à la connexion | Conforme : e-mail « Mot de passe temporaire Innov’Events » ; page « Choisir un nouveau mot de passe » imposée, puis espace client | 18/11/2026 |
| A4 | AUTH-04 | Client qui saisit l’adresse d’une page d’administration | Accès refusé, redirection vers son espace | Conforme : `/administration` saisi par un client redirige vers l’espace client | 18/11/2026 |
| A5 | DEV-01 à DEV-07 | Conversion d’une demande, événement, devis à deux prestations, PDF, envoi | Totaux HT, TVA et TTC exacts ; PDF ; e-mail au client ; compte client créé si absent | Conforme : conversion, événement, devis à deux prestations ; HT 2 050,50 €, TVA 410,10 €, TTC 2 460,60 € à l’écran et dans le PDF ; e-mail au client avec le PDF et un mot de passe temporaire (compte créé) | 18/11/2026 |
| A6 | CLI-01 | Le client accepte le devis | Statut « accepté » visible par l’administratrice | Conforme : devis « accepté » côté client et dans la liste des devis de l’administratrice | 18/11/2026 |
| A7 | CLI-03 | Le client modifie son téléphone | Fiche à jour ; journal de modification sans nom | Conforme : téléphone mis à jour, e-mail du contact en lecture seule ; journal sans nom vérifié par le test d’intégration « modifie le profil avec les controles… » | 18/11/2026 |
| A8 | CLI-06, EMP-05, PUB-09 | Avis sur un événement terminé, modération par l’employé | Avis publié sur la page Avis, sans nom de client | Conforme : avis « en attente », validé par l’employé, publié sur la page Avis sans nom ni entreprise | 18/11/2026 |
| A9 | CLI-07, PUB-07, PUB-08 | Accord de publication donné puis retiré | Événement visible puis absent de la page Événements, jamais de prix | Conforme : événement visible sur la page Événements après l’accord, sans prix, puis absent après le retrait | 18/11/2026 |
| A10 | CLI-04 | Le client supprime son compte | Déconnexion ; connexion refusée ensuite ; fiche anonymisée ; nom absent des journaux | Conforme : déconnexion immédiate, reconnexion refusée, fiche anonymisée ; événement, devis et avis conservés ; retrait du nom des journaux vérifié par le test d’intégration « efface le compte, anonymise la fiche… » | 18/11/2026 |
| A11 | EMP-01 à EMP-04 | Employé : fiche client, fiche événement, note, tâche | Données affichées ; note et tâche enregistrées | Conforme, avec le compte employé de José créé par l’administratrice : fiches client et événement affichées, note et tâche enregistrées | 18/11/2026 |
| A12 | ADM-01, ADM-07 | Administratrice : tableau de bord, journaux | Chiffres clés ; journaux filtrés par type | Conforme : chiffres clés du tableau de bord ; journaux filtrés par type d’action | 18/11/2026 |
| A13 | MOB-01 à MOB-04 | Employé sur iPhone : liste, fiche, client, note | Appel, e-mail et itinéraire ouverts ; note visible sur le web | Conforme : I1 à I5 de `docs/tests/J10-mobile-resultats.md` (iPhone, Safari, compte de José) | 18/11/2026 |
| A14 | MOB-07, PUB-04 | CGU et CGV sur le web et le mobile, sans connexion | Pages lisibles, contenu identique | Conforme : CGU et CGV lisibles sans connexion sur le web et le mobile, contenu identique | 18/11/2026 |
| A15 | LOG-02, LOG-03 | Connexion puis action d’un administrateur | Journaux dans MongoDB Atlas avec la date au format ISODate ; adresse IP réelle ; aucun mot de passe | Conforme : collection `logs` d’Atlas, connexion de l’administratrice : `horodatage` de type Date (ISODate), adresse IP publique réelle, aucun mot de passe | 18/11/2026 |
| A16 | DEP-05 | Fusion dans `main` modifiant l’API | Déploiement automatique ; `/api/sante` répond | Conforme : `main` à `86edc0a`, CI n° 69 verte ; trois services Render « Deploy live » sur ce commit ; `/api/sante` répond via le web et le mobile | 18/11/2026 |
| A17 | DEP-07 | Sauvegarde de Neon et d’Atlas, restauration locale | Comptages identiques entre sauvegarde et restauration | Conforme : 12 tables et 9 journaux identiques ; données des sessions exclues par construction (détail : `docs/tests/J10-validation-resultats.md`, B1 à B6) | 17/11/2026 |
| S1 | TR-03 | Champ « Entreprise » de la demande de devis : `Test'); DROP TABLE prospects;--` | Demande enregistrée avec ce texte exact ; aucune table affectée. En production, un refus par la protection de l’hébergeur est accepté (rien n’est enregistré) | Écart accepté par le Product Owner le 18/11/2026 : en production, requête bloquée en amont par la protection de l’hébergeur (403 avec une page de blocage, aucune trace dans les journaux de l’API), rien n’est enregistré, aucune table affectée. Sur une copie isolée du code `86edc0a` (base jetable), texte enregistré au caractère près | 18/11/2026 |
| S2 | TR-03 | `<img src=x onerror=alert(1)>` dans le champ « Entreprise » de la demande de devis, puis affichage dans « Prospects » (la description du besoin n’est pas affichée dans l’espace de l’équipe) | Texte affiché tel quel, aucun script exécuté | Conforme : texte affiché tel quel dans « Prospects », sans image ni script exécuté. Le même texte dans la description du besoin est enregistré ; il n’apparaît que dans l’e-mail de notification, non observé pour ce contrôle | 18/11/2026 |
| S3 | TR-03 | Appel direct de l’API Render sans passer par le site | Réponse 403 | Conforme : `GET /api/csrf` sur l’adresse Render de l’API → 403 (`/api/sante` reste ouverte aux sondes de l’hébergeur) | 18/11/2026 |
| S4 | TR-03 | Six demandes de devis en moins de 15 minutes depuis le même poste | La sixième est refusée (429) | Conforme : cinq demandes enregistrées, la sixième refusée avec « Trop de demandes. Réessayez dans quelques minutes. » | 18/11/2026 |
| S5 | TR-01, TR-02 | Parcours au clavier seul et à 375 px de large | Ordre logique, focus visible, aucun défilement horizontal | Conforme : accueil, demande de devis et espace client au clavier seul (ordre logique, focus visible) ; aucun défilement horizontal à 375 px | 18/11/2026 |

Recette du 18/11/2026 sur la production, avec des comptes de démonstration et le compte employé de José. En complément, 234 tests de l’API, 182 tests du web et 58 tests du mobile ont réussi sur une copie isolée du commit `86edc0a` (base PostgreSQL jetable, aucune donnée de production).

Observations :
- La protection de l’hébergeur placée devant les services refuse les requêtes dont le texte ressemble à une commande SQL (S1) : une saisie légitime de ce type serait refusée avec le message « Le service est momentanément indisponible ». Écart accepté : il n’entraîne ni perte ni exposition de données, et l’application elle-même enregistre ce texte tel quel.
- La description du besoin d’une demande n’est visible par l’équipe que dans l’e-mail de notification ; elle n’est pas affichée dans « Prospects » (piste d’amélioration).

## 9. Gestion des anomalies

1. **Constat** : toute différence entre résultat attendu et obtenu, tout test en échec ou tout comportement inattendu.
2. **Enregistrement** : issue GitHub (titre explicite, étapes pour reproduire, résultat attendu, résultat obtenu, environnement, gravité : bloquante, majeure, mineure) ; consignation dans le journal des incidents (symptôme, diagnostic, correction ; DEP-10).
3. **Correction** : branche `fix/*` depuis `dev` ; un test qui reproduit l’anomalie est ajouté avant la correction quand c’est possible.
4. **Vérification** : le test ajouté et les niveaux concernés réussissent ; le scénario est rejoué et la ligne de la section 8 mise à jour.
5. **Clôture** : PR fusionnée par merge commit avec `Fixes #N` ; une anomalie bloquante empêche toute fusion dans `main` tant qu’elle est ouverte.
