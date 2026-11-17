# Sauvegarde et restauration des bases (DEP-07)

Les offres gratuites utilisées en production ne suffisent pas comme sauvegarde : MongoDB Atlas (cluster gratuit) n’offre pas de sauvegarde, et l’historique de Neon ne permet de revenir en arrière que sur une courte durée (6 heures sur l’offre gratuite, valeur « History retention » de la console Neon). Deux scripts produisent donc une copie locale des deux bases, puis vérifient qu’elle se restaure.

| Script | Rôle | Bases visées |
| --- | --- | --- |
| `database/sauvegarde/Sauvegarder-Bases.ps1` | Copie des bases de production, **en lecture seule** | Neon (PostgreSQL) et MongoDB Atlas |
| `database/sauvegarde/Restaurer-Bases.ps1` | Restauration de cette copie et comparaison des comptages | Pile Docker Compose **locale uniquement** |

Les deux scripts s’exécutent avec Windows PowerShell 5.1 et Docker Desktop : les outils `pg_dump`, `pg_restore`, `mongodump`, `mongorestore` et `mongosh` viennent des images `postgres:16.15-alpine` et `mongo:8.0`, les mêmes que Docker Compose. Rien d’autre à installer.

## Ce qui est sauvegardé

- **PostgreSQL** : le schéma `innov_events` complet (tables, contraintes, index, fonctions) et ses données, au format personnalisé de `pg_dump` (`postgresql.dump`), sans propriétaires ni droits (`--no-owner --no-acl`). Les données de la table des sessions sont exclues : elles ne servent qu’aux connexions en cours.
- **MongoDB** : la base `innov_events_logs` (journaux et index), en archive compressée (`mongodb.archive.gz`).
- **Contrôles** : nombre de lignes de chaque table (`comptage-postgresql.txt`), nombre de documents de chaque collection (`comptage-mongodb.txt`), compte rendu avec l’empreinte SHA-256 de chaque fichier (`sauvegarde.txt`).

Dossier de sortie par défaut, hors du dépôt : `D:\Sauvegardes\innov-events\AAAA-MM-JJ-HHmm`. Le script refuse un dossier situé dans le dépôt ou un dossier déjà rempli.

## Sécurité des chaînes de connexion

- Elles sont saisies au clavier, masquées (`Read-Host -AsSecureString`).
- Pendant l’appel à Docker, elles sont placées dans une variable d’environnement transmise par son seul nom (`docker run -e INNOV_PG_URL`, sans valeur sur la ligne de commande), puis effacées dès la fin de l’appel, même en cas d’erreur.
- Elles ne sont jamais écrites sur disque ni affichées : le compte rendu ne mentionne que l’hôte.
- Le script de restauration ne lit aucune chaîne de connexion : il ne peut agir que dans les conteneurs locaux.

## Prérequis

1. Docker Desktop lancé ; dépôt à jour sur `D:\Projets\innov-events-manager`.
2. **Neon** : chaîne de connexion du **rôle propriétaire** de la base `innov_events` (le rôle applicatif n’a pas les droits nécessaires sur les séquences), en **connexion directe**. Console Neon → projet `innov-events-manager` → **Connect** → branche `production`, base `innov_events`, rôle propriétaire → désactiver **Connection pooling** (l’hôte ne doit pas contenir `-pooler`, que le script refuse) → copier la chaîne `postgresql://…?sslmode=require`.
3. **MongoDB Atlas** : accès IP temporaire du poste, de quelques heures. Console Atlas → projet `innov-events-manager` → **Network Access** → **Add IP Address** → **Add Current IP Address** → cocher **This entry is temporary and will be deleted in** et choisir **6 hours** → **Confirm**. Chaîne de connexion de l’utilisateur `innov_events_api` (son rôle `readWrite` sur `innov_events_logs` suffit pour lire) : **Clusters** (ou **Database**) → **Connect** → **Drivers** → copier la chaîne `mongodb+srv://…`, mot de passe depuis le gestionnaire de mots de passe.
4. Pour la restauration : pile locale démarrée (`docker compose up -d`).

## Sauvegarde

Depuis la racine du dépôt :

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File database\sauvegarde\Sauvegarder-Bases.ps1
```

Le script demande la chaîne Neon, sauvegarde PostgreSQL, puis demande la chaîne Atlas et sauvegarde MongoDB. Options : `-Dossier <chemin>`, `-SansPostgreSQL`, `-SansMongoDB`.

Résultat attendu :

```text
Dossier de sauvegarde : D:\Sauvegardes\innov-events\2026-11-18-1030
PostgreSQL : sauvegarde de ep-….eu-central-1.aws.neon.tech ...
PostgreSQL : OK, 13 tables comptees.
  avis;…
  …
MongoDB : sauvegarde de innov-events.….mongodb.net ...
MongoDB : OK, 1 collection(s) comptee(s).
  logs;…
Sauvegarde terminee.
```

Code de sortie 0. Le dossier contient `postgresql.dump`, `mongodb.archive.gz`, `comptage-postgresql.txt`, `comptage-mongodb.txt` et `sauvegarde.txt`. Ensuite, retirer l’entrée IP temporaire dans Atlas si elle n’a pas encore expiré (**Network Access** → **Delete**).

## Restauration de contrôle (pile locale)

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File database\sauvegarde\Restaurer-Bases.ps1 -Dossier D:\Sauvegardes\innov-events\2026-11-18-1030
```

Le script :
1. vérifie l’empreinte de chaque fichier notée dans `sauvegarde.txt` (fichier altéré : arrêt) ;
2. PostgreSQL : supprime puis recrée la base locale `innov_events_restauration` dans le conteneur `postgres`, convertit la sauvegarde en script SQL (`pg_restore --no-owner --no-acl`), en retire les options de colonnes internes de Neon (`SET (pg_attver=…)`, refusées par PostgreSQL standard), puis exécute le script en une seule transaction (`psql --single-transaction`) ;
3. MongoDB : restaure l’archive dans la base locale `innov_events_restauration` du conteneur `mongo` (`mongorestore --nsFrom innov_events_logs.* --nsTo innov_events_restauration.* --drop`) ;
4. compare les comptages à ceux de la sauvegarde.

Les bases `innov_events` et `innov_events_logs` de la pile locale ne sont pas modifiées.

Résultat attendu :

```text
PostgreSQL : options de colonnes propres a Neon retirees : …
PostgreSQL : nombre de lignes par table
  Nom                            Sauvegarde    Restauree  Etat
  avis                                    …            …  OK
  …
  sessions                                …            0  non sauvegardee
  …
MongoDB : nombre de documents par collection
  logs                                    …            …  OK
Restauration conforme : comptages identiques a ceux de la sauvegarde.
```

Code de sortie 0 ; un écart affiche `ECART` et donne le code 1. La table des sessions est la seule à différer, par construction.

Nettoyage après vérification :

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File database\sauvegarde\Restaurer-Bases.ps1 -Nettoyer
```

puis suppression du dossier de sauvegarde (`Remove-Item -Recurse D:\Sauvegardes\innov-events\2026-11-18-1030`) et vidage de la corbeille.

## Précautions RGPD

- Les fichiers contiennent des données personnelles (coordonnées des clients, demandes de devis) et des adresses IP (journaux de connexion de moins de 6 mois). Ils restent sur le poste, dans un dossier hors du dépôt et hors de tout dossier synchronisé (OneDrive), et ne sont jamais envoyés par e-mail ni versionnés.
- Ils sont supprimés après le test de restauration, ainsi que les bases de restauration locales (`-Nettoyer`).
- Une sauvegarde fige l’état du jour : un client qui demande ensuite l’effacement de son compte reste présent dans la copie. C’est une raison de plus de ne pas la conserver ; en cas de restauration de la production (section suivante), les effacements demandés après la date de la sauvegarde doivent être rejoués, à partir des journaux `EFFACEMENT_CLIENT` d’Atlas postérieurs à cette date.
- Les sauvegardes automatiques d’Atlas restent désactivées : des instantanés conserveraient pendant plusieurs jours un nom effacé.

## Limites

- **MongoDB Atlas, cluster gratuit** : aucune sauvegarde ni restauration à un instant donné ; 512 Mo de stockage ; cluster mis en pause après 30 jours sans connexion.
- **Neon, offre gratuite** : restauration à un instant donné limitée aux 6 dernières heures (« History retention ») ; elle ne remplace pas une copie hors de Neon.
- **Restauration de contrôle** : elle prouve que les fichiers sont complets et lisibles et que les comptages concordent ; elle ne rejoue pas l’application sur les données restaurées.
- **Journaux de connexion** : l’index d’expiration (6 mois) est restauré avec la collection ; un journal qui atteint ses 6 mois entre la sauvegarde et la restauration peut être effacé par MongoDB et créer un écart d’une ligne. Relancer alors une sauvegarde récente.

## Restauration d’urgence de la production

Décrite pour mémoire, **jamais lancée sans décision explicite** du responsable du projet, après analyse de l’incident. Aucun script ne l’automatise.

1. Mettre le site en maintenance (suspendre le service API sur Render) pour éviter toute écriture.
2. Avant toute restauration, conserver les journaux d’Atlas postérieurs à la date de la sauvegarde, au minimum les `EFFACEMENT_CLIENT` : exportés avec `mongoexport` (filtre sur la date, en lecture seule) dans le dossier de la sauvegarde, avec les mêmes précautions RGPD. Ils servent à rejouer les effacements (étape 5) et à conserver la trace des actions postérieures.
3. PostgreSQL : dans la console Neon, préférer d’abord la restauration à un instant donné si l’incident est dans la période d’historique. Sinon, ne jamais restaurer par-dessus une base existante (une branche Neon neuve contient déjà le schéma et les données de sa branche parente) :
   - créer, sur la branche `production`, une base **vide** dédiée (par exemple `innov_events_restauree`, propriétaire : le rôle propriétaire) ;
   - y restaurer `postgresql.dump` sous le rôle propriétaire, en connexion directe, avec arrêt à la première erreur et en une seule transaction : `pg_restore --no-owner --no-acl --exit-on-error --single-transaction` (image `postgres:16.15-alpine`, chaîne saisie masquée comme dans `Sauvegarder-Bases.ps1`) ; les options de colonnes internes de Neon y sont acceptées ;
   - réappliquer les droits du rôle applicatif, omis par `--no-acl` : instructions `GRANT` et `REVOKE` de la fin de `database/CO-04-script-postgresql.sql` ;
   - vérifier, avant toute bascule, que `comptage-postgresql.sql` exécuté sur cette base donne les nombres de `comptage-postgresql.txt` (sessions exceptées) ;
   - seulement ensuite, faire pointer la chaîne de connexion de l’API (Render) vers cette base ; l’ancienne base est conservée pour l’analyse et n’est supprimée que sur décision explicite.
4. MongoDB : `mongorestore` ajoute les documents mais ne remplace pas ceux qui ont déjà le même `_id` ; la restauration doit donc viser une collection vidée explicitement, avec un utilisateur disposant des droits d’écriture et après accord explicite : `mongorestore --archive --gzip --drop --nsInclude=innov_events_logs.*` (`--drop` supprime chaque collection de la sauvegarde avant de la restaurer). Vérifier ensuite que `comptage-mongodb.js` donne les nombres de `comptage-mongodb.txt`, puis réimporter (`mongoimport`) les journaux conservés à l’étape 2 qui doivent l’être.
5. Rejouer les effacements demandés après la date de la sauvegarde, à partir des journaux `EFFACEMENT_CLIENT` conservés à l’étape 2 (section RGPD) : suppression du compte et anonymisation de la fiche comme le fait l’application, puis retrait du nom dans les journaux.
6. Relancer l’API, vérifier `/api/sante` et les parcours d’acceptation du plan de tests, puis consigner l’incident dans le journal des incidents (DEP-10).
