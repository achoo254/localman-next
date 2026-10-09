#!/bin/bash
# Let's Encrypt certificate for localman.hoandat.com and *.localman.hoandat.com
# through a DNS-01 challenge on Cloudflare, renewed by certbot's timer, with
# nginx reloaded after every renewal. Run as root; idempotent:
# - no certificate yet: issue it with the dns-cloudflare authenticator;
# - certificate issued another way (e.g. manual DNS): `certbot reconfigure`
#   it to dns-cloudflare, which also test-renews it against staging;
# - a renewal config without the nginx reload hook: add the hook.
#
#   bash issue-wildcard-cert.sh < token-file                  # first run
#   CLOUDFLARE_API_TOKEN=... bash issue-wildcard-cert.sh
#   bash issue-wildcard-cert.sh --replace-token < token-file  # token rotation
#   [CERTBOT_EMAIL=you@example.com]   # needed only when certbot has no account yet
#
# The token (Cloudflare API token limited to Zone:DNS:Edit on hoandat.com) is
# written to /etc/letsencrypt/cloudflare-localman.ini (mode 600) when that file
# is missing or with --replace-token, and read from there otherwise; it is
# never printed or put in argv.
set -euo pipefail

DOMAIN=localman.hoandat.com
CREDENTIALS=/etc/letsencrypt/cloudflare-localman.ini
RENEWAL="/etc/letsencrypt/renewal/$DOMAIN.conf"
RELOAD_HOOK="systemctl reload nginx"
PROPAGATION_SECONDS=30

die() { echo "issue-wildcard-cert: $*" >&2; exit 1; }

REPLACE_TOKEN=0
case "${1:-}" in
"") ;;
--replace-token) REPLACE_TOKEN=1 ;;
*) die "usage: issue-wildcard-cert.sh [--replace-token]" ;;
esac

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

# Never loosen the mode of an existing /etc/letsencrypt.
[ -d /etc/letsencrypt ] || install -d -m 700 /etc/letsencrypt
if [ ! -s "$CREDENTIALS" ] || [ "$REPLACE_TOKEN" -eq 1 ]; then
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
	# printf is a builtin: the token never reaches argv.
	(umask 077; printf 'dns_cloudflare_api_token = %s\n' "$TOKEN" >"$CREDENTIALS.tmp")
	mv -f "$CREDENTIALS.tmp" "$CREDENTIALS"
	unset TOKEN
	echo "wrote $CREDENTIALS"
fi
chown root:root "$CREDENTIALS"
chmod 600 "$CREDENTIALS"

dns_args=(--dns-cloudflare-credentials "$CREDENTIALS"
	--dns-cloudflare-propagation-seconds "$PROPAGATION_SECONDS")

renewal_value() { # <key>: value in the renewal config, empty when absent
	sed -n "s/^$1[[:space:]]*=[[:space:]]*//p" "$RENEWAL" | tail -n 1
}

if [ ! -f "$RENEWAL" ]; then
	echo "== issuing $DOMAIN + *.$DOMAIN"
	args=(certonly --non-interactive --agree-tos --dns-cloudflare "${dns_args[@]}"
		--cert-name "$DOMAIN" -d "$DOMAIN" -d "*.$DOMAIN"
		--deploy-hook "$RELOAD_HOOK")
	if [ -n "${CERTBOT_EMAIL:-}" ]; then args+=(-m "$CERTBOT_EMAIL"); fi
	certbot "${args[@]}"
elif [ "$(renewal_value authenticator)" != dns-cloudflare ]; then
	echo "== switching $DOMAIN renewals to dns-cloudflare (test renewal included)"
	certbot reconfigure --non-interactive --cert-name "$DOMAIN" \
		--authenticator dns-cloudflare "${dns_args[@]}" --deploy-hook "$RELOAD_HOOK"
elif [ "$(renewal_value renew_hook)" != "$RELOAD_HOOK" ]; then
	echo "== adding the nginx reload hook to $DOMAIN renewals"
	certbot reconfigure --non-interactive --cert-name "$DOMAIN" --deploy-hook "$RELOAD_HOOK"
else
	echo "$DOMAIN already renews through dns-cloudflare with the nginx reload hook"
fi

[ "$(renewal_value authenticator)" = dns-cloudflare ] || die "renewal config is not on dns-cloudflare"
[ "$(renewal_value renew_hook)" = "$RELOAD_HOOK" ] || die "renewal config has no nginx reload hook"

# Renewal runs from certbot's systemd timer (RHEL: certbot-renew.timer).
if systemctl list-unit-files certbot-renew.timer >/dev/null 2>&1 &&
	! systemctl is-enabled --quiet certbot-renew.timer; then
	systemctl enable --now certbot-renew.timer
fi
systemctl list-timers --all 2>/dev/null | grep -i certbot ||
	echo "warning: no certbot timer found; schedule 'certbot renew' yourself" >&2

certbot certificates --cert-name "$DOMAIN" 2>/dev/null | grep -E 'Domains|Expiry' || true
echo "check renewal: certbot renew --dry-run --cert-name $DOMAIN"
