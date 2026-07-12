# Approval Record

Approval ID: `ALATYR-20260712-adapter-drift-checker-repair`
Operation ID: `adapter-drift-checker-repair-20260712`
Operation type: `ai-infrastructure framework-upgrade validation-gate-repair`
Plan version: `2026-07-12-adapter-drift-checker-v1`
Plan hash: `not available; approval was given as a direct fix list in conversation`
Requested by: `atvardovsky`
Approved by: `atvardovsky`
Approved at: `2026-07-12T18:48:10+02:00`
Approval source/message: `User supplied the eight-item Alatyr issue fix list and emphasized strengthening scripts/check-alatyr.sh.`
Expires at or reuse policy: `single adapter drift-repair scope only`
Scope invalidation rule: `new framework import, assistant bridge addition, weakened gate/checker behavior, tool permission change, or live/destructive action requires fresh approval`

## Approved Scope

Allowed protected changes:

- Make context routing canonical through `.ai/assistant/context-router.json`.
- Remove local machine path leakage from adapter-owned `.ai` files.
- Replace stale local-checker wording with `npm run alatyr:check`.
- Strengthen `scripts/check-alatyr.sh` for context-router references,
  local home-directory path leakage, stale checker wording, duplicate
  context-profile references, and required manifest owner fields.
- Replace ambiguous backup-owner metadata with a known-gap placeholder.
- Refresh maturity metadata with explicit mature/usable/minimal profile
  grouping.
- Replace hardcoded target repository paths in operation templates.
- Deduplicate context profile references.

Allowed files or surfaces:

- `.ai/alatyr.yaml`
- `.ai/assistant/context-profiles.md`
- `.ai/assistant/gates/checklist.md`
- `.ai/assistant/flows/operation-routing.flow.md`
- `.ai/assistant/policies/ai-infrastructure-source-access.md`
- `.ai/assistant/maturity-profile.md`
- `.ai/assistant/module-profile.md`
- `.ai/assistant/templates`
- `.ai/assistant/reports`
- `.ai/assistant/approvals`
- `scripts/check-alatyr.sh`

Excluded actions:

- Live external service calls.
- System web server, PM2, certificate, or deployment changes.
- New dependencies, package installs, MCP/tool permission changes, or assistant bridge additions.
- Product behavior, API, database, frontend, or runtime architecture changes.
- Weakening approval gates, validation gates, or source-access rules.

Allowed actions mode:
`adapter-only`

## Plan Evidence

Approved plan summary:

```text
Repair Alatyr adapter drift by making context-router.json canonical for
routing, removing local machine path leakage, updating stale local-checker
claims, refreshing ownership/maturity metadata, deduplicating profile
references, and strengthening scripts/check-alatyr.sh so the drift is caught
automatically.
```

Approved validation or manual review:

- `bash -n scripts/check-alatyr.sh`
- `npm run alatyr:check`
- `git diff --check`
- manual adapter source review

## Use Result

Used by operation/change: `adapter-drift-checker-repair-20260712`
Patch changed after approval: `yes; implementation details were adjusted during local checker feedback`
Implementation stayed within approved scope: `yes`
Validation run: `bash -n scripts/check-alatyr.sh`; `npm run alatyr:check`; `git diff --check`
Result/evidence: `all listed local validation passed`
Residual risk: `the checker remains structural and cannot prove semantic correctness of every adapter or project fact`
