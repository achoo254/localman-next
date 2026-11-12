#!/bin/bash
# Activates a Localman release uploaded to /opt/localman/ci-incoming/<release-id> (by CI as `localman-deploy`, or by
# infra/localman/deploy.sh). Installed as root at /usr/local/sbin/localman-activate-incoming; `localman-deploy` may run
# only this command through sudo (infra/localman/setup-deploy-user.sh).
#   localman-activate-incoming <release-id>
# One activation at a time (flock). The upload moves to a root-owned directory and is rejected if it holds links or
# special files or misses a part; its infra/ replaces /opt/localman/infra, the rest becomes releases/<id>, then
# activate-release.sh installs, switches, checks health and rolls back on failure.
set -euo pipefail
APP_DIR=/opt/localman
ID="${1:?usage: localman-activate-incoming <release-id>}"
[[ "$ID" =~ ^[0-9]{8}-[0-9]{6}-[0-9a-f]{12}$ ]] || { echo "bad release id" >&2; exit 2; }
[ "$(id -u)" -eq 0 ] || { echo "run as root" >&2; exit 1; }

# One activation at a time: a CI deploy and a manual release from a dev machine may meet.
exec 9>/run/localman-activate.lock
flock -w 600 9 || { echo "another activation still holds /run/localman-activate.lock" >&2; exit 1; }

# sudo keeps only the secure path; pm2 lives in /usr/local/bin (activate-release.sh loads Node from root's nvm).
export PATH="/usr/local/bin:$PATH"

SRC="$APP_DIR/ci-incoming/$ID"
STAGE="$APP_DIR/staging"
DST="$APP_DIR/releases/$ID"
[ ! -e "$DST" ] || { echo "release $ID already exists" >&2; exit 2; }
[ -d "$SRC" ] && [ ! -L "$SRC" ] || { echo "incoming release $ID missing" >&2; exit 2; }

install -d -m 700 -o root -g root "$STAGE"
rm -rf "${STAGE:?}/$ID"
mv "$SRC" "$STAGE/$ID"
chown -R root:root "$STAGE/$ID"
reject() {
	rm -rf "${STAGE:?}/$ID"
	echo "incoming release $ID $1" >&2
	exit 2
}
[ -z "$(find "$STAGE/$ID" ! -type f ! -type d -print -quit)" ] || reject "has links or special files"
for part in api/main.mjs api/package.json api/pnpm-lock.yaml web/index.html nginx/localman-http.conf \
	nginx/localman.hoandat.com.conf nginx/localman-app.inc infra/activate-release.sh infra/switch-release.sh; do
	[ -s "$STAGE/$ID/$part" ] || reject "has no $part"
done
find "$STAGE/$ID" -type d -exec chmod 755 {} +
find "$STAGE/$ID" -type f -exec chmod go-w {} +
printf '%s\n' "$ID" >"$STAGE/$ID/web/RELEASE"

# The server scripts travel with the release, so the activation below runs the version built with it.
install -d -m 755 -o root -g root "$APP_DIR/infra"
rsync -a --delete "$STAGE/$ID/infra/" "$APP_DIR/infra/"
rm -rf "${STAGE:?}/$ID/infra"
mkdir -p "$APP_DIR/releases"
mv "$STAGE/$ID" "$DST"

# pm2 may start its daemon here; it must not inherit the lock (fd 9) or the lock would outlive this run.
bash "$APP_DIR/infra/activate-release.sh" "$ID" 9>&-
