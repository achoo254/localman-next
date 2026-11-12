#!/bin/bash
# Builds Localman locally and deploys it to server .65 (pm2 + nginx) as an
# atomic release: /opt/localman/releases/<id>/{api,web,nginx} behind the
# symlink /opt/localman/current. The server side (install, nginx -t, switch,
# health check, automatic rollback) is infra/localman/activate-release.sh.
#   SSH_TARGET=<ssh alias or user@host> SERVER_PUBLIC_IP=<server IPv4> [SSH_OPTS="-F ssh_config"] bash infra/localman/deploy.sh
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
# The server's public IPv4 is kept out of the public repository; nginx needs it
# to let the IdP on the same server reach /internal/.
SERVER_PUBLIC_IP="${SERVER_PUBLIC_IP:?set SERVER_PUBLIC_IP to the server public IPv4}"
[[ "$SERVER_PUBLIC_IP" =~ ^[0-9]{1,3}(\.[0-9]{1,3}){3}$ ]] || { echo "SERVER_PUBLIC_IP is not an IPv4 address" >&2; exit 2; }

# The release must be exactly a commit that is already on origin/main.
if [ -n "$(git status --porcelain)" ]; then
	echo "working tree is not clean: commit or stash first (git status)" >&2
	exit 1
fi
git fetch --quiet origin main
if ! git merge-base --is-ancestor HEAD origin/main; then
	echo "HEAD $(git rev-parse --short HEAD) is not on origin/main: push it first" >&2
	exit 1
fi
# One deploy at a time across machines and agent sessions; a lock older than 30 minutes is a crashed run.
lock=/run/lock/localman-deploy
owner="$(hostname -s) $(git rev-parse --short HEAD) $(date -u +%FT%TZ)"
# Exit 3 from the server means the lock is held; anything else is ssh failing.
rc=0
$SSH "$SSH_TARGET" "find $lock -maxdepth 0 -mmin +30 -exec rm -rf {} + 2>/dev/null; mkdir $lock 2>/dev/null || exit 3; echo '$owner' >$lock/owner" </dev/null || rc=$?
if [ "$rc" -eq 3 ]; then
	echo "another deploy is running: $($SSH "$SSH_TARGET" "cat $lock/owner" </dev/null 2>/dev/null)" >&2
	exit 1
elif [ "$rc" -ne 0 ]; then
	echo "could not take the deploy lock on the server (ssh exit $rc)" >&2
	exit 1
fi
trap 'rm -rf "$STAGE"; $SSH "$SSH_TARGET" "rm -rf $lock" </dev/null || true' EXIT

# Sortable and traceable: UTC time and commit.
RELEASE="$(date -u +%Y%m%d-%H%M%S)-$(git rev-parse --short=12 HEAD)"
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
bash infra/localman/api-runtime-package.sh "$STAGE" "$OUT/api"
cp -R apps/api/dist/. "$OUT/api/"
cp -R apps/web/dist "$OUT/web"

echo "== nginx config with the CSP hashes of this build and the server IP"
cp infra/localman/nginx/localman-http.conf infra/localman/nginx/localman-app.inc "$OUT/nginx/"
HASHES="$(node infra/localman/csp-hashes.mjs apps/web/dist/*.html)"
# Base64 hashes never contain '|' or '&'.
for name in localman.hoandat.com.conf; do
	sed -e "s|__CSP_SCRIPT_HASHES__|$HASHES|" -e "s|__SERVER_PUBLIC_IP__|$SERVER_PUBLIC_IP|" \
		"infra/localman/nginx/$name" >"$OUT/nginx/$name"
	if grep -Eq '__CSP_SCRIPT_HASHES__|__SERVER_PUBLIC_IP__' "$OUT/nginx/$name"; then
		echo "placeholder left in $name" >&2
		exit 1
	fi
done

echo "== upload (files owned by the remote root)"
sync_infra
"${RSYNC[@]}" "$OUT/" "$SSH_TARGET:$REMOTE_DIR/releases/$RELEASE/"

echo "== activate on the server"
# shellcheck disable=SC2029 # The arguments are meant to expand locally.
$SSH "$SSH_TARGET" "bash $REMOTE_DIR/infra/activate-release.sh $RELEASE"
echo "== deployed $RELEASE"
