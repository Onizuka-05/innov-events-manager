# Vérifications

Date : 16/11/2026

Commit : `18dff79` (`dev` après l'administration et l'espace employé) complété par cette PR. Poste : Windows 11, PowerShell 5.1.

## Contrôles web

| Commande depuis `apps/web` | Résultat | Preuve |
| --- | --- | --- |
| `npm.cmd run format:check` | OK | Sortie de la commande |
| `npm.cmd run lint` | OK | `All files pass linting.` |
| `npm.cmd run typecheck` | OK | Aucune erreur |
| `npm.cmd run test:coverage` | 108 réussis sur 108 (9 fichiers) ; couverture des lignes 76,7 % | Sortie de la commande |
| `npm.cmd run build` | OK | `dist/web/` |
| `npm.cmd audit --omit=dev --audit-level=high` | 0 vulnérabilité | Sortie de la commande |

## Navigation et accès

Les tableaux suivants sont la liste de contrôle préparée au J9. Les parcours du 17/11/2026 (`J9-finitions.md` : W1 à W12, P1 à P7) et la recette en production du 18/11/2026 (`plan-de-tests.md`, section 8 : A1 à A16) documentent certains des contrôles ; les accès sont également vérifiés par les tests automatisés de `apps/web/src/app/pages/gestion/organisation-espaces.spec.ts`. Les cases non renseignées ci-dessous ne constituent pas une preuve de validation individuelle.

| Vérification | Résultat | Preuve |
| --- | --- | --- |
| Administratrice : les dix rubriques sont présentes sur chaque page de l’équipe. | | |
| Employé : Clients, Événements, Mes tâches et Avis seulement. | | |
| Client : aucun lien vers les rubriques de l’équipe. | | |
| Un seul `h1` et un titre d’onglet distinct par rubrique. | | |
| La rubrique active porte `aria-current="page"`, y compris avec un identifiant de fiche dans l’URL. | | |
| Petit écran : ouverture et fermeture du menu, `aria-expanded`, touche Échap et retour du focus. | | |
| Clavier : ordre de tabulation, focus visible, activation des liens et boutons. | | |
| Cibles de navigation d’au moins 44 × 44 px ; lecture à 320 px et zoom à 200 %. | | |
| Connexion : administratrice vers `/administration`, employé vers `/administration/evenements`, client vers `/espace`. | | |
| Destination demandée conservée après connexion et changement du mot de passe temporaire. | | |
| `/espace` renvoie l’administratrice et l’employé vers leur accueil. | | |
| L’employé saisissant une rubrique réservée à l’admin revient à son accueil ; un appel direct de son API reste refusé en 403. | | |

## Parcours commercial

| Vérification | Résultat | Preuve |
| --- | --- | --- |
| Prospects : recherche, filtre par statut, classement sans suite et message envoyé. | | |
| Conversion : coordonnées préremplies, adresse postale obligatoire. | | |
| Client qui revient : annonce avant confirmation, fiche et adresse conservées. | | |
| Conversion réussie : `/administration/devis?prospect=…`, étape « Créer un événement » préremplie après relecture des données. | | |
| Réouverture de l’adresse : préremplissage conservé sans stockage local de données personnelles. | | |
| Événement sans demande, création d’un devis sur un événement existant. | | |
| Liste des devis : chaque statut, dont Acceptés ; démarrage de l’événement accepté. | | |
| Détail, prestations et totaux, PDF, envoi, demande de modification et contre-proposition. | | |
| Client sur `/devis` : Mes devis, PDF et réponses inchangés. | | |
| Admin sur `/devis` : redirection vers `/administration/devis` ; employé refusé. | | |
| Tableau de bord : notes récentes et notes globales conservées, section Prospects retirée. | | |
| Paramètres : modification du remerciement ; ancienne adresse redirigée. | | |
| Anciennes adresses `/equipe/…` : redirections avec l’identifiant de fiche conservé. | | |
| Clients, événements, notes, tâches, avis, comptes et journaux : fonctions conservées. | | |

## Tâches

Les rubriques Tâches et Mes tâches chargent la liste des événements, puis leurs fiches en parallèle avec les routes existantes. L’administratrice voit toutes les tâches ; l’employé voit seulement celles dont il est l’affecté. Chaque tâche renvoie vers sa fiche d’événement. Les contrôles d’accès et la modification des statuts restent assurés par l’API.

| Vérification | Résultat | Preuve |
| --- | --- | --- |
| Admin : consultation des tâches et ouverture de leur événement. | | |
| Employé : toutes ses tâches sont visibles, celles d’un autre employé sont absentes, et chaque lien ouvre le bon événement. | | |
| Dans une fiche : notes, affectation et progression des tâches selon les droits existants. | | |

## Bilan

Tests réussis : 108 (tests unitaires web)

Tests échoués : 0

Tests ignorés : 0

Anomalies et corrections : aucune à l'exécution ; avant intégration, la rubrique Mes tâches de l'employé a été complétée pour afficher ses tâches.

Rapports complémentaires : `J9-finitions.md` et `plan-de-tests.md` (section 8). Les résultats non renseignés ci-dessus restent sans preuve individuelle dans ce tableau.
