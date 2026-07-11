#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SOURCE_DIR="$ROOT_DIR/.ai/project/diagrams"
OUTPUT_DIR="$SOURCE_DIR/rendered"
PUPPETEER_CONFIG="$SOURCE_DIR/puppeteer-config.json"
MMDC="${MMDC:-$ROOT_DIR/node_modules/.bin/mmdc}"
HASH_MANIFEST="$OUTPUT_DIR/source-hashes.sha256"

mkdir -p "$OUTPUT_DIR"

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

for source in "${sources[@]}"; do
  name="$(basename "$source" .mmd)"
  output="$OUTPUT_DIR/$name.svg"
  echo "Rendering $source -> $output"
  "$MMDC" \
    --quiet \
    --theme neutral \
    --backgroundColor white \
    --puppeteerConfigFile "$PUPPETEER_CONFIG" \
    --input "$source" \
    --output "$output"
done

(
  cd "$SOURCE_DIR"
  sha256sum ./*.mmd | sort
) > "$HASH_MANIFEST"

echo "Rendered ${#sources[@]} diagram(s) into $OUTPUT_DIR"
