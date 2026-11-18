# Procédures qualité — Innov'Events Manager

## 1. Objectif

Garantir la qualité, la sécurité, la traçabilité et la
maintenabilité du projet, de son développement à sa livraison.

## 2. Organisation des branches

- `main` : branche principale stable.
- `dev` : branche d'intégration.
- `feature/*` : développement des fonctionnalités.
- `fix/*` : correction des anomalies.
- `docs/*` : documentation et conception.

Circuit de contribution :

1. Créer une branche `feature/*`, `fix/*` ou `docs/*`
   depuis `dev`.
2. Développer et vérifier les modifications.
3. Ouvrir une Pull Request (PR) vers `dev`.
4. Effectuer la revue et fusionner dans `dev`.
5. Ouvrir une PR de `dev` vers `main` pour intégrer
   les modifications validées.
6. Fusionner toutes les PR par merge commit, vers `dev`
   comme vers `main`, jamais par squash ni rebase, afin
   de conserver le détail des commits et d'éviter des
   divergences artificielles entre les branches.

Convention de commits : `type: message`

Types autorisés :
- `feat` : nouvelle fonctionnalité.
- `fix` : correction d'anomalie.
- `docs` : documentation.
- `chore` : maintenance et configuration.
- `test` : ajout ou modification de tests.
- `refactor` : restructuration sans changement
  fonctionnel.

Aucun espace avant les deux-points.

Aucun développement ne doit être intégré directement
dans `main`.

## 3. Kanban et suivi

Le projet comporte cinq statuts :

- Backlog : tâche identifiée, non sélectionnée.
- À faire : tâche planifiée, prérequis satisfaits.
- En cours : développement ou réalisation en cours.
- Terminé (dev) : critères respectés et PR fusionnée
  dans `dev`.
- Mergé (main) : modifications intégrées dans `main`
  après les vérifications obligatoires.

Le champ « Validé par les tests » indique :
- Non testé : vérifications non effectuées.
- Validé : tests applicables réussis.
- Échec : au moins une vérification a échoué.

Il est mis à jour selon les résultats des tests, sans
attendre obligatoirement la fusion dans `main`.

Le workflow intégré « Item closed » de GitHub Projects
fait passer automatiquement les tickets fermés
en « Mergé (main) ».

## 4. Définition de terminé (Definition of Done)

Une tâche de développement est terminée sur `dev` lorsque :

- Ses critères d'acceptation sont satisfaits.
- Le lint ne remonte aucune erreur.
- La vérification TypeScript réussit.
- Les tests applicables sont réussis.
- Le build est réussi lorsque pertinent.
- Une revue de code est documentée.
- La documentation concernée est actualisée.
- La preuve de vérification (test, capture ou lien) est
  ajoutée en commentaire de l'issue et le champ
  « Validé par les tests » est renseigné.
- La PR a été fusionnée dans `dev`.

Une tâche de conception ou de documentation est terminée
lorsque son livrable est dans `docs/`, relu, et que sa PR
est fusionnée dans `dev`.

Les contrôles non applicables (lint, TypeScript, build)
sont marqués N/A.

Les contrôles automatisés (format, lint, TypeScript,
tests, build, audit) s'exécutent dans GitHub Actions
selon le fonctionnement décrit à la section 6.

## 5. Revues de code

Le projet est développé individuellement.

Chaque PR comporte :
- Une description des modifications.
- Une référence aux issues concernées.
- Une checklist de vérification.
- Une relecture manuelle.

Le développeur assure la relecture, la vérification et la validation des
modifications apportées au code. Il demeure responsable de leur qualité,
de leur sécurité et de leur conformité aux exigences du projet.

Aucune approbation GitHub par un tiers n'est exigée.

## 6. Intégration continue (CI)

GitHub Actions (`.github/workflows/ci.yml`) exécute les
contrôles des trois applications à chaque push et à chaque
PR sur `dev` et `main` :
- Formatage (Prettier).
- Lint.
- Vérification des types TypeScript.
- Tests automatisés et couverture.
- Build.
- Audit des dépendances npm de production.

Les trois jobs `validation (…)` doivent réussir avant toute
fusion vers `main`. Lecture des rapports :
`docs/technique/05-tests-et-integration-continue.md`.

## 7. Livraison continue (CD)

La CD déploie les applications validées.

Hébergement : Render (web, mobile et API, déployés depuis
leurs Dockerfiles), Neon (PostgreSQL), MongoDB Atlas
(MongoDB) et Brevo (envoi des e-mails).

- Web : build et déploiement sur Render.
- API : build et déploiement du service Node.js sur Render.
- Mobile : application web Ionic + Angular,
  packagée dans un conteneur Docker avec Nginx,
  déployée en HTTPS et ouverte dans le navigateur
  d'un téléphone Android ou iOS. APK Android via
  Capacitor en option, non réalisée.


La fusion de la PR vers `main` vaut validation manuelle ;
le déploiement est ensuite automatique : les services
Render sont reliés au dépôt GitHub et ne déploient `main`
qu'après réussite des vérifications CI (option
« After CI Checks Pass »).

La livraison finale reçoit un tag `vX.Y.Z` sur le commit
de fusion de `main`. Retour arrière : « Rollback » vers un
déploiement précédent dans Render, ou PR qui annule le merge
commit (`docs/technique/06-deploiement.md`).

## 8. Protection de main

Règles appliquées à `main` :
- Pull Request obligatoire.
- Pas d'approbation tierce exigée.
- Force push interdit.
- Suppression de branche interdite.
- Contournement des protections interdit,
  y compris pour l'administrateur.
- Vérifications CI obligatoires (trois jobs
  `validation (…)`), activées sur `main`.

## 9. Traçabilité des issues

PR vers `dev` :
- Utiliser `Refs #N` pour référencer l'issue.
- Conserver l'issue ouverte.

PR vers `main` :
- Utiliser `Closes #N` pour les issues terminées.
- Utiliser un mot-clé par issue lorsqu'une PR
  concerne plusieurs tickets :
  `Closes #3, closes #5`
  et non `Closes #3, #5`.
- Vérifier leur fermeture après fusion.
- Passer les tickets concernés en « Mergé (main) ».

## 10. Sécurité et conformité

- Aucun secret ou identifiant sensible dans Git.
- Activation des alertes Dependabot.
- Activation de la protection contre les secrets.
- Analyse des dépendances dans la CI.
- Respect des exigences RGPD et RGAA.
- Mise à jour des documentations concernées.