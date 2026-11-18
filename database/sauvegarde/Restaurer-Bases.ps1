<#
  Restaurer-Bases.ps1 - test de restauration d'une sauvegarde sur la pile Docker Compose locale
  (DEP-07). Ne vise jamais une base distante : le script ne lit aucune chaine de connexion et
  n'agit que dans les conteneurs postgres et mongo de Docker Compose, sur deux bases dediees.

  - PostgreSQL : base neuve innov_events_restauration (supprimee puis recreee),
    pg_restore --no-owner --no-acl en script SQL, sans les options de colonnes propres a Neon
    (pg_attver), inconnues de PostgreSQL standard, puis psql en une seule transaction.
  - MongoDB : base innov_events_restauration (remplacee),
    mongorestore --nsFrom innov_events_logs.* --nsTo innov_events_restauration.*.
  - Comparaison automatique des comptages avec ceux de la sauvegarde.

  Les bases innov_events et innov_events_logs de la pile locale ne sont pas modifiees.

  Prerequis : Windows PowerShell 5.1, Docker Desktop lance, pile demarree (docker compose up -d).
  Usage :
    powershell -NoProfile -ExecutionPolicy Bypass -File database\sauvegarde\Restaurer-Bases.ps1 -Dossier D:\Sauvegardes\innov-events\AAAA-MM-JJ-HHmm
    powershell -NoProfile -ExecutionPolicy Bypass -File database\sauvegarde\Restaurer-Bases.ps1 -Nettoyer
  -Nettoyer supprime les deux bases de restauration locales, puis s'arrete.
  Codes de sortie : 0 restauration conforme (ou nettoyage fait), 1 ecart ou echec, 2 erreur d'utilisation.
#>
param(
  [string]$Dossier,
  [string]$Depot = (Join-Path $PSScriptRoot '..\..'),
  [switch]$Nettoyer
)

# Les codes de retour de docker sont lus dans $LASTEXITCODE.
$ErrorActionPreference = 'Continue'
$base = 'innov_events_restauration'
$fichierCompose = Join-Path $Depot 'docker-compose.yml'

function Get-Conteneur([string]$Service) {
  $id = & docker compose -f $fichierCompose ps -q $Service 2>$null
  if ($LASTEXITCODE -ne 0 -or -not $id) { return $null }
  return ([string]$id).Trim()
}

function Get-Empreinte([string]$Chemin) {
  return (Get-FileHash -LiteralPath $Chemin -Algorithm SHA256).Hash.ToLowerInvariant()
}

# Lignes "nom;nombre" vers une table de hachage triee.
function Lire-Comptage([string[]]$Lignes) {
  $table = [ordered]@{}
  foreach ($ligne in $Lignes) {
    if ($ligne -match '^\s*([^;]+);(\d+)\s*$') { $table[$Matches[1]] = [int64]$Matches[2] }
  }
  return $table
}

# Affiche la comparaison (Write-Host, pour ne renvoyer que le nombre d'ecarts) ;
# les noms ignores sont seulement affiches.
function Comparer-Comptages([string]$Titre, $Attendu, $Obtenu, [string[]]$Ignores) {
  Write-Host $Titre
  Write-Host ('  {0,-28} {1,12} {2,12}  {3}' -f 'Nom', 'Sauvegarde', 'Restauree', 'Etat')
  $ecarts = 0
  $noms = @($Attendu.Keys) + @($Obtenu.Keys | Where-Object { -not $Attendu.Contains($_) })
  foreach ($nom in $noms) {
    $a = if ($Attendu.Contains($nom)) { $Attendu[$nom] } else { '-' }
    $o = if ($Obtenu.Contains($nom)) { $Obtenu[$nom] } else { '-' }
    if ($Ignores -contains $nom) {
      $etat = 'non sauvegardee'
    } elseif ("$a" -eq "$o") {
      $etat = 'OK'
    } else {
      $etat = 'ECART'
      $ecarts++
    }
    Write-Host ('  {0,-28} {1,12} {2,12}  {3}' -f $nom, $a, $o, $etat)
  }
  return $ecarts
}

$null = & docker info --format '{{.ServerVersion}}' 2>&1
if ($LASTEXITCODE -ne 0) {
  Write-Output 'Docker ne repond pas : lancer Docker Desktop puis recommencer.'
  exit 2
}
if (-not (Test-Path -LiteralPath $fichierCompose)) {
  Write-Output "docker-compose.yml introuvable dans $Depot (option -Depot)."
  exit 2
}
$postgres = Get-Conteneur 'postgres'
$mongo = Get-Conteneur 'mongo'
if (-not $postgres -or -not $mongo) {
  Write-Output 'Pile locale arretee : lancer docker compose up -d a la racine du depot, puis recommencer.'
  exit 2
}

if ($Nettoyer) {
  & docker exec -e PGOPTIONS=--client-min-messages=warning $postgres psql -U postgres -d postgres -q -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS $base WITH (FORCE)"
  $codePg = $LASTEXITCODE
  $null = & docker exec -e INNOV_BASE=$base $mongo mongosh --quiet --norc --eval 'db.getSiblingDB(process.env.INNOV_BASE).dropDatabase()'
  $codeMongo = $LASTEXITCODE
  if ($codePg -ne 0 -or $codeMongo -ne 0) {
    Write-Output 'Nettoyage incomplet.'
    exit 1
  }
  Write-Output "Bases de restauration $base supprimees de la pile locale."
  exit 0
}

if (-not $Dossier) {
  Write-Output 'Indiquer le dossier de la sauvegarde : -Dossier D:\Sauvegardes\innov-events\AAAA-MM-JJ-HHmm'
  exit 2
}
$Dossier = [System.IO.Path]::GetFullPath($Dossier)
$compteRendu = Join-Path $Dossier 'sauvegarde.txt'
if (-not (Test-Path -LiteralPath $compteRendu)) {
  Write-Output "sauvegarde.txt introuvable dans $Dossier : ce n'est pas un dossier de sauvegarde."
  exit 2
}

# Integrite : chaque fichier doit avoir l'empreinte notee lors de la sauvegarde.
$aRestaurer = @()
foreach ($ligne in (Get-Content -LiteralPath $compteRendu)) {
  if ($ligne -match '^\s*(postgresql\.dump|mongodb\.archive\.gz) SHA-256 ([0-9a-f]{64})\s*$') {
    $chemin = Join-Path $Dossier $Matches[1]
    if (-not (Test-Path -LiteralPath $chemin) -or (Get-Empreinte $chemin) -ne $Matches[2]) {
      Write-Output "Fichier absent ou altere : $($Matches[1]). Restauration annulee."
      exit 1
    }
    $aRestaurer += $Matches[1]
  }
}
if ($aRestaurer.Count -eq 0) {
  Write-Output 'Aucun fichier de sauvegarde valide dans ce dossier.'
  exit 1
}
Write-Output "Sauvegarde : $Dossier ($($aRestaurer -join ', '), empreintes verifiees)"
Write-Output ''

$ecarts = 0
$echec = $false

if ($aRestaurer -contains 'postgresql.dump') {
  Write-Output "PostgreSQL : restauration dans la base locale $base ..."
  $null = & docker cp (Join-Path $Dossier 'postgresql.dump') "${postgres}:/tmp/innov-restauration.dump"
  $null = & docker cp (Join-Path $PSScriptRoot 'comptage-postgresql.sql') "${postgres}:/tmp/innov-comptage.sql"
  & docker exec -e PGOPTIONS=--client-min-messages=warning $postgres psql -U postgres -d postgres -q -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS $base WITH (FORCE)"
  & docker exec -e PGOPTIONS=--client-min-messages=warning $postgres psql -U postgres -d postgres -q -v ON_ERROR_STOP=1 -c "CREATE DATABASE $base"
  # Neon ajoute a chaque colonne une option interne (pg_attver) que PostgreSQL standard refuse :
  # la sauvegarde est convertie en script SQL, ces seules lignes en sont retirees, puis le script
  # est execute en une transaction. Le nombre de lignes retirees est affiche.
  & docker exec -e PGOPTIONS=--client-min-messages=warning -e INNOV_BASE=$base $postgres sh -c 'set -eu; pg_restore --no-owner --no-acl --file=/tmp/innov-restauration.sql /tmp/innov-restauration.dump; n=$(grep -c -E ''^ALTER TABLE ONLY [^ ]+ ALTER COLUMN [^ ]+ SET \(pg_attver=[0-9]+\);$'' /tmp/innov-restauration.sql || true); sed -i -E ''/^ALTER TABLE ONLY [^ ]+ ALTER COLUMN [^ ]+ SET \(pg_attver=[0-9]+\);$/d'' /tmp/innov-restauration.sql; echo PostgreSQL : options de colonnes propres a Neon retirees : $n; psql -U postgres -d $INNOV_BASE --no-psqlrc -q -v ON_ERROR_STOP=1 --single-transaction --output=/dev/null --file=/tmp/innov-restauration.sql'
  $code = $LASTEXITCODE
  $obtenu = & docker exec $postgres psql -U postgres -d $base --no-psqlrc --tuples-only --no-align -v ON_ERROR_STOP=1 --file=/tmp/innov-comptage.sql
  if ($LASTEXITCODE -ne 0) { $code = $LASTEXITCODE }
  $null = & docker exec $postgres rm -f /tmp/innov-restauration.dump /tmp/innov-restauration.sql /tmp/innov-comptage.sql
  if ($code -ne 0) {
    Write-Output "PostgreSQL : ECHEC de la restauration (code $code)."
    $echec = $true
  } else {
    $attendu = Lire-Comptage (Get-Content -LiteralPath (Join-Path $Dossier 'comptage-postgresql.txt'))
    $ecarts += Comparer-Comptages 'PostgreSQL : nombre de lignes par table' $attendu (Lire-Comptage $obtenu) @('sessions')
  }
  Write-Output ''
}

if ($aRestaurer -contains 'mongodb.archive.gz') {
  Write-Output "MongoDB : restauration dans la base locale $base ..."
  $null = & docker cp (Join-Path $Dossier 'mongodb.archive.gz') "${mongo}:/tmp/innov-restauration.archive.gz"
  $null = & docker cp (Join-Path $PSScriptRoot 'comptage-mongodb.js') "${mongo}:/tmp/innov-comptage.js"
  & docker exec $mongo mongorestore --archive=/tmp/innov-restauration.archive.gz --gzip --drop --quiet "--nsFrom=innov_events_logs.*" "--nsTo=$base.*"
  $code = $LASTEXITCODE
  $obtenu = & docker exec -e INNOV_BASE=$base $mongo mongosh --quiet --norc --file /tmp/innov-comptage.js
  if ($LASTEXITCODE -ne 0) { $code = $LASTEXITCODE }
  $null = & docker exec $mongo rm -f /tmp/innov-restauration.archive.gz /tmp/innov-comptage.js
  if ($code -ne 0) {
    Write-Output "MongoDB : ECHEC de la restauration (code $code)."
    $echec = $true
  } else {
    $attendu = Lire-Comptage (Get-Content -LiteralPath (Join-Path $Dossier 'comptage-mongodb.txt'))
    $ecarts += Comparer-Comptages 'MongoDB : nombre de documents par collection' $attendu (Lire-Comptage $obtenu) @()
  }
  Write-Output ''
}

if ($echec -or $ecarts -gt 0) {
  Write-Output "Restauration NON conforme : $ecarts ecart(s)$(if ($echec) { ', avec un echec' })."
  exit 1
}
Write-Output 'Restauration conforme : comptages identiques a ceux de la sauvegarde.'
Write-Output 'Apres verification : -Nettoyer pour supprimer les bases de restauration, puis supprimer le dossier de sauvegarde.'
exit 0
