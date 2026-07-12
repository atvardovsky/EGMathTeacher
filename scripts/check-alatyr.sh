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
  ".ai/framework/context-router.md"
  ".ai/project/README.md"
  ".ai/project/blueprint.md"
  ".ai/project/contour.md"
  ".ai/project/source-of-truth-registry.md"
  ".ai/project/gaps.md"
  ".ai/project/validation.md"
  ".ai/project/security-safety.md"
  ".ai/project/diagrams.md"
  ".ai/assistant/context-router.json"
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

context_router_reference_files=(
  "AGENTS.md"
  "AI_ASSISTANTS.md"
  ".ai/alatyr.yaml"
  ".ai/README.md"
  ".ai/assistant/context-profiles.md"
  ".ai/assistant/gates/checklist.md"
  ".ai/assistant/flows/operation-routing.flow.md"
  ".ai/assistant/templates/operation-request.md"
)

for path in "${context_router_reference_files[@]}"; do
  if ! grep -q 'context-router.json' "$path"; then
    fail "$path does not reference .ai/assistant/context-router.json"
  fi
done

node <<'NODE'
const fs = require('fs');
const routerPath = '.ai/assistant/context-router.json';
const profilesPath = '.ai/assistant/context-profiles.md';
const router = JSON.parse(fs.readFileSync(routerPath, 'utf8'));
const requiredBootstrap = [
  'AGENTS.md',
  '.ai/alatyr.yaml',
  '.ai/README.md',
  '.ai/assistant/context-router.json',
  '.ai/assistant/context-profiles.md',
  '.ai/assistant/module-profile.md',
  '.ai/project/contour.md',
  '.ai/project/source-of-truth-registry.md',
  '.ai/assistant/contour.md',
  '.ai/project/blueprint.md',
];
const profiles = [
  'docs-local',
  'code-local',
  'business-change',
  'architecture-change',
  'data-change',
  'security-sensitive',
  'ai-infrastructure',
  'framework-upgrade',
];
const fields = [
  'use_when',
  'required_context',
  'expand_when',
  'approval_gates',
  'validation',
  'final_evidence',
];
const failures = [];
if (router.schema_version !== 1) {
  failures.push('context-router schema_version must be 1');
}
if (router.router_kind !== 'target-context-router') {
  failures.push('context-router router_kind must be target-context-router');
}
if (router.human_reference !== profilesPath) {
  failures.push('context-router human_reference must point to context-profiles.md');
}
for (const path of requiredBootstrap) {
  if (!router.bootstrap_context?.includes(path)) {
    failures.push(`context-router bootstrap_context missing ${path}`);
  }
}
if (JSON.stringify(router.routing_order) !== JSON.stringify(profiles)) {
  failures.push('context-router routing_order must match canonical profile order');
}
const markdown = fs.readFileSync(profilesPath, 'utf8');
for (const profile of profiles) {
  if (!markdown.includes(`## Profile: \`${profile}\``)) {
    failures.push(`context-profiles.md missing profile ${profile}`);
  }
  const entry = router.profiles?.[profile];
  if (!entry || typeof entry !== 'object') {
    failures.push(`context-router missing profile ${profile}`);
    continue;
  }
  for (const field of fields) {
    if (!Array.isArray(entry[field]) || entry[field].length === 0) {
      failures.push(`context-router profile ${profile} missing non-empty ${field}`);
    }
  }
}
if (failures.length > 0) {
  for (const failure of failures) {
    console.error(`Alatyr check failed: ${failure}`);
  }
  process.exit(1);
}
NODE
if [ "$?" -ne 0 ]; then
  failures=$((failures + 1))
fi

node <<'NODE'
const fs = require('fs');
const failures = [];

const manifest = fs.readFileSync('.ai/alatyr.yaml', 'utf8');
const ownerMatch = manifest.match(/^owner:\n([\s\S]*?)(?=^[a-zA-Z0-9_]+:|\z)/m);
if (!ownerMatch) {
  failures.push('.ai/alatyr.yaml missing owner block');
} else {
  const ownerBlock = ownerMatch[1];
  const requiredOwnerFields = [
    'responsible_team',
    'technical_owner',
    'backup_owner',
    'last_review_date',
    'review_cadence',
    'codeowners',
  ];
  for (const field of requiredOwnerFields) {
    const match = ownerBlock.match(new RegExp(`^\\s+${field}:\\s*"?([^"\\n]+)"?\\s*$`, 'm'));
    const value = match?.[1]?.trim();
    if (!value) {
      failures.push(`.ai/alatyr.yaml owner.${field} is required`);
    }
    if (field === 'backup_owner' && value?.toLowerCase() === 'not defined') {
      failures.push('.ai/alatyr.yaml owner.backup_owner must not be "not defined"');
    }
    if (
      field === 'backup_owner' &&
      value?.toLowerCase().includes('unassigned') &&
      !manifest.includes('Backup owner remains unassigned')
    ) {
      failures.push('unassigned backup owner must be recorded in known_gaps');
    }
  }
}

const profilesPath = '.ai/assistant/context-profiles.md';
const profilesMarkdown = fs.readFileSync(profilesPath, 'utf8');
const profilePattern = /^## Profile: `([^`]+)`\n([\s\S]*?)(?=^## Profile: `|\z)/gm;
for (const match of profilesMarkdown.matchAll(profilePattern)) {
  const profileName = match[1];
  const body = match[2];
  const refs = [];
  let inRequiredContext = false;
  for (const line of body.split('\n')) {
    if (line.trim() === 'Required context:') {
      inRequiredContext = true;
      continue;
    }
    if (!inRequiredContext) {
      continue;
    }
    if (line.startsWith('- ')) {
      refs.push(line.trim());
      continue;
    }
    if (line.trim() === '') {
      continue;
    }
    if (!line.startsWith('  ')) {
      break;
    }
  }

  const seen = new Set();
  for (const ref of refs) {
    if (seen.has(ref)) {
      failures.push(`${profilesPath} profile ${profileName} has duplicate reference ${ref}`);
    }
    seen.add(ref);
  }
}

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(`Alatyr check failed: ${failure}`);
  }
  process.exit(1);
}
NODE
if [ "$?" -ne 0 ]; then
  failures=$((failures + 1))
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
  "checker not found"
  "local Alatyr checker was found"
  "no CI or local Alatyr checker"
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
    >/dev/null; then
    fail "stale current-gap text found for pattern: $pattern"
  fi
done

if rg -n '/home/' .ai -g '!*.svg' >/dev/null; then
  fail "hardcoded /home path found under .ai"
fi

if [ "$failures" -gt 0 ]; then
  exit 1
fi

echo "Alatyr consistency check passed."
