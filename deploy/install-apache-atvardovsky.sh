#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="${PROJECT_DIR:-$(cd "$SCRIPT_DIR/.." && pwd)}"
SERVER_NAME="${SERVER_NAME:-atvardovsky.dev}"
SITE_NAME="${SITE_NAME:-000-atvardovsky-egmathteacher.conf}"
API_UPSTREAM="${API_UPSTREAM:-http://127.0.0.1:3000}"
CERT_DIR="${CERT_DIR:-/etc/letsencrypt/live/$SERVER_NAME}"
SOURCE_CONF="$PROJECT_DIR/deploy/apache-atvardovsky.dev.conf"
TARGET_CONF="/etc/apache2/sites-available/$SITE_NAME"
SERVER_NAME_REGEX="${SERVER_NAME//./\\.}"

if [[ ! -f "$CERT_DIR/fullchain.pem" && -d "/etc/letsencrypt/live/$SERVER_NAME-0001" ]]; then
  CERT_DIR="/etc/letsencrypt/live/$SERVER_NAME-0001"
fi

if [[ $EUID -ne 0 ]]; then
  echo "Run with sudo: sudo bash <repository-root>/deploy/install-apache-atvardovsky.sh" >&2
  exit 1
fi

cd "$PROJECT_DIR"

rendered_conf="$(mktemp)"
trap 'rm -f "$rendered_conf"' EXIT

sed \
  -e "s|@@PROJECT_DIR@@|$PROJECT_DIR|g" \
  -e "s|@@SERVER_NAME@@|$SERVER_NAME|g" \
  -e "s|@@SERVER_NAME_REGEX@@|$SERVER_NAME_REGEX|g" \
  -e "s|@@API_UPSTREAM@@|$API_UPSTREAM|g" \
  -e "s|@@CERT_FULLCHAIN@@|$CERT_DIR/fullchain.pem|g" \
  -e "s|@@CERT_PRIVATE_KEY@@|$CERT_DIR/privkey.pem|g" \
  "$SOURCE_CONF" > "$rendered_conf"

cp "$rendered_conf" "$TARGET_CONF"

a2enmod rewrite headers proxy proxy_http ssl
a2ensite "$SITE_NAME"

apache2ctl configtest
systemctl reload apache2

echo "Apache routing installed for https://$SERVER_NAME"
