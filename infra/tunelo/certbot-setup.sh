#!/bin/bash
# Let's Encrypt wildcard cert for tunnel.hoandat.com + *.tunnel.hoandat.com,
# by DNS-01 through the Cloudflare plugin. Run on the server as root.
# The credential file holds a token with Zone:DNS:Edit on hoandat.com that
# only works from this server's IP; it also renews localman.hoandat.com.
set -euo pipefail

DOMAIN="tunnel.hoandat.com"
CREDENTIALS="${CLOUDFLARE_CREDENTIALS:-/etc/letsencrypt/cloudflare-localman.ini}"

echo "=== Tunelo SSL Certificate Setup ==="
echo "Domain: $DOMAIN + *.$DOMAIN"

certbot certonly \
  --non-interactive \
  --dns-cloudflare \
  --dns-cloudflare-credentials "$CREDENTIALS" \
  --dns-cloudflare-propagation-seconds 30 \
  --cert-name "$DOMAIN" \
  -d "$DOMAIN" \
  -d "*.$DOMAIN" \
  --deploy-hook "systemctl reload nginx"

echo "Cert: /etc/letsencrypt/live/$DOMAIN/ (renewed by certbot-renew.timer)"
