# 3. Bases de données

Deux bases aux rôles distincts : PostgreSQL pour les données métier, qui ont besoin de relations, de contraintes et de transactions ; MongoDB pour les journaux, documents indépendants à forte écriture, à structure souple et à durée de vie limitée.

## 3.1 PostgreSQL

**Références :** MCD [`docs/conception/CO-03-MCD.pdf`](../conception/CO-03-MCD.pdf), MLD [`docs/conception/CO-04-MLD.pdf`](../conception/CO-04-MLD.pdf), script écrit à la main [`database/CO-04-script-postgresql.sql`](../../database/CO-04-script-postgresql.sql), tests des contraintes [`database/CO-04-tests-contraintes.sql`](../../database/CO-04-tests-contraintes.sql) et leurs résultats, jeu d'essai [`database/CO-05-jeu-essai.sql`](../../database/CO-05-jeu-essai.sql).

### Tables (schéma `innov_events`)

| Table | Contenu |
|---|---|
| `utilisateurs` | Comptes (administratrice, employés, clients) : identité de connexion, haché Argon2id, mot de passe temporaire stocké à part, rôle, statut |
| `clients` | Fiches clients (entreprise et contact commercial), anonymisables |
| `prospects` | Demandes de devis, du formulaire public à la conversion ou au classement sans suite |
| `evenements` | Événements, avec type, thème, statut, accord de publication et visibilité |
| `devis`, `lignes_devis` | Devis (plusieurs par événement, un seul accepté) et leurs prestations ; montants `NUMERIC(12,2)`, calculés en centimes entiers par l'API pour éviter les arrondis |
| `taches`, `notes` | Tâches assignées et notes de l'équipe |
| `avis` | Avis des clients, modérés |
| `types_evenement`, `themes`, `parametres` | Tables de référence et paramètres (taux de TVA, message de remerciement) |
| `sessions` | Sessions Express (`connect-pg-simple`) |

### Intégrité

- Clés étrangères sur toutes les relations ; contraintes `CHECK` sur les statuts, les montants et les cohérences entre colonnes (par exemple, un devis autre qu'« en préparation » ou « refusé » a une date d'envoi) ; index uniques insensibles à la casse sur l'e-mail de connexion et les libellés.
- Un seul devis accepté par événement : index unique partiel `uq_devis_accepte_par_evenement`.
- Totaux HT, TVA et TTC calculés à partir des lignes, jamais stockés ; le taux de TVA est copié dans le devis à sa création.
- Les opérations qui touchent plusieurs tables (conversion, envoi d'un devis, acceptation, suppression d'un compte) s'exécutent dans une transaction. Les opérations sur les devis verrouillent les lignes dans le même ordre (fiche client, puis événement, puis devis) pour éviter les interblocages. Exception connue : l'envoi d'un devis prend la fiche avant le compte, l'effacement du compte par le client prend le compte avant la fiche ; si les deux se chevauchent exactement, PostgreSQL interrompt l'une des deux opérations, qui peut être relancée.
- Suppressions de compte par deux fonctions SQL : `supprimer_compte_client` (compte effacé, fiche anonymisée, devis, événements et avis conservés) et `supprimer_compte_employe` (suppression logique, tâches en cours réaffectées).

### Droits

| Rôle | Usage | Droits |
|---|---|---|
| propriétaire de la base | Création du schéma, scripts d'initialisation et de migration | Tous |
| `innov_events_app` | Utilisé par l'API | `SELECT`, `INSERT`, `UPDATE`, `DELETE` sur les tables métier et les sessions ; lecture seule sur les tables de référence ; lecture et modification des paramètres ; exécution des deux fonctions de suppression ; `USAGE` sur le schéma, sans droit d'y créer ni d'y modifier des objets |

### Évolution du schéma

Le schéma de référence est `database/CO-04-script-postgresql.sql`. Toute modification d'une base existante passe par un script daté dans `database/migrations/`, exécuté sur la base de production **avant** la fusion du code qui en dépend. Une seule migration a été nécessaire : `2026-11-15-ck-devis-envoi.sql` (contrainte d'envoi des devis, voir le [journal des incidents](09-journal-des-incidents.md)).

## 3.2 MongoDB

Base `innov_events_logs`, collection `logs`. Chaque document contient :

| Champ | Contenu |
|---|---|
| `horodatage` | Date BSON (ISODate) |
| `type_action` | `CONNEXION_REUSSIE`, `CONNEXION_ECHOUEE`, `CREATION_CLIENT`, `MODIFICATION_CLIENT`, `SUPPRESSION_CLIENT`, `EFFACEMENT_CLIENT`, `CREATION_EVENEMENT`, `CHANGEMENT_STATUT_EVENEMENT`, `GENERATION_PDF`, `ENVOI_DEVIS`, `REPONSE_DEVIS`… |
| `id_utilisateur` | Auteur de l'action (nul pour une connexion échouée) |
| `details` | Données propres à l'action : adresse IP pour les connexions, e-mail tenté pour un échec, identifiants et nom du client pour la gestion des fiches |

Aucun mot de passe, haché, cookie, jeton ni corps de requête n'est journalisé. Dans les tests automatisés de l'API, MongoDB est remplacé par un double en mémoire ; l'écriture réelle est vérifiée sur la pile Compose et en production. Le journal de connexion est écrit avant l'ouverture de la session : si MongoDB est indisponible, la connexion est refusée.

En production, l'utilisateur MongoDB de l'API n'a que le rôle `readWrite` sur `innov_events_logs`.

## 3.3 Conservation et purges

| Donnée | Durée | Mécanisme |
|---|---|---|
| Journaux de connexion (avec IP) | 6 mois | Index TTL partiel `ttl_journaux_connexion` sur `horodatage`, créé par l'API au démarrage |
| Autres journaux | 1 an | Purge de l'API au démarrage puis toutes les 24 heures |
| Demandes classées sans suite | 3 ans après le dernier contact | Même purge |
| Compte client effacé | Immédiat | Fiche anonymisée, nom retiré de tous ses journaux ; demandes non converties de l'e-mail de contact de la fiche effacées (aucune si une autre fiche porte la même adresse) |
| Sessions | 8 heures | Expiration du cookie et de la session en base |

Sur un service gratuit mis en veille, les purges sont rattrapées au réveil. Détail dans la politique de confidentialité du site (`/confidentialite`).

## 3.4 Sauvegardes

Les offres gratuites ne fournissent pas de sauvegarde suffisante (aucune sur le cluster Atlas gratuit, 6 heures d'historique sur Neon). Deux scripts PowerShell produisent une copie locale des deux bases, en lecture seule, et vérifient qu'elle se restaure sur la pile locale : [`docs/sauvegarde-restauration.md`](../sauvegarde-restauration.md).
