# Vérifications — API du J10 : espace client, catalogue public, purges

Date : 17/11/2026

Base : `ac892ac` (`dev` après les finitions du J9), complétée par cette PR. Poste : Windows 11, PowerShell 5.1. Périmètre : `services/api/` uniquement ; aucun changement de schéma SQL.

## Contenu

### Espace client (rôle client, propriété vérifiée côté serveur)

Chaque requête relit le compte en base ; une ressource d’un autre client répond 404.

| Route | Exigence | Comportement |
| --- | --- | --- |
| `GET /api/espace-client` | CLI-02, CLI-05 | `prochains_evenements` : 3 événements au plus, date de début à venir, hors annulés et terminés, triés par date. `suivi` : demandes rattachées à la fiche du client (date, type, statut), avec l’événement lié et ses devis **envoyés** seulement. Compte sans fiche : deux listes vides. |
| `GET /api/profil` | CLI-03 | `compte` (prénom, nom, nom d’utilisateur, e-mail de connexion) et `fiche` (coordonnées) ou `null`. Aucun haché. |
| `PATCH /api/profil` | CLI-03, LOG-02 | Corps `{ compte?, fiche?, mot_de_passe_actuel? }`, chaque bloc complet. Mêmes validations que la gestion par l’administratrice. Changer l’e-mail de connexion exige le mot de passe actuel (400, code `MOT_DE_PASSE_ACTUEL_INVALIDE`). Doublon d’e-mail ou de nom d’utilisateur : 409. Coordonnées réellement modifiées : journal `MODIFICATION_CLIENT { id_client }`, acteur = le client. Quota : 20 requêtes par 15 minutes. |
| `DELETE /api/profil` | CLI-04, TR-04 | Corps `{ mot_de_passe }`. Pour un compte avec fiche, le journal `EFFACEMENT_CLIENT { id_client }`, sans nom, est écrit **avant** toute suppression : c’est la trace durable de la demande. MongoDB indisponible : rien n’est supprimé, réponse 503 (code `EFFACEMENT_INDISPONIBLE`), à réessayer. Puis transaction : verrou du compte, destruction de toutes ses sessions, suppression des demandes non converties portant son e-mail de connexion ou de contact (casse ignorée), puis fonction `supprimer_compte_client` (compte effacé, fiche anonymisée, notes et demandes rattachées supprimées ; devis, événements et avis conservés). Si la transaction échoue, le journal est retiré dès que la base confirme que la fiche n’est pas anonymisée. Ensuite : session courante détruite, cookie effacé, nom retiré de tous les journaux de cette fiche (repris par la purge en cas d’échec). Compte sans fiche : compte supprimé, journal écrit après coup (aucun journal ne porte de nom). Quota : 10 requêtes par 15 minutes. |
| `GET /api/mes-evenements` | CLI-06, CLI-07 | Tous ses événements, avec type, `date_accord_publication`, `visible_public` et son avis éventuel. |
| `POST /api/mes-evenements/:id/avis` | CLI-06, EMP-05 | Note entière de 1 à 5, commentaire de 1 à 2 000 caractères après suppression des espaces de début et de fin. Événement terminé uniquement (409 sinon), un seul avis (409). Statut « en attente » jusqu’à la modération par l’équipe. |
| `POST` et `DELETE /api/mes-evenements/:id/accord-publication` | CLI-07 | `POST` renseigne la date de l’accord si elle est vide (la date d’origine est conservée), `DELETE` la retire. Réponse : `{ date_accord_publication }`. |

La suppression d’une fiche par l’administratrice ne change pas : son journal `SUPPRESSION_CLIENT` conserve le nom du client. Seul l’effacement demandé par le client retire ce nom.

### Catalogue public (sans session)

| Route | Exigence | Comportement |
| --- | --- | --- |
| `GET /api/evenements-publics` | PUB-07 | Événements publiés : case « visible » cochée, accord du client donné, statut autre que brouillon (annulés compris, statut renvoyé). Filtres `du`, `au` (AAAA-MM-JJ, période qui chevauche l’événement, jours entiers à l’heure de Paris), `type`, `theme`, `tri` (`recent` par défaut ou `ancien`, sur la date de début), `page` (12 par page). Paramètre inconnu ou invalide : 400. Réponse : `{ evenements, total, page, par_page }`. Champs : identifiant, nom, dates ISO, lieu, statut, libellés du type et du thème, image. Ni prix, ni devis, ni coordonnées du client. |
| `GET /api/evenements-publics/filtres` | PUB-07 | `{ types, themes }` pour les listes du formulaire. |
| `GET /api/evenements-publics/:id` | PUB-08 | Même projection ; un événement non publié répond 404. |
| `GET /api/avis` (existante) | PUB-09 | Avis validés seulement, avec la note, le commentaire, la date et le nom de l’événement, jamais le nom du client. |

### Purges automatiques (TR-04)

Tâche de l’API lancée au démarrage puis toutes les 24 heures, sans bloquer les requêtes ; désactivable par la variable `PURGES_ACTIVES=false`.

1. Demandes classées sans suite dont le dernier contact date de plus de 3 ans : supprimées.
2. Pour chaque journal `EFFACEMENT_CLIENT` dont la fiche est anonymisée en base : nom retiré des journaux de la même fiche (reprise si le retrait a échoué au moment de l’effacement). Un journal d’effacement dont la fiche n’est pas anonymisée (effacement non abouti) est ignoré.
3. Journaux de plus d’un an, hors connexions réussies et échouées : supprimés. Les journaux de connexion restent effacés après 6 mois par l’index d’expiration existant.

Chaque étape est indépendante ; un échec écrit une ligne JSON sans donnée personnelle (`purge_echec` et le nom de l’étape) et n’arrête jamais l’API. Le bilan (`purges_terminees`) ne contient que des nombres. Un service gratuit en veille ne purge pas : le passage au démarrage rattrape les purges à la prochaine activité.

### Liste « à venir » du mobile (MOB-01)

`GET /api/evenements?avenir=true` retient désormais les événements dont la **date de fin** est à venir : un événement commencé et pas terminé reste dans la liste de l’employé. Statuts inchangés (brouillon, accepté, en cours).

## Contrôles de l’API

| Commande depuis `services/api` | Résultat | Preuve |
| --- | --- | --- |
| `npm.cmd ci` | OK : 323 paquets installés (7 alertes modérées dans les dépendances de développement, fichier de verrouillage inchangé) | Sortie de la commande |
| `npm.cmd run format:check` | OK | Sortie de la commande |
| `npm.cmd run lint` | OK | Sortie de la commande |
| `npm.cmd run typecheck` | OK | Sortie de la commande |
| `npm.cmd run test:coverage` (PostgreSQL 16.15 jetable, base `innov_events_tests`) | 204 réussis, 2 ignorés (nginx absent du poste), dont les 38 tests de `j10.integration.spec.ts` ; couverture : 90,75 % des lignes, 88,67 % des instructions, 82,07 % des branches, 92,19 % des fonctions | Sortie de la commande |
| `npm.cmd run build` | OK | `dist/` |
| `npm.cmd audit --omit=dev --audit-level=high` | 0 vulnérabilité | Sortie de la commande |
| CI de la PR (trois jobs `validation`) | Exécutée sur la PR | Onglet « Checks » de la PR |

## Tests automatisés ajoutés ou adaptés

| Fichier | Vérification | Résultat |
| --- | --- | --- |
| `src/routes/j10.integration.spec.ts` — matrice d’accès | Chaque route de l’API pour le visiteur, le client, l’employé et l’administratrice (tableau ci-dessous) ; contrôle que la matrice couvre toutes les routes déclarées par les routeurs | Réussi |
| `src/routes/j10.integration.spec.ts` — espace client | 3 prochains événements triés, annulé et terminé exclus ; suivi limité aux demandes rattachées et aux devis envoyés ; compte sans fiche ; 404 sur l’événement d’un autre client ; profil (validation, champ inconnu refusé, 409, mot de passe exigé pour l’e-mail, journal seulement si la fiche change) ; avis (refusé si non terminé, validations, doublon 409, modération puis publication sans nom) ; accord donné, date conservée, retiré | Réussi |
| `src/routes/j10.integration.spec.ts` — effacement | Compte supprimé, fiche anonymisée, deux sessions détruites, demandes non converties des deux e-mails effacées et autre demande conservée, événement, devis et avis conservés, notes supprimées, journal `EFFACEMENT_CLIENT` sans nom, nom retiré des journaux de la fiche et conservé pour un autre client, connexion refusée ensuite ; compte sans fiche ; retrait du nom en échec consigné sans donnée personnelle puis repris par la purge ; **panne simultanée de l’écriture du journal et du retrait du nom** : 503, rien de supprimé (compte, session, fiche, demande, nom des journaux), puis effacement complet au rétablissement de MongoDB ; échec de la transaction après le journal : journal retiré, rien de supprimé ; purge limitée aux fiches anonymisées ; compte sans fiche supprimé malgré MongoDB indisponible ; parcours de l’administratrice inchangé (nom conservé) | Réussi |
| `src/routes/j10.integration.spec.ts` — catalogue | Brouillon, sans accord et non visible exclus ; annulé inclus ; champs renvoyés limités, aucun prix ni devis ; filtres type, thème, période (chevauchement), tri, pagination (14 événements, pages de 12) ; 12 paramètres invalides en 400 ; détail publié, non publié 404, identifiant invalide 400 | Réussi |
| `src/routes/j10.integration.spec.ts` — purges | Demande échouée depuis 3 ans et 1 jour supprimée, depuis 3 ans moins 1 jour conservée, demande « à contacter » ancienne conservée ; filtre MongoDB des journaux d’un an (connexions exclues) ; échec d’une étape sans arrêt des autres | Réussi |
| `src/routes/j10.integration.spec.ts` — liste à venir | Événement en cours (commencé hier, fini demain) inclus ; événement fini exclu ; annulé exclu | Réussi |
| `src/services/purges.service.spec.ts` | Bilan des trois étapes ; reprise limitée aux fiches anonymisées ; poursuite après un échec ; un seul passage à la fois ; passage au démarrage puis toutes les 24 heures jusqu’à l’arrêt | Réussi |
| `src/config/config.spec.ts` | Purges actives par défaut, désactivables par `PURGES_ACTIVES=false` | Réussi |

### Matrice d’accès (AUTH-04)

« autorisé » : la route traite la demande (200, 201, 202, 204, ou 400, 404, 409 selon les données envoyées). Une route refusée répond 401 au visiteur et 403 à un rôle connecté. `GET /api/sante` a ses propres tests. `PATCH /api/mot-de-passe` exige une session et n’accepte qu’une session restreinte (mot de passe temporaire), ce que vérifient les tests de l’authentification.

| Route | Visiteur | Client | Employé | Administratrice |
| --- | --- | --- | --- | --- |
| `GET /api/csrf` | autorisé | autorisé | autorisé | autorisé |
| `POST /api/inscriptions` | autorisé | autorisé | autorisé | autorisé |
| `POST /api/sessions` | autorisé | autorisé | autorisé | autorisé |
| `GET /api/sessions/courante` | 401 | autorisé | autorisé | autorisé |
| `POST /api/mots-de-passe-oublies` | autorisé | autorisé | autorisé | autorisé |
| `PATCH /api/mot-de-passe` | 401 | autorisé | autorisé | autorisé |
| `POST /api/contacts` | autorisé | autorisé | autorisé | autorisé |
| `GET /api/types-evenement` | autorisé | autorisé | autorisé | autorisé |
| `POST /api/prospects` | autorisé | autorisé | autorisé | autorisé |
| `GET /api/parametres/remerciement` | 401 | 403 | 403 | autorisé |
| `PATCH /api/parametres/remerciement` | 401 | 403 | 403 | autorisé |
| `GET /api/prospects` | 401 | 403 | 403 | autorisé |
| `POST /api/prospects/:id/conversion` | 401 | 403 | 403 | autorisé |
| `POST /api/prospects/:id/echec` | 401 | 403 | 403 | autorisé |
| `GET /api/themes` | 401 | 403 | autorisé | autorisé |
| `POST /api/evenements` | 401 | 403 | 403 | autorisé |
| `GET /api/devis` | 401 | autorisé | 403 | autorisé |
| `POST /api/devis` | 401 | 403 | 403 | autorisé |
| `GET /api/devis/:id` | 401 | autorisé | 403 | autorisé |
| `GET /api/devis/:id/pdf` | 401 | autorisé | 403 | autorisé |
| `POST /api/devis/:id/envoi` | 401 | 403 | 403 | autorisé |
| `PATCH /api/devis/:id` | 401 | 403 | 403 | autorisé |
| `POST /api/devis/:id/lignes` | 401 | 403 | 403 | autorisé |
| `POST /api/devis/:id/reponse` | 401 | autorisé | 403 | 403 |
| `GET /api/administration/tableau-de-bord` | 401 | 403 | 403 | autorisé |
| `GET /api/clients` | 401 | 403 | autorisé | autorisé |
| `GET /api/clients/:id` | 401 | 403 | autorisé | autorisé |
| `POST /api/clients` | 401 | 403 | 403 | autorisé |
| `PATCH /api/clients/:id` | 401 | 403 | 403 | autorisé |
| `DELETE /api/clients/:id` | 401 | 403 | 403 | autorisé |
| `GET /api/evenements` | 401 | 403 | autorisé | autorisé |
| `GET /api/evenements/:id` | 401 | 403 | autorisé | autorisé |
| `PATCH /api/evenements/:id` | 401 | 403 | 403 | autorisé |
| `DELETE /api/evenements/:id` | 401 | 403 | 403 | autorisé |
| `GET /api/notes-globales` | 401 | 403 | 403 | autorisé |
| `POST /api/notes` | 401 | 403 | autorisé | autorisé |
| `PATCH /api/notes/:id` | 401 | 403 | autorisé | autorisé |
| `DELETE /api/notes/:id` | 401 | 403 | autorisé | autorisé |
| `POST /api/taches` | 401 | 403 | 403 | autorisé |
| `POST /api/taches/:id/affectation` | 401 | 403 | 403 | autorisé |
| `POST /api/taches/:id/statut` | 401 | 403 | autorisé | autorisé |
| `GET /api/comptes` | 401 | 403 | 403 | autorisé |
| `POST /api/comptes` | 401 | 403 | 403 | autorisé |
| `POST /api/comptes/:id/statut` | 401 | 403 | 403 | autorisé |
| `DELETE /api/comptes/:id` | 401 | 403 | 403 | autorisé |
| `GET /api/avis/moderation` | 401 | 403 | autorisé | autorisé |
| `POST /api/avis/:id/moderation` | 401 | 403 | autorisé | autorisé |
| `GET /api/avis` | autorisé | autorisé | autorisé | autorisé |
| `GET /api/journaux` | 401 | 403 | 403 | autorisé |
| `GET /api/espace-client` | 401 | autorisé | 403 | 403 |
| `GET /api/profil` | 401 | autorisé | 403 | 403 |
| `PATCH /api/profil` | 401 | autorisé | 403 | 403 |
| `DELETE /api/profil` | 401 | autorisé | 403 | 403 |
| `GET /api/mes-evenements` | 401 | autorisé | 403 | 403 |
| `POST /api/mes-evenements/:id/avis` | 401 | autorisé | 403 | 403 |
| `POST /api/mes-evenements/:id/accord-publication` | 401 | autorisé | 403 | 403 |
| `DELETE /api/mes-evenements/:id/accord-publication` | 401 | autorisé | 403 | 403 |
| `GET /api/evenements-publics` | autorisé | autorisé | autorisé | autorisé |
| `GET /api/evenements-publics/filtres` | autorisé | autorisé | autorisé | autorisé |
| `GET /api/evenements-publics/:id` | autorisé | autorisé | autorisé | autorisé |
| `DELETE /api/sessions` | autorisé | autorisé | autorisé | autorisé |

## Parcours manuels (pile Docker Compose locale)

Résultat attendu dans chaque ligne ; colonne « Résultat » : OK ou anomalie décrite. Les écrans de l’espace client et du catalogue arrivent avec la PR web du J10 ; ces parcours vérifient l’API seule.

| N° | Vérification | Résultat | Preuve |
| --- | --- | --- | --- |
| A1 | `docker compose up -d --build` puis `docker compose logs api` : une ligne `purges_terminees` avec trois nombres, aucune ligne `purge_echec`. | OK | `{"evenement":"purges_terminees","prospects_supprimes":0,"noms_retires":0,"journaux_supprimes":0}`, aucune ligne `purge_echec` |
| A2 | Navigateur sur `http://localhost:8080/api/evenements-publics` : JSON `{ evenements, total, page, par_page }` ; aucun prix, devis ni coordonnée de client. | OK | Réponse JSON dans le navigateur |
| A3 | `http://localhost:8080/api/evenements-publics?tri=prix` puis `?du=2026-02-31` : réponse 400 « Vérifiez les champs du formulaire. ». | OK | `{"erreur":"Vérifiez les champs du formulaire."}` pour les deux adresses |
| A4 | `http://localhost:8080/api/evenements-publics/filtres` : types et thèmes avec leurs libellés. | OK | Cinq types triés par libellé ; liste des thèmes vide (aucun thème dans la base locale) |
| A5 | Un événement passé à « visible » par l’administratrice mais sans accord du client n’apparaît pas dans A2 ; `http://localhost:8080/api/evenements-publics/<id>` répond 404. | Non réalisé à la main (base locale sans événement) | Couvert par `j10.integration.spec.ts` (catalogue : événement sans accord exclu, détail non publié en 404) |
| A6 | Application mobile : un événement en cours commencé avant aujourd’hui reste dans « Événements à venir ». | Non réalisé à la main (base locale sans événement) | Couvert par `j10.integration.spec.ts` (liste à venir : événement commencé la veille et fini le lendemain inclus) |
| A7 | MongoDB (`mongosh` sur le conteneur `mongo`, base `innov_events_logs`) après un effacement demandé par un client depuis l’écran web : journal `EFFACEMENT_CLIENT` avec l’identifiant de la fiche seulement ; plus aucun `details.nom_client` pour cette fiche. | OK : effacement de la fiche 4 depuis « Mon profil » ; journal `EFFACEMENT_CLIENT` réduit à `{ id_client: '4' }` ; le journal `CREATION_CLIENT` de cette fiche ne contient plus `nom_client` | Parcours W10 de `docs/tests/J10-web-resultats.md` ; requête `mongosh` sur `innov_events_logs`, 17/11/2026 |
| A8 | `docker compose stop mongo`, puis effacement demandé par un client depuis « Mon profil » : message « La suppression du compte est momentanément impossible… » ; le client reste connecté et sa fiche est intacte. `docker compose start mongo`, puis nouvelle demande : effacement complet (A7). | OK : client connecté avant l’arrêt de MongoDB ; message de refus, client toujours connecté, fiche 5 intacte en base ; après `docker compose start mongo`, effacement complet. Une nouvelle connexion est impossible pendant l’arrêt (journal de connexion obligatoire) | Parcours W11 de `docs/tests/J10-web-resultats.md`, 17/11/2026 |

## Limites connues

- Effacement d’un compte avec fiche pendant une panne de MongoDB : refusé (503) jusqu’au rétablissement, pour garantir que chaque effacement laisse une trace permettant de retirer le nom des journaux. Le client doit renouveler sa demande ; le message l’y invite.
- Panne simultanée de PostgreSQL et de MongoDB juste après l’écriture du journal : le journal d’effacement peut rester sans effacement en base ; la purge l’ignore tant que la fiche n’est pas anonymisée.
- Hébergement gratuit en veille : les purges s’exécutent au réveil du service, pas à heure fixe.
- Suivi de l’accueil client (CLI-02) : seules les demandes rattachées à la fiche du client apparaissent, c’est-à-dire converties par l’administratrice ; une nouvelle demande d’un client existant apparaît dès sa conversion. Les demandes « à contacter » et « échouées » ne sont reliées au client que par l’e-mail saisi dans le formulaire. Elles ne sont pas rapprochées par e-mail : l’adresse d’un compte n’est pas vérifiée (compte utilisable dès l’inscription, e-mail modifiable avec le seul mot de passe), et un tel rapprochement montrerait les demandes d’une autre entreprise à quiconque crée un compte avec son adresse. Une demande classée sans suite est signalée au demandeur par e-mail.
