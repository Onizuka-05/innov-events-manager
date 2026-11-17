# Vérifications — validation des tests et sauvegarde des bases (J10)

Date : 17/11/2026

Branche : `feature/j10-validation`, créée depuis `dev` après la fusion des PR de l’API, du web et du mobile du J10. Poste : Windows 11, PowerShell 5.1, Node.js 24.22.0, Docker Desktop.

## Contenu

| Exigence | Livrable |
| --- | --- |
| TST-02 | Test de bout en bout `apps/web/e2e/demande-devis.spec.ts` (Playwright, pile Docker Compose réelle, e-mail vérifié dans Mailpit) ; tests unitaires du service de demande de devis `services/api/src/services/formulaires.service.spec.ts` ; synthèse des trois niveaux dans `docs/tests/TST-02-demande-devis.md` |
| TST-03 | `docs/tests/couverture.md` : où lire les rapports, relevés des trois applications, lecture des chiffres |
| TST-04 | `outils/tableau-des-tests.mjs` (Node.js, sans dépendance) et `docs/tests/tableau-des-tests.md`, regroupé par fonctionnalité, avec le nombre de tests et le niveau |
| TST-05 | `docs/tests/plan-de-tests.md` : objectifs, périmètre, environnements, niveaux et procédures, sécurité, évolutions technologiques, critères d’entrée et de sortie, résultats attendus et obtenus, anomalies |
| DEP-07 | `database/sauvegarde/Sauvegarder-Bases.ps1`, `Restaurer-Bases.ps1`, requêtes de comptage, et `docs/sauvegarde-restauration.md` |
| TST-01 | Les tests unitaires des composants sont recensés par fonctionnalité dans le tableau des tests |

Outillage du web : dépendance de développement `@playwright/test` (même plage que le mobile), script `test:e2e`, vérification des types et du formatage étendue au dossier `e2e/`, rapports Playwright ignorés par Git (`apps/web/.gitignore`).

## Contrôles

| Commande | Résultat | Preuve |
| --- | --- | --- |
| `apps/web` : `npm.cmd install` (ajoute `@playwright/test` au fichier de verrouillage) | Réussi : `added 3 packages` ; `package-lock.json` : 46 lignes ajoutées, aucune supprimée | Sortie de la commande |
| `apps/web` : `npm.cmd run format:check` | Réussi | |
| `apps/web` : `npm.cmd run lint` | Réussi : `All files pass linting.` | |
| `apps/web` : `npm.cmd run typecheck` (application, tests unitaires et `e2e/`) | Réussi, aucune erreur | |
| `apps/web` : `npm.cmd run test:coverage` | Réussi : 12 fichiers, 179 tests réussis ; lignes 82,49 % | |
| `apps/web` : `npm.cmd run build` | Réussi | |
| `apps/web` : `npm.cmd audit --omit=dev --audit-level=high` | Réussi : `found 0 vulnerabilities` | |
| `services/api` : `npm.cmd run format:check`, `lint`, `typecheck` | Réussi, aucune erreur | |
| `services/api` : `npm.cmd run test:coverage` (PostgreSQL de test jetable) | Réussi : 207 tests réussis, 2 ignorés (nginx absent du poste), dont les 3 de `formulaires.service.spec.ts` ; lignes 90,92 % | |
| `node outils/tableau-des-tests.mjs` puis `node outils/tableau-des-tests.mjs --verifier` | Réussi : « docs/tests/tableau-des-tests.md est à jour. » ; 451 cas (303 unitaires, 143 d’intégration, 5 de bout en bout), aucun test non classé | |
| CI de la PR (trois jobs `validation`) | à compléter | Lien de l’exécution |

## Test de bout en bout (TST-02)

Pile démarrée par `docker compose up -d --build`, puis `npm.cmd run test:e2e` dans `apps/web`.

| N° | Test | Résultat | Preuve |
| --- | --- | --- | --- |
| E1 | « envoie la demande, affiche le remerciement et notifie l’adresse de contact » | Réussi (17/11/2026) | Sortie de la commande (`2 passed`) ; e-mail contrôlé par le test via l’API de Mailpit |
| E2 | « refuse une demande incomplete : message d’erreur, aucun envoi, aucun e-mail » | Réussi (17/11/2026) | Sortie de la commande (`2 passed`) |

## Sauvegarde et restauration (DEP-07)

Exécution unique sur les bases de production, selon `docs/sauvegarde-restauration.md`.

| N° | Vérification | Résultat | Preuve |
| --- | --- | --- | --- |
| B1 | Accès IP temporaire du poste ajouté dans Atlas (6 heures) | Fait le 17/11/2026 | Console Atlas |
| B2 | `Sauvegarder-Bases.ps1` : « Sauvegarde terminee. », code 0 ; nombre de tables et de documents affichés | Réussi le 17/11/2026 à 20 h 17 : PostgreSQL, 13 tables comptées (utilisateurs 3, clients 1, prospects 1, evenements 1, devis 1, lignes_devis 2, types_evenement 5, parametres 1, autres tables 0 ; sessions 2, données non sauvegardées) ; MongoDB, 1 collection (`logs` : 9 documents) | Sortie du script, sans chaîne de connexion |
| B3 | Aucune chaîne de connexion dans la sortie ni dans `sauvegarde.txt` | Conforme : saisies masquées, seuls les hôtes affichés ; aucun `://` dans les fichiers texte du dossier | `Select-String … -Quiet` : `False` |
| B4 | `Restaurer-Bases.ps1 -Dossier …` : « Restauration conforme », code 0 ; seule la table des sessions est « non sauvegardee » | Conforme : 12 tables `OK`, `sessions` « non sauvegardee », `logs` 9 / 9. Anomalie corrigée : la première exécution s’est arrêtée sur l’option de colonne interne de Neon `pg_attver`, refusée par PostgreSQL standard (aucune écriture, transaction annulée) ; le script retire désormais ces 92 lignes avant la restauration | Sortie du script |
| B5 | Bases `innov_events` et `innov_events_logs` de la pile locale inchangées | Conforme : comptages des 13 tables et nombre de journaux identiques avant et après | `Compare-Object` sans écart |
| B6 | `Restaurer-Bases.ps1 -Nettoyer`, dossier de sauvegarde supprimé, entrée IP temporaire retirée d’Atlas | Fait le 17/11/2026 : bases de restauration supprimées, dossier supprimé (`Test-Path` : `False`), entrée IP retirée | Sortie des commandes, console Atlas |

## Limites connues

- Le test de bout en bout n’est pas lancé par la CI, qui ne démarre pas la pile complète ; il est exécuté sur le poste avant chaque PR qui touche la demande de devis.
- Chaque exécution du test de bout en bout enregistre une demande fictive dans la base locale et compte dans la limite de 5 demandes par quart d’heure depuis le même poste.
- Le tableau des tests est produit à partir du code source : un test ignoré à l’exécution (base de test ou nginx absents) y figure quand même.
