#!/bin/bash
# Builds Localman locally and deploys it to server .65 (pm2 + nginx) as an
# atomic release: /opt/localman/releases/<id>/{api,web,nginx} behind the
# symlink /opt/localman/current. The server side (install, nginx -t, switch,
# health check, automatic rollback) is infra/localman/activate-release.sh.
#   SSH_TARGET=<ssh alias or user@host> [SSH_OPTS="-F ssh_config"] bash infra/localman/deploy.sh
#   ... bash infra/localman/deploy.sh --infra-only   # sync infra/localman only (first-time setup)
# Build-time web settings (VITE_*) are pinned here so a developer's
# apps/web/.env.local never leaks into production; override with
# VITE_FEATURES=... / VITE_IDP_ORIGIN=... on the command line.
# The server keeps /opt/localman/.env and backups/; they are never synced.
# First-time order and rollback: docs/deployment-guide.md.
set -euo pipefail
cd "$(dirname "$0")/../.."

SSH_TARGET="${SSH_TARGET:?set SSH_TARGET to the server ssh alias}"
REMOTE_DIR=/opt/localman
# Extra ssh options, e.g. SSH_OPTS="-F /path/to/ssh_config".
SSH="ssh ${SSH_OPTS:-}"
RSYNC=(rsync -rlptz -e "$SSH")
STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT

sync_infra() {
	# shellcheck disable=SC2029 # REMOTE_DIR is meant to expand locally.
	$SSH "$SSH_TARGET" "mkdir -p $REMOTE_DIR/infra $REMOTE_DIR/releases"
	"${RSYNC[@]}" --delete infra/localman/ "$SSH_TARGET:$REMOTE_DIR/infra/"
}

if [ "${1:-}" = "--infra-only" ]; then
	echo "== sync infra/localman only"
	sync_infra
	echo "done: scripts are in $REMOTE_DIR/infra on the server"
	exit 0
fi
[ $# -eq 0 ] || { echo "usage: deploy.sh [--infra-only]" >&2; exit 2; }

# Sortable and traceable: UTC time, commit, and whether the tree was dirty.
RELEASE="$(date -u +%Y%m%d-%H%M%S)-$(git rev-parse --short=12 HEAD)"
git diff --quiet HEAD -- || RELEASE="$RELEASE-dirty"
OUT="$STAGE/release"
mkdir -p "$OUT/api" "$OUT/nginx"

echo "== build api + web ($RELEASE)"
export VITE_API_BASE_URL=""
export VITE_IDP_ORIGIN="${VITE_IDP_ORIGIN:-https://auth.hoandat.com}"
if [ -z "${VITE_FEATURES+x}" ]; then
	VITE_FEATURES="$(grep -v '^#' "$(dirname "$0")/released-features" | tr -d ' \t' | sed '/^$/d' | paste -sd, -)"
fi
export VITE_FEATURES
echo "   features: ${VITE_FEATURES:-none}"
pnpm --filter @localman/api --filter @localman/web build

echo "== runtime manifest and lockfile (versions from the workspace lockfile)"
pnpm --filter @localman/api deploy --prod --config.inject-workspace-packages=true "$STAGE/deploy" >/dev/null
node infra/localman/runtime-manifest.mjs "$STAGE/deploy/package.json" "$OUT/api/package.json"
cp "$STAGE/deploy/pnpm-lock.yaml" "$OUT/api/pnpm-lock.yaml"
# Drops the workspace packages and everything only they used; keeps every
# resolution. Then prove the server's --frozen-lockfile install will accept it.
(cd "$OUT/api" && pnpm install --lockfile-only --reporter=silent &&
	pnpm install --lockfile-only --frozen-lockfile --reporter=silent)
if grep -Eq '@file:|type: directory' "$OUT/api/pnpm-lock.yaml"; then
	echo "runtime lockfile still references local packages" >&2
	exit 1
fi
cp -R apps/api/dist/. "$OUT/api/"
cp -R apps/web/dist "$OUT/web"

echo "== nginx config with the CSP hashes of this build"
cp infra/localman/nginx/localman-http.conf "$OUT/nginx/"
HASHES="$(node infra/localman/csp-hashes.mjs apps/web/dist/*.html)"
# Base64 hashes never contain '|' or '&'.
sed "s|__CSP_SCRIPT_HASHES__|$HASHES|" infra/localman/nginx/localman.hoandat.com.conf \
	>"$OUT/nginx/localman.hoandat.com.conf"
if grep -q '__CSP_SCRIPT_HASHES__' "$OUT/nginx/localman.hoandat.com.conf"; then
	echo "CSP placeholder left in the nginx config" >&2
	exit 1
fi

echo "== upload (files owned by the remote root)"
sync_infra
"${RSYNC[@]}" "$OUT/" "$SSH_TARGET:$REMOTE_DIR/releases/$RELEASE/"

echo "== activate on the server"
# shellcheck disable=SC2029 # The arguments are meant to expand locally.
$SSH "$SSH_TARGET" "bash $REMOTE_DIR/infra/activate-release.sh $RELEASE"
echo "== deployed $RELEASE"
