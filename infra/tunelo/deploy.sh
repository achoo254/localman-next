#!/bin/bash
# Break-glass deploy of tunelo-server; a push to main deploys through .github/workflows/deploy.yml.
# Refuses a dirty tree or a commit not on origin/main, builds here (infra/tunelo/build-release.sh), uploads to
# /var/www/tunelo/ci-incoming/<id> and runs the same activation as CI (infra/tunelo/activate-incoming.sh: flock,
# releases/<id>, `current`, pm2, /health, previous release back on failure).
#   VPS_HOST=<ssh alias or root@host> bash infra/tunelo/deploy.sh
# The target is never defaulted so server access details stay out of the repo.
set -euo pipefail
cd "$(dirname "$0")/../.."

VPS_HOST="${VPS_HOST:?set VPS_HOST to the server ssh alias}"
REMOTE_DIR=/var/www/tunelo

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

RELEASE="$(date -u +%Y%m%d-%H%M%S)-$(git rev-parse --short=12 HEAD)"
STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT
echo "== build $RELEASE"
bash infra/tunelo/build-release.sh "$STAGE/release"

echo "== upload"
ssh "$VPS_HOST" "mkdir -p $REMOTE_DIR/ci-incoming/$RELEASE" </dev/null
rsync -rlptz "$STAGE/release/" "$VPS_HOST:$REMOTE_DIR/ci-incoming/$RELEASE/"

echo "== activate (the same step CI runs; it waits for any other activation)"
ssh "$VPS_HOST" "install -m 755 -o root -g root $REMOTE_DIR/ci-incoming/$RELEASE/activate-incoming.sh /usr/local/sbin/tunelo-activate-incoming && /usr/local/sbin/tunelo-activate-incoming $RELEASE" </dev/null
