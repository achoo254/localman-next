#!/bin/bash
# Writes what the server installs next to the API bundle: package.json and
# pnpm-lock.yaml with the npm dependencies only, versions pinned from the
# workspace lockfile. Run after `pnpm --filter @localman/api build`; fails
# when the bundle still imports a workspace package (they must be bundled,
# apps/api/scripts/build-api.ts) or the lockfile still points at one.
# deploy.sh uses it, and CI runs it so a broken release fails before deploy.
#   bash infra/localman/api-runtime-package.sh <scratch dir> <output dir>
set -euo pipefail
cd "$(dirname "$0")/../.."

STAGE="${1:?usage: api-runtime-package.sh <scratch dir> <output dir>}"
OUT="${2:?usage: api-runtime-package.sh <scratch dir> <output dir>}"
mkdir -p "$OUT"

workspace_names="$(node -e '
	const deps = require("./apps/api/package.json").dependencies ?? {};
	for (const [name, spec] of Object.entries(deps))
		if (String(spec).startsWith("workspace:")) console.log(name);
')"
for name in $workspace_names; do
	if grep -lF -e "from \"$name\"" -e "from \"$name/" -e "import(\"$name" apps/api/dist/*.mjs; then
		echo "the API bundle imports workspace package $name at run time" >&2
		exit 1
	fi
done

pnpm --filter @localman/api deploy --prod --config.inject-workspace-packages=true "$STAGE/deploy" >/dev/null
node infra/localman/runtime-manifest.mjs "$STAGE/deploy/package.json" "$OUT/package.json"
cp "$STAGE/deploy/pnpm-lock.yaml" "$OUT/pnpm-lock.yaml"
# Drops the workspace packages and everything only they used; keeps every
# resolution. Then prove the server's --frozen-lockfile install will accept it.
(cd "$OUT" && pnpm install --lockfile-only --reporter=silent &&
	pnpm install --lockfile-only --frozen-lockfile --reporter=silent)
if grep -Eq '@file:|type: directory' "$OUT/pnpm-lock.yaml"; then
	echo "runtime lockfile still references local packages" >&2
	exit 1
fi
