# TST-02 — Demande de devis testée sur les trois niveaux

Fonctionnalité : un visiteur, sans compte, décrit son projet dans le formulaire public ; l’API enregistre la demande au statut « à contacter », notifie l’adresse de contact d’Innov’Events par e-mail et renvoie le message de remerciement défini par l’administratrice. Exigences liées : PUB-06 (formulaire, ligne « à contacter », e-mail à l’adresse de contact), ADM-09 (message de remerciement modifiable), TR-03 (contrôles côté serveur, CSRF, limitation de débit).

Parcours couvert : accueil → bouton « Demander un devis » → formulaire (10 champs obligatoires : entreprise, nom, prénom, e-mail, téléphone, lieu souhaité, date souhaitée, type d’événement, nombre de participants, description du besoin) → envoi → remerciement → e-mail de notification.

## 1. Tests unitaires

| Fichier | Test | Ce qu’il prouve | Résultat |
| --- | --- | --- | --- |
| `apps/web/src/app/pages/formulaires.spec.ts` | « reprend les champs, titres, etapes et libelles de W1 » | Les 10 champs obligatoires existent et chacun a une étiquette ; titre et trois étapes de la maquette | Réussi |
| `apps/web/src/app/pages/formulaires.spec.ts` | « n’envoie pas une demande incomplete et signale les champs invalides » | Aucun appel à l’API tant qu’un champ manque ; champs invalides signalés | Réussi |
| `apps/web/src/app/pages/formulaires.spec.ts` | « envoie les types numeriques et affiche uniquement le message recu apres succes » | Type d’événement et nombre de participants envoyés comme nombres ; remerciement affiché seulement après la réponse de l’API | Réussi |
| `apps/web/src/app/pages/formulaires.spec.ts` | « conserve les saisies si l’enregistrement echoue » | Une erreur de l’API n’efface pas le formulaire | Réussi |
| `apps/web/src/app/pages/formulaires.spec.ts` | « affiche un message comme texte, sans executer son contenu HTML » | Le remerciement est affiché comme texte (pas d’injection HTML) | Réussi |
| `services/api/src/services/formulaires.service.spec.ts` | « enregistre la demande avant de notifier l’adresse de contact, puis renvoie le remerciement » | Ordre enregistrement puis notification ; destinataire, objet, adresse de réponse et contenu de l’e-mail ; réponse renvoyée | Réussi |
| `services/api/src/services/formulaires.service.spec.ts` | « refuse un type d’evenement indisponible sans rien enregistrer ni envoyer » | Erreur 400, aucune écriture, aucun e-mail | Réussi |
| `services/api/src/services/formulaires.service.spec.ts` | « conserve la demande si l’e-mail echoue et le signale sans donnee personnelle » | La demande reste enregistrée, `notification_envoyee` vaut `false`, ligne de journal sans e-mail du visiteur | Réussi |
| `services/api/src/services/courriels.service.spec.ts` | « construit un message texte avec l’expediteur configure et le bon destinataire » ; « ne transmet aucun detail d’erreur du fournisseur » | Format du message envoyé au fournisseur d’e-mails en production ; erreur du fournisseur sans détail technique | Réussi |

## 2. Tests fonctionnels (API réelle, PostgreSQL réel)

Supertest sur l’application Express complète et une base PostgreSQL 16.15 jetable (`TEST_DATABASE_URL`), envoi d’e-mails simulé. Fichier : `services/api/src/routes/j7.integration.spec.ts`.

| Test | Ce qu’il prouve | Résultat |
| --- | --- | --- |
| « devis : statut impose, notification et message admin dans les demandes suivantes » | `POST /api/prospects` répond 201 avec le remerciement modifié par l’administratrice ; demande enregistrée au statut `a_contacter`, sans client ; e-mail adressé à l’adresse de contact | Réussi |
| « devis : champ obligatoire %s controle sur le serveur » (10 cas) | Chaque champ manquant est refusé en 400 par l’API, indépendamment du navigateur | Réussi |
| « devis : refuse date impossible, nombre fractionnaire, type absent et injection de statut » | Date inexistante, nombre non entier, type inconnu et champ `statut_prospect` ajouté : 400 | Réussi |
| « CSRF obligatoire sur post /api/prospects » | Envoi refusé (403) sans jeton CSRF | Réussi |
| « bloque post /api/prospects pour une session restreinte » | Une session à mot de passe temporaire ne peut pas envoyer de demande | Réussi |

## 3. Test de bout en bout (navigateur réel, pile Docker Compose)

Fichier : `apps/web/e2e/demande-devis.spec.ts` (Playwright, Chrome). Il s’exécute sur la pile locale complète, déjà démarrée par `docker compose up -d` : site sur `http://localhost:8080`, nginx, API, PostgreSQL, MongoDB et Mailpit (`http://localhost:8025`), qui reçoit les e-mails. Lancement : `npm.cmd run test:e2e` depuis `apps/web`. La CI GitHub Actions ne le lance pas, car elle ne démarre pas la pile complète.

| Test | Ce qu’il prouve | Résultat |
| --- | --- | --- |
| « envoie la demande, affiche le remerciement et notifie l’adresse de contact » | Depuis l’accueil, le bouton « Demander un devis » ouvre le formulaire ; les 10 champs sont remplis avec un e-mail unique ; après l’envoi, le remerciement s’affiche sans alerte de notification ; Mailpit a reçu exactement un e-mail « Nouvelle demande de devis » adressé à `contact@innov-events.invalid`, avec l’e-mail du visiteur en adresse de réponse et le contenu de la demande | Réussi |
| « refuse une demande incomplete : message d’erreur, aucun envoi, aucun e-mail » | Lieu souhaité laissé vide : message « Vérifiez tous les champs obligatoires. », champ signalé (`aria-invalid`, « Vérifiez ce champ. »), aucun remerciement, aucune requête `POST /api/prospects` émise et aucun e-mail dans Mailpit | Réussi |

Précautions : chaque exécution enregistre une demande réelle dans la base locale (entreprise « Société Essai Bout en Bout », e-mail `e2e-…@example.org`). L’API limite l’envoi de demandes à 5 par quart d’heure depuis le même poste : au-delà, attendre avant de relancer.

## 4. Synthèse

| Niveau | Nombre de tests | Exécution | Résultat |
| --- | --- | --- | --- |
| Unitaire (web) | 5 | `npm.cmd run test:coverage` dans `apps/web` | Réussi (17/11/2026 ; 179 tests du web réussis) |
| Unitaire (API) | 5 | `npm.cmd run test:coverage` dans `services/api` | Réussi (17/11/2026 ; 207 tests de l’API réussis, 2 ignorés) |
| Fonctionnel (API et PostgreSQL) | 14 | `npm.cmd run test:coverage` dans `services/api`, avec `TEST_DATABASE_URL` | Réussi (17/11/2026 ; PostgreSQL 16.15 jetable) |
| Bout en bout | 2 | `npm.cmd run test:e2e` dans `apps/web`, pile Compose démarrée | Réussi (17/11/2026 ; `2 passed`) |
