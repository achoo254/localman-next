#!/bin/bash
# Makes /opt/localman/current point at an installed release and has nginx and
# pm2 serve it, then waits for the health checks. Used by
# activate-release.sh, and by hand to roll back:
#   ls /opt/localman/releases
#   bash /opt/localman/infra/switch-release.sh <release-id>
# Order: install the release's nginx config (its CSP hashes match its
# index.html) and keep the old one if `nginx -t` fails; flip the symlink
# atomically; reload nginx; reload (or recreate) the API; health checks.
# Exit 1 when any step fails; the caller decides whether to switch back.
set -euo pipefail

APP_DIR=/opt/localman
RELEASES="$APP_DIR/releases"
ECOSYSTEM="$APP_DIR/infra/ecosystem.config.cjs"
ECOSYSTEM_STAMP="$APP_DIR/.ecosystem.sha256"

die() { echo "switch-release: $*" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || die "run as root"
id="${1:?usage: switch-release.sh <release-id>}"
[[ "$id" =~ ^[A-Za-z0-9._-]+$ ]] || die "bad release id"
target="$RELEASES/$id"
[ -f "$target/api/main.mjs" ] && [ -d "$target/api/node_modules" ] ||
	die "$target is not an installed release"
[ -f "$target/web/index.html" ] || die "$target/web has no index.html"
# shellcheck disable=SC1091
source /root/.nvm/nvm.sh >/dev/null

echo "== nginx config of $id"
# Files and where they go: conf.d loads every *.conf; the shared dashboard
# locations are included from /etc/nginx/localman. The tenants' blocks use
# the IdP's 00-tenants-http.conf (certificate map): only once it exists.
installs=(
	"localman-http.conf:/etc/nginx/conf.d"
	"localman.hoandat.com.conf:/etc/nginx/conf.d"
	"localman-app.inc:/etc/nginx/localman"
)
if [ -f /etc/nginx/conf.d/00-tenants-http.conf ]; then
	installs+=("localman-tenants.conf:/etc/nginx/conf.d")
fi
mkdir -p /etc/nginx/localman
changed=()
for entry in "${installs[@]}"; do
	name="${entry%%:*}"
	src="$target/nginx/$name"
	dest="${entry#*:}/$name"
	[ -s "$src" ] || die "missing $src"
	if ! cmp -s "$src" "$dest"; then
		if [ -f "$dest" ]; then cp -p "$dest" "$dest.bak"; else rm -f "$dest.bak"; fi
		install -m 644 "$src" "$dest"
		changed+=("$dest")
	fi
done
if [ "${#changed[@]}" -gt 0 ] && ! nginx -t; then
	for dest in "${changed[@]}"; do
		if [ -f "$dest.bak" ]; then mv -f "$dest.bak" "$dest"; else rm -f "$dest"; fi
	done
	die "nginx -t failed; previous nginx config restored, current release unchanged"
fi

echo "== current -> releases/$id"
ln -sfn "releases/$id" "$APP_DIR/current.next"
mv -T "$APP_DIR/current.next" "$APP_DIR/current"
if [ "${#changed[@]}" -gt 0 ]; then
	systemctl reload nginx
	echo "nginx reloaded: ${changed[*]}"
fi

echo "== API"
sum="$(sha256sum "$ECOSYSTEM" | cut -d ' ' -f 1)"
if pm2 describe localman-api >/dev/null 2>&1 && [ "$(cat "$ECOSYSTEM_STAMP" 2>/dev/null)" = "$sum" ]; then
	pm2 reload "$ECOSYSTEM" --update-env
else
	# New process, or the ecosystem changed: reload would keep the old args.
	pm2 delete localman-api >/dev/null 2>&1 || true
	pm2 start "$ECOSYSTEM"
fi
echo "$sum" >"$ECOSYSTEM_STAMP"
pm2 save >/dev/null

healthy() {
	curl -fsS --max-time 3 http://127.0.0.1:4000/healthz | grep -q '"db":"connected"' &&
		curl -fsS --max-time 3 http://127.0.0.1:4100/healthz | grep -q '"db":"connected"'
}
ok=0
for _ in $(seq 1 30); do
	if healthy; then ok=1; break; fi
	sleep 1
done
if [ "$ok" -ne 1 ]; then
	echo "healthz failed; recent log:" >&2
	pm2 logs localman-api --lines 40 --nostream >&2 || true
	exit 1
fi

# Through nginx and TLS, as visitors reach it.
resolve=(--resolve localman.hoandat.com:443:127.0.0.1)
curl -fsS --max-time 5 -o /dev/null "${resolve[@]}" https://localman.hoandat.com/ ||
	die "nginx does not serve the web app"
curl -fsS --max-time 5 -o /dev/null "${resolve[@]}" https://localman.hoandat.com/api/v1/openapi.json ||
	die "nginx does not reach the API"
echo "release $id is live (dashboard :4000, mock :4100, db connected, nginx ok)"
