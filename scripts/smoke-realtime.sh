#!/usr/bin/env bash
set -euo pipefail

if [ "${REALTIME_SMOKE_LIVE:-false}" != "true" ]; then
  echo "Realtime smoke skipped. Set REALTIME_SMOKE_LIVE=true to run a live OpenAI Realtime WebRTC check."
  exit 0
fi

BASE_URL="${SMOKE_BASE_URL:-https://localhost:5137}"
INSECURE_TLS="${SMOKE_INSECURE_TLS:-true}"

SMOKE_BASE_URL="$BASE_URL" \
SMOKE_INSECURE_TLS="$INSECURE_TLS" \
node scripts/smoke-realtime-client.cjs
