#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="<TARGET_REPOSITORY_ROOT>"

cd "$PROJECT_DIR"
npm run build
pm2 startOrReload deploy/pm2-egmathteacher.config.cjs
pm2 save

echo "PM2 API process is running on port 3000 as egmathteacher-api"
