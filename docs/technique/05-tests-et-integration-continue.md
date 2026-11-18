# 5. Tests et intégration continue

Références : [`docs/tests/plan-de-tests.md`](../tests/plan-de-tests.md) (stratégie, procédures, résultats attendus et obtenus, gestion des anomalies), [`docs/tests/tableau-des-tests.md`](../tests/tableau-des-tests.md) (liste générée de tous les tests), [`docs/tests/couverture.md`](../tests/couverture.md) (couverture et lecture des rapports).

## 5.1 Niveaux de test

| Niveau | Outil | Ce qui est vérifié | Nombre |
|---|---|---|---|
| Unitaire | Vitest (API, web, mobile) | Une classe ou un composant isolé : calculs, validation, affichage, gardes | 306 |
| Intégration | Vitest, Supertest, PostgreSQL réel dans un conteneur jetable, nginx réel ; MongoDB remplacé par un double en mémoire | Routes de l'API avec la base : règles métier, droits, transactions, concurrence | 170 |
| Bout en bout | Playwright, sur le poste (hors CI) | Site web : demande de devis sur la pile Compose complète, e-mail lu dans Mailpit (2 cas). Mobile : parcours dans un navigateur sur le serveur de développement Angular, réponses d'API simulées (3 cas) | 5 |
| Acceptation | Manuel, en production | Scénarios A1 à A17 et contrôles de sécurité S1 à S5 (§8 du plan de tests) ; essai sur iPhone | — |

Total de 481 cas au 18/11/2026. La CI exécute les tests unitaires et d'intégration (476 cas) ; les 5 tests de bout en bout et l'acceptation sont exécutés sur le poste et en production, résultats consignés dans `docs/tests/`. L'écriture réelle dans MongoDB est vérifiée sur la pile Compose et en production (A15). Le tableau des tests est produit par `node outils/tableau-des-tests.mjs` ; la CI ne le modifie pas, mais `--verifier` signale un tableau en retard.

Chaque anomalie suit la même procédure (§9 du plan) : issue GitHub, branche `fix/*`, test qui reproduit l'anomalie **avant** la correction, puis correction, rapport `docs/tests/correctif-*-resultats.md` et preuve sur l'issue.

## 5.2 Pipeline GitHub Actions

Fichier `.github/workflows/ci.yml`, déclenché à chaque push et à chaque pull request sur `dev` et `main`. Un job par application (`validation (api)`, `validation (web)`, `validation (mobile)`), exécutés en parallèle, sous Ubuntu avec Node.js 24 :

1. récupération du code et installation par `npm ci` (versions exactes du fichier de verrouillage) ;
2. pour l'API : PostgreSQL 16.15 jetable et nginx, pour exécuter tous les tests d'intégration (pas de MongoDB : double en mémoire) ;
3. contrôle du formatage (Prettier) ;
4. lint (ESLint), avec un rapport JSON ;
5. vérification TypeScript ;
6. tests et couverture ;
7. build de production ;
8. audit des dépendances de production (`npm audit --omit=dev --audit-level=high`) ;
9. publication des rapports en artefacts, conservés 90 jours.

Les étapes 4 à 8 s'exécutent même si une étape précédente échoue : un seul passage donne la liste complète des problèmes. Les trois jobs sont obligatoires pour fusionner dans `main` (protection de branche) ; Render ne déploie `main` qu'après leur réussite (chapitre 6).

## 5.3 Lire les rapports

Onglet **Actions** du dépôt → exécution → section **Artifacts** : `rapports-api`, `rapports-web`, `rapports-mobile`.

| Fichier | Contenu | Lecture |
|---|---|---|
| `artifacts/format.log` | Fichiers mal formatés | Vide d'erreur : conforme. Sinon `npm.cmd run format` sur le poste |
| `artifacts/lint.json`, `lint.log` | Problèmes ESLint par fichier et par règle | `errorCount` et `warningCount` à 0 attendus ; une erreur bloque la CI |
| `artifacts/types.log` | Erreurs TypeScript | Aucune ligne `error TS` attendue |
| `artifacts/tests.log` | Résultat de chaque test, tableau de couverture final | Ligne `Tests  N passed` ; un échec donne le nom du test et l'écart obtenu / attendu |
| `coverage/` | Rapport HTML de couverture (`index.html`) | Lignes non exécutées surlignées en rouge : code jamais testé |
| `artifacts/build.log` | Build de production | Pour le web et le mobile : taille des fichiers produits et avertissements de budget |
| `artifacts/audit.log` | Vulnérabilités des dépendances de production | `found 0 vulnerabilities` attendu ; une vulnérabilité élevée ou critique fait échouer la CI |

## 5.4 Interprétation des résultats

Résultats à la mise en production du 18/11/2026 (`main` à `86edc0a`, CI n° 69 verte) :

| Application | Tests | Lignes | Branches | Fonctions |
|---|---|---|---|---|
| API | 234 réussis (+ 2 tests nginx exécutés en CI seulement) | 92,08 % | 84,48 % | 92,33 % |
| Site web | 182 réussis | 83,80 % | 75,58 % | 68,55 % |
| Mobile | 58 réussis | 86,24 % | 84,26 % | 75,30 % |

- **API** : la couverture la plus élevée porte sur le code le plus sensible (droits, devis, comptes, effacement), testé avec une vraie base PostgreSQL. Les branches non couvertes sont surtout des erreurs d'infrastructure difficiles à provoquer (perte de connexion en cours de transaction).
- **Site web** : le taux de fonctions est plus bas car Angular compte comme fonctions les petits gestionnaires d'événements des modèles HTML (ouverture d'un menu, changement d'onglet) ; les parcours qui les utilisent sont vérifiés par les tests de composants et les parcours manuels des rapports `docs/tests/J9-*.md` et `J10-*.md`.
- **Mobile** : écrans en lecture surtout ; les appels, e-mails et itinéraires vers les applications du téléphone sont vérifiés à la main sur iPhone.
- La couverture mesure le code exécuté, pas la justesse des vérifications : elle sert à repérer les zones jamais testées. Aucun seuil n'est imposé à la CI ; une baisse inexpliquée bloque la fusion (critères de sortie, §7 du plan de tests).
- Audit de production : 0 vulnérabilité sur les trois applications à la mise en production.
