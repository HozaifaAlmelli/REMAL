#!/usr/bin/env bash
# ============================================================================
# One-time Let's Encrypt bootstrap for the KAZA prod Nginx stack.
# Solves the chicken-and-egg: Nginx needs certs to start (ssl_certificate),
# but Certbot's HTTP-01 challenge needs Nginx serving the webroot.
#
# Flow: create temporary self-signed "dummy" certs -> start Nginx ->
#       request real certs via webroot -> reload Nginx.
#
# RUN THIS ONCE on the VPS, AFTER DNS A-records point at the server and
# AFTER you have populated /opt/kaza/env/.env.production. It is NOT part of
# the automated deploy and touches nothing in the four project directories.
#
# Usage (from /opt/kaza/app):
#   ./infra/certbot/init-letsencrypt.sh
# ============================================================================
set -euo pipefail

COMPOSE="docker compose -f docker-compose.prod.yml --env-file /opt/kaza/env/.env.production"
ENV_FILE="/opt/kaza/env/.env.production"

# shellcheck disable=SC1090
set -a; source "$ENV_FILE"; set +a

DOMAINS=("$PORTFOLIO_DOMAIN" "$PORTAL_DOMAIN" "$API_DOMAIN")
EMAIL="${CERTBOT_EMAIL:?CERTBOT_EMAIL must be set in $ENV_FILE}"
# Flip to 0 for a real run; 1 uses the Let's Encrypt staging CA (no rate limits) for a dry run.
STAGING="${STAGING:-0}"

echo "### Creating dummy certificates so Nginx can boot ..."
for d in "${DOMAINS[@]}"; do
  $COMPOSE run --rm --entrypoint "/bin/sh" certbot -c "\
    mkdir -p /etc/letsencrypt/live/$d && \
    openssl req -x509 -nodes -newkey rsa:2048 -days 1 \
      -keyout /etc/letsencrypt/live/$d/privkey.pem \
      -out /etc/letsencrypt/live/$d/fullchain.pem \
      -subj '/CN=$d'"
done

echo "### Starting Nginx (and the apps) ..."
$COMPOSE up -d nginx

echo "### Deleting dummy certificates ..."
for d in "${DOMAINS[@]}"; do
  $COMPOSE run --rm --entrypoint "/bin/sh" certbot -c "rm -rf /etc/letsencrypt/live/$d /etc/letsencrypt/archive/$d /etc/letsencrypt/renewal/$d.conf"
done

STAGING_FLAG=""
[ "$STAGING" != "0" ] && STAGING_FLAG="--staging"

echo "### Requesting real Let's Encrypt certificates ..."
for d in "${DOMAINS[@]}"; do
  $COMPOSE run --rm --entrypoint "certbot" certbot certonly \
    --webroot -w /var/www/certbot \
    $STAGING_FLAG \
    --email "$EMAIL" --agree-tos --no-eff-email \
    -d "$d"
done

echo "### Reloading Nginx with real certificates ..."
$COMPOSE exec nginx nginx -s reload

echo "### Done. All three domains should now serve valid HTTPS."
