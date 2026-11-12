#!/bin/bash
# Builds a tunelo-server release into <out-dir>: the bundle, its source map, the web console (static/), the sanitized
# package.json, the pm2 ecosystem and the activation script. Used by .github/workflows/deploy.yml and by
# infra/tunelo/deploy.sh.
#   bash infra/tunelo/build-release.sh <out-dir>
set -euo pipefail
OUT="${1:?usage: build-release.sh <out-dir>}"
cd "$(dirname "$0")/../.."
pnpm build:tunelo-server
mkdir -p "$OUT"
cp dist/tunelo-server/server.mjs dist/tunelo-server/server.mjs.map dist/tunelo-server/package.json "$OUT/"
cp -R dist/tunelo-server/static "$OUT/static"
cp infra/tunelo/ecosystem.config.cjs infra/tunelo/activate-incoming.sh "$OUT/"
