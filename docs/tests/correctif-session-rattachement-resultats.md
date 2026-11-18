# Correctif — session ouverte avant le rattachement du compte à une fiche

Date : 18/11/2026

Base : `9583227` (`dev` après le correctif des adresses e-mail non vérifiées). Poste : Windows 11, PowerShell 5.1, Node.js 24.22.0. Périmètre : `services/api/` ; aucun changement de schéma ni de dépendance.

## Anomalie

Exigences : CLI-01 (devis du client), CLI-02 (suivi), CLI-03 (profil), CLI-06 (avis), DEV-07 (envoi du devis et compte client).

| Étape | Constat |
| --- | --- |
| Reproduction | Bertrand s’est inscrit avec l’adresse de contact de la fiche d’Ada et il est connecté. Pendant l’envoi du premier devis d’Ada, qui rattache son compte à la fiche et remplace son mot de passe, Bertrand envoie une réponse au devis ; sa requête, déjà autorisée par sa session, attend le verrou de l’événement. |
| Résultat attendu | Réponse refusée : la session ouverte avec l’ancien mot de passe ne vaut plus après le rattachement. |
| Résultat obtenu | Une fois l’envoi terminé, la réponse reprend, constate que le compte possède désormais la fiche et enregistre l’acceptation (ou le refus) du devis au nom d’Ada (200). |
| Même écart, sans attente de verrou | Si le rattachement se termine entre la vérification de la session et la lecture en base, une requête de l’ancienne session voit la fiche d’Ada : accueil et suivi, profil, événements, liste des devis, devis et PDF, accord de publication et avis. |
| Cause | La propriété était vérifiée par l’identifiant du compte, qui ne change pas au rattachement, sans revérifier dans la même instruction le mot de passe qui avait autorisé la session. |
| Gravité | Majeure en cas de simultanéité : décision prise sur le devis d’une autre entreprise, ou lecture de ses données. |

## Correction

`services/api/src/repositories/devis.repository.ts`, `services/api/src/repositories/espace-client.repository.ts`, `services/api/src/services/devis.service.ts`, `services/api/src/controllers/devis.controller.ts`, `services/api/src/controllers/espace-client.controller.ts` :

- les routes du client transmettent le hache du mot de passe qui a autorisé la session ;
- chaque contrôle de propriété de l’espace client et des devis (accueil et suivi, fiche du profil, événements, avis, accord de publication, liste des devis, devis et PDF) retient le compte dans la même instruction SQL seulement s’il est actif et si son mot de passe est toujours celui de la session. Une fiche rattachée après l’ouverture de la session reste donc introuvable : listes vides, fiche absente du profil, 404 pour un devis, un PDF, un avis ou un accord ;
- réponse au devis : juste après le verrou de l’événement, l’API relit le compte ; s’il n’est plus actif ou si son mot de passe n’est plus celui de la session, la réponse est refusée (401) et rien n’est écrit. Le rattachement à l’envoi remplace le mot de passe sous ce même verrou : une réponse qui l’attendait voit donc le nouveau mot de passe. La relecture se fait sans verrou du compte, ce qui laisse inchangé l’ordre des verrous (fiche, événement, devis, puis compte à l’envoi).

La modification du profil et l’effacement du compte vérifiaient déjà ce mot de passe sous le verrou du compte.

## Tests ajoutés ou adaptés

Ajoutés avant la correction : 9 cas d’intégration en échec, puis réussis après la correction.

| Fichier | Test | Vérification |
| --- | --- | --- |
| `services/api/src/routes/j8.integration.spec.ts` | « refuse la reponse d une session ouverte avant le rattachement du compte au devis » | Deux connexions PostgreSQL : l’envoi verrouille la fiche puis l’événement ; la réponse de Bertrand attend ; mot de passe remplacé, fiche rattachée, devis envoyé ; réponse 401, devis toujours « en étude », événement toujours « brouillon » |
| `services/api/src/routes/j10.integration.spec.ts` | « ne donne rien de la fiche rattachee apres l ouverture de la session : … » (8 cas : accueil, profil, événements, liste des devis, devis, PDF, accord de publication, avis) | La session est vérifiée, puis le compte est rattaché à la fiche et son mot de passe remplacé avant la lecture en base : listes vides, fiche absente, 404 ; aucun nom d’entreprise renvoyé ; accord toujours vide, aucun avis créé |
| `services/api/src/routes/j8.integration.spec.ts` | Tests appelant directement la réponse, la propriété ou la liste des devis (adaptés) | Hache du mot de passe du compte transmis, comme par une session normale |
| `services/api/src/services/devis.service.spec.ts` | « journalise une reponse de devis », « refuse de divulguer la fiche… », « autorise la consultation administrateur » (adaptés) | Hache de la session transmis au repository |

## Contrôles

| Commande | Résultat | Preuve |
| --- | --- | --- |
| `services/api` : `npx.cmd vitest run src/routes/j8.integration.spec.ts src/routes/j10.integration.spec.ts -t "session ouverte avant le rattachement|fiche rattachee apres"` avant la correction | 9 échecs | Sortie de la commande |
| `services/api` : `npm.cmd run format:check`, `lint`, `typecheck`, `build` | OK | Sortie des commandes |
| `services/api` : `npm.cmd run test:coverage` (PostgreSQL de test jetable) | 232 réussis, 2 ignorés (nginx absent du poste) ; lignes 92,08 %, instructions 89,91 %, branches 84,48 %, fonctions 92,33 % | Sortie de la commande |
| `node outils/tableau-des-tests.mjs --verifier` (racine) | « docs/tests/tableau-des-tests.md est à jour. » ; 479 cas (306 unitaires, 168 d’intégration, 5 de bout en bout) | Sortie de la commande |
| CI de la PR (trois jobs `validation`) | OK : `validation (api)`, `validation (web)` et `validation (mobile)` réussis sur `b176124` (exécution n° 61, 2 min 9 s) | https://github.com/Onizuka-05/innov-events-manager/actions/runs/44224600101 |

## Limites connues

- Les routes de l’équipe (administratrice, employé) ne sont pas concernées : leurs comptes ne sont jamais rattachés à une fiche.
