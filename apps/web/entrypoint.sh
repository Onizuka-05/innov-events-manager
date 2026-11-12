#!/bin/sh
set -eu

: "${API_UPSTREAM:?API_UPSTREAM obligatoire}"
case "$API_UPSTREAM" in
  http://*|https://*) ;;
  *) echo 'API_UPSTREAM doit commencer par http:// ou https://' >&2; exit 1 ;;
esac
case "${NGINX_SCHEME:-}" in
  http|https) ;;
  *) echo 'NGINX_SCHEME doit valoir http ou https' >&2; exit 1 ;;
esac

# Ne remplacer que ces trois valeurs : $uri et $proxy_host appartiennent a nginx.
envsubst '${API_UPSTREAM} ${NGINX_SCHEME} ${NGINX_CLIENT_IP_SOURCE}' \
  < /etc/nginx/nginx.conf.template > /etc/nginx/conf.d/default.conf
exec nginx -g 'daemon off;'
