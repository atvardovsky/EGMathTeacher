#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

failures=0

fail() {
  echo "Alatyr check failed: $*" >&2
  failures=$((failures + 1))
}

require_file() {
  local path="$1"
  if [ ! -f "$path" ]; then
    fail "missing file $path"
  fi
}

require_dir() {
  local path="$1"
  if [ ! -d "$path" ]; then
    fail "missing directory $path"
  fi
}

required_files=(
  "AGENTS.md"
  "AI_ASSISTANTS.md"
  "README.md"
  "package.json"
  ".github/CODEOWNERS"
  ".github/workflows/ci.yml"
  "playwright.config.ts"
  ".ai/alatyr.yaml"
  ".ai/README.md"
  ".ai/project/README.md"
  ".ai/project/blueprint.md"
  ".ai/project/contour.md"
  ".ai/project/source-of-truth-registry.md"
  ".ai/project/gaps.md"
  ".ai/project/validation.md"
  ".ai/project/security-safety.md"
  ".ai/project/diagrams.md"
  ".ai/assistant/context-profiles.md"
  ".ai/assistant/module-profile.md"
  ".ai/assistant/contour.md"
  ".ai/assistant/gates/checklist.md"
  ".ai/assistant/infrastructure-index.md"
  "apps/web/e2e/app.spec.ts"
  ".ai/project/diagrams/rendered/source-hashes.sha256"
)

required_dirs=(
  ".ai/framework"
  ".ai/project"
  ".ai/assistant"
  ".ai/project/diagrams"
  ".ai/project/diagrams/rendered"
)

for path in "${required_files[@]}"; do
  require_file "$path"
done

for path in "${required_dirs[@]}"; do
  require_dir "$path"
done

node <<'NODE'
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const required = [
  'build',
  'test',
  'lint',
  'diagrams:render',
  'diagrams:check',
  'smoke:dev',
  'alatyr:check',
  'e2e',
];
const missing = required.filter((script) => !pkg.scripts?.[script]);
if (missing.length > 0) {
  console.error(`Alatyr check failed: missing package script(s): ${missing.join(', ')}`);
  process.exit(1);
}
NODE
if [ "$?" -ne 0 ]; then
  failures=$((failures + 1))
fi

if ! grep -q '@atvardovsky' .github/CODEOWNERS; then
  fail ".github/CODEOWNERS does not name @atvardovsky"
fi

if ! grep -q 'npm run alatyr:check' .github/workflows/ci.yml; then
  fail "CI workflow does not run npm run alatyr:check"
fi

if ! grep -q 'npm run e2e' .github/workflows/ci.yml; then
  fail "CI workflow does not run npm run e2e"
fi

if ! grep -q 'npm run alatyr:check' AGENTS.md; then
  fail "AGENTS.md does not mention npm run alatyr:check"
fi

if ! grep -q 'npm run e2e' AGENTS.md; then
  fail "AGENTS.md does not mention npm run e2e"
fi

current_manifest="$(mktemp)"
trap 'rm -f "$current_manifest"' EXIT
(
  cd .ai/project/diagrams
  sha256sum ./*.mmd | sort
) > "$current_manifest"
if ! diff -u .ai/project/diagrams/rendered/source-hashes.sha256 "$current_manifest" >/dev/null; then
  fail "diagram source hash manifest is stale; run npm run diagrams:render"
fi

stale_patterns=(
  "No local Alatyr consistency checker"
  "no local Alatyr consistency checker"
  "No CODEOWNERS file is installed"
  "no CODEOWNERS"
  "No browser E2E command was found"
  "No browser end-to-end tests were found"
  "No automated browser end-to-end tests"
  "No production database migration system"
)

for pattern in "${stale_patterns[@]}"; do
  if rg -n "$pattern" \
    .ai AGENTS.md AI_ASSISTANTS.md README.md \
    -g '!**/reports/**' \
    -g '!**/approvals/**' \
    >/dev/null; then
    fail "stale current-gap text found for pattern: $pattern"
  fi
done

if [ "$failures" -gt 0 ]; then
  exit 1
fi

echo "Alatyr consistency check passed."
