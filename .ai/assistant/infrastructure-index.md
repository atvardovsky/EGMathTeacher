# EGMathTeacher Assistant Infrastructure Index

Current as of: 2026-07-15

This file is the current index for repository-owned assistant infrastructure,
including the installed Alatyr adapter. Historical inventory reports remain
under `.ai/assistant/reports`.

## Scope

Included:

- root assistant bridge files
- repository ownership and CI files
- installed Alatyr framework, project, and assistant adapter files
- assistant operation flows, gates, policies, templates, and evidence reports
- project-owned prompt-adjacent files used by inherited voice behavior
- diagram-as-code sources, render config, and generated SVG artifacts

Excluded:

- `node_modules`
- workspace `dist` output
- local SQLite data
- transcript logs
- local certificates
- private secrets or global assistant settings outside this repository

## Root Bridge Files

| Path | Type | Owner | Action |
| --- | --- | --- | --- |
| `AGENTS.md` | Canonical assistant bridge | Adapter/bridge | Keep short; route to `.ai` |
| `AI_ASSISTANTS.md` | Generic assistant bridge | Adapter/bridge | Keep short; route to `AGENTS.md` and `.ai` |
| `.github/CODEOWNERS` | Repository ownership | Project maintainer | Keep ownership aligned with `.ai/alatyr.yaml` |
| `.github/workflows/ci.yml` | CI validation workflow | Project validation | Keep aligned with `.ai/project/validation.md` |

Supported bridge behavior is recorded in
`.ai/assistant/bridge-capability-matrix.md`.

## Project Prompt-Adjacent Files

| Path | Type | Owner | Action |
| --- | --- | --- | --- |
| `apps/api/Agent.md` | Inherited voice assistant behavior notes | Project/runtime prompt-adjacent | Keep; sync when WebRTC/persona behavior changes |

## Alatyr Root

| Path | Type | Owner | Action |
| --- | --- | --- | --- |
| `.ai/README.md` | Installed adapter index | Adapter | Keep current with source-of-truth and operation routing |
| `.ai/alatyr.yaml` | Installed adapter manifest | Adapter | Keep framework version, schema, modules, validation, gaps, and deviations current |

## Alatyr Framework Files

Portable framework rules copied from AlatyrCore baseline
`b80b00a724bb5d009bf36a42c64a4098095e0e1a`.

- `.ai/framework/README.md`
- `.ai/framework/adapter-maturity.md`
- `.ai/framework/ai-infrastructure-routing.md`
- `.ai/framework/approval-records.md`
- `.ai/framework/blueprint-driven-change.md`
- `.ai/framework/bridge-capability-matrix.md`
- `.ai/framework/change-risk-model.md`
- `.ai/framework/consistency-model.md`
- `.ai/framework/context-discovery.md`
- `.ai/framework/context-profiles.md`
- `.ai/framework/context-router.md`
- `.ai/framework/contour.md`
- `.ai/framework/diagram-guidance.md`
- `.ai/framework/effectiveness-metrics.md`
- `.ai/framework/guarantees.md`
- `.ai/framework/installed-operations.md`
- `.ai/framework/large-task-orchestration.md`
- `.ai/framework/lifecycle.md`
- `.ai/framework/logical-integrity.md`
- `.ai/framework/migration-diff.md`
- `.ai/framework/module-profile.md`
- `.ai/framework/operation-help.md`
- `.ai/framework/portability.md`
- `.ai/framework/project-adapter-contract.md`
- `.ai/framework/prompt-injection.md`
- `.ai/framework/rule-ownership.md`
- `.ai/framework/rule-registry.json`
- `.ai/framework/rule-registry.md`
- `.ai/framework/scaffolding.md`
- `.ai/framework/security-safety-guidance.md`
- `.ai/framework/skill-adaptation.md`
- `.ai/framework/source-of-truth-registry.md`
- `.ai/framework/testing-guidance.md`

Action: keep framework files portable. Do not add EGMathTeacher-specific facts
to `.ai/framework`.

## Project Source-Of-Truth Files

- `.ai/project/README.md`
- `.ai/project/architecture.md`
- `.ai/project/blueprint.md`
- `.ai/project/context-map.md`
- `.ai/project/contour.md`
- `.ai/project/data-model.md`
- `.ai/project/diagrams.md`
- `.ai/project/gaps.md`
- `.ai/project/guards.md`
- `.ai/project/lesson-agent-tools.md`
- `.ai/project/runtime-flows.md`
- `.ai/project/security-safety.md`
- `.ai/project/source-of-truth-registry.md`
- `.ai/project/ui-guidelines.md`
- `.ai/project/ui-tree.md`
- `.ai/project/use-cases.md`
- `.ai/project/validation.md`

Action: keep these synchronized with product code, README, diagrams, and
validation commands.

## Diagram Infrastructure

Editable sources:

- `.ai/project/diagrams/README.md`
- `.ai/project/diagrams/api-modules.mmd`
- `.ai/project/diagrams/assistant-governance.mmd`
- `.ai/project/diagrams/data-model.mmd`
- `.ai/project/diagrams/knowledge-upload-sequence.mmd`
- `.ai/project/diagrams/onboarding-profile-sequence.mmd`
- `.ai/project/diagrams/system-context.mmd`
- `.ai/project/diagrams/tutor-rag-sequence.mmd`
- `.ai/project/diagrams/ui-tree.mmd`
- `.ai/project/diagrams/webrtc-realtime-sequence.mmd`

Render config:

- `.ai/project/diagrams/puppeteer-config.json`
- `scripts/render-diagrams.sh`
- `scripts/check-diagrams.sh`
- `package.json` script `diagrams:render`
- `package.json` script `diagrams:check`

Generated SVG artifacts:

- `.ai/project/diagrams/rendered/api-modules.svg`
- `.ai/project/diagrams/rendered/assistant-governance.svg`
- `.ai/project/diagrams/rendered/data-model.svg`
- `.ai/project/diagrams/rendered/knowledge-upload-sequence.svg`
- `.ai/project/diagrams/rendered/onboarding-profile-sequence.svg`
- `.ai/project/diagrams/rendered/system-context.svg`
- `.ai/project/diagrams/rendered/tutor-rag-sequence.svg`
- `.ai/project/diagrams/rendered/ui-tree.svg`
- `.ai/project/diagrams/rendered/webrtc-realtime-sequence.svg`
- `.ai/project/diagrams/rendered/source-hashes.sha256`

Action: edit `.mmd` files first, then run `npm run diagrams:render` and
`npm run diagrams:check`.

## Browser E2E Infrastructure

- `playwright.config.ts`
- `apps/web/e2e/app.spec.ts`
- `package.json` script `e2e`

Action: keep mocked browser workflow tests aligned with UI routes,
localization, first-login profile flow, tutor turn rendering, and CI.
Default local E2E port is `5138` unless `E2E_PORT` or `E2E_BASE_URL` is set;
normal dev HTTPS remains on `5137`.

## Local Adapter Checkers

- `scripts/check-alatyr.sh`
- `package.json` script `alatyr:check`

Action: run `npm run alatyr:check` after changing `.ai`, bridge files,
validation commands, CI, CODEOWNERS, or Alatyr-owned scripts.

## Assistant Adapter Files

Core adapter:

- `.ai/assistant/bridge-capability-matrix.md`
- `.ai/assistant/ai-infrastructure-router.json`
- `.ai/assistant/context-router.json`
- `.ai/assistant/context-profiles.md`
- `.ai/assistant/contour.md`
- `.ai/assistant/help-reference.md`
- `.ai/assistant/help.md`
- `.ai/assistant/infrastructure-index.md`
- `.ai/assistant/maturity-profile.md`
- `.ai/assistant/module-profile.md`

Approvals and checklists:

- `.ai/assistant/approvals/ALATYR-20260711-background-assistant-work.md`
- `.ai/assistant/approvals/ALATYR-20260711-framework-update.md`
- `.ai/assistant/approvals/ALATYR-20260711-dev-domain-reachability.md`
- `.ai/assistant/approvals/ALATYR-20260711-gap-cleanup.md`
- `.ai/assistant/approvals/ALATYR-20260711-no-answer-gap-cleanup.md`
- `.ai/assistant/approvals/ALATYR-20260711-poc-e2e-profile-ops.md`
- `.ai/assistant/approvals/ALATYR-20260711-settings-view.md`
- `.ai/assistant/approvals/ALATYR-20260711-specialist-profile-pipeline.md`
- `.ai/assistant/approvals/ALATYR-20260711-ui-system.md`
- `.ai/assistant/approvals/ALATYR-20260712-adapter-drift-checker-repair.md`
- `.ai/assistant/approvals/ALATYR-20260712-background-batching.md`
- `.ai/assistant/approvals/ALATYR-20260712-framework-context-router-update.md`
- `.ai/assistant/approvals/ALATYR-20260712-framework-update-4654732.md`
- `.ai/assistant/approvals/ALATYR-20260712-lesson-agent-contracts.md`
- `.ai/assistant/approvals/ALATYR-20260712-lesson-contract-repair.md`
- `.ai/assistant/approvals/ALATYR-20260712-lesson-lifecycle-usage.md`
- `.ai/assistant/approvals/ALATYR-20260712-role-operation-model-policy.md`
- `.ai/assistant/approvals/ALATYR-20260712-session-progress-tracking.md`
- `.ai/assistant/approvals/ALATYR-20260712-tutor-response-blocks.md`
- `.ai/assistant/approvals/ALATYR-20260712-verified-learning-loop.md`
- `.ai/assistant/approvals/ALATYR-20260712-knowledge-pack-rag-sync.md`
- `.ai/assistant/approvals/ALATYR-20260713-review-fix-repair.md`
- `.ai/assistant/approvals/ALATYR-20260713-runtime-review-issue-repair.md`
- `.ai/assistant/approvals/ALATYR-20260714-lesson-ux-review-repair.md`
- `.ai/assistant/approvals/ALATYR-20260714-onboarding-idempotency-terminal-meeting.md`
- `.ai/assistant/approvals/ALATYR-20260714-onboarding-recovery-repair.md`
- `.ai/assistant/approvals/ALATYR-20260714-profile-creation-lock-repair.md`
- `.ai/assistant/approvals/ALATYR-20260714-profile-generation-user-lock-provider-errors.md`
- `.ai/assistant/approvals/ALATYR-20260714-framework-update-8dab3d1.md`
- `.ai/assistant/approvals/ALATYR-20260714-framework-update-5547fca.md`
- `.ai/assistant/approvals/ALATYR-20260715-framework-update-b80b00a.md`
- `.ai/assistant/approvals/ALATYR-20260715-framework-update-b80b00a.json`
- `.ai/assistant/approvals/approval-record-template.json`
- `.ai/assistant/approvals/approval-template.md`
- `.ai/assistant/checklists/change-impact.md`

Flows:

- `.ai/assistant/flows/adapter-recheck.flow.md`
- `.ai/assistant/flows/ai-infrastructure-adaptation.flow.md`
- `.ai/assistant/flows/ai-infrastructure-inventory.flow.md`
- `.ai/assistant/flows/blueprint-driven-change.flow.md`
- `.ai/assistant/flows/documentation-sync.flow.md`
- `.ai/assistant/flows/large-task-orchestration.flow.md`
- `.ai/assistant/flows/logical-integrity-review.flow.md`
- `.ai/assistant/flows/operation-routing.flow.md`
- `.ai/assistant/flows/project-blueprint-creation.flow.md`
- `.ai/assistant/flows/skill-adaptation.flow.md`

Gates:

- `.ai/assistant/gates/README.md`
- `.ai/assistant/gates/approval-gates.md`
- `.ai/assistant/gates/checklist.md`
- `.ai/assistant/gates/diagram-sync-gates.md`
- `.ai/assistant/gates/documentation-sync-gates.md`
- `.ai/assistant/gates/final-evidence.md`
- `.ai/assistant/gates/security-safety-gates.md`
- `.ai/assistant/gates/ui-gates.md`
- `.ai/assistant/gates/validation-gates.md`

Skills:

- `.ai/assistant/skills/ui-implementation.md`

Policies:

- `.ai/assistant/policies/ai-infrastructure-source-access.md`
- `.ai/assistant/policies/prompt-injection.md`

Templates:

- `.ai/assistant/templates/adapter-output-contracts.md`
- `.ai/assistant/templates/ai-infrastructure-adaptation-record.md`
- `.ai/assistant/templates/ai-infrastructure-inventory.md`
- `.ai/assistant/templates/effectiveness-report.md`
- `.ai/assistant/templates/installation-note.md`
- `.ai/assistant/templates/large-task-operation-packet.md`
- `.ai/assistant/templates/migration-note.md`
- `.ai/assistant/templates/operation-request.md`
- `.ai/assistant/templates/post-install-message.md`
- `.ai/assistant/templates/post-update-message.md`

Reports:

- `.ai/assistant/reports/ALATYR-20260709-ai-inventory.md`
- `.ai/assistant/reports/ALATYR-20260709-blueprint-review.md`
- `.ai/assistant/reports/ALATYR-20260709-diagram-render-command.md`
- `.ai/assistant/reports/ALATYR-20260709-diagrams-gates-recheck.md`
- `.ai/assistant/reports/ALATYR-20260709-egmathteacher-installation-plan.md`
- `.ai/assistant/reports/ALATYR-20260709-project-contour-generation.md`
- `.ai/assistant/reports/ALATYR-20260710-first-login-student-profile.md`
- `.ai/assistant/reports/ALATYR-20260710-assistant-infrastructure-reindex.md`
- `.ai/assistant/reports/ALATYR-20260711-framework-update.md`
- `.ai/assistant/reports/ALATYR-20260712-framework-update-context-router.md`
- `.ai/assistant/reports/ALATYR-20260712-framework-update-4654732.md`
- `.ai/assistant/reports/ALATYR-20260714-framework-update-8dab3d1.md`
- `.ai/assistant/reports/ALATYR-20260714-framework-update-5547fca.md`
- `.ai/assistant/reports/ALATYR-20260715-framework-update-b80b00a.md`

Action: keep adapter files aligned with current project commands, gates, and
operation routing. Reports are historical evidence unless a newer report says
it supersedes a fact.

## Assistant Surfaces Not Present

No repository files are installed for:

- `.agents/skills`
- `.claude`
- `.cursor`
- `.github` prompt/rule files
- `.devin`
- `.cascade`
- `.windsurf`
- `CLAUDE.md`
- `GEMINI.md`
- MCP/tool server configuration
- assistant-specific skill wrappers

Add these only when the repository actually uses the corresponding assistant
surface and after applying the source-access and prompt-injection policies.

## Current Known Gaps

- No formal production privacy policy or incident procedure.
- No frontend component, accessibility, or visual regression test command.
- Production auth hardening remains POC-only.
- Production backup, restore, rollback, and incident runbooks remain undefined.
