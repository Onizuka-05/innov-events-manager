# Vérifications — finitions des espaces de l’équipe (web et mobile)

Date : 17/11/2026

Commit : `2ca4b3b` (`dev` après l’administration, l’espace employé, l’organisation des espaces et le mobile) complété par cette PR. Poste : Windows 11, PowerShell 5.1.

## Contenu

- En-tête du site : « Demander un devis » réservé au visiteur et au client ; « Administration » remplace « Mon espace » pour l’administratrice et l’employé et ouvre l’accueil de leur rôle.
- Espaces de l’équipe à la charte graphique CO-09, sans changement de mise en page : menu en boutons avec rubrique active pleine (`aria-current="page"` conservé), badges de statut aux couleurs d’état, cartes avec en-tête, tableaux lisibles, un bouton principal par zone et des boutons secondaires à contour, largeurs cohérentes.
- Correspondance unique entre statuts et couleurs d’état, identique sur le web et le mobile :

| Famille (texte / fond) | Statuts |
| --- | --- |
| Neutre (`#30465E` / `#E9EFF6`) | brouillon, en préparation, à faire |
| Information (`#1559A8` / `#E8F2FC`) | à contacter, étude client, en cours (événement, tâche) |
| Alerte (`#8B520A` / `#FFF1D6`) | modification demandée, en attente (avis), suspendu (compte) |
| Succès (`#176344` / `#E6F4EB`) | accepté, validé, converti, terminé, actif |
| Erreur (`#A3212A` / `#FCE9E9`) | refusé, annulé, échoué, supprimé (compte employé) |

- Tâches et Mes tâches : nom de l’événement sur chaque carte.
- Journaux : identifiant et nom de l’utilisateur lus dans la liste des comptes (« Compte supprimé n° X » si le compte n’existe plus) ; actions et détails écrits en texte ; plus de lien « Tableau de bord » en tête de Journaux et de Comptes.
- Mobile : mêmes badges d’état ; « Se déconnecter » en bouton secondaire ; thème aligné sur la charte.
- Petit écran (moins de 768 px) : un seul bouton de menu pour l’équipe, rubriques de l’équipe en premier puis liens du site ; focus, `aria-expanded` et touche Échap conservés.
- Contrastes : seules les associations de couleurs autorisées par la charte (§3 et §7 bis) sont utilisées ; les boutons désactivés prennent le couple « désactivé » de la charte au lieu d’une opacité réduite.

## Contrôles web

| Commande depuis `apps/web` | Résultat | Preuve |
| --- | --- | --- |
| `npm.cmd run format:check` | OK | `All matched files use Prettier code style!` |
| `npm.cmd run lint` | OK | `All files pass linting.` |
| `npm.cmd run typecheck` | OK | Aucune erreur |
| `npm.cmd run test:coverage` | 134 réussis sur 134 (10 fichiers) ; couverture des lignes 77,2 % | Sortie de la commande |
| `npm.cmd run build` | OK | `dist/web/` |
| `npm.cmd audit --omit=dev --audit-level=high` | 0 vulnérabilité | Sortie de la commande |

## Contrôles mobile

| Commande depuis `apps/mobile` | Résultat | Preuve |
| --- | --- | --- |
| `npm.cmd run format:check` | OK | `All matched files use Prettier code style!` |
| `npm.cmd run lint` | OK | `All files pass linting.` |
| `npm.cmd run typecheck` | OK | Aucune erreur |
| `npm.cmd run test:coverage` | 27 réussis sur 27 (6 fichiers) ; couverture des lignes 71,11 % | Sortie de la commande |
| `npm.cmd run test:e2e` | 1 réussi | Sortie de la commande |
| `npm.cmd run build` | OK | `www/` |
| `npm.cmd audit --omit=dev --audit-level=high` | 0 vulnérabilité | Sortie de la commande |

## Tests automatisés ajoutés ou adaptés

| Fichier | Vérification | Résultat |
| --- | --- | --- |
| `apps/web/src/app/core/statuts.spec.ts` | Table identique à la charte ; libellé et classe de chaque badge ; Brouillon et En cours distincts ; statut inconnu | 12 réussis |
| `apps/web/src/app/app.spec.ts` | En-tête par rôle (Administration, Mon espace, Demander un devis) ; menu compact unique, rubriques de l’équipe en premier, Échap et retour du focus, fermeture après choix | 31 réussis |
| `apps/web/src/app/pages/gestion/navigation-equipe.spec.ts` | Nombre de rubriques par rôle ; plus de bouton de menu propre au menu de l’équipe | 4 réussis |
| `apps/web/src/app/pages/gestion/gestion.spec.ts` | Journaux lisibles (identifiant, compte supprimé, détails en texte, liste des comptes indisponible) ; absence du lien « Tableau de bord » ; nom de l’événement sur la carte de tâche ; badges d’état ; hiérarchie des boutons | 19 réussis |
| `apps/mobile/src/app/core/statuts.spec.ts` | Table identique à la charte et au web | 2 réussis |
| `apps/mobile/src/app/home/home.page.spec.ts` | Badges Brouillon, Accepté et En cours distincts ; « Se déconnecter » secondaire | 5 réussis |

## Parcours manuels — web

Résultat attendu dans chaque ligne ; colonne « Résultat » : OK ou anomalie décrite.

| N° | Vérification | Résultat | Preuve |
| --- | --- | --- | --- |
| W1 | Visiteur puis client : « Demander un devis » visible dans l’en-tête ; client : « Mon espace » présent. | OK | Parcours manuel du 17/11/2026 |
| W2 | Administratrice : « Administration » à la place de « Mon espace », ouvre le Tableau de bord ; aucun « Demander un devis » dans l’en-tête. | OK | Parcours manuel du 17/11/2026 |
| W3 | Employé : « Administration » ouvre Événements ; aucun « Demander un devis » dans l’en-tête. | OK | Parcours manuel du 17/11/2026 |
| W4 | Menu de l’équipe sur ordinateur : rubriques en boutons à contour, rubrique active pleine, une seule rubrique avec `aria-current="page"`, y compris avec `?id=` dans l’adresse. | OK | Parcours manuel du 17/11/2026 |
| W5 | Badges : prospects, devis, événements, tâches, avis et comptes aux couleurs d’état du tableau ci-dessus, libellé écrit en clair. | OK | Parcours manuel du 17/11/2026 |
| W6 | Cartes : en-tête sur surface secondaire (Tableau de bord, fiches client et événement, notes, tâches, avis, Comptes, Paramètres, Prospects, Devis). | OK | Parcours manuel du 17/11/2026 |
| W7 | Boutons : un seul bouton principal (vert plein) par zone ; actions secondaires à contour ; suppressions en rouge plein avec confirmation. | OK | Parcours manuel du 17/11/2026 |
| W8 | Largeurs : « Rechercher » et « Filtrer » à côté du champ sur ordinateur, sous le champ sans pleine largeur sur téléphone ; Paramètres aligné sur les autres rubriques. | OK | Parcours manuel du 17/11/2026 |
| W9 | Tâches et Mes tâches : nom de l’événement sur chaque carte, lien vers la bonne fiche. | OK | Parcours manuel du 17/11/2026 |
| W10 | Journaux : identifiant et nom de l’utilisateur ; compte client supprimé affiché « Compte supprimé n° X » ; connexion échouée sans utilisateur (« — ») ; détails en texte, sans accolades ; filtre par type d’action avec libellés en clair. | OK | Parcours manuel du 17/11/2026 |
| W11 | Journaux et Comptes : plus de lien « Tableau de bord » en tête de page. | OK | Parcours manuel du 17/11/2026 |
| W12 | Boutons désactivés pendant un envoi : fond gris clair et texte gris, sans transparence. | OK | Parcours manuel du 17/11/2026 |

## Parcours manuels — petit écran et clavier

| N° | Vérification | Résultat | Preuve |
| --- | --- | --- | --- |
| P1 | 375 px, administratrice : un seul bouton « Ouvrir le menu » ; ouvert, il montre les dix rubriques de l’équipe puis les liens du site. | OK | Parcours manuel du 17/11/2026 |
| P2 | 375 px, employé : quatre rubriques (Clients, Événements, Mes tâches, Avis) puis les liens du site. | OK | Parcours manuel du 17/11/2026 |
| P3 | `aria-expanded` passe à `true` puis `false` ; Échap ferme le menu et rend le focus au bouton ; le choix d’une rubrique ferme le menu et place le focus sur le contenu. | OK | Parcours manuel du 17/11/2026 |
| P4 | Entre 768 et 1 100 px : menu de l’équipe visible en boutons, un seul bouton de menu pour les liens du site. | OK | Parcours manuel du 17/11/2026 |
| P5 | 320 px : aucun défilement horizontal de la page sur chaque rubrique (les tableaux défilent dans leur propre zone, accessible au clavier). | OK | Parcours manuel du 17/11/2026 |
| P6 | Clavier : ordre de tabulation, focus violet visible sur le fond clair et autour de la rubrique active, aucun contour coupé. | OK | Parcours manuel du 17/11/2026 |
| P7 | Zoom 200 % : aucune perte de contenu ni d’action. | OK | Parcours manuel du 17/11/2026 |

## Parcours manuels — mobile

| N° | Vérification | Résultat | Preuve |
| --- | --- | --- | --- |
| M1 | Liste des événements : badges Brouillon (neutre), Accepté (succès) et En cours (information) distincts, libellés en clair. | OK | Parcours manuel du 17/11/2026 |
| M2 | « Actualiser » en bouton principal, « Se déconnecter » en bouton secondaire à contour. | OK | Parcours manuel du 17/11/2026 |
| M3 | Téléphone en mode sombre : thème clair conservé. | OK | Parcours manuel du 17/11/2026 |

## Bilan

Tests réussis : 162 (134 tests unitaires web, 27 tests unitaires mobile, 1 test Playwright mobile)

Tests échoués : 0

Tests ignorés : 0

Anomalies et corrections : aucune.

Liens des preuves : sorties des commandes et parcours manuels W1 à W12, P1 à P7 et M1 à M3 consignés dans ce document ; résultats repris dans la description de la PR.
