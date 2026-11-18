# Vérifications — application mobile du J10 : fiches, contact, note rapide, CGU et CGV

Date : 17/11/2026

Base : `ac892ac` (`dev` après les finitions du J9), complétée par cette PR. Poste : Windows 11, PowerShell 5.1. Périmètre : `apps/mobile/src/`, `apps/mobile/e2e/` ; aucune dépendance nouvelle. Routes de l’API utilisées : `GET /api/evenements?avenir=true`, `GET /api/evenements/:id`, `GET /api/clients/:id`, `POST /api/notes`.

## Contenu

| Exigence | Réalisation |
| --- | --- |
| MOB-01 (complément) | Liste « Événements à venir » : champ « Rechercher » (nom de l’événement, client, lieu ; sans tenir compte des accents ni de la casse, plusieurs mots cumulés) et liste « Statut » (Tous, Brouillon, Accepté, En cours), cumulables, bouton « Réinitialiser ». Nombre de résultats annoncé aux lecteurs d’écran (`role="status"`), par exemple « 1 événement affiché sur 3 ». Dates au format `jj/mm/aaaa · hh:mm`. |
| MOB-02 | Un appui sur une carte ouvre `/evenements/:id` : nom (titre unique de la page), statut en badge d’état de la charte, début, fin, lieu, client associé avec le lien « Voir la fiche client de … » ; lien « ‹ Retour aux événements ». Client anonymisé : message, sans lien. |
| MOB-03 | `/clients/:id` : entreprise, contact et trois actions d’un seul appui, au libellé explicite : « Appeler … » (`tel:` avec le numéro nettoyé des espaces, points, tirets et parenthèses), « Envoyer un e-mail à … » (`mailto:`), « Ouvrir l’itinéraire vers … » (Plans sur iPhone et iPad via `https://maps.apple.com/?daddr=…`, Google Maps ailleurs via `https://www.google.com/maps/dir/?api=1&destination=…`, adresse encodée ; plateforme détectée par Ionic). Coordonnée absente : action masquée et message ; fiche anonymisée : toutes les actions masquées et message. Retour vers l’événement d’origine. |
| MOB-04 | Bouton principal « Ajouter une note », pleine largeur, en haut de la fiche ; saisie simple (zone « Nouvelle note » avec étiquette et aide, « Enregistrer la note », « Annuler ») ; curseur placé dans la zone à l’ouverture ; note vide refusée avec message relié au champ ; envoi unique (bouton désactivé et garde contre le double appui) ; confirmation annoncée (« Note enregistrée et partagée avec l’équipe. ») et note affichée en tête des notes de la fiche ; erreur du serveur affichée sans perdre le texte. |
| MOB-06 | Rien à coder : `Dockerfile` et `nginx.conf` du mobile existants ; vérification ci-dessous (M1). |
| MOB-07 | Pages `/cgu` et `/cgv`, consultables sans connexion depuis l’écran de connexion et depuis la liste (liens « Conditions générales d’utilisation » et « Conditions générales de vente ») ; passage de l’une à l’autre ; contenu identique aux pages du site (`apps/web/src/app/pages/page-legale/contenus-legaux.ts`, sections CGU et CGV), recopié dans `src/app/page-legale/contenus-legaux.ts` avec un commentaire qui renvoie à la source. |

Charte CO-09 : cartes blanches à rayon de 12 px ; carte de la liste cliquable sur toute sa surface (contour de 2 px) ; boutons et liens d’action de 44 px de haut au moins ; seules les associations de couleurs autorisées (§3 et §7 bis) : texte secondaire `#465569` sur blanc ou fond de page, confirmation en couple « succès », message d’information en couple « information », erreur en couple « erreur », lien d’action en blanc sur primaire. Contour de focus violet sur les surfaces claires.

## Contrôles du mobile

| Commande depuis `apps/mobile` | Résultat | Preuve |
| --- | --- | --- |
| `npm.cmd ci` | OK : 512 paquets installés, sans erreur | Sortie de la commande |
| `npm.cmd run format:check` | OK : `All matched files use Prettier code style!` | Sortie de la commande |
| `npm.cmd run lint` | OK : `All files pass linting.` | Sortie de la commande |
| `npm.cmd run typecheck` | OK : aucune erreur (application, tests unitaires, tests end-to-end) | Sortie de la commande |
| `npm.cmd run test:coverage` | OK : 10 fichiers, 58 tests réussis sur 58 ; couverture : lignes 86,24 %, instructions 86,36 %, branches 84,26 %, fonctions 75,3 % | Sortie de la commande |
| `npm.cmd run test:e2e` | OK : 3 scénarios réussis sur 3 (Chromium) | Sortie de la commande |
| `npm.cmd run build` | OK : `Application bundle generation complete.`, sans avertissement de budget ; bundle initial 539,43 kB (140,00 kB transférés) | `www/` |
| `npm.cmd audit --omit=dev --audit-level=high` | OK : `found 0 vulnerabilities` | Sortie de la commande |
| CI de la PR (trois jobs `validation`) | OK : `validation (api)`, `validation (web)` et `validation (mobile)` réussis sur `a8f25ef` (exécution n° 43, 2 min 14 s) | https://github.com/Onizuka-05/innov-events-manager/actions/runs/44097865553 |

## Tests automatisés ajoutés ou adaptés

| Fichier | Vérification | Résultat |
| --- | --- | --- |
| `src/app/home/home.page.spec.ts` | Recherche sur le nom, le client et le lieu (accents et casse ignorés) ; filtre par statut cumulé ; réinitialisation ; nombre de résultats annoncé ; lien de chaque carte vers sa fiche ; liens CGU et CGV ; dates au format français | OK : 9 tests réussis |
| `src/app/evenement/evenement.page.spec.ts` | Chargement et affichage de la fiche ; un seul titre de niveau 1 ; badge d’état ; lien vers la fiche client ; bouton « Ajouter une note » principal, pleine largeur, avant les informations ; note enregistrée, confirmée et affichée ; double appui : un seul envoi ; note vide refusée ; erreur du serveur sans perte du texte ; Annuler ; erreur de chargement ; identifiant invalide sans appel ; client anonymisé | OK : 8 tests réussis |
| `src/app/client/client.page.spec.ts` | Liens `tel:`, `mailto:` et Google Maps générés ; Plans sur iPhone ; action masquée si la coordonnée manque ; fiche anonymisée sans action ; retour à l’événement d’origine, valeur non numérique ignorée ; erreur du serveur | OK : 6 tests réussis |
| `src/app/core/contact.spec.ts` | Nettoyage du numéro, lien e-mail, encodage de l’adresse de l’itinéraire | OK : 8 tests réussis |
| `src/app/page-legale/page-legale.page.spec.ts` | Toutes les sections des CGU et des CGV ; lien de l’une vers l’autre ; pages sans garde de connexion, fiches protégées | OK : 4 tests réussis |
| `src/app/connexion/connexion.page.spec.ts` | Liens CGU et CGV depuis l’écran de connexion | OK : 4 tests réussis |
| `e2e/app.spec.ts` (Playwright, API simulée) | Connexion puis déconnexion ; recherche et filtre avec le nombre de résultats ; liste → fiche → client → vérification des trois liens → retour → ajout d’une note → déconnexion → CGU depuis la connexion → CGV | OK : 3 scénarios réussis |

## Parcours manuels (pile Docker Compose locale)

Résultat attendu dans chaque ligne ; colonne « Résultat » : OK ou anomalie décrite.

| N° | Vérification | Résultat | Preuve |
| --- | --- | --- | --- |
| M1 | MOB-06 : `docker compose build mobile` sans erreur, puis `docker compose up -d` : l’application est servie sur `http://localhost:8100` et l’écran « Connexion de l’équipe » s’affiche. | OK | Image `innov-events-manager-mobile` construite ; conteneur `mobile` `healthy` sur `127.0.0.1:8100` ; 17/11/2026 |
| M2 | Sans connexion : liens CGU et CGV de l’écran de connexion, lecture complète à 375 px sans défilement horizontal, passage des CGU aux CGV, « ‹ Retour à l’application » ramène à la connexion. | OK | Constat manuel, Chrome à 375 px, 17/11/2026 |
| M3 | Connexion de l’employé : recherche « nom du client » puis filtre « Brouillon » ; le nombre affiché suit ; « Réinitialiser » rétablit la liste. | OK | Constat manuel, Chrome à 375 px, 17/11/2026 |
| M4 | Appui sur une carte : fiche avec nom, dates, lieu, badge d’état et client ; « Voir la fiche client » ouvre la fiche contact. | OK | Constat manuel, Chrome à 375 px, 17/11/2026 |
| M5 | Fiche contact : les trois boutons ont un libellé explicite ; survol et focus visibles ; une fiche sans téléphone n’affiche pas « Appeler ». | OK | Constat manuel, Chrome à 375 px, 17/11/2026 |
| M6 | « Ajouter une note » : le curseur est dans la zone ; « Enregistrer la note » avec un texte vide affiche l’erreur ; avec un texte, confirmation puis note en tête de liste ; un double appui rapide n’enregistre qu’une note (vérifier dans la fiche web de l’événement). | OK | Constat manuel, Chrome à 375 px, 17/11/2026 |
| M7 | Clavier (ordinateur, Tab et Maj+Tab) : ordre logique sur la liste, la fiche et la fiche contact ; contour de focus violet visible et non coupé sur chaque lien, champ et bouton ; Entrée active les liens et boutons. | OK | Constat manuel, Chrome à 375 px, 17/11/2026 |
| M8 | Mode sombre du système : la palette claire de la charte reste appliquée. | OK | Constat manuel, Chrome à 375 px, 17/11/2026 |

## Essai sur iPhone réel (après la mise en ligne)

| N° | Vérification | Résultat | Preuve |
| --- | --- | --- | --- |
| I1 | Dates de la liste et de la fiche au format `jj/mm/aaaa · hh:mm` (aucune date vide ou invalide). | OK | Constat manuel, iPhone (Safari), compte employé de José, 18/11/2026 |
| I2 | « Appeler … » propose l’appel du numéro de la fiche. | OK | Constat manuel, iPhone (Safari), compte employé de José, 18/11/2026 |
| I3 | « Envoyer un e-mail à … » ouvre Mail avec le destinataire prérempli. | OK | Constat manuel, iPhone (Safari), compte employé de José, 18/11/2026 |
| I4 | « Ouvrir l’itinéraire vers … » ouvre Plans sur l’adresse du client. | OK | Constat manuel, iPhone (Safari), compte employé de José, 18/11/2026 |
| I5 | Ajout d’une note depuis la fiche : clavier virtuel sans masquer les boutons, confirmation, note visible ensuite dans l’espace web de l’équipe. | OK | Constat manuel, iPhone (Safari), compte employé de José, 18/11/2026 |
| I6 | CGU et CGV lisibles sans zoom ni défilement horizontal. | OK | Constat manuel, iPhone (Safari), compte employé de José, 18/11/2026 |
