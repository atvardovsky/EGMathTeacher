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
  ".ai/framework/ai-infrastructure-routing.md"
  ".ai/framework/consistency-model.md"
  ".ai/README.md"
  ".ai/framework/context-router.md"
  ".ai/framework/large-task-orchestration.md"
  ".ai/project/README.md"
  ".ai/project/blueprint.md"
  ".ai/project/contour.md"
  ".ai/project/source-of-truth-registry.md"
  ".ai/project/gaps.md"
  ".ai/project/validation.md"
  ".ai/project/security-safety.md"
  ".ai/project/diagrams.md"
  ".ai/assistant/context-router.json"
  ".ai/assistant/ai-infrastructure-router.json"
  ".ai/assistant/context-profiles.md"
  ".ai/assistant/module-profile.md"
  ".ai/assistant/contour.md"
  ".ai/assistant/flows/large-task-orchestration.flow.md"
  ".ai/assistant/gates/checklist.md"
  ".ai/assistant/infrastructure-index.md"
  ".ai/assistant/templates/ai-infrastructure-adaptation-record.md"
  ".ai/assistant/templates/large-task-operation-packet.md"
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

ai_router_reference_files=(
  "AGENTS.md"
  "AI_ASSISTANTS.md"
  ".ai/alatyr.yaml"
  ".ai/README.md"
  ".ai/assistant/context-router.json"
  ".ai/assistant/context-profiles.md"
  ".ai/assistant/help.md"
  ".ai/assistant/help-reference.md"
  ".ai/assistant/module-profile.md"
  ".ai/assistant/policies/ai-infrastructure-source-access.md"
  ".ai/assistant/templates/operation-request.md"
)

for path in "${ai_router_reference_files[@]}"; do
  if ! grep -q 'ai-infrastructure-router.json' "$path"; then
    fail "$path does not reference .ai/assistant/ai-infrastructure-router.json"
  fi
done

node <<'NODE'
const fs = require('fs');
const routerPath = '.ai/assistant/context-router.json';
const profilesPath = '.ai/assistant/context-profiles.md';
const router = JSON.parse(fs.readFileSync(routerPath, 'utf8'));
const requiredPreloaded = [
  'AGENTS.md',
];
const requiredBootstrap = [
  '.ai/alatyr.yaml',
  '.ai/README.md',
  '.ai/assistant/context-router.json',
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
if (router.schema_version !== 2) {
  failures.push('context-router schema_version must be 2');
}
if (router.router_kind !== 'target-context-router') {
  failures.push('context-router router_kind must be target-context-router');
}
if (router.human_reference !== profilesPath) {
  failures.push('context-router human_reference must point to context-profiles.md');
}
for (const path of requiredPreloaded) {
  if (!router.preloaded_context?.includes(path)) {
    failures.push(`context-router preloaded_context missing ${path}`);
  }
}
for (const path of requiredBootstrap) {
  if (!router.bootstrap_context?.includes(path)) {
    failures.push(`context-router bootstrap_context missing ${path}`);
  }
}
if (!router.context_budgets?.bootstrap || !router.context_budgets?.profile_default) {
  failures.push('context-router missing context_budgets bootstrap/profile_default');
}
if (!Array.isArray(router.context_receipt?.fields) || router.context_receipt.fields.length === 0) {
  failures.push('context-router missing context_receipt fields');
}
if (!Array.isArray(router.migration_routing?.candidate_context) || router.migration_routing.candidate_context.length === 0) {
  failures.push('context-router missing migration_routing candidate_context');
}
if (!router.task_scale_overlays?.['large-or-resumable']) {
  failures.push('context-router missing large-or-resumable task scale overlay');
}
if (!router.area_overlays?.['assistant-adapter']) {
  failures.push('context-router missing assistant-adapter area overlay');
}
if (JSON.stringify(router.routing_order) !== JSON.stringify(profiles)) {
  failures.push('context-router routing_order must match canonical profile order');
}
const checkArrayDuplicates = (name, arr) => {
  if (!Array.isArray(arr)) return;
  const seen = new Set();
  for (const value of arr) {
    const key = JSON.stringify(value);
    if (seen.has(key)) {
      failures.push(`${name} has duplicate reference ${key}`);
    }
    seen.add(key);
  }
};
checkArrayDuplicates('context-router preloaded_context', router.preloaded_context);
checkArrayDuplicates('context-router bootstrap_context', router.bootstrap_context);
checkArrayDuplicates('context-router routing_order', router.routing_order);
checkArrayDuplicates('context-router migration_routing.candidate_context', router.migration_routing?.candidate_context);
for (const [overlayName, overlay] of Object.entries(router.task_scale_overlays ?? {})) {
  checkArrayDuplicates(`context-router task_scale_overlays.${overlayName}.required_context`, overlay.required_context);
}
for (const [areaName, area] of Object.entries(router.area_overlays ?? {})) {
  checkArrayDuplicates(`context-router area_overlays.${areaName}.required_context`, area.required_context);
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
    checkArrayDuplicates(`context-router profile ${profile}.${field}`, entry[field]);
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
const path = '.ai/assistant/ai-infrastructure-router.json';
const router = JSON.parse(fs.readFileSync(path, 'utf8'));
const failures = [];
const requiredRoutes = [
  'inventory',
  'use-existing',
  'adapt-import',
  'gate-checker-change',
  'tool-mcp-change',
  'bridge-wrapper-change',
];
const requiredItems = [
  'operation-help',
  'local-alatyr-checker',
  'ui-implementation-skill',
  'root-bridge-files',
];
const checkArray = (name, arr) => {
  if (!Array.isArray(arr) || arr.length === 0) {
    failures.push(`${name} must be a non-empty array`);
    return;
  }
  const seen = new Set();
  for (const value of arr) {
    const key = JSON.stringify(value);
    if (seen.has(key)) {
      failures.push(`${name} has duplicate entry ${key}`);
    }
    seen.add(key);
  }
};
if (router.schema_version !== 1) {
  failures.push('AI infrastructure router schema_version must be 1');
}
if (router.router_kind !== 'target-ai-infrastructure-router') {
  failures.push('AI infrastructure router_kind must be target-ai-infrastructure-router');
}
if (router.inventory_template !== '.ai/assistant/templates/ai-infrastructure-inventory.md') {
  failures.push('AI infrastructure router inventory_template is not target canonical');
}
if (router.adaptation_record_template !== '.ai/assistant/templates/ai-infrastructure-adaptation-record.md') {
  failures.push('AI infrastructure router adaptation_record_template is not target canonical');
}
checkArray('AI infrastructure router routing_order', router.routing_order);
for (const route of requiredRoutes) {
  const entry = router.routes?.[route];
  if (!entry) {
    failures.push(`AI infrastructure router missing route ${route}`);
    continue;
  }
  for (const field of ['use_when', 'required_context', 'expand_when', 'allowed_actions', 'approval_gates', 'validation', 'final_evidence']) {
    checkArray(`AI infrastructure router route ${route}.${field}`, entry[field]);
  }
}
const ids = new Set();
for (const item of router.items ?? []) {
  if (!item.id) {
    failures.push('AI infrastructure router item missing id');
    continue;
  }
  if (ids.has(item.id)) {
    failures.push(`AI infrastructure router duplicate item id ${item.id}`);
  }
  ids.add(item.id);
  for (const field of ['activation_triggers', 'required_context', 'assistant_surfaces', 'allowed_actions', 'required_permissions', 'approval_triggers', 'gates', 'validation']) {
    checkArray(`AI infrastructure router item ${item.id}.${field}`, item[field]);
  }
  for (const field of ['type', 'purpose', 'status', 'canonical_source', 'output_contract', 'adaptation_record']) {
    if (typeof item[field] !== 'string' || item[field].trim() === '') {
      failures.push(`AI infrastructure router item ${item.id}.${field} is required`);
    }
  }
}
for (const item of requiredItems) {
  if (!ids.has(item)) {
    failures.push(`AI infrastructure router missing required item ${item}`);
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
