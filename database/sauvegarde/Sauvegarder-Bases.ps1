<#
  Sauvegarder-Bases.ps1 - sauvegarde des bases de production (DEP-07).

  - PostgreSQL (Neon) : pg_dump au format custom, schema innov_events, sans les donnees de
    la table des sessions, avec l'image postgres:16.15-alpine (meme version que Docker Compose).
  - MongoDB (Atlas) : mongodump --archive --gzip de la base innov_events_logs, image mongo:8.0.
  - Nombre de lignes de chaque table et de documents de chaque collection, ecrit a cote.

  Les chaines de connexion sont saisies masquees, placees dans une variable d'environnement
  le temps de l'appel a Docker (docker run -e NOM, sans valeur sur la ligne de commande),
  puis effacees. Elles ne sont jamais ecrites sur disque ni affichees.
  Lecture seule sur les bases distantes : aucune commande d'ecriture n'y est envoyee.

  Prerequis : Windows PowerShell 5.1, Docker Desktop lance. Rien a installer.
  Usage :
    powershell -NoProfile -ExecutionPolicy Bypass -File database\sauvegarde\Sauvegarder-Bases.ps1
  Options : -Dossier <chemin> (defaut D:\Sauvegardes\innov-events\AAAA-MM-JJ-HHmm),
            -SansPostgreSQL, -SansMongoDB.
  Codes de sortie : 0 sauvegarde terminee, 1 echec, 2 erreur d'utilisation.
#>
param(
  [string]$Dossier = (Join-Path 'D:\Sauvegardes\innov-events' (Get-Date -Format 'yyyy-MM-dd-HHmm')),
  [switch]$SansPostgreSQL,
  [switch]$SansMongoDB
)

# Les codes de retour de docker sont lus dans $LASTEXITCODE.
$ErrorActionPreference = 'Continue'
$imagePostgres = 'postgres:16.15-alpine'
$imageMongo = 'mongo:8.0'
$outils = $PSScriptRoot
$racineDepot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path

function Lire-Secret([string]$Invite) {
  $securise = Read-Host -Prompt $Invite -AsSecureString
  $pointeur = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securise)
  try {
    return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointeur)
  } finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointeur)
  }
}

# Hote seul, pour le compte rendu : jamais l'utilisateur ni le mot de passe.
function Get-Hote([string]$Url) {
  $reste = $Url -replace '^[a-z+]+://', ''
  if ($reste.Contains('@')) { $reste = $reste.Substring($reste.LastIndexOf('@') + 1) }
  return ($reste -split '[/?]')[0]
}

function Get-Empreinte([string]$Chemin) {
  return (Get-FileHash -LiteralPath $Chemin -Algorithm SHA256).Hash.ToLowerInvariant()
}

if ($SansPostgreSQL -and $SansMongoDB) {
  Write-Output 'Rien a sauvegarder : -SansPostgreSQL et -SansMongoDB ensemble.'
  exit 2
}
$null = & docker info --format '{{.ServerVersion}}' 2>&1
if ($LASTEXITCODE -ne 0) {
  Write-Output 'Docker ne repond pas : lancer Docker Desktop puis recommencer.'
  exit 2
}

# Dossier de sortie hors du depot (les sauvegardes contiennent des donnees personnelles).
$Dossier = [System.IO.Path]::GetFullPath($Dossier)
if ($Dossier.StartsWith($racineDepot, [System.StringComparison]::OrdinalIgnoreCase)) {
  Write-Output "Refus : le dossier de sortie doit etre hors du depot ($racineDepot)."
  exit 2
}
if ((Test-Path -LiteralPath $Dossier) -and (Get-ChildItem -LiteralPath $Dossier -Force | Select-Object -First 1)) {
  Write-Output "Refus : le dossier $Dossier existe deja et n'est pas vide."
  exit 2
}
Write-Output "Dossier de sauvegarde : $Dossier"
Write-Output ''

# Le dossier n'est cree qu'au moment d'ecrire, apres validation de la chaine saisie.
function Preparer-Dossier {
  if (-not (Test-Path -LiteralPath $Dossier)) { $null = New-Item -ItemType Directory -Path $Dossier -Force }
}

$compteRendu = New-Object System.Collections.Generic.List[string]
$compteRendu.Add("Sauvegarde Innov'Events du $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss zzz')")
$echec = $false

if (-not $SansPostgreSQL) {
  $url = Lire-Secret 'Chaine de connexion Neon (role proprietaire, connexion directe sans -pooler)'
  if ($url -notmatch '^postgres(ql)?://') {
    Write-Output 'Chaine PostgreSQL invalide : elle doit commencer par postgresql://.'
    exit 2
  }
  if ((Get-Hote $url) -match '-pooler') {
    Write-Output 'Refus : utiliser la connexion directe de Neon (hote sans -pooler) pour pg_dump.'
    exit 2
  }
  $hote = Get-Hote $url
  Write-Output "PostgreSQL : sauvegarde de $hote ..."
  Preparer-Dossier
  $env:INNOV_PG_URL = $url
  try {
    & docker run --rm -e INNOV_PG_URL -v "${Dossier}:/sauvegarde" -v "${outils}:/outils:ro" `
      --entrypoint sh $imagePostgres -c 'set -euf; pg_dump --dbname=$INNOV_PG_URL --format=custom --no-owner --no-acl --schema=innov_events --exclude-table-data=innov_events.sessions --file=/sauvegarde/postgresql.dump; psql --dbname=$INNOV_PG_URL --no-psqlrc --tuples-only --no-align -v ON_ERROR_STOP=1 --file=/outils/comptage-postgresql.sql --output=/sauvegarde/comptage-postgresql.txt'
    $code = $LASTEXITCODE
  } finally {
    Remove-Item Env:INNOV_PG_URL -ErrorAction SilentlyContinue
    $url = $null
  }
  $fichier = Join-Path $Dossier 'postgresql.dump'
  $comptage = Join-Path $Dossier 'comptage-postgresql.txt'
  if ($code -ne 0 -or -not (Test-Path -LiteralPath $fichier) -or -not (Test-Path -LiteralPath $comptage)) {
    Write-Output "PostgreSQL : ECHEC (code $code). Verifier la chaine, le role proprietaire et la connexion directe."
    $echec = $true
  } else {
    $lignes = @(Get-Content -LiteralPath $comptage | Where-Object { $_ -match ';' })
    Write-Output "PostgreSQL : OK, $($lignes.Count) tables comptees."
    $lignes | ForEach-Object { Write-Output "  $_" }
    $compteRendu.Add("PostgreSQL : $hote, schema innov_events, image $imagePostgres, donnees des sessions exclues")
    $compteRendu.Add("  postgresql.dump SHA-256 $(Get-Empreinte $fichier)")
  }
  Write-Output ''
}

if (-not $SansMongoDB -and -not $echec) {
  $url = Lire-Secret 'Chaine de connexion MongoDB Atlas (mongodb+srv://...)'
  if ($url -notmatch '^mongodb(\+srv)?://') {
    Write-Output 'Chaine MongoDB invalide : elle doit commencer par mongodb+srv:// ou mongodb://.'
    exit 2
  }
  $hote = Get-Hote $url
  Write-Output "MongoDB : sauvegarde de $hote ..."
  Preparer-Dossier
  $env:INNOV_MONGO_URL = $url
  try {
    & docker run --rm -e INNOV_MONGO_URL -e INNOV_BASE=innov_events_logs -v "${Dossier}:/sauvegarde" `
      -v "${outils}:/outils:ro" --entrypoint sh $imageMongo -c 'set -euf; mongodump --uri=$INNOV_MONGO_URL --db=innov_events_logs --archive=/sauvegarde/mongodb.archive.gz --gzip --quiet; mongosh $INNOV_MONGO_URL --quiet --norc --file /outils/comptage-mongodb.js > /sauvegarde/comptage-mongodb.txt'
    $code = $LASTEXITCODE
  } finally {
    Remove-Item Env:INNOV_MONGO_URL -ErrorAction SilentlyContinue
    $url = $null
  }
  $fichier = Join-Path $Dossier 'mongodb.archive.gz'
  $comptage = Join-Path $Dossier 'comptage-mongodb.txt'
  if ($code -ne 0 -or -not (Test-Path -LiteralPath $fichier) -or -not (Test-Path -LiteralPath $comptage)) {
    Write-Output "MongoDB : ECHEC (code $code). Verifier la chaine et l'acces IP temporaire du poste dans Atlas."
    $echec = $true
  } else {
    $lignes = @(Get-Content -LiteralPath $comptage | Where-Object { $_ -match ';' })
    Write-Output "MongoDB : OK, $($lignes.Count) collection(s) comptee(s)."
    $lignes | ForEach-Object { Write-Output "  $_" }
    $compteRendu.Add("MongoDB : $hote, base innov_events_logs, image $imageMongo")
    $compteRendu.Add("  mongodb.archive.gz SHA-256 $(Get-Empreinte $fichier)")
  }
  Write-Output ''
}

[System.IO.File]::WriteAllLines((Join-Path $Dossier 'sauvegarde.txt'), $compteRendu)
if ($echec) {
  Write-Output "Sauvegarde incomplete. Supprimer le dossier $Dossier apres analyse."
  exit 1
}
Write-Output 'Sauvegarde terminee.'
Write-Output 'Ces fichiers contiennent des donnees personnelles et des adresses IP : les garder sur ce poste,'
Write-Output 'puis supprimer le dossier apres le test de restauration (voir docs\sauvegarde-restauration.md).'
exit 0
