#!/bin/bash
set -e

# Run from the monorepo root: paths below are relative to it.
cd "$(dirname "$0")/../.."

VPS_HOST="${VPS_HOST:-root@103.72.98.65}"
REMOTE_DIR="${REMOTE_DIR:-/var/www/tunelo}"

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
