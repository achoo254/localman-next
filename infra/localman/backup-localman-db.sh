#!/bin/bash
# Daily dump of the `localman` database from mongod-localman (127.0.0.1:27018)
# with the app user of /opt/localman/.env; keeps the 14 newest archives.
# Any failure (mongodump missing, empty MONGO_URI, dump error) sends a
# Telegram message to OWNER_TELEGRAM_CHAT_ID through Localman's bot, both read
# from the same .env; the bot token goes to curl through stdin, never argv.
# Archives stay on this server only (no off-site copy yet).
# Cron (root, /etc/cron.d/localman-backup written by setup-server.sh):
#   45 2 * * * root bash /opt/localman/infra/backup-localman-db.sh >> /var/log/localman/backup.log 2>&1
set -euo pipefail
cd /opt/localman
umask 077
KEEP=14
STAMP="$(date +%Y%m%d-%H%M%S)"
CONFIG=""
PARTIAL=""

env_value() { # <name>: last value in .env, surrounding double quotes removed
	local value
	value="$(sed -n "s/^$1=//p" .env 2>/dev/null | tail -n 1)"
	value="${value#\"}"
	printf '%s' "${value%\"}"
}

alert_owner() { # <exit status>
	local token chat
	token="$(env_value TELEGRAM_BOT_TOKEN)"
	chat="$(env_value OWNER_TELEGRAM_CHAT_ID)"
	if [ -z "$token" ] || [ -z "$chat" ]; then
		echo "$(date -Is) no TELEGRAM_BOT_TOKEN/OWNER_TELEGRAM_CHAT_ID: owner not alerted" >&2
		return 0
	fi
	printf 'url = "https://api.telegram.org/bot%s/sendMessage"\n' "$token" |
		curl -fsS --max-time 15 -o /dev/null --config - \
			--data-urlencode "chat_id=$chat" \
			--data-urlencode "text=Localman: backup MongoDB lỗi trên $(hostname) lúc $(date '+%Y-%m-%d %H:%M') (exit $1). Xem /var/log/localman/backup.log" ||
		echo "$(date -Is) Telegram alert failed" >&2
}

on_exit() {
	local status=$?
	rm -f "$CONFIG" "$PARTIAL"
	if [ "$status" -ne 0 ]; then
		echo "$(date -Is) backup localman-$STAMP FAILED (exit $status)" >&2
		alert_owner "$status" || true
	fi
	exit "$status"
}
trap on_exit EXIT

command -v mongodump >/dev/null || { echo "$(date -Is) mongodump is not installed" >&2; exit 1; }
URI="$(env_value MONGO_URI)"
[ -n "$URI" ] || { echo "$(date -Is) MONGO_URI is empty in /opt/localman/.env" >&2; exit 1; }

# The URI holds the password, so it goes in a private config file, not argv.
CONFIG="$(mktemp)"
PARTIAL="backups/localman-$STAMP.archive.gz.partial"
printf 'uri: "%s"\n' "$URI" >"$CONFIG"
mongodump --quiet --config="$CONFIG" --archive="$PARTIAL" --gzip
mv "$PARTIAL" "backups/localman-$STAMP.archive.gz"
PARTIAL=""

# Stamps sort chronologically; drop everything after the newest $KEEP.
find backups -maxdepth 1 -name 'localman-*.archive.gz' -printf '%f\n' |
	sort -r | tail -n +"$((KEEP + 1))" |
	while IFS= read -r old; do rm -f -- "backups/$old"; done
echo "$(date -Is) backup localman-$STAMP ok"
