# EGMathTeacher Adapter Maturity Profile

This file reports adapter readiness by task type.

## Overall Summary

Overall adapter state: usable
Last reviewed: 2026-07-11
Reviewed by: Codex using approved Alatyr framework update scope
Blocking gaps:

- no formal production privacy policy or incident procedure
- no frontend component, accessibility, or visual regression command
- production auth hardening remains POC-only
- production backup, restore, rollback, and incident runbooks remain undefined

## Task-Specific Maturity

### Task Area: `documentation`

Task area: `documentation`
Maturity: usable
Supported work: project docs, adapter docs, framework-update notes, diagram
source updates, README alignment, and source-of-truth repairs.
Required context:

- `.ai/assistant/context-profiles.md`
- `.ai/project/source-of-truth-registry.md`
- affected docs
- `.ai/assistant/gates/checklist.md`

Required owners present: yes.
Validation or manual review: manual source-doc review; `npm run
diagrams:render` when diagram sources change; `npm run diagrams:check` for
rendered diagram consistency; `npm run alatyr:check` for adapter consistency.
Approval needs: required when docs change accepted behavior, architecture,
security posture, approval gates, or assistant instructions.
Blocking criteria: none for ordinary docs.
Residual risks: no automated semantic docs checker.
Final evidence: changed facts, docs updated, diagram/render result if needed,
approval status, skipped checks.

### Task Area: `code-changes`

Task area: `code-changes`
Maturity: usable
Supported work: focused NestJS API, React/Vite web, tests, and required docs
sync.
Required context:

- `.ai/project/context-map.md`
- `.ai/project/validation.md`
- `.ai/assistant/context-profiles.md`
- relevant source and tests

Required owners present: yes.
Validation or manual review: `npm run build`, `npm test`, `npm run lint`,
`npm run e2e`, and `npm run alatyr:check` depending on changed surface.
Approval needs: required for protected behavior, architecture, data,
security, dependency, live-service, destructive, or assistant-governance
changes.
Blocking criteria: tasks needing production validation are not fully covered.
Residual risks: limited frontend automated tests beyond mocked E2E.
Final evidence: changed facts, code/tests/docs sync, commands run, skipped
checks, residual risk.

### Task Area: `architecture`

Task area: `architecture`
Maturity: usable with approval gate
Supported work: architecture discussion, approved docs/diagram sync, and
implementation when explicitly approved.
Required context:

- `.ai/project/architecture.md`
- `.ai/project/runtime-flows.md`
- `.ai/project/diagrams.md`
- `.ai/project/source-of-truth-registry.md`
- `.ai/assistant/gates/checklist.md`

Required owners present: yes.
Validation or manual review: build/tests/lint for code changes; diagram render
for diagram-source changes; manual architecture review.
Approval needs: explicit approval before architecture changes.
Blocking criteria: production deployment or system web server changes are
blocked without explicit deployment approval.
Residual risks: no formal ADR process; CI is configured but no remote run was
observed from this local workspace.
Final evidence: affected boundaries, source-of-truth updates, diagrams,
validation, approval.

### Task Area: `data`

Task area: `data`
Maturity: minimal-to-usable
Supported work: SQLite schema documentation, source review, focused tests, and
non-destructive code changes.
Required context:

- `.ai/project/data-model.md`
- `.ai/project/security-safety.md`
- `.ai/project/source-of-truth-registry.md`
- database and DTO source files

Required owners present: yes for current schema and POC migration ledger;
missing retention policy.
Validation or manual review: `npm run build`, `npm test`, `npm run lint`;
initial migration ledger is covered by API tests.
Approval needs: destructive, retention, privacy, migration, or live data
changes require approval.
Blocking criteria: production rollback, backfill, backup, restore, or
retention policy tasks need new project decisions.
Residual risks: no production rollback/backfill workflow, export/delete, or
backup policy.
Final evidence: data contracts changed, owner docs synced, validation,
unresolved migration/privacy gaps.

### Task Area: `security`

Task area: `security`
Maturity: minimal-to-usable
Supported work: source review, documented guard behavior, secret/live-service
boundaries, and focused code changes with approval.
Required context:

- `.ai/project/security-safety.md`
- `.ai/project/guards.md`
- `.ai/assistant/policies/prompt-injection.md`
- relevant auth/env/source files

Required owners present: yes for POC boundaries; missing formal production
privacy and incident policies.
Validation or manual review: build/tests/lint for code changes; manual policy
review for docs-only changes.
Approval needs: explicit approval for auth, authorization, cookies, roles,
permissions, credentials, dependencies, live services, destructive actions, or
production config.
Blocking criteria: production readiness claims for real student data are
blocked until privacy/compliance gaps are resolved.
Residual risks: no rate limiting, no production privacy policy, no incident
procedure, and no production auth hardening beyond the POC.
Final evidence: sensitive surface, policy checked, validation, approval,
residual risk.

### Task Area: `ai-infrastructure`

Task area: `ai-infrastructure`
Maturity: usable for review and adapter-only updates
Supported work: inventory, source-access review, prompt-injection review,
adapter-only merges, bridge help/routing, and approval-gated imports.
Required context:

- `.ai/assistant/infrastructure-index.md`
- `.ai/assistant/flows/ai-infrastructure-inventory.flow.md`
- `.ai/assistant/flows/skill-adaptation.flow.md`
- `.ai/assistant/policies/ai-infrastructure-source-access.md`
- `.ai/assistant/policies/prompt-injection.md`

Required owners present: yes.
Validation or manual review: manual adapter source review; target validation
when recurring behavior or code changes.
Approval needs: required before importing third-party infrastructure,
overwriting existing instructions, or broadening permissions.
Blocking criteria: remote/package/plugin sources remain review-only until
provenance, license, safety, and approval are clear.
Residual risks: local checker does not validate third-party provenance, and no
assistant-native skills are installed.
Final evidence: inventory/provenance, prompt-injection review, changed
surfaces, validation/review, approval.

### Task Area: `framework-upgrade`

Task area: `framework-upgrade`
Maturity: usable
Supported work: Alatyr update impact review, framework sync, adapter migration
notes, bridge recheck, and manual validation.
Required context:

- `.ai/alatyr.yaml`
- `.ai/assistant/context-router.json`
- `.ai/assistant/context-profiles.md`
- `.ai/assistant/module-profile.md`
- `.ai/assistant/bridge-capability-matrix.md`
- `.ai/assistant/templates/installation-note.md`
- `.ai/assistant/templates/migration-note.md`

Required owners present: yes.
Validation or manual review: manual file existence/reference review; source
AlatyrCore tools may provide evidence but are not target requirements.
Approval needs: required before overwriting existing assistant instructions.
Blocking criteria: none after explicit approval for the approved adapter-only
scope.
Residual risks: no target checker for framework consistency.
Final evidence: baseline/version, surfaces changed, validation/review,
approval, residual risk.

## Blocking Criteria

Security-sensitive work is blocked unless `.ai/project/security-safety.md`,
`.ai/project/guards.md`, validation, credential handling, and approval rules
are checked.

Data work is blocked unless `.ai/project/data-model.md`, validation, and
approval rules are checked when destructive or live data changes are possible.

AI infrastructure integration is blocked unless inventory, source access,
prompt-injection policy, provenance, permissions, and approval rules are
checked.

Framework upgrade work is blocked unless `.ai/alatyr.yaml`, installation note,
context router, context profiles, module profile, bridge files, operation
help, and adapter-recheck flow are discoverable.

## Evidence

Report task area, maturity, blockers, missing facts, validation, approval
needs, and residual risk before broad work.
