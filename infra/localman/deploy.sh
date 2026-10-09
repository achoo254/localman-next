#!/bin/bash
# Builds Localman locally and deploys it to server .65 (pm2 + nginx).
#   SSH_TARGET=<ssh alias or user@host> [SSH_OPTS="-F ssh_config"] bash infra/localman/deploy.sh
#   ... bash infra/localman/deploy.sh --infra-only   # first-time setup: sync infra/localman only
# Build-time web settings (VITE_*) are pinned here so a developer's
# apps/web/.env.local never leaks into production; override with
# VITE_FEATURES=... / VITE_IDP_ORIGIN=... on the command line.
# The server keeps /opt/localman/.env and backups/; they are never synced.
# First-time order: docs/deployment-guide.md.
set -euo pipefail
cd "$(dirname "$0")/../.."

SSH_TARGET="${SSH_TARGET:?set SSH_TARGET to the server ssh alias}"
REMOTE_DIR=/opt/localman
PNPM_VERSION=11.9.0
# Extra ssh options, e.g. SSH_OPTS="-F /path/to/ssh_config".
SSH="ssh ${SSH_OPTS:-}"
RSYNC=(rsync -rlptz -e "$SSH")
STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT

remote_dirs() {
	# shellcheck disable=SC2029 # REMOTE_DIR is meant to expand locally.
	$SSH "$SSH_TARGET" "mkdir -p $REMOTE_DIR/api $REMOTE_DIR/web $REMOTE_DIR/infra"
}

if [ "${1:-}" = "--infra-only" ]; then
	echo "== sync infra/localman only"
	remote_dirs
	"${RSYNC[@]}" --delete infra/localman/ "$SSH_TARGET:$REMOTE_DIR/infra/"
	echo "done: scripts are in $REMOTE_DIR/infra on the server"
	exit 0
fi
[ $# -eq 0 ] || { echo "usage: deploy.sh [--infra-only]" >&2; exit 2; }

echo "== build api + web"
export VITE_API_BASE_URL=""
export VITE_IDP_ORIGIN="${VITE_IDP_ORIGIN:-https://auth.hoandat.com}"
export VITE_FEATURES="${VITE_FEATURES:-}"
pnpm --filter @localman/api --filter @localman/web build
node infra/localman/runtime-manifest.mjs apps/api/dist/package.json

echo "== render nginx config with the CSP hashes of this build"
cp -R infra/localman "$STAGE/infra"
HASHES="$(node infra/localman/csp-hashes.mjs apps/web/dist/index.html)"
SITE_CONF="$STAGE/infra/nginx/localman.hoandat.com.conf"
# Base64 hashes never contain '|' or '&'.
sed "s|__CSP_SCRIPT_HASHES__|$HASHES|" infra/localman/nginx/localman.hoandat.com.conf >"$SITE_CONF"
if grep -q '__CSP_SCRIPT_HASHES__' "$SITE_CONF"; then
	echo "CSP placeholder left in $SITE_CONF" >&2
	exit 1
fi

echo "== sync release files (owned by the remote root)"
remote_dirs
"${RSYNC[@]}" --delete "$STAGE/infra/" "$SSH_TARGET:$REMOTE_DIR/infra/"
# node_modules and the lockfile pnpm writes on the server stay between deploys.
"${RSYNC[@]}" --delete --exclude node_modules/ --exclude pnpm-lock.yaml \
	apps/api/dist/ "$SSH_TARGET:$REMOTE_DIR/api/"
# No --delete: tabs opened before the deploy still load their old hashed
# chunks; the remote step prunes assets untouched for 14 days.
# --delay-updates switches index.html and the assets together at the end.
"${RSYNC[@]}" --delay-updates apps/web/dist/ "$SSH_TARGET:$REMOTE_DIR/web/"

echo "== install, nginx, restart, health check"
$SSH "$SSH_TARGET" bash -s -- "$REMOTE_DIR" "$PNPM_VERSION" <<'REMOTE'
set -euo pipefail
REMOTE_DIR="$1"
PNPM_VERSION="$2"
# shellcheck disable=SC1091
source /root/.nvm/nvm.sh >/dev/null
cd "$REMOTE_DIR"

bash infra/setup-server.sh
find web/assets -type f -mtime +14 -delete
if command -v restorecon >/dev/null; then restorecon -R web; fi

(cd api && npx --yes "pnpm@$PNPM_VERSION" install --prod --reporter=silent)

# nginx: install changed files, keep a backup, roll back when nginx -t fails.
changed=()
for name in localman-http.conf localman.hoandat.com.conf; do
	src="infra/nginx/$name"
	dest="/etc/nginx/conf.d/$name"
	if ! cmp -s "$src" "$dest"; then
		if [ -f "$dest" ]; then cp -p "$dest" "$dest.bak"; else rm -f "$dest.bak"; fi
		install -m 644 "$src" "$dest"
		changed+=("$dest")
	fi
done
if [ "${#changed[@]}" -gt 0 ]; then
	if nginx -t; then
		systemctl reload nginx
		echo "nginx reloaded: ${changed[*]}"
	else
		for dest in "${changed[@]}"; do
			if [ -f "$dest.bak" ]; then mv -f "$dest.bak" "$dest"; else rm -f "$dest"; fi
		done
		echo "nginx -t failed; previous config restored" >&2
		exit 1
	fi
fi

# The proxied host needs the Cloudflare real-IP rules at http level (shared
# with auth.hoandat.com, not repeated by Localman); without them every
# visitor shares the rate limits of a Cloudflare edge address.
nginx_config="$(nginx -T 2>/dev/null)"
if ! grep -Eq '^[[:space:]]*real_ip_header[[:space:]]+CF-Connecting-IP[[:space:]]*;' <<<"$nginx_config" ||
	! grep -Eq '^[[:space:]]*set_real_ip_from[[:space:]]+[0-9a-fA-F.:]+/[0-9]+[[:space:]]*;' <<<"$nginx_config"; then
	echo "WARNING: nginx has no Cloudflare real-IP rules (set_real_ip_from + real_ip_header CF-Connecting-IP) at http level; see docs/deployment-guide.md" >&2
fi

pm2 startOrReload infra/ecosystem.config.cjs --update-env
pm2 save >/dev/null

healthy() {
	curl -fsS http://127.0.0.1:4000/healthz | grep -q '"db":"connected"' &&
		curl -fsS http://127.0.0.1:4100/healthz | grep -q '"db":"connected"'
}
ok=0
for _ in $(seq 1 30); do
	if healthy; then ok=1; break; fi
	sleep 1
done
if [ "$ok" -ne 1 ]; then
	echo "healthz failed; recent log:" >&2
	pm2 logs localman-api --lines 40 --nostream
	exit 1
fi
echo "healthz ok (dashboard :4000, mock :4100, db connected)"

# Through nginx and TLS, as visitors reach it.
RESOLVE=(--resolve localman.hoandat.com:443:127.0.0.1)
curl -fsS -o /dev/null "${RESOLVE[@]}" https://localman.hoandat.com/
curl -fsS -o /dev/null "${RESOLVE[@]}" https://localman.hoandat.com/api/v1/openapi.json
echo "nginx ok (web app and /api/)"
REMOTE

echo "== deployed"
