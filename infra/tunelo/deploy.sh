#!/bin/bash
set -euo pipefail

# Usage: VPS_HOST=<ssh alias or user@host> bash infra/tunelo/deploy.sh
# The target is never defaulted so server access details stay out of the repo.

# Run from the monorepo root: paths below are relative to it.
cd "$(dirname "$0")/../.."

VPS_HOST="${VPS_HOST:?set VPS_HOST to the server ssh alias}"
REMOTE_DIR="${REMOTE_DIR:-/var/www/tunelo}"

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
lock=/run/lock/tunelo-deploy
owner="$(hostname -s) $(git rev-parse --short HEAD) $(date -u +%FT%TZ)"
# Exit 3 from the server means the lock is held; anything else is ssh failing.
rc=0
ssh "$VPS_HOST" "find $lock -maxdepth 0 -mmin +30 -exec rm -rf {} + 2>/dev/null; mkdir $lock 2>/dev/null || exit 3; echo '$owner' >$lock/owner" </dev/null || rc=$?
if [ "$rc" -eq 3 ]; then
	echo "another deploy is running: $(ssh "$VPS_HOST" "cat $lock/owner" </dev/null 2>/dev/null)" >&2
	exit 1
elif [ "$rc" -ne 0 ]; then
	echo "could not take the deploy lock on the server (ssh exit $rc)" >&2
	exit 1
fi
trap 'ssh "$VPS_HOST" "rm -rf $lock" </dev/null || true' EXIT

echo "=== Tunelo Deploy ==="
echo "Target: $VPS_HOST:$REMOTE_DIR"

echo "Building bundle (server + dashboard)..."
pnpm build:tunelo-server

echo "Ensuring remote directories exist..."
ssh "$VPS_HOST" "mkdir -p $REMOTE_DIR"

echo "Syncing server bundle..."
rsync -avz \
  dist/tunelo-server/server.mjs \
  dist/tunelo-server/server.mjs.map \
  "$VPS_HOST:$REMOTE_DIR/"

echo "Syncing web console assets..."
rsync -avz --delete dist/tunelo-server/static/ "$VPS_HOST:$REMOTE_DIR/static/"

echo "Syncing package.json (sanitized for prod)..."
rsync -avz dist/tunelo-server/package.json "$VPS_HOST:$REMOTE_DIR/package.json"

echo "Syncing PM2 ecosystem config..."
rsync -avz infra/tunelo/ecosystem.config.cjs "$VPS_HOST:$REMOTE_DIR/ecosystem.config.cjs"

echo "Installing prod dependencies on VPS..."
ssh "$VPS_HOST" "cd $REMOTE_DIR && pnpm install --prod --no-frozen-lockfile || npm install --omit=dev"

echo "Restarting tunelo server (delete old + start fresh from ecosystem)..."
ssh "$VPS_HOST" "pm2 delete tunelo 2>/dev/null || true; cd $REMOTE_DIR && pm2 start ecosystem.config.cjs --update-env && pm2 save"

echo "Deploy complete!"
ssh "$VPS_HOST" "pm2 status tunelo && curl -sf http://localhost:3001/health || echo 'Health check failed'"
