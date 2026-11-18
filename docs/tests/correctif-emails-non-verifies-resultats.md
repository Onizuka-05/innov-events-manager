# Correctif — adresses e-mail non vérifiées

Date : 18/11/2026

Base : `4dfa54d` (`dev` après le correctif des devis). Poste : Windows 11, PowerShell 5.1, Node.js 24.22.0. Périmètre : `services/api/`, `apps/web/` ; aucun changement de schéma ni de dépendance.

## Anomalies

Exigences : CLI-03 (profil), CLI-04 (suppression du compte), ADM-05 (comptes), DEV-03 (conversion d’une demande), DEV-07 (envoi du devis et compte client).

Cause commune : une adresse e-mail que personne n’a vérifiée servait à décider à qui appartient une demande ou un devis. Un compte est utilisable dès l’inscription, sans confirmation de l’adresse, et le client pouvait modifier l’e-mail de contact de sa fiche.

| Cas | Reproduction | Résultat obtenu | Gravité |
| --- | --- | --- | --- |
| Rattachement à la mauvaise entreprise | Alpha remplace l’e-mail de contact de sa fiche par celui de Beta ; Beta dépose une demande ; l’administratrice la convertit. | La demande de Beta est rattachée à la fiche d’Alpha, visible dans son suivi ; le devis part vers le compte d’Alpha. | Majeure (fuite de données) |
| Effacement des demandes d’un tiers | Un visiteur s’inscrit avec l’adresse de Beta, puis supprime son compte. | Les demandes non converties de Beta sont effacées. | Majeure (perte de données) |
| Compte inscrit avant le premier devis | Un visiteur s’inscrit avec l’adresse de Beta avant que Beta ne devienne cliente ; au premier devis, ce compte est rattaché à la fiche de Beta. | Le visiteur, qui connaît le mot de passe, lit le devis de Beta. | Majeure (fuite de données) |
| Suppression d’un compte sans fiche par l’administratrice | Depuis « Comptes », l’administratrice supprime le compte du visiteur inscrit avec l’adresse de Beta. | Les demandes non converties de Beta sont effacées. | Majeure (perte de données) |
| Deux fiches pour une même adresse | Deux fiches actives portent le même e-mail de contact ; une demande de cette adresse est convertie. | L’une des deux fiches est choisie automatiquement : la demande et son devis peuvent rejoindre la mauvaise entreprise. | Majeure (fuite de données) |
| Suppression d’une fiche dont l’adresse est partagée | Alpha et Beta partagent l’adresse de contact ; Alpha supprime son compte, ou l’administratrice supprime sa fiche. | Les demandes non converties de Beta portant cette adresse sont effacées. | Majeure (perte de données) |
| Demande conservée puis rattachée à la seule fiche restante | Alpha et Beta partagent l’adresse de contact ; une demande d’Alpha, « à contacter », est conservée à la suppression d’Alpha ; l’administratrice la convertit. | Beta étant devenue l’unique fiche active à cette adresse, la demande d’Alpha lui est rattachée automatiquement : le futur devis arrive dans l’espace de Beta. Plus généralement, toute demande est rattachée sans confirmation à la fiche qui porte son adresse, jamais vérifiée. | Majeure (fuite de données) |
| Requête autorisée juste avant le rattachement | Une modification du profil ou une suppression du compte, déjà autorisée par l’ancien mot de passe, s’exécute juste après le remplacement de ce mot de passe à l’envoi du premier devis. | L’e-mail de connexion du compte rattaché est modifié, ou la fiche rattachée est effacée. | Majeure en cas de simultanéité |
| Suppression d’un compte pendant son rattachement | L’administratrice supprime un compte sans fiche pendant que le premier devis le rattache à une fiche. | Le compte suit le parcours « sans fiche » : la fiche reste nominative sans compte. | Mineure (simultanéité) |
| Deux sauvegardes du profil | Une sauvegarde ordinaire, partie avant un changement d’e-mail confirmé, s’exécute après lui. | L’ancienne adresse de connexion est rétablie sans mot de passe. | Mineure (simultanéité) |

## Corrections

| Fichier | Changement |
| --- | --- |
| `services/api/src/repositories/espace-client.repository.ts` | « Mon profil » : l’e-mail de contact de la fiche n’est plus modifiable par le client (400, code `EMAIL_CONTACT_NON_MODIFIABLE`) ; les autres coordonnées restent modifiables. Effacement demandé par le client : seules les demandes non converties portant l’e-mail de contact de sa fiche sont supprimées ; un compte sans fiche n’en supprime aucune. |
| `services/api/src/services/devis.service.ts` | Envoi du premier devis à une fiche sans compte, quand un compte client existe déjà avec l’adresse de contact : avant le rattachement, son mot de passe est remplacé par un mot de passe temporaire (7 jours, usage unique) envoyé dans l’e-mail du devis, et ses sessions sont supprimées. |
| `services/api/src/repositories/gestion.repository.ts` | Suppression d’un compte client sans fiche depuis « Comptes » : le compte et ses sessions sont supprimés, les demandes non converties sont conservées (même règle que l’effacement par le client). Sous le verrou du compte, un rattachement survenu entre-temps est revérifié : 409, rien n’est supprimé. |
| `services/api/src/repositories/espace-client.repository.ts`, `services/api/src/repositories/gestion.repository.ts` | Suppression d’une fiche (par le client ou par l’administratrice) : les demandes non converties portant son e-mail de contact sont conservées si une autre fiche active porte la même adresse (appartenance ambiguë). |
| `services/api/src/repositories/devis.repository.ts` | Conversion d’une demande : si plusieurs fiches actives portent son adresse, la conversion est refusée (409, code `FICHES_EN_DOUBLE`) jusqu’à la correction du doublon dans « Clients » ; la demande reste « à contacter ». |
| `services/api/src/repositories/devis.repository.ts`, `services/api/src/controllers/devis.controller.ts` | Conversion d’une demande dont l’adresse correspond à une fiche active : la demande n’est rattachée que si la requête confirme cette fiche précise (`id_client_confirme`) ; sinon 409, code `RATTACHEMENT_A_CONFIRMER`, et la demande reste « à contacter ». Une confirmation devenue sans objet (fiche modifiée ou effacée entre-temps) est refusée de la même façon, au lieu de créer une fiche. |
| `apps/web/src/app/pages/gestion/prospects.ts`, `apps/web/src/app/pages/gestion/prospects.html` | « Convertir un prospect » : quand une fiche porte l’adresse de la demande, l’entreprise et le contact de la fiche sont affichés à côté de ceux de la demande, et le bouton « Convertir » reste inactif jusqu’à la case « Je confirme que cette demande vient de … ». La case vaut pour la demande et la fiche affichées au moment où elle est cochée : si la liste relue montre une autre fiche, elle est décochée et une nouvelle confirmation est exigée. Seule la fiche confirmée est envoyée à l’API ; sur un refus `RATTACHEMENT_A_CONFIRMER`, la liste des fiches est relue et la confirmation redemandée. |
| `services/api/src/repositories/espace-client.repository.ts`, `services/api/src/services/espace-client.service.ts`, `services/api/src/controllers/espace-client.controller.ts` | Modification du profil et suppression du compte : sous le verrou du compte, l’API vérifie que le mot de passe qui a autorisé la session est toujours celui du compte ; sinon 401 et aucune écriture. Le mot de passe actuel saisi est vérifié contre ce même mot de passe. Le changement d’e-mail de connexion est comparé à l’adresse lue sous ce verrou : sans mot de passe vérifié, une adresse différente est refusée (400). |
| `apps/web/src/app/pages/espace/profil-client.html` | Champ « E-mail du contact » en lecture seule, avec l’aide « Adresse gérée par Innov’Events : écrivez-nous depuis la page Contact pour la modifier. » |
| `apps/web/src/app/pages/page-legale/contenus-legaux.ts` | Politique de confidentialité : demandes effacées selon l’e-mail de contact de la fiche ; mot de passe temporaire d’un compte rattaché à l’envoi d’un devis. |

L’e-mail de contact de la fiche provient de la demande convertie ou de la saisie de l’administratrice : c’est la seule adresse utilisée pour désigner les demandes d’un client.

## Tests ajoutés ou adaptés

Ajoutés ou adaptés avant la correction : 14 tests d’intégration en échec, puis réussis après la correction.

| Fichier | Test | Vérification |
| --- | --- | --- |
| `services/api/src/routes/j10.integration.spec.ts` | « refuse au client la modification de l e-mail du contact de sa fiche » | 400 et code `EMAIL_CONTACT_NON_MODIFIABLE`, fiche inchangée, aucun journal ; même adresse à la casse près : téléphone modifié, adresse conservée |
| `services/api/src/routes/j10.integration.spec.ts` | « garde la demande de Beta hors de l espace d Alpha, meme si Alpha vise son adresse » | Deux entreprises : modification refusée ; la demande de Beta, convertie par l’administratrice, crée la fiche de Beta ; le suivi d’Alpha reste vide |
| `services/api/src/routes/j10.integration.spec.ts` | « supprime un compte sans fiche sans effacer les demandes d une autre entreprise » | Compte inscrit avec l’adresse de Beta puis supprimé : la demande de Beta est conservée |
| `services/api/src/routes/j10.integration.spec.ts` | « efface le compte, anonymise la fiche, detruit les sessions et retire le nom des journaux » (adapté) | Demandes de l’e-mail de contact effacées ; demande de l’e-mail de connexion conservée |
| `services/api/src/routes/j10.integration.spec.ts` | « garde les demandes d une autre entreprise quand l administratrice supprime un compte sans fiche » | Suppression depuis « Comptes » : compte supprimé, demande de Beta conservée |
| `services/api/src/routes/j10.integration.spec.ts` | « suspend la conversion si deux fiches partagent l adresse de la demande » | Deux fiches de même adresse (casse différente) : 409 et code `FICHES_EN_DOUBLE`, demande toujours « à contacter » et non rattachée |
| `services/api/src/routes/j10.integration.spec.ts` | « refuse la modification du profil si le mot de passe est remplace avant l ecriture » et « refuse l effacement si le mot de passe est remplace avant l ecriture » | Deux connexions PostgreSQL : la requête, autorisée, attend le verrou du compte pendant que l’autre connexion remplace le mot de passe ; 401, e-mail de connexion inchangé, compte conservé |
| `services/api/src/routes/j10.integration.spec.ts` | « conserve la demande commune quand Alpha est supprimee par client, sans la rattacher a Beta sans confirmation » et « … par administratrice » | Deux fiches de même adresse : Alpha anonymisée, fiche de Beta et demande intactes, pour les deux parcours de suppression ; conversion sans confirmation, puis avec la fiche d’Alpha : 409 et code `RATTACHEMENT_A_CONFIRMER`, demande « à contacter » et non rattachée ; rattachement à Beta seulement avec la confirmation de sa fiche |
| `services/api/src/routes/j10.integration.spec.ts` | « refuse la suppression d un compte rattache a une fiche pendant la suppression » | Deux connexions PostgreSQL : rattachement pendant que la suppression attend le verrou ; 409, compte et fiche conservés |
| `services/api/src/routes/j10.integration.spec.ts` | « refuse une sauvegarde partie avant un changement d e-mail confirme » | Deux connexions PostgreSQL : l’adresse change pendant que la sauvegarde attend le verrou ; 400, adresse confirmée et prénom conservés |
| `services/api/src/routes/j8.integration.spec.ts` | « rattache une seconde demande du meme e-mail a la fiche existante, puis envoie le devis » (adapté) | Sans confirmation : 409 et code `RATTACHEMENT_A_CONFIRMER`, demande inchangée ; avec la fiche confirmée : rattachement, puis parcours du devis inchangé |
| `services/api/src/routes/j8.integration.spec.ts` | « remplace le mot de passe d un compte inscrit avec l e-mail du contact avant de le rattacher » | Compte rattaché, mot de passe choisi effacé, temporaire envoyé à l’adresse de contact ; ancienne session refusée (401), ancien mot de passe refusé (401) |
| `apps/web/src/app/pages/espace/espace-client.spec.ts` | « affiche l e-mail du contact en lecture seule, gere par Innov Events » | Champ en lecture seule avec l’aide ; téléphone toujours modifiable |
| `apps/web/src/app/pages/gestion/organisation-espaces.spec.ts` | « convertit puis relit et preremplit l’evenement (client existant=…) » (adapté) | Client existant : bouton inactif et aucun envoi sans la case de confirmation, libellé avec l’entreprise, fiche confirmée envoyée ; nouveau client : pas de case, `id_client_confirme` nul |
| `apps/web/src/app/pages/gestion/organisation-espaces.spec.ts` | « annule la confirmation si la fiche affichee change apres un classement sans suite » | Case cochée pour la fiche d’Alpha ; une autre demande est classée sans suite et la liste relue ne montre plus que Beta : case décochée, libellé « Beta SAS », bouton inactif, aucune conversion envoyée ; après confirmation de Beta, l’identifiant de Beta est envoyé |
| `apps/web/src/app/pages/gestion/organisation-espaces.spec.ts` | « relit les fiches et redemande la confirmation si la fiche a rattacher a change » | Refus `RATTACHEMENT_A_CONFIRMER` : pas de navigation, fiches relues, message affiché, case décochée |

## Contrôles

| Commande | Résultat | Preuve |
| --- | --- | --- |
| `services/api` : `npx.cmd vitest run src/routes/j8.integration.spec.ts src/routes/j10.integration.spec.ts` avant la correction | 14 échecs, 61 réussis | Sortie de la commande |
| `services/api` : `npm.cmd run format:check`, `lint`, `typecheck`, `build` | OK | Sortie des commandes |
| `services/api` : `npm.cmd run test:coverage` (PostgreSQL de test jetable) | 223 réussis, 2 ignorés (nginx absent du poste) ; lignes 92,01 %, instructions 89,90 %, branches 84,23 %, fonctions 92,26 % | Sortie de la commande |
| `apps/web` : `npm.cmd run format:check`, `lint`, `typecheck`, `build` | OK | Sortie des commandes |
| `apps/web` : `npm.cmd run test:coverage` | 182 réussis ; lignes 83,80 %, instructions 81,98 %, branches 75,58 %, fonctions 68,55 % | Sortie de la commande |
| `node outils/tableau-des-tests.mjs --verifier` (racine) | « docs/tests/tableau-des-tests.md est à jour. » ; 470 cas (306 unitaires, 159 d’intégration, 5 de bout en bout) | Sortie de la commande |
| CI de la PR (trois jobs `validation`) | OK : `validation (api)`, `validation (web)` et `validation (mobile)` réussis sur `c47b273` (exécution n° 57, 2 min 6 s) | https://github.com/Onizuka-05/innov-events-manager/actions/runs/44218298738 |

## Limites connues

- L’e-mail de connexion reste modifiable par le client (avec son mot de passe actuel) et n’est pas vérifié. Il ne désigne plus aucune demande ; s’il reprend l’adresse de contact d’une autre fiche, le premier devis de cette fiche est refusé (409) au lieu d’être rattaché, jusqu’à correction par l’administratrice.
- Une personne qui s’est inscrite elle-même avant son premier devis reçoit un mot de passe temporaire dans l’e-mail du devis : le mot de passe qu’elle avait choisi n’est plus valable.
- L’envoi d’un devis et l’effacement de son compte par le même client verrouillent la fiche et le compte dans un ordre opposé (comportement antérieur au J10) : s’ils se chevauchent exactement, PostgreSQL interrompt l’une des deux opérations, qui peut être relancée.
- Tant que deux fiches actives portent la même adresse de contact, la conversion d’une demande de cette adresse est refusée et la suppression de l’une des fiches conserve ces demandes : l’administratrice corrige le doublon dans « Clients ».
- Le rattachement d’une demande à une fiche existante repose sur la vérification de l’administratrice (entreprise et contact affichés côte à côte) : si la demande ne vient pas de cette entreprise, elle la classe sans suite ou corrige la fiche, car une nouvelle fiche à la même adresse rendrait la conversion impossible (doublon).
- Une vérification de l’adresse à l’inscription (lien de confirmation) supprimerait ces limites ; elle demande une évolution du schéma.
