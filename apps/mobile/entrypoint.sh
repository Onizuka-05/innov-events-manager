#!/bin/sh
set -eu

: "${API_UPSTREAM:?API_UPSTREAM obligatoire}"
case "$API_UPSTREAM" in
  http://*|https://*) ;;
  *) echo 'API_UPSTREAM doit commencer par http:// ou https://' >&2; exit 1 ;;
esac
case "$API_UPSTREAM" in
  *://*/*|*[?#]*) echo 'API_UPSTREAM doit etre une origine sans chemin ni barre finale (ex. https://innov-api.onrender.com)' >&2; exit 1 ;;
esac
case "${NGINX_SCHEME:-}" in
  http|https) ;;
  *) echo 'NGINX_SCHEME doit valoir http ou https' >&2; exit 1 ;;
esac

: "${INTERNAL_PROXY_SECRET:?INTERNAL_PROXY_SECRET obligatoire}"
# Valeur URL-safe sans espaces, guillemets ou caracteres nginx reserves.
case "$INTERNAL_PROXY_SECRET" in
  *[!A-Za-z0-9_-]*) echo 'INTERNAL_PROXY_SECRET doit etre en base64url sans remplissage' >&2; exit 1 ;;
esac
if [ "${#INTERNAL_PROXY_SECRET}" -lt 32 ] || [ "${#INTERNAL_PROXY_SECRET}" -gt 128 ]; then
  echo 'INTERNAL_PROXY_SECRET doit contenir de 32 a 128 caracteres' >&2
  exit 1
fi

# Source limitee aux deux topologies supportees. Aucun repli sur un en-tete client.
case "${NGINX_CLIENT_IP_SOURCE:-}" in
  '$remote_addr')
    [ "$NGINX_SCHEME" = http ] || { echo 'Source IP locale incoherente' >&2; exit 1; } ;;
  '$http_cf_connecting_ip')
    [ "$NGINX_SCHEME" = https ] || { echo 'Source IP Render incoherente' >&2; exit 1; } ;;
  *) echo 'NGINX_CLIENT_IP_SOURCE invalide' >&2; exit 1 ;;
esac

# Remplacer uniquement les variables du modele ; $uri, $host, $proxy_host
# et $remote_addr doivent rester des variables nginx.
envsubst '${API_UPSTREAM} ${NGINX_SCHEME} ${NGINX_CLIENT_IP_SOURCE} ${INTERNAL_PROXY_SECRET}' \
  < /etc/nginx/nginx.conf.template > /etc/nginx/conf.d/default.conf
exec nginx -g 'daemon off;'

