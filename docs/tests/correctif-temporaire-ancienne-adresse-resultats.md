# Correctif — mot de passe temporaire de l’ancienne adresse de connexion

Date : 18/11/2026

Base : `4dbecf3` (`dev` après le correctif des sessions ouvertes avant le rattachement). Poste : Windows 11, PowerShell 5.1, Node.js 24.22.0. Périmètre : `services/api/` ; aucun changement de schéma ni de dépendance.

## Anomalie

Exigences : CLI-03 (profil), AUTH-03 (mot de passe oublié).

| Étape | Constat |
| --- | --- |
| Reproduction | Un mot de passe temporaire a été envoyé à l’ancienne adresse de connexion et une session de récupération est ouverte avec lui. Le titulaire change ensuite son adresse depuis « Mon profil », avec son mot de passe actuel. |
| Résultat attendu | L’ancienne adresse ne donne plus aucun accès : la session de récupération est fermée et le mot de passe du titulaire reste valable. |
| Résultat obtenu | Le temporaire et sa date d’expiration étaient conservés : la session de récupération pouvait encore choisir un nouveau mot de passe (200) et obtenir une session normale sur le compte. De plus, une demande « mot de passe oublié » lue avant un changement d’adresse et écrite après enregistrait un temporaire et l’envoyait à l’ancienne adresse. |
| Cause | La modification du profil ne touchait pas au temporaire ; l’émission du temporaire ne vérifiait que l’identifiant et le statut du compte, pas l’adresse demandée. |
| Gravité | Majeure : prise de contrôle du compte par le détenteur de l’ancienne adresse. |

## Correction

- `services/api/src/repositories/espace-client.repository.ts` : quand l’adresse de connexion change effectivement, le mot de passe temporaire et sa date d’expiration sont effacés dans la même instruction, sous le verrou du compte. La session de récupération ouverte avec ce temporaire n’est plus reconnue (401).
- `services/api/src/repositories/utilisateurs.repository.ts`, `services/api/src/services/authentification.service.ts` : le temporaire n’est enregistré que si le compte porte encore l’adresse demandée au moment de l’écriture ; sinon rien n’est écrit ni envoyé, et la réponse publique reste la même (202).

## Tests ajoutés

Ajoutés avant la correction : 2 tests d’intégration en échec, puis réussis après la correction (`services/api/src/routes/j7.integration.spec.ts`, PostgreSQL réel).

| Test | Vérification |
| --- | --- |
| « ferme la session de recuperation de l ancienne adresse au changement d adresse » | Session de récupération ouverte avec le temporaire, puis changement d’adresse par le titulaire : choix d’un nouveau mot de passe refusé (401) ; temporaire et expiration effacés ; mot de passe du titulaire inchangé ; session du titulaire toujours valide |
| « n envoie pas de temporaire a l ancienne adresse si l adresse change pendant la demande » | L’adresse change entre la lecture du compte et l’écriture : réponse 202, aucun e-mail, aucun temporaire enregistré, mot de passe inchangé |

## Contrôles

| Commande | Résultat | Preuve |
| --- | --- | --- |
| `services/api` : `npx.cmd vitest run src/routes/j7.integration.spec.ts -t "ancienne adresse"` avant la correction | 2 échecs | Sortie de la commande |
| `services/api` : `npm.cmd run format:check`, `lint`, `typecheck`, `build` | OK | Sortie des commandes |
| `services/api` : `npm.cmd run test:coverage` (PostgreSQL de test jetable) | 234 réussis, 2 ignorés (nginx absent du poste) ; lignes 92,08 %, instructions 89,91 %, branches 84,48 %, fonctions 92,33 % | Sortie de la commande |
| `node outils/tableau-des-tests.mjs --verifier` (racine) | « docs/tests/tableau-des-tests.md est à jour. » ; 481 cas (306 unitaires, 170 d’intégration, 5 de bout en bout) | Sortie de la commande |
| CI de la PR (trois jobs `validation`) | OK : `validation (api)`, `validation (web)` et `validation (mobile)` réussis sur `88037a7` (exécution n° 65, 2 min) | https://github.com/Onizuka-05/innov-events-manager/actions/runs/44228345036 |

## Limites connues

- L’adresse de connexion reste modifiable sans vérification de la nouvelle adresse (avec le mot de passe actuel) ; une vérification par lien de confirmation demande une évolution du schéma.
