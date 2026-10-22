#!/usr/bin/env bash
# Builds the web app for the iOS/Android shell into apps/web/dist-native:
# the same features as production (infra/localman/released-features) and
# the API on its public host. LOCALMAN_API_BASE_URL overrides the host
# (e.g. a staging tunnel); VITE_FEATURES on the command line wins too.
set -euo pipefail
root="$(cd "$(dirname "$0")/../../.." && pwd)"
if [ -z "${VITE_FEATURES+x}" ]; then
	VITE_FEATURES="$(grep -v '^#' "$root/infra/localman/released-features" | tr -d ' \t' | sed '/^$/d' | paste -sd, -)"
fi
export VITE_FEATURES
export VITE_NATIVE=true
export VITE_API_BASE_URL="${LOCALMAN_API_BASE_URL:-https://localman.hoandat.com}"
echo "native web build: api=$VITE_API_BASE_URL features=${VITE_FEATURES:-none}"
pnpm --dir "$root" --filter @localman/web exec vite build --outDir dist-native --emptyOutDir
