#!/bin/bash
# Installs Localman's own mongod on the server: a single-node replica set
# (transactions need one) on 127.0.0.1:27018 with access control, apart from
# the shared mongod on 27017, which is never touched. Run as root;
# idempotent (config, unit and users are reconciled on every run).
#
#   MONGO_ADMIN_PASSWORD=... MONGO_APP_PASSWORD=... bash setup-mongo-localman.sh
#   bash setup-mongo-localman.sh < passwords   # line 1: admin, line 2: app
#   bash setup-mongo-localman.sh --config-only # config/unit/logrotate only
#     (restarts mongod when they changed; no passwords, users untouched)
#
# Passwords come from the environment or stdin, never argv, and are never
# printed. The app password goes into MONGO_URI, so it is limited to
# URL-safe characters (e.g. `openssl rand -hex 24`).
# First run: mongod starts with auth and the keyFile, the localhost exception
# lets this script initiate the replica set and create the first (admin)
# user; afterwards everything authenticates as that admin.
set -euo pipefail

PORT=27018
REPLSET=rs-localman
MEMBER="127.0.0.1:$PORT"
CONF=/etc/mongod-localman.conf
KEYFILE=/etc/mongod-localman.key
DBPATH=/var/lib/mongodb-localman
LOGDIR=/var/log/mongodb-localman
UNIT=/etc/systemd/system/mongod-localman.service
LOGROTATE=/etc/logrotate.d/mongod-localman
ADMIN_USER="${MONGO_ADMIN_USER:-localman_admin}"
APP_USER=localman
APP_DB=localman

die() { echo "setup-mongo-localman: $*" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || die "run as root"
MONGOD_BIN="$(command -v mongod)" || die "mongod is not installed"
command -v mongosh >/dev/null || die "mongosh is not installed"
command -v openssl >/dev/null || die "openssl is not installed"

# Service account of the distro package: mongod (RHEL) or mongodb (Debian).
if [ -z "${MONGO_OS_USER:-}" ]; then
	if id mongod >/dev/null 2>&1; then MONGO_OS_USER=mongod
	elif id mongodb >/dev/null 2>&1; then MONGO_OS_USER=mongodb
	else die "no mongod/mongodb system user; set MONGO_OS_USER"
	fi
fi

read_secret() { # <variable> <prompt>
	if [ -n "${!1:-}" ]; then return; fi
	local value=""
	if [ -t 0 ]; then
		IFS= read -r -s -p "$2: " value || true
		echo >&2
	else
		IFS= read -r value || true
	fi
	printf -v "$1" '%s' "$value"
}
CONFIG_ONLY=0
case "${1:-}" in
"") ;;
--config-only) CONFIG_ONLY=1 ;;
*) die "usage: setup-mongo-localman.sh [--config-only]" ;;
esac

if [ "$CONFIG_ONLY" -eq 0 ]; then
	read_secret MONGO_ADMIN_PASSWORD "Mongo admin password ($ADMIN_USER)"
	read_secret MONGO_APP_PASSWORD "Mongo app password ($APP_USER)"
	[ "${#MONGO_ADMIN_PASSWORD}" -ge 16 ] || die "admin password must be at least 16 characters"
	[[ "$MONGO_APP_PASSWORD" =~ ^[A-Za-z0-9._~-]{24,}$ ]] ||
		die "app password must be 24+ URL-safe characters [A-Za-z0-9._~-]"
fi

changed=0
install_if_changed() { # <temp-file> <destination> <mode>
	if ! cmp -s "$1" "$2"; then
		install -m "$3" -o root -g root "$1" "$2"
		changed=1
		echo "wrote $2"
	fi
	rm -f "$1"
}

install -d -m 750 -o "$MONGO_OS_USER" -g "$MONGO_OS_USER" "$DBPATH" "$LOGDIR"

# Internal authentication between members; required with replSet + auth.
if [ ! -s "$KEYFILE" ]; then
	(umask 077; openssl rand -base64 756 >"$KEYFILE")
	changed=1
	echo "generated $KEYFILE"
fi
chown "$MONGO_OS_USER:$MONGO_OS_USER" "$KEYFILE"
chmod 400 "$KEYFILE"

tmp="$(mktemp)"
cat >"$tmp" <<CONF
# Managed by infra/localman/setup-mongo-localman.sh (localman-next);
# local edits are overwritten on the next run.
storage:
  dbPath: $DBPATH
  wiredTiger:
    engineConfig:
      cacheSizeGB: 0.25
systemLog:
  destination: file
  path: $LOGDIR/mongod.log
  logAppend: true
  logRotate: reopen
net:
  port: $PORT
  bindIp: 127.0.0.1
replication:
  replSetName: $REPLSET
security:
  authorization: enabled
  keyFile: $KEYFILE
CONF
install_if_changed "$tmp" "$CONF" 644

tmp="$(mktemp)"
cat >"$tmp" <<UNIT
# Managed by infra/localman/setup-mongo-localman.sh (localman-next).
[Unit]
Description=MongoDB for Localman (replica set $REPLSET on $MEMBER)
After=network-online.target
Wants=network-online.target

[Service]
User=$MONGO_OS_USER
Group=$MONGO_OS_USER
ExecStart=$MONGOD_BIN --config $CONF
Restart=on-failure
RestartSec=5
TimeoutStopSec=60
LimitNOFILE=64000
LimitNPROC=64000
# Sandbox: /usr, /boot and /etc read-only (dbPath and the log live under
# /var, which stays writable; the keyFile in /etc is only read), no access to
# /home, /root or devices beyond null/zero/urandom, read-only /proc/sys and
# cgroups (mongod only reads them), new files private to the service user.
PrivateTmp=true
NoNewPrivileges=true
ProtectSystem=full
ProtectHome=true
PrivateDevices=true
ProtectKernelTunables=true
ProtectControlGroups=true
RestrictSUIDSGID=true
LockPersonality=true
UMask=0077

[Install]
WantedBy=multi-user.target
UNIT
install_if_changed "$tmp" "$UNIT" 644
# A new keyFile, config or unit needs a restart; the logrotate file does not.
restart_needed=$changed

tmp="$(mktemp)"
cat >"$tmp" <<ROTATE
$LOGDIR/mongod.log {
    weekly
    rotate 8
    maxsize 500M
    compress
    delaycompress
    missingok
    notifempty
    sharedscripts
    postrotate
        systemctl kill -s USR1 mongod-localman.service >/dev/null 2>&1 || true
    endscript
}
ROTATE
install_if_changed "$tmp" "$LOGROTATE" 644

# With the MongoDB SELinux policy loaded, label the non-default port and paths.
if command -v getenforce >/dev/null && [ "$(getenforce)" = Enforcing ] &&
	command -v semanage >/dev/null && semanage port -l | grep -q '^mongod_port_t'; then
	semanage port -a -t mongod_port_t -p tcp "$PORT" 2>/dev/null ||
		semanage port -m -t mongod_port_t -p tcp "$PORT"
	semanage fcontext -a -t mongod_var_lib_t "$DBPATH(/.*)?" 2>/dev/null ||
		semanage fcontext -m -t mongod_var_lib_t "$DBPATH(/.*)?"
	semanage fcontext -a -t mongod_log_t "$LOGDIR(/.*)?" 2>/dev/null ||
		semanage fcontext -m -t mongod_log_t "$LOGDIR(/.*)?"
	restorecon -R "$DBPATH" "$LOGDIR"
fi

systemctl daemon-reload
systemctl enable mongod-localman.service >/dev/null
if [ "$restart_needed" -eq 1 ] && systemctl is-active --quiet mongod-localman.service; then
	systemctl restart mongod-localman.service
else
	systemctl start mongod-localman.service
fi

URI="mongodb://$MEMBER/admin?directConnection=true"
for _ in $(seq 1 30); do
	if mongosh --quiet --norc "$URI" --eval 'db.adminCommand({ ping: 1 }).ok' >/dev/null 2>&1; then
		break
	fi
	sleep 1
done
mongosh --quiet --norc "$URI" --eval 'db.adminCommand({ ping: 1 }).ok' >/dev/null 2>&1 ||
	die "mongod-localman does not answer on $MEMBER (journalctl -u mongod-localman, $LOGDIR/mongod.log)"

if [ "$CONFIG_ONLY" -eq 1 ]; then
	echo "mongod-localman config reconciled and answering on $MEMBER (users untouched)"
	exit 0
fi

# Replica set, admin user (localhost exception on the first run), app user.
read -r -d '' INIT_JS <<'JS' || true
const env = process.env;
const admin = db.getSiblingDB("admin");
const hello = admin.runCommand({ hello: 1 });
if (!hello.setName) {
	const result = admin.runCommand({
		replSetInitiate: { _id: env.REPLSET, members: [{ _id: 0, host: env.MEMBER }] },
	});
	if (result.ok !== 1) throw new Error(`replSetInitiate failed: ${result.codeName}`);
	print(`initiated replica set ${env.REPLSET}`);
} else if (hello.setName !== env.REPLSET) {
	throw new Error(`mongod belongs to replica set ${hello.setName}, expected ${env.REPLSET}`);
}
for (let i = 0; i < 60 && !admin.runCommand({ hello: 1 }).isWritablePrimary; i++) sleep(1000);
if (!admin.runCommand({ hello: 1 }).isWritablePrimary) throw new Error("no primary after 60 s");

function authenticate() {
	try {
		return admin.auth(env.ADMIN_USER, env.ADMIN_PASSWORD).ok === 1;
	} catch {
		return false;
	}
}
if (!authenticate()) {
	try {
		admin.createUser({
			user: env.ADMIN_USER,
			pwd: env.ADMIN_PASSWORD,
			roles: [{ role: "root", db: "admin" }],
		});
		print(`created admin user ${env.ADMIN_USER}`);
	} catch {
		throw new Error(
			`cannot log in as ${env.ADMIN_USER} and users already exist: wrong admin password?`,
		);
	}
	if (!authenticate()) throw new Error("admin authentication failed after creating the user");
}

const target = db.getSiblingDB(env.APP_DB);
const roles = [{ role: "readWrite", db: env.APP_DB }];
if (target.getUser(env.APP_USER)) {
	target.updateUser(env.APP_USER, { pwd: env.APP_PASSWORD, roles });
	print(`updated user ${env.APP_USER} (readWrite on ${env.APP_DB})`);
} else {
	target.createUser({ user: env.APP_USER, pwd: env.APP_PASSWORD, roles });
	print(`created user ${env.APP_USER} (readWrite on ${env.APP_DB})`);
}
JS

# Credentials travel through the environment of mongosh only, never argv.
REPLSET="$REPLSET" MEMBER="$MEMBER" APP_DB="$APP_DB" APP_USER="$APP_USER" \
	ADMIN_USER="$ADMIN_USER" ADMIN_PASSWORD="$MONGO_ADMIN_PASSWORD" \
	APP_PASSWORD="$MONGO_APP_PASSWORD" \
	mongosh --quiet --norc "$URI" --eval "$INIT_JS"

echo "mongod-localman ready on $MEMBER. In /opt/localman/.env:"
echo "  MONGO_URI=mongodb://$APP_USER:<app-password>@$MEMBER/$APP_DB?replicaSet=$REPLSET&authSource=$APP_DB"
