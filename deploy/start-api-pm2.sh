#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="${PROJECT_DIR:-$(cd "$SCRIPT_DIR/.." && pwd)}"

cd "$PROJECT_DIR"
npm run build
pm2 startOrReload deploy/pm2-egmathteacher.config.cjs
pm2 save

echo "PM2 API process is running on port 3000 as egmathteacher-api"
