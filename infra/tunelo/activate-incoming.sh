#!/bin/bash
# Activates a tunelo-server release uploaded to /var/www/tunelo/ci-incoming/<release-id> (by CI as `tunelo-deploy`, or
# by infra/tunelo/deploy.sh). Installed as root at /usr/local/sbin/tunelo-activate-incoming; `tunelo-deploy` may run
# only this command through sudo (infra/tunelo/setup-deploy-user.sh).
#   tunelo-activate-incoming <release-id>
# One activation at a time (flock). The upload moves to a root-owned releases/<id> (rejected if it holds links or
# special files or misses a part). A release whose files equal the running one is dropped without a restart, so a
# push that only changes Localman does not drop every tunnel. Otherwise: production dependencies, `current` points to
# the new release, pm2 recreates `tunelo` from current/ecosystem.config.cjs, and /health must answer within 20 s;
# on failure the previous release (or, before the first release, the old in-place files in /var/www/tunelo) comes
# back. /var/www/tunelo/.env stays outside the releases. Keeps the 5 newest releases.
set -euo pipefail
ROOT=/var/www/tunelo
ID="${1:?usage: tunelo-activate-incoming <release-id>}"
[[ "$ID" =~ ^[0-9]{8}-[0-9]{6}-[0-9a-f]{12}$ ]] || { echo "bad release id" >&2; exit 2; }
[ "$(id -u)" -eq 0 ] || { echo "run as root" >&2; exit 1; }

# One activation at a time: a CI deploy and a manual release from a dev machine may meet.
exec 9>/run/tunelo-activate.lock
flock -w 600 9 || { echo "another activation still holds /run/tunelo-activate.lock" >&2; exit 1; }

# sudo keeps only the secure path; Node, pnpm and pm2 live in root's nvm and /usr/local/bin.
export PATH="/usr/local/bin:$PATH"
# shellcheck disable=SC1091
source /root/.nvm/nvm.sh >/dev/null

SRC="$ROOT/ci-incoming/$ID"
DST="$ROOT/releases/$ID"
[ ! -e "$DST" ] || { echo "release $ID already exists" >&2; exit 2; }
[ -d "$SRC" ] && [ ! -L "$SRC" ] || { echo "incoming release $ID missing" >&2; exit 2; }
mkdir -p "$ROOT/releases"
mv "$SRC" "$DST"
chown -R root:root "$DST"
reject() {
	rm -rf "${DST:?}"
	echo "incoming release $ID $1" >&2
	exit 2
}
[ -z "$(find "$DST" ! -type f ! -type d -print -quit)" ] || reject "has links or special files"
for part in server.mjs package.json ecosystem.config.cjs static; do
	[ -e "$DST/$part" ] || reject "has no $part"
done

# Same files as the running release: nothing to restart.
digest() { (cd "$1" && find . -type f ! -path './node_modules/*' ! -name pnpm-lock.yaml ! -name package-lock.json -print0 | sort -z | xargs -0 sha256sum | sha256sum | cut -d' ' -f1); }
prev="$(readlink -f "$ROOT/current" 2>/dev/null || true)"
if [ -n "$prev" ] && [ -d "$prev" ] && [ "$(digest "$prev")" = "$(digest "$DST")" ]; then
	rm -rf "${DST:?}"
	echo "release $ID has the same files as $(basename "$prev"): nothing to activate"
	exit 0
fi

echo "== production dependencies"
(cd "$DST" && { pnpm install --prod --no-frozen-lockfile --reporter=silent || npm install --omit=dev --no-audit --no-fund; })

healthy() {
	for _ in $(seq 1 20); do
		curl -fsS --max-time 3 http://127.0.0.1:3001/health >/dev/null && return 0
		sleep 1
	done
	return 1
}
# pm2 may start its daemon here; it must not inherit the lock (fd 9) or the lock would outlive this run.
start_from() {
	pm2 delete tunelo >/dev/null 2>&1 9>&- || true
	pm2 start "$1" --update-env 9>&- && pm2 save 9>&-
}

echo "== switch to $ID"
ln -sfn "$DST" "$ROOT/current.next"
mv -T "$ROOT/current.next" "$ROOT/current"
if start_from "$ROOT/current/ecosystem.config.cjs" && healthy; then
	echo "health ok: tunelo-server now runs $ID"
	ls -1dt "$ROOT"/releases/*/ | tail -n +6 | xargs -r rm -rf
	exit 0
fi

pm2 logs tunelo --lines 40 --nostream 9>&- || true
if [ -n "$prev" ] && [ -d "$prev" ]; then
	echo "release $ID failed: switching back to $(basename "$prev")" >&2
	ln -sfn "$prev" "$ROOT/current.next"
	mv -T "$ROOT/current.next" "$ROOT/current"
	start_from "$ROOT/current/ecosystem.config.cjs" || true
elif [ -f "$ROOT/server.mjs" ] && [ -f "$ROOT/ecosystem.config.cjs" ]; then
	echo "release $ID failed: back to the in-place files of $ROOT" >&2
	rm -f "$ROOT/current"
	start_from "$ROOT/ecosystem.config.cjs" || true
fi
if healthy; then echo "previous version is back and healthy" >&2; else echo "previous version is not healthy either" >&2; fi
exit 1
