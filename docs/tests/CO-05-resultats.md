# Résultats — jeu d'essai (CO-05)

**Date :** 14/11/2026  
**Périmètre :** `database/CO-05-jeu-essai.sql`, exécuté après `database/CO-04-script-postgresql.sql`.  
**Environnement :** Windows 11, PowerShell 5.1, Docker Desktop ; conteneur jetable `postgres:16.15-alpine` (même image que le Compose), base neuve, compte propriétaire `postgres`.

Le jeu d'essai sert au développement et aux tests locaux. Il ne doit jamais être chargé en production : il crée notamment un compte administrateur de démonstration, alors qu'en exploitation ce compte est créé uniquement par un script dédié.

## Procédure (rejouable)

Le script attend sept variables psql, une par compte de test : `hash_admin`, `hash_employe`, `hash_ancien_employe`, `hash_client`, `hash_suspendu`, `hash_effacer`, `hash_temporaire`. Ce sont des hachages Argon2id, l'algorithme retenu par l'API. Ils sont générés par `database/outils/hacher-mots-de-passe-demo.mjs` à partir d'un mot de passe de test lu dans la variable d'environnement `MDP_DEMO`, jamais écrit dans le dépôt.

Depuis la racine du dépôt, sous PowerShell :

```powershell
# 1. Hachages : mot de passe de test au choix, conforme à la règle (8 caractères, majuscule, minuscule, chiffre, caractère spécial).
$env:MDP_DEMO = 'Exemple-Demo-2026!'
docker run --rm -e MDP_DEMO -v "${PWD}\database\outils:/outils:ro" -w /app node:24-slim sh -c "npm install --silent --no-audit --no-fund argon2@0 >/dev/null && cp /outils/hacher-mots-de-passe-demo.mjs . && node hacher-mots-de-passe-demo.mjs" | Set-Content -Encoding ASCII "$env:TEMP\hachages-co05.psql"
Remove-Item Env:MDP_DEMO

# 2. Base neuve (aucun port publié), puis CO-04 et CO-05.
docker run -d --name ie-co05 -e POSTGRES_PASSWORD=essai -e POSTGRES_DB=innov_events postgres:16.15-alpine
docker exec ie-co05 pg_isready -U postgres -d innov_events
docker cp database\CO-04-script-postgresql.sql ie-co05:/tmp/co04.sql
docker cp database\CO-05-jeu-essai.sql ie-co05:/tmp/co05.sql
docker cp "$env:TEMP\hachages-co05.psql" ie-co05:/tmp/hachages.psql
docker exec ie-co05 psql -U postgres -d innov_events -v ON_ERROR_STOP=1 -q -f /tmp/co04.sql
docker exec ie-co05 psql -U postgres -d innov_events -v ON_ERROR_STOP=1 -f /tmp/hachages.psql -f /tmp/co05.sql

# 3. Nettoyage.
docker rm -f ie-co05
Remove-Item "$env:TEMP\hachages-co05.psql"
```

Une base neuve est nécessaire à chaque exécution : le script ne fixe aucun identifiant et ne vide aucune table.

## Résultat de l'exécution

| Étape | Résultat |
|---|---|
| CO-04 | Terminé sans erreur |
| CO-05 | 13 insertions, 1 mise à jour, suppression d'un compte employé (`supprimer_compte_employe`) et d'un compte client (`supprimer_compte_client`), contrôles finaux (bloc `DO`) réussis, `COMMIT` ; aucune erreur |

Nombre de lignes par table après l'exécution :

| Table | Lignes |
|---|---|
| avis | 3 |
| clients | 4 |
| devis | 7 |
| evenements | 8 |
| lignes_devis | 10 |
| notes | 3 |
| parametres | 1 |
| prospects | 5 |
| sessions | 1 |
| taches | 5 |
| themes | 3 |
| types_evenement | 5 |
| utilisateurs | 6 |

Les treize tables sont alimentées. `utilisateurs` compte six lignes pour sept comptes créés : le compte client supprimé par `supprimer_compte_client` est retiré, sa fiche client reste anonymisée, et le compte employé supprimé reste présent mais anonymisé (suppression logique).

## Limites

- Le jeu d'essai contient uniquement des données fictives (domaine `example.org`).
- Les droits du rôle applicatif sur ces données sont testés par `database/CO-04-tests-contraintes.sql`, pas par ce script.
