# Documentation technique — Innov'Events Manager

Ce dossier réunit la documentation technique du projet. Chaque chapitre résume les choix et renvoie aux documents détaillés du dépôt, qui restent la référence.

| Chapitre | Contenu |
|---|---|
| [1. Environnement, Git et Docker](01-environnement-git-docker.md) | Poste de développement, organisation Git, mise en place pas à pas de Docker Compose |
| [2. Architecture et code](02-architecture-et-code.md) | Couches, organisation du code, conventions de nommage, gestion des erreurs |
| [3. Bases de données](03-bases-de-donnees.md) | PostgreSQL (schéma, droits, contraintes), MongoDB (journaux), conservation |
| [4. Sécurité](04-securite.md) | Authentification, sessions, contrôles d'accès, protection des échanges, données personnelles |
| [5. Tests et intégration continue](05-tests-et-integration-continue.md) | Niveaux de test, pipeline GitHub Actions, lecture des rapports |
| [6. Déploiement](06-deploiement.md) | Render, Neon, MongoDB Atlas, Brevo : configuration, procédure, limites des offres gratuites |
| [7. Éco-conception](07-eco-conception.md) | Mesures appliquées, mesures relevées, pistes |
| [8. Veille technologique et sécurité](08-veille.md) | Sources, méthode, décisions issues de la veille |
| [9. Journal des incidents](09-journal-des-incidents.md) | Incidents rencontrés : symptôme, diagnostic, correction |

## Documents de référence

| Domaine | Document |
|---|---|
| Démarrage local | [`README.md`](../../README.md) |
| Procédures qualité, branches, CI/CD | [`docs/qualite.md`](../qualite.md) |
| Conception (cas d'utilisation, statuts, MCD, MLD, architecture, wireframes, charte, maquettes, séquence de connexion) | [`docs/conception/CO-12-dossier-de-conception.md`](../conception/CO-12-dossier-de-conception.md) et [`docs/conception/`](../conception/) |
| Guide d'utilisation | [`docs/utilisateur/guide-utilisateur.md`](../utilisateur/guide-utilisateur.md) |
| Authentification, formulaires, journaux | [`docs/authentification-et-formulaires.md`](../authentification-et-formulaires.md) |
| Sauvegarde et restauration | [`docs/sauvegarde-restauration.md`](../sauvegarde-restauration.md) |
| Plan de tests, tableau des tests, couverture, rapports | [`docs/tests/`](../tests/) |
| Composants tiers et licences | [`THIRD_PARTY_NOTICES.md`](../../THIRD_PARTY_NOTICES.md) |
