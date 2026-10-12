#!/bin/bash
# Prepares server .65 for Localman. Run as root; idempotent, so
# activate-release.sh runs it on every deploy (it then only refreshes the
# Node runtime copy).
#   bash /opt/localman/infra/setup-server.sh
#
# - system user `localman`: pm2 (running as root, shared with the other
#   apps) starts the API under this user through `uid`/`gid`;
# - /opt/localman/{releases,infra,runtime,backups} and /var/log/localman
#   (releases/<id> + the `current` symlink: activate-release.sh);
# - a copy of root's nvm Node in /opt/localman/runtime: /root is not
#   traversable by other users, so `localman` cannot run the nvm binary;
# - /opt/localman/.env seeded from .env.production.example with a fresh
#   SESSION_ENCRYPTION_KEY and VARIABLE_ENCRYPTION_KEY when missing (never
#   overwritten; an older file only gets the variable key added);
# - the daily backup cron (02:45) and logrotate for its log; the pm2 logs
#   are rotated by the pm2-logrotate module only (checked below);
# - pm2 startup; a report of internal ports reachable from outside.
set -euo pipefail

APP_DIR=/opt/localman
APP_USER=localman
LOG_DIR=/var/log/localman
INFRA_DIR="$(cd "$(dirname "$0")" && pwd)"

die() { echo "setup-server: $*" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || die "run as root"
# shellcheck disable=SC1091
[ -s /root/.nvm/nvm.sh ] && source /root/.nvm/nvm.sh >/dev/null
command -v node >/dev/null || die "node is not installed (nvm)"
command -v pm2 >/dev/null || die "pm2 is not installed"
node -e 'const [major, minor] = process.versions.node.split(".").map(Number);
process.exit(major > 22 || (major === 22 && minor >= 12) ? 0 : 1)' ||
	die "Node >= 22.12 is required, found $(node --version)"

if ! id "$APP_USER" >/dev/null 2>&1; then
	useradd --system --user-group --home-dir "$APP_DIR" --no-create-home \
		--shell "$(command -v nologin || echo /sbin/nologin)" "$APP_USER"
	echo "created system user $APP_USER"
fi

install -d -m 755 -o root -g root "$APP_DIR" "$APP_DIR/releases" \
	"$APP_DIR/infra" "$APP_DIR/runtime"
install -d -m 700 -o root -g root "$APP_DIR/backups"
install -d -m 750 -o root -g "$APP_USER" "$LOG_DIR"

# Node runtime for the `localman` user; replaced atomically when root's
# default nvm Node changes (a running process keeps the old inode).
NODE_SRC="$(command -v node)"
NODE_DEST="$APP_DIR/runtime/node"
if ! cmp -s "$NODE_SRC" "$NODE_DEST"; then
	cp "$NODE_SRC" "$NODE_DEST.tmp"
	chmod 755 "$NODE_DEST.tmp"
	mv -f "$NODE_DEST.tmp" "$NODE_DEST"
	echo "installed Node $("$NODE_DEST" --version) in $NODE_DEST"
fi
runuser -u "$APP_USER" -- "$NODE_DEST" --version >/dev/null ||
	die "$APP_USER cannot run $NODE_DEST"

# Environment of the API (and of the cleanup command), readable by the
# service user only. Secrets are filled in by hand: docs/deployment-guide.md.
ENV_FILE="$APP_DIR/.env"
if [ ! -f "$ENV_FILE" ]; then
	[ -s "$INFRA_DIR/.env.production.example" ] || die "missing $INFRA_DIR/.env.production.example"
	# The key reaches awk through its environment, not argv (visible in ps).
	(umask 077; SESSION_KEY="k1:$(openssl rand -base64 32)" \
		VARIABLE_KEY="k1:$(openssl rand -base64 32)" awk '
		/^SESSION_ENCRYPTION_KEY=/ { print "SESSION_ENCRYPTION_KEY=" ENVIRON["SESSION_KEY"]; next }
		/^VARIABLE_ENCRYPTION_KEY=/ { print "VARIABLE_ENCRYPTION_KEY=" ENVIRON["VARIABLE_KEY"]; next }
		{ print }' "$INFRA_DIR/.env.production.example" >"$ENV_FILE")
	echo "wrote $ENV_FILE (fill in the empty secrets before deploying)"
fi
# Files seeded before HOST existed: add the loopback default, never change a set value.
if ! grep -q '^HOST=' "$ENV_FILE"; then
	printf '\n# Interface of both servers (loopback: reachable through nginx only).\nHOST=127.0.0.1\n' >>"$ENV_FILE"
	echo "added HOST=127.0.0.1 to $ENV_FILE"
fi
# Files seeded before secret variables existed: add a fresh key, never
# change a set one (losing it loses every secret variable for good).
if ! grep -q '^VARIABLE_ENCRYPTION_KEY=.' "$ENV_FILE"; then
	sed -i '/^VARIABLE_ENCRYPTION_KEY=$/d' "$ENV_FILE"
	# printf is a builtin: the key never shows in ps.
	printf '\n# Secret environment and global variables at rest (keep a copy).\nVARIABLE_ENCRYPTION_KEY=%s\n' \
		"k1:$(openssl rand -base64 32)" >>"$ENV_FILE"
	echo "added VARIABLE_ENCRYPTION_KEY to $ENV_FILE"
fi
chown root:"$APP_USER" "$ENV_FILE"
chmod 640 "$ENV_FILE"

# Only the backup log: api.out.log/api.err.log belong to pm2-logrotate, and
# rotating them here too would rotate them twice.
cat >/etc/logrotate.d/localman <<ROTATE
# Managed by infra/localman/setup-server.sh (localman-next).
$LOG_DIR/backup.log {
    weekly
    rotate 8
    maxsize 500M
    compress
    delaycompress
    missingok
    notifempty
    copytruncate
}
ROTATE
if [ ! -d /root/.pm2/modules/pm2-logrotate ]; then
	echo "warning: pm2-logrotate is not installed; $LOG_DIR/api.*.log will grow unbounded (pm2 install pm2-logrotate)" >&2
fi

# 02:45 server time, 15 minutes after the IdP's 02:30 backup.
cat >/etc/cron.d/localman-backup <<CRON
# Managed by infra/localman/setup-server.sh (localman-next).
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
45 2 * * * root bash $APP_DIR/infra/backup-localman-db.sh >> $LOG_DIR/backup.log 2>&1
CRON
chmod 644 /etc/logrotate.d/localman /etc/cron.d/localman-backup

# pm2 resurrects the saved process list at boot (shared with the other apps).
if ! systemctl is-enabled --quiet pm2-root.service 2>/dev/null; then
	pm2 startup systemd -u root --hp /root
fi

# SELinux: nginx must read the static web app of every release under /opt
# (activate-release.sh runs restorecon on each new release).
WEB_CONTEXT="$APP_DIR/releases/[^/]+/web(/.*)?"
if command -v getenforce >/dev/null && [ "$(getenforce)" = Enforcing ]; then
	if command -v semanage >/dev/null; then
		semanage fcontext -a -t httpd_sys_content_t "$WEB_CONTEXT" 2>/dev/null ||
			semanage fcontext -m -t httpd_sys_content_t "$WEB_CONTEXT"
		restorecon -R "$APP_DIR/releases"
	else
		echo "warning: SELinux is enforcing but semanage is missing; label $WEB_CONTEXT httpd_sys_content_t" >&2
	fi
	if [ "$(getsebool httpd_can_network_connect 2>/dev/null | awk '{print $NF}')" != on ]; then
		echo "warning: httpd_can_network_connect is off; nginx may not reach 127.0.0.1:4000/4100" >&2
	fi
fi

# Exposure of the internal ports: reported only, never changed here (the
# firewall is shared with the other apps). The API (4000, 4100) and
# mongod-localman (27018) must listen on loopback only and stay closed from
# outside; check from another machine too (docs/deployment-guide.md).
for port in 4000 4100 27018; do
	while read -r address; do
		case "$address" in
		127.0.0.1:* | "[::1]:"* | "::1:"*) ;;
		*) echo "warning: port $port listens on $address, not loopback only" >&2 ;;
		esac
	done < <(ss -ltnH "sport = :$port" 2>/dev/null | awk '{print $4}')
done
if command -v firewall-cmd >/dev/null && firewall-cmd --state >/dev/null 2>&1; then
	opened="$(firewall-cmd --list-ports 2>/dev/null)"
	for port in 4000 4100 27018; do
		if grep -qw "$port/tcp" <<<"$opened"; then
			echo "warning: firewalld opens $port/tcp to the outside; close it" >&2
		fi
	done
fi

echo "setup-server done"
