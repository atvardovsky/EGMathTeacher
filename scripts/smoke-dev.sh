#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${SMOKE_BASE_URL:-https://localhost:5137}"
INSECURE_TLS="${SMOKE_INSECURE_TLS:-true}"

curl_args=(--fail --silent --show-error)
if [ "$INSECURE_TLS" = "true" ]; then
  curl_args+=("--insecure")
fi

curl "${curl_args[@]}" --head "$BASE_URL/" >/dev/null
health_payload="$(curl "${curl_args[@]}" "$BASE_URL/health")"

case "$health_payload" in
  *'"status":"ok"'*)
    echo "Dev smoke passed for $BASE_URL"
    ;;
  *)
    echo "Unexpected health payload from $BASE_URL/health: $health_payload" >&2
    exit 1
    ;;
esac
