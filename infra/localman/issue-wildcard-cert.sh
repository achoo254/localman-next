#!/bin/bash
# Issues the Let's Encrypt certificate for localman.hoandat.com and
# *.localman.hoandat.com through a DNS-01 challenge on Cloudflare, and lets
# certbot's timer renew it (nginx reloads after each renewal). Run as root;
# idempotent: the certificate is only renewed when close to expiry.
#
#   bash issue-wildcard-cert.sh < token-file      # first run
#   CLOUDFLARE_API_TOKEN=... bash issue-wildcard-cert.sh
#   [CERTBOT_EMAIL=you@example.com]   # needed only when certbot has no account yet
#
# The token (Cloudflare API token limited to Zone:DNS:Edit on hoandat.com) is
# written once to /etc/letsencrypt/cloudflare-localman.ini (mode 600) and
# read from there afterwards; it is never printed or put in argv.
set -euo pipefail

DOMAIN=localman.hoandat.com
CREDENTIALS=/etc/letsencrypt/cloudflare-localman.ini

die() { echo "issue-wildcard-cert: $*" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || die "run as root"
command -v certbot >/dev/null || die "certbot is not installed"

if ! certbot plugins 2>/dev/null | grep -q 'dns-cloudflare'; then
	echo "installing the certbot dns-cloudflare plugin"
	if command -v snap >/dev/null && snap list certbot >/dev/null 2>&1; then
		snap set certbot trust-plugin-with-root=ok
		snap install certbot-dns-cloudflare
		snap connect certbot:plugin certbot-dns-cloudflare
	elif command -v dnf >/dev/null; then
		dnf install -y python3-certbot-dns-cloudflare
	elif command -v apt-get >/dev/null; then
		apt-get install -y python3-certbot-dns-cloudflare
	else
		die "cannot install python3-certbot-dns-cloudflare on this system"
	fi
	certbot plugins 2>/dev/null | grep -q 'dns-cloudflare' || die "dns-cloudflare plugin still missing"
fi

install -d -m 700 /etc/letsencrypt
if [ ! -s "$CREDENTIALS" ]; then
	TOKEN="${CLOUDFLARE_API_TOKEN:-}"
	if [ -z "$TOKEN" ]; then
		if [ -t 0 ]; then
			IFS= read -r -s -p "Cloudflare API token (DNS edit, hoandat.com): " TOKEN || true
			echo >&2
		else
			IFS= read -r TOKEN || true
		fi
	fi
	[[ "$TOKEN" =~ ^[A-Za-z0-9_-]{20,}$ ]] || die "missing or malformed Cloudflare API token"
	(umask 077; printf 'dns_cloudflare_api_token = %s\n' "$TOKEN" >"$CREDENTIALS")
	unset TOKEN
	echo "wrote $CREDENTIALS"
fi
chown root:root "$CREDENTIALS"
chmod 600 "$CREDENTIALS"

args=(certonly --non-interactive --agree-tos
	--dns-cloudflare --dns-cloudflare-credentials "$CREDENTIALS"
	--dns-cloudflare-propagation-seconds 30
	--cert-name "$DOMAIN" -d "$DOMAIN" -d "*.$DOMAIN"
	--keep-until-expiring
	# Stored in the renewal config: every renewal reloads nginx.
	--deploy-hook "systemctl reload nginx")
if [ -n "${CERTBOT_EMAIL:-}" ]; then args+=(-m "$CERTBOT_EMAIL"); fi
certbot "${args[@]}"

# Renewal runs from certbot's systemd timer (RHEL: certbot-renew.timer).
if systemctl list-unit-files certbot-renew.timer >/dev/null 2>&1 &&
	! systemctl is-enabled --quiet certbot-renew.timer; then
	systemctl enable --now certbot-renew.timer
fi
systemctl list-timers --all 2>/dev/null | grep -i certbot ||
	echo "warning: no certbot timer found; schedule 'certbot renew' yourself" >&2

echo "certificate: /etc/letsencrypt/live/$DOMAIN/fullchain.pem"
echo "check renewal: certbot renew --dry-run --cert-name $DOMAIN"
