#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="<TARGET_REPOSITORY_ROOT>"
SITE_NAME="000-atvardovsky-egmathteacher.conf"
SOURCE_CONF="$PROJECT_DIR/deploy/apache-atvardovsky.dev.conf"
TARGET_CONF="/etc/apache2/sites-available/$SITE_NAME"

if [[ $EUID -ne 0 ]]; then
  echo "Run with sudo: sudo bash $PROJECT_DIR/deploy/install-apache-atvardovsky.sh" >&2
  exit 1
fi

cd "$PROJECT_DIR"

cp "$SOURCE_CONF" "$TARGET_CONF"

a2enmod rewrite headers proxy proxy_http ssl
a2ensite "$SITE_NAME"

apache2ctl configtest
systemctl reload apache2

echo "Apache routing installed for https://atvardovsky.dev"
