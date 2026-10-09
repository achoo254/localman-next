#!/bin/bash
# Activates a release uploaded by deploy.sh to /opt/localman/releases/<id>
# ({api,web,nginx}). Run as root on the server (deploy.sh does it):
#   bash /opt/localman/infra/activate-release.sh <release-id>
# 1. setup-server.sh (idempotent: user, dirs, Node runtime, cron, logrotate);
# 2. runtime dependencies from the shipped lockfile (--frozen-lockfile);
# 3. web assets of the previous release carried forward (hard links), so
#    tabs opened before the deploy still load their chunks; assets older
#    than 14 days are dropped;
# 4. switch-release.sh (nginx config + nginx -t, symlink, reloads, health);
#    on failure, switch back to the previous release and exit 1;
# 5. keep the 5 newest releases (never the current or previous one).
set -euo pipefail

APP_DIR=/opt/localman
RELEASES="$APP_DIR/releases"
INFRA="$APP_DIR/infra"
KEEP=5
ASSET_DAYS=14
PNPM_VERSION=11.9.0

die() { echo "activate-release: $*" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || die "run as root"
id="${1:?usage: activate-release.sh <release-id>}"
[[ "$id" =~ ^[A-Za-z0-9._-]+$ ]] || die "bad release id"
new="$RELEASES/$id"
for part in api/main.mjs api/package.json api/pnpm-lock.yaml web/index.html \
	nginx/localman-http.conf nginx/localman.hoandat.com.conf; do
	[ -s "$new/$part" ] || die "upload incomplete: missing $new/$part"
done
# shellcheck disable=SC1091
source /root/.nvm/nvm.sh >/dev/null

bash "$INFRA/setup-server.sh"

previous=""
if [ -L "$APP_DIR/current" ]; then previous="$(basename "$(readlink "$APP_DIR/current")")"; fi
[ "$previous" != "$id" ] || die "$id is already the current release"

echo "== runtime dependencies"
(cd "$new/api" && npx --yes "pnpm@$PNPM_VERSION" install --prod --frozen-lockfile --reporter=silent)

echo "== web assets"
if [ -n "$previous" ] && [ -d "$RELEASES/$previous/web/assets" ]; then
	# Hard links (--link-dest on the source itself), never overwriting this
	# build's files of the same name; portable across coreutils versions,
	# unlike `cp --no-clobber`.
	prev_assets="$RELEASES/$previous/web/assets/"
	rsync -a --ignore-existing --link-dest="$prev_assets" "$prev_assets" "$new/web/assets/"
	find "$new/web/assets" -type f -mtime +"$ASSET_DAYS" -delete
fi
if command -v restorecon >/dev/null; then restorecon -R "$new/web"; fi

# The proxied host needs the Cloudflare real-IP rules at http level (shared
# with auth.hoandat.com, not repeated by Localman); without them every
# visitor shares the rate limits of a Cloudflare edge address.
nginx_config="$(nginx -T 2>/dev/null || true)"
if ! grep -Eq '^[[:space:]]*real_ip_header[[:space:]]+CF-Connecting-IP[[:space:]]*;' <<<"$nginx_config" ||
	! grep -Eq '^[[:space:]]*set_real_ip_from[[:space:]]+[0-9a-fA-F.:]+/[0-9]+[[:space:]]*;' <<<"$nginx_config"; then
	echo "WARNING: nginx has no Cloudflare real-IP rules (set_real_ip_from + real_ip_header CF-Connecting-IP) at http level; see docs/deployment-guide.md" >&2
fi

if ! bash "$INFRA/switch-release.sh" "$id"; then
	echo "release $id failed" >&2
	if [ -n "$previous" ]; then
		echo "== rolling back to $previous" >&2
		bash "$INFRA/switch-release.sh" "$previous" ||
			echo "ROLLBACK TO $previous FAILED: check pm2 and nginx by hand" >&2
	else
		echo "no previous release to roll back to" >&2
	fi
	exit 1
fi

echo "== prune releases (keep $KEEP)"
while IFS= read -r old; do
	if [ "$old" = "$id" ] || [ "$old" = "$previous" ]; then continue; fi
	rm -rf -- "${RELEASES:?}/$old"
	echo "removed release $old"
done < <(find "$RELEASES" -mindepth 1 -maxdepth 1 -type d -printf '%f\n' | sort -r | tail -n +"$((KEEP + 1))")
echo "== release $id active"
