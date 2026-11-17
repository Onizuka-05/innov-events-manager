# Couverture des tests (TST-03)

La couverture mesure la part du code exécutée pendant les tests unitaires et d’intégration. Elle est calculée par Vitest avec le fournisseur V8, pour chacune des trois applications.

## Où lire les rapports

| Application | Commande (depuis le dossier de l’application) | Rapport HTML | Autres formats |
| --- | --- | --- | --- |
| API (`services/api`) | `npm.cmd run test:coverage`, avec `TEST_DATABASE_URL` pour inclure les tests d’intégration | `services/api/coverage/index.html` | `coverage/lcov.info` |
| Site web (`apps/web`) | `npm.cmd run test:coverage` | `apps/web/coverage/web/index.html` | `coverage/web/clover.xml`, `coverage/web/coverage-final.json` |
| Mobile (`apps/mobile`) | `npm.cmd run test:coverage` | `apps/mobile/coverage/app/index.html` | dossier `coverage/app/` |

Le tableau récapitulatif (`All files`) s’affiche aussi à la fin de la commande, dans le terminal.

Dans la CI GitHub Actions, chaque exécution publie trois artefacts conservés 90 jours : `rapports-api`, `rapports-web` et `rapports-mobile`. Ils contiennent le dossier `coverage/` et le journal `artifacts/tests.log`. Pour les ouvrir : onglet **Actions** du dépôt → exécution de la CI → section **Artifacts** en bas de page → télécharger l’archive, puis ouvrir `coverage/…/index.html`. Dans la CI, l’API dispose d’une base PostgreSQL jetable et de nginx : ses tests d’intégration y sont tous exécutés.

## Résultats

Relevés le 17/11/2026 sur le poste (Windows 11, Node.js 24.22.0), sur `dev` après la fusion de toutes les PR du J10, complété par les tests de cette validation. Ligne de l’API relevée de nouveau le 18/11/2026 après la correction des devis d’un événement annulé ou terminé. Colonnes du rapport : instructions (`% Stmts`), branches (`% Branch`), fonctions (`% Funcs`), lignes (`% Lines`).

| Application | Commit | Tests réussis | Instructions | Branches | Fonctions | Lignes | Source |
| --- | --- | --- | --- | --- | --- | --- | --- |
| API | `fix/devis-evenement-clos` (base `4612fbe`) | 212 (+ 2 ignorés : nginx absent du poste) | 89,00 % | 82,43 % | 92,21 % | 91,00 % | poste, avec `TEST_DATABASE_URL` |
| Site web | `feature/j10-validation` (base `45ec400`) | 179 | 80,74 % | 74,42 % | 66,94 % | 82,49 % | poste |
| Mobile | `feature/j10-validation` (base `45ec400`) | 58 | 86,36 % | 84,26 % | 75,30 % | 86,24 % | poste |

Les tests de bout en bout (Playwright) ne sont pas inclus dans ces chiffres : ils pilotent un navigateur sur l’application construite et ne mesurent pas la couverture. Ils sont recensés dans `docs/tests/tableau-des-tests.md`.

## Lecture des chiffres

Ce que la couverture indique :

- quelles lignes, branches (`if`, `?:`, `&&`) et fonctions ont été exécutées au moins une fois par un test ;
- les zones jamais exécutées, visibles en rouge dans le rapport HTML : ce sont les premières à examiner.

Ce qu’elle ne prouve pas :

- qu’un comportement est correct : une ligne exécutée sans vérification (`expect`) compte comme couverte ;
- que tous les cas sont traités : une branche couverte une fois ne garantit pas les valeurs limites ni les combinaisons ;
- que l’application fonctionne de bout en bout : la configuration de nginx, de Docker et des services hébergés est vérifiée par les tests d’intégration de nginx, les tests de bout en bout et les parcours manuels.

Lecture par application :

- **API** : la couverture élevée vient surtout des tests d’intégration sur PostgreSQL réel, qui traversent routes, contrôleurs, services et repositories. Sans `TEST_DATABASE_URL`, ces tests sont ignorés et le chiffre baisse fortement : il faut toujours comparer des relevés faits avec la base de test.
- **Site web et mobile** : les tests de composants vérifient le rendu, les formulaires, la navigation et l’accessibilité (étiquettes, rôles, titres). Les fonctions peu couvertes sont surtout des gestionnaires d’erreurs réseau et des actions rares ; les parcours réels sont complétés par les tests de bout en bout.

La couverture sert d’indicateur de suivi : elle ne doit pas baisser d’une PR à l’autre sans explication. Aucun seuil bloquant n’est configuré.
