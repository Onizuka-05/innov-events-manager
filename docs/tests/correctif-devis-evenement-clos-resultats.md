# Correctif — devis d’un événement annulé ou terminé

Date : 18/11/2026

Base : `4612fbe` (`dev` après le J10). Poste : Windows 11, PowerShell 5.1, Node.js 24.22.0. Périmètre : `services/api/` ; aucun changement de schéma ni de dépendance.

## Anomalie

Exigences : CLI-01 (réponse du client au devis), ADM-03 (cycle de vie de l’événement).

| Étape | Constat |
| --- | --- |
| Reproduction | Devis envoyé au client, puis événement annulé par l’administratrice ; le client accepte le devis. |
| Résultat attendu | Acceptation refusée : un événement annulé ou terminé n’accepte plus d’engagement. |
| Résultat obtenu | Acceptation enregistrée : devis « accepté », événement « annulé ». Une demande de modification et un nouvel envoi du devis étaient aussi possibles. |
| Cause | La réponse du client et l’envoi ne contrôlaient que le statut du devis, jamais celui de l’événement. |
| Gravité | Majeure : incohérence entre devis et événement, sans fuite de données. |

## Correction

`services/api/src/repositories/devis.repository.ts` :

- l’envoi et la réponse verrouillent d’abord la ligne de l’événement, puis celle du devis (même ordre dans les deux opérations, donc sans interblocage) ; l’annulation, qui modifie la même ligne, s’exécute avant ou après, jamais pendant ;
- événement annulé ou terminé : envoi refusé (409, « L’événement est annulé ou terminé : ce devis ne peut plus être envoyé. ») ; acceptation et demande de modification refusées (409, « … ce devis ne peut plus être accepté ni modifié. ») ; le refus du devis reste possible ;
- le contrôle de propriété reste fait avant : un autre client reçoit toujours 404 ;
- ordre des verrous commun : fiche client, puis événement, puis devis. L’envoi verrouille la fiche client avant l’événement, comme la suppression d’une fiche par l’administratrice (fiche, puis événement, dont la clé `id_prospect` est remise à vide quand la demande convertie est supprimée). Sans cet ordre, un envoi et une suppression simultanés s’attendaient mutuellement : PostgreSQL interrompait l’une des deux opérations et l’API répondait 500.

## Tests ajoutés (`services/api/src/routes/j8.integration.spec.ts`, PostgreSQL réel)

Ajoutés avant la correction : 4 tests en échec, puis réussis après la correction. Le test d’interblocage, ajouté après la relecture de la PR, échouait sur la première version de la correction (500 après interblocage détecté par PostgreSQL) et réussit avec l’ordre des verrous ci-dessus.

| Test | Vérification |
| --- | --- |
| « refuse l acceptation et la modification d un devis envoye si l evenement est annule » et « … termine » | 409 pour l’acceptation et la modification ; devis toujours « en étude », statut de l’événement inchangé ; le refus reste accepté |
| « repond 409 au client qui accepte le devis d un evenement annule » | Route `POST /api/devis/:id/reponse` avec la session du client : 409, devis inchangé |
| « refuse l envoi d un devis si l evenement est annule ou termine » | 409, aucun e-mail préparé, devis toujours « en préparation » sans date d’envoi |
| « n entre pas en interblocage avec la suppression de la fiche pendant l envoi » | Deux connexions PostgreSQL, événement issu d’une demande convertie : la suppression verrouille la fiche, l’envoi attend, la suppression se termine ; l’envoi répond 404 (fiche anonymisée), sans e-mail, devis toujours « en préparation » |

## Contrôles

| Commande depuis `services/api` | Résultat | Preuve |
| --- | --- | --- |
| `npx.cmd vitest run src/routes/j8.integration.spec.ts` avant la correction | 4 échecs, 21 réussis | Sortie de la commande |
| `npm.cmd run format:check`, `lint`, `typecheck` | OK | Sortie des commandes |
| `npx.cmd vitest run src/routes/j8.integration.spec.ts` après la correction | 26 réussis | Sortie de la commande |
| `npm.cmd run test:coverage` (PostgreSQL de test jetable) | 212 réussis, 2 ignorés (nginx absent du poste) ; lignes 91,00 %, instructions 89,00 %, branches 82,43 %, fonctions 92,21 % | Sortie de la commande |
| `npm.cmd run build` | OK | `dist/` |
| `node outils/tableau-des-tests.mjs --verifier` (racine) | « docs/tests/tableau-des-tests.md est à jour. » ; 456 cas (303 unitaires, 148 d’intégration, 5 de bout en bout) | Sortie de la commande |
| CI de la PR (trois jobs `validation`) | à compléter | Onglet « Checks » de la PR |

## Limites connues

- Les devis restés « en étude » sur un événement annulé ne changent pas de statut : le client peut seulement les refuser. L’annulation ne les refuse pas d’office, pour ne pas attribuer au client un refus qu’il n’a pas donné.
