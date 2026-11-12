#!/bin/bash
# Builds a Localman release into <out-dir>: api/ (bundle, runtime package.json and lockfile), web/, nginx/ (CSP hashes
# of this build and the server IP filled in) and infra/ (the server scripts the activation runs). Used by
# .github/workflows/deploy.yml and by infra/localman/deploy.sh.
#   SERVER_PUBLIC_IP=<server IPv4> bash infra/localman/build-release.sh <out-dir>
# Build-time web settings (VITE_*) are pinned here so a developer's apps/web/.env.local never leaks into production;
# override with VITE_FEATURES=... / VITE_IDP_ORIGIN=... in the environment.
set -euo pipefail
OUT="${1:?usage: build-release.sh <out-dir>}"
cd "$(dirname "$0")/../.."
# The server's public IPv4 is kept out of the public repository; nginx needs it to let the IdP on the same server
# reach /internal/.
SERVER_PUBLIC_IP="${SERVER_PUBLIC_IP:?set SERVER_PUBLIC_IP to the server public IPv4}"
[[ "$SERVER_PUBLIC_IP" =~ ^[0-9]{1,3}(\.[0-9]{1,3}){3}$ ]] || { echo "SERVER_PUBLIC_IP is not an IPv4 address" >&2; exit 2; }
STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT
mkdir -p "$OUT/api" "$OUT/nginx"

echo "== build api + web"
export VITE_API_BASE_URL=""
export VITE_IDP_ORIGIN="${VITE_IDP_ORIGIN:-https://auth.hoandat.com}"
if [ -z "${VITE_FEATURES+x}" ]; then
	VITE_FEATURES="$(grep -v '^#' infra/localman/released-features | tr -d ' \t' | sed '/^$/d' | paste -sd, -)"
fi
export VITE_FEATURES
echo "   features: ${VITE_FEATURES:-none}"
pnpm --filter @localman/api --filter @localman/web build

echo "== runtime manifest and lockfile (versions from the workspace lockfile)"
# Written outside the repository first: inside it, pnpm would see the workspace and keep local packages in the lockfile.
bash infra/localman/api-runtime-package.sh "$STAGE/scratch" "$STAGE/api"
cp "$STAGE/api/package.json" "$STAGE/api/pnpm-lock.yaml" "$OUT/api/"
cp -R apps/api/dist/. "$OUT/api/"
cp -R apps/web/dist "$OUT/web"

echo "== nginx config with the CSP hashes of this build and the server IP"
cp infra/localman/nginx/localman-http.conf infra/localman/nginx/localman-app.inc "$OUT/nginx/"
HASHES="$(node infra/localman/csp-hashes.mjs apps/web/dist/*.html)"
# Base64 hashes never contain '|' or '&'.
sed -e "s|__CSP_SCRIPT_HASHES__|$HASHES|" -e "s|__SERVER_PUBLIC_IP__|$SERVER_PUBLIC_IP|" \
	infra/localman/nginx/localman.hoandat.com.conf >"$OUT/nginx/localman.hoandat.com.conf"
if grep -Eq '__CSP_SCRIPT_HASHES__|__SERVER_PUBLIC_IP__' "$OUT/nginx/localman.hoandat.com.conf"; then
	echo "placeholder left in localman.hoandat.com.conf" >&2
	exit 1
fi

echo "== server scripts"
cp -R infra/localman "$OUT/infra"
