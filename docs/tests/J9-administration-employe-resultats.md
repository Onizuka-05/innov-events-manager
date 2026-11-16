# J9 — Administration et espace employé

Date : 16/11/2026. Base : `3c7b6d9effc14ce06eb0d823eb5bb5e795612c3c` (parcours devis intégré).

## Contenu et points d'entrée

- `/espace` dirige l'administrateur vers `/administration`. Le tableau de bord contient les trois prochains événements avec le client, les cinq notes récentes, les clients ayant au moins un événement en cours, les brouillons et les prospects. La conversion d'un prospect mène à `/devis?prospect=…` avec la demande présélectionnée.
- `/equipe/clients` : recherche, coordonnées, historique. L'administrateur peut créer, modifier et supprimer une fiche.
- `/equipe/evenements` : fiches, notes et tâches ; création, modification, suppression et pilotage du cycle réservés à l'administrateur. Un événement ayant un devis ne peut pas être supprimé. Un événement terminé ou annulé ne revient pas à un état antérieur.
- Les notes globales sont réservées à l'administrateur ; un employé ne modifie et ne supprime que ses notes de projet. L'administrateur gère toutes les notes.
- L'administrateur crée et réaffecte les tâches. Seul l'affecté, administrateur compris, fait avancer une tâche de « À faire » à « En cours », puis « Terminé ».
- `/devis` propose le filtre « Devis acceptés » et permet de passer leur événement accepté à « En cours ».
- `/administration/comptes` : création de comptes employés ou clients, suspension, réactivation et suppression. Le compte administrateur reste protégé et ne peut être créé par HTTP. Un mot de passe temporaire aléatoire valable 7 jours est envoyé au titulaire avant le commit ; l'échec de cet e-mail annule la création et le rattachement. Le mot de passe définitif est absent et le renouvellement est imposé à la première connexion. Aucun mot de passe n'est affiché à l'administrateur.
- `/equipe/avis` permet de valider ou refuser les avis en attente ; `/avis` affiche seulement les avis validés, sans nom de client.
- `/administration/journaux` : filtre exact sur le type d'action, pages de 50 journaux, ordre décroissant. La création et la suppression d'une fiche conservent le nom du contact ; sa modification conserve l'identifiant.

## Suppressions et sessions

La suspension et la suppression effacent physiquement les sessions du compte dans `innov_events.sessions`, à l'intérieur de la transaction SQL. La vérification du statut à chaque requête reste en place.

La suppression administrative d'un client appelle la fonction SQL existante : compte effacé, fiche anonymisée, demandes et notes de ses événements supprimées, événements, devis et avis conservés. Les demandes non rattachées du même e-mail sont également effacées sans distinction de casse. Le nom reste dans les journaux de gestion administrative ; l'effacement demandé par le client relève de son propre parcours et devra retirer ce nom.

La suppression d'un employé appelle la fonction SQL existante : identité remplacée, mots de passe effacés, notes et tâches terminées conservées. Toutes les tâches non terminées sont réaffectées à l'administrateur. Aucun schéma, script de création, migration ou livrable de conception n'est modifié.

## Vérifications

Poste : Windows 11, PowerShell 5.1. Tests de l'API sur PostgreSQL 16.15 dans un conteneur Docker jetable (base `innov_events_tests`). Code : `3c7b6d9effc14ce06eb0d823eb5bb5e795612c3c` complété par cette PR. Date : 16/11/2026.

| Contrôle | API (`services/api`) | Web (`apps/web`) |
|---|---|---|
| Installation `npm.cmd ci` | OK | OK |
| Format `npm.cmd run format:check` | OK | OK |
| Lint `npm.cmd run lint` | OK | OK |
| Types `npm.cmd run typecheck` | OK | OK |
| Tests `npm.cmd run test:coverage` | 162 réussis, 2 ignorés (nginx absent du poste) ; 22 tests J9 exécutés et réussis | 70 réussis |
| Couverture des lignes | 87,27 % | 72,95 % |
| Build `npm.cmd run build` | OK | OK (`dist/web/`) |
| Audit `npm.cmd audit --omit=dev --audit-level=high` | 0 vulnérabilité | 0 vulnérabilité |

Les tests d'intégration vérifient sur PostgreSQL réel : droits par rôle sur chaque route, héritage des fonctions de l'employé par l'administrateur, destruction des sessions à la suspension et à la suppression, suppression d'un employé et d'un client, notes et tâches, cycle des événements, tableau de bord, création de comptes par mot de passe temporaire envoyé par e-mail (et annulation si l'e-mail échoue), dates au format ISO. MongoDB et l'envoi des e-mails y sont simulés.

## Parcours manuels

À réaliser sur l'application complète (organisation des espaces et application mobile intégrées), avant la mise en production : e-mail de création de compte dans Mailpit, première connexion avec changement imposé, notes à deux employés, tâches, suspension avec deux sessions ouvertes, suppressions, modération puis page `/avis`, journaux dans MongoDB, clavier et petit écran.
