#!/bin/sh
# Si ce fichier n'est pas executable, l'image PostgreSQL le charge dans son propre script :
# pas de "set -u" ici, pour ne pas modifier le comportement de ce script.
set -e

: "${POSTGRES_APP_PASSWORD:?Mot de passe applicatif obligatoire}"
export PGOPTIONS='-c client_min_messages=warning'

psql -v ON_ERROR_STOP=1 \
  --username "$POSTGRES_USER" \
  --dbname "$POSTGRES_DB" \
  -v mot_de_passe="$POSTGRES_APP_PASSWORD" <<'SQL'
SELECT format('ALTER ROLE innov_events_app PASSWORD %L', :'mot_de_passe') \gexec
SQL
