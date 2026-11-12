#!/bin/bash
# Break-glass deploy of Localman to server .65; a push to main deploys through .github/workflows/deploy.yml.
# Refuses a dirty tree or a commit not on origin/main, builds here (infra/localman/build-release.sh), uploads to
# /opt/localman/ci-incoming/<id> and runs the same activation as CI (infra/localman/activate-incoming.sh: flock, server
# scripts from the release, then activate-release.sh: install, switch, health, rollback).
#   SSH_TARGET=<ssh alias or user@host> SERVER_PUBLIC_IP=<server IPv4> [SSH_OPTS="-F ssh_config"] bash infra/localman/deploy.sh
#   ... bash infra/localman/deploy.sh --infra-only   # sync infra/localman only (first-time setup)
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

# Sortable and traceable: UTC time and commit.
RELEASE="$(date -u +%Y%m%d-%H%M%S)-$(git rev-parse --short=12 HEAD)"
OUT="$STAGE/release"
echo "== build $RELEASE"
bash infra/localman/build-release.sh "$OUT"

echo "== upload (files owned by the remote root)"
# shellcheck disable=SC2029 # The arguments are meant to expand locally.
$SSH "$SSH_TARGET" "mkdir -p $REMOTE_DIR/ci-incoming/$RELEASE"
"${RSYNC[@]}" "$OUT/" "$SSH_TARGET:$REMOTE_DIR/ci-incoming/$RELEASE/"

echo "== activate (the same step CI runs; it waits for any other activation)"
# shellcheck disable=SC2029 # The arguments are meant to expand locally.
$SSH "$SSH_TARGET" "install -m 755 -o root -g root $REMOTE_DIR/ci-incoming/$RELEASE/infra/activate-incoming.sh /usr/local/sbin/localman-activate-incoming && /usr/local/sbin/localman-activate-incoming $RELEASE"
echo "== deployed $RELEASE"
