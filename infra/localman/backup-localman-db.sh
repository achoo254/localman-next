#!/bin/bash
# Daily dump of the `localman` database from mongod-localman (127.0.0.1:27018)
# with the app user of /opt/localman/.env; keeps the 14 newest archives.
# Cron (root, /etc/cron.d/localman-backup written by setup-server.sh):
#   45 2 * * * root bash /opt/localman/infra/backup-localman-db.sh >> /var/log/localman/backup.log 2>&1
set -euo pipefail
cd /opt/localman
umask 077
KEEP=14
STAMP="$(date +%Y%m%d-%H%M%S)"

URI="$(sed -n 's/^MONGO_URI=//p' .env | tail -n 1)"
URI="${URI#\"}"
URI="${URI%\"}"
[ -n "$URI" ] || { echo "$(date -Is) MONGO_URI is empty in /opt/localman/.env" >&2; exit 1; }

# The URI holds the password, so it goes in a private config file, not argv.
CONFIG="$(mktemp)"
PARTIAL="backups/localman-$STAMP.archive.gz.partial"
trap 'rm -f "$CONFIG" "$PARTIAL"' EXIT
printf 'uri: "%s"\n' "$URI" >"$CONFIG"
mongodump --quiet --config="$CONFIG" --archive="$PARTIAL" --gzip
mv "$PARTIAL" "backups/localman-$STAMP.archive.gz"

# Stamps sort chronologically; drop everything after the newest $KEEP.
find backups -maxdepth 1 -name 'localman-*.archive.gz' -printf '%f\n' |
	sort -r | tail -n +"$((KEEP + 1))" |
	while IFS= read -r old; do rm -f -- "backups/$old"; done
echo "$(date -Is) backup localman-$STAMP ok"
