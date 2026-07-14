# Alatyr Migration Note

Migration ID: `ALATYR-20260714-framework-update-8dab3d1`
Operation ID: `framework-update-8dab3d1-20260714`
From framework version: `0.1.0-alpha.0`
To framework version: `0.1.0-alpha.0`
From adapter schema version: `1`
To adapter schema version: `1`
From template version: `1`
To template version: `2`
Prepared by: `Codex`
Prepared at: `2026-07-14T17:40:19+02:00`

## Changed Framework Rules

Added rules:

- none; stable rule IDs remain unchanged.

Changed rules:

- `ALATYR-CONTEXT-001`: expanded around compact bootstrap, context budgets,
  project-area overlays, task-scale overlays, optional consistency routing,
  and AI infrastructure item routing.
- `ALATYR-SOURCE-001`: expanded to allow stable fact IDs and optional
  relationship coverage.
- `ALATYR-SAFETY-002`: expanded to require route/item contracts and adaptation
  evidence for imported AI infrastructure.
- `ALATYR-INTEGRITY-001`: expanded around bounded impact closure and
  multi-workstream convergence when available.
- `ALATYR-CHANGE-001`: expanded around bounded workstreams for large or
  resumable changes.
- `ALATYR-ADAPTER-001`: expanded around routed AI infrastructure items and
  adaptation records.
- `ALATYR-BRIDGE-001`: expanded around cross-assistant AI item routing.
- `ALATYR-EVIDENCE-001`: expanded around operation packets.

Removed or deprecated rules:

- none.

## Required Target Actions

- Update `.ai/framework` from AlatyrCore commit
  `8dab3d15c6e0dc983096c2aaca89fba75fe6fa14`.
- Update `.ai/alatyr.yaml` source baseline and template version.
- Update context routing to schema version 2 compact bootstrap metadata.
- Add `.ai/assistant/ai-infrastructure-router.json`.
- Add `.ai/assistant/templates/ai-infrastructure-adaptation-record.md`.
- Add `.ai/assistant/flows/large-task-orchestration.flow.md`.
- Add `.ai/assistant/templates/large-task-operation-packet.md`.
- Update bridge/help/module/maturity/infrastructure metadata.
- Strengthen `scripts/check-alatyr.sh` for the new deterministic invariants.

## Optional Target Actions

- Add `.ai/project/consistency-map.json` later when broad fact relationship
  routing needs a machine-readable map.
- Use large-task operation packets only for genuinely large, cross-boundary,
  multi-workstream, or resumable work.

## Local Deviations

- EGMathTeacher keeps target-local `scripts/check-alatyr.sh` as the canonical
  local checker.
- Source AlatyrCore tools are review evidence only and are not target
  validation commands.
- The optional consistency-map module is deferred.
- Unsupported assistant bridge surfaces remain deferred; only AGENTS-aware,
  Codex, and generic Markdown assistants are supported.

## Affected Target Surfaces

- `.ai/alatyr.yaml`: source commit and template version updated.
- `.ai/framework`: portable framework files synced to AlatyrCore `8dab3d1`.
- `.ai/project`: source-of-truth registry, validation, and gaps updated for
  new adapter surfaces.
- `.ai/assistant`: router, help, recheck flow, module/maturity profiles,
  infrastructure index, policies, templates, reports, and approval evidence
  updated.
- `.ai/assistant/module-profile.md`: AI infrastructure router and large-task
  orchestration enabled; consistency map deferred.
- bridge files: `AGENTS.md` and `AI_ASSISTANTS.md` updated for compact
  bootstrap and AI infrastructure routing.
- validation or manual review: `npm run alatyr:check`, `git diff --check`,
  and manual source/adaptation review.

## Approval And Validation

Approval needed: `yes; existing assistant instructions were overwritten`
Approval record:
`.ai/assistant/approvals/ALATYR-20260714-framework-update-8dab3d1.md`
Validation run:

- `npm run diagrams:render`: passed, rendered 10 diagrams.
- `npm run diagrams:check`: passed for 10 diagrams.
- `npm run alatyr:check`: passed with schema-v2 router, AI-router, large-task
  overlay, stale wording, local path, duplicate-reference, CI, CODEOWNERS, and
  diagram-hash checks.
- `git diff --check`: passed.

## Final Evidence

Migration result: `Alatyr baseline updated from 465473284966676d86bb6e55d1254b20e415bf5c to 8dab3d15c6e0dc983096c2aaca89fba75fe6fa14. Template version updated from 1 to 2. Context routing now records compact bootstrap, budgets, project-area overlays, and the large/resumable overlay. AI infrastructure routing and large-task packet templates were added; consistency map remains deferred.`
Remaining gaps: `backup owner remains unassigned as a known gap; optional consistency-map module is deferred; production privacy/incident policy and production backup/rollback runbooks remain unresolved.`
Residual risk: `source AlatyrCore license file was not found; remote source tools were reviewed but not executed; semantic correctness of project facts remains manual; browser/API/product tests were not run because this was adapter-only framework metadata and diagram work.`
