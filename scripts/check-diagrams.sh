#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SOURCE_DIR="$ROOT_DIR/.ai/project/diagrams"
EXPECTED_DIR="$SOURCE_DIR/rendered"
PUPPETEER_CONFIG="$SOURCE_DIR/puppeteer-config.json"
MMDC="${MMDC:-$ROOT_DIR/node_modules/.bin/mmdc}"
HASH_MANIFEST="$EXPECTED_DIR/source-hashes.sha256"
TMP_DIR="$(mktemp -d)"

cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

if [ ! -x "$MMDC" ]; then
  echo "Mermaid CLI not found at $MMDC. Run npm install first." >&2
  exit 1
fi

shopt -s nullglob
sources=("$SOURCE_DIR"/*.mmd)

if [ "${#sources[@]}" -eq 0 ]; then
  echo "No Mermaid diagram sources found in $SOURCE_DIR" >&2
  exit 1
fi

if [ ! -f "$HASH_MANIFEST" ]; then
  echo "Missing diagram source hash manifest: $HASH_MANIFEST" >&2
  echo "Run npm run diagrams:render." >&2
  exit 1
fi

current_manifest="$TMP_DIR/source-hashes.sha256"
(
  cd "$SOURCE_DIR"
  sha256sum ./*.mmd | sort
) > "$current_manifest"

if ! diff -u "$HASH_MANIFEST" "$current_manifest" >/dev/null; then
  echo "Diagram source hash drift detected. Run npm run diagrams:render." >&2
  diff -u "$HASH_MANIFEST" "$current_manifest" >&2 || true
  exit 1
fi

for source in "${sources[@]}"; do
  name="$(basename "$source" .mmd)"
  expected="$EXPECTED_DIR/$name.svg"
  actual="$TMP_DIR/$name.svg"

  if [ ! -f "$expected" ]; then
    echo "Missing rendered diagram: $expected" >&2
    exit 1
  fi

  # Mermaid SVG output can include non-deterministic path data, so this check
  # validates source hashes and renderability instead of byte-comparing SVGs.
  "$MMDC" \
    --quiet \
    --theme neutral \
    --backgroundColor white \
    --puppeteerConfigFile "$PUPPETEER_CONFIG" \
    --input "$source" \
    --output "$actual"
done

echo "Diagram drift check passed for ${#sources[@]} diagram(s)."
