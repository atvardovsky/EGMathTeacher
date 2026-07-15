# Alatyr Release Migration Report

Generated from `tools/report_migration_diff.py` using the shape in `docs/release-migration-report-template.md`.

Report ID: `ALATYR-20260715-framework-update-b80b00a`
Prepared by: `Codex using tools/report_migration_diff.py`
Prepared at: `2026-07-15`

Target note: this generated report compares EGMathTeacher's mature installed
adapter against the smaller upstream target template directory. Entries listed
as removed target template surfaces are target-local reports, approvals,
gates, diagrams, skills, or project docs that are intentionally retained
unless a separate target-specific change removes them.

## Version Scope

From manifest: `<TARGET_REPOSITORY_ROOT>/.ai/framework/rule-registry.json`
To manifest: `<ALATYR_CORE_SOURCE>/framework/rule-registry.json`
From framework version: `0.1.0-alpha.2`
To framework version: `0.1.0-alpha.3`
From adapter schema version: `1`
To adapter schema version: `2`
From template version: `2`
To template version: `3`

## Summary

- Added rules: 0
- Changed rules: 5
- Removed rules: 0
- Unchanged rules: 8
- Added rule owner categories: 0
- Changed rule owner categories: 4
- Removed rule owner categories: 0
- Added framework files: 0
- Changed framework files: 19
- Removed framework files: 0
- Added target template surfaces: 3
- Changed target template surfaces: 37
- Removed target template surfaces: 126

## Adapter Contract Impact

- Framework version: `changed`
- Adapter schema version: `changed`
- Template version: `changed`
- Rule registry: `changed`
- Rule ownership: `changed`
- Framework files: `changed`
- Target template surfaces: `changed`

## Affected Rule Categories

- `APPROVAL`
- `CHANGE`
- `INTEGRITY`
- `RISK`
- `SOURCE`

## Affected Task Profiles

- `all changes`
- `architecture changes`
- `blueprint-driven changes`
- `business changes`
- `data changes`
- `documentation sync`
- `drift reviews`
- `installed operations`
- `logical integrity`
- `protected changes`
- `public contract changes`
- `runtime changes`
- `semantic fact changes`

## Affected Canonical Sources

- `framework/approval-records.md`
- `framework/blueprint-driven-change.md`
- `framework/change-risk-model.md`
- `framework/logical-integrity.md`
- `framework/source-of-truth-registry.md`

## Migration Action Hints

- Compare installed `.ai/framework` files against changed framework sources before applying updates.
- Compare installed adapter templates against changed target template surfaces before applying updates.
- Compare target templates and decide which installed adapter placeholders need migration.
- Recheck approval-record policy and protected-change approval scope.
- Recheck blueprint-driven change and product-change flow references.
- Recheck logical integrity review flow and companion-update rules.
- Recheck risk classification and approval trigger routing.
- Recheck source-of-truth registry entries and conflict resolution.
- Update installed adapter manifest schema version and review schema migration needs.

## Rule Changes

## Added Rules

- none

## Changed Rules

- `ALATYR-APPROVAL-001`
- `ALATYR-CHANGE-001`
- `ALATYR-INTEGRITY-001`
- `ALATYR-RISK-001`
- `ALATYR-SOURCE-001`

## Removed Rules

- none

## Unchanged Rules

- `ALATYR-ADAPTER-001`
- `ALATYR-BRIDGE-001`
- `ALATYR-CONTEXT-001`
- `ALATYR-EVIDENCE-001`
- `ALATYR-LIFECYCLE-001`
- `ALATYR-MODULE-001`
- `ALATYR-SAFETY-001`
- `ALATYR-SAFETY-002`

## Rule Owner Changes

Added rule owner categories:
- none

Changed rule owner categories:
- `APPROVAL`
- `INTEGRITY`
- `RISK`
- `SOURCE`

Removed rule owner categories:
- none

## Framework File Changes

From framework directory: `<TARGET_REPOSITORY_ROOT>/.ai/framework`
To framework directory: `<ALATYR_CORE_SOURCE>/framework`

Added framework files:
- none

Changed framework files:
- `README.md`
- `adapter-maturity.md`
- `approval-records.md`
- `blueprint-driven-change.md`
- `change-risk-model.md`
- `consistency-model.md`
- `context-profiles.md`
- `context-router.md`
- `guarantees.md`
- `installed-operations.md`
- `large-task-orchestration.md`
- `logical-integrity.md`
- `module-profile.md`
- `operation-help.md`
- `project-adapter-contract.md`
- `rule-ownership.md`
- `rule-registry.json`
- `rule-registry.md`
- `source-of-truth-registry.md`

Removed framework files:
- none

## Target Template Surface Changes

From template directory: `<TARGET_REPOSITORY_ROOT>/.ai`
To template directory: `<ALATYR_CORE_SOURCE>/templates/target/.ai`

Added target template surfaces:
- `assistant/approvals/approval-record-template.json`
- `assistant/skills/example/SKILL.md`
- `project/consistency-map.json`

Changed target template surfaces:
- `README.md`
- `alatyr.yaml`
- `assistant/ai-infrastructure-router.json`
- `assistant/approvals/approval-template.md`
- `assistant/bridge-capability-matrix.md`
- `assistant/checklists/change-impact.md`
- `assistant/context-profiles.md`
- `assistant/context-router.json`
- `assistant/contour.md`
- `assistant/flows/adapter-recheck.flow.md`
- `assistant/flows/ai-infrastructure-inventory.flow.md`
- `assistant/flows/blueprint-driven-change.flow.md`
- `assistant/flows/documentation-sync.flow.md`
- `assistant/flows/large-task-orchestration.flow.md`
- `assistant/flows/logical-integrity-review.flow.md`
- `assistant/flows/operation-routing.flow.md`
- `assistant/flows/project-blueprint-creation.flow.md`
- `assistant/flows/skill-adaptation.flow.md`
- `assistant/gates/checklist.md`
- `assistant/help-reference.md`
- `assistant/help.md`
- `assistant/maturity-profile.md`
- `assistant/module-profile.md`
- `assistant/policies/ai-infrastructure-source-access.md`
- `assistant/policies/prompt-injection.md`
- `assistant/templates/adapter-output-contracts.md`
- `assistant/templates/ai-infrastructure-adaptation-record.md`
- `assistant/templates/ai-infrastructure-inventory.md`
- `assistant/templates/effectiveness-report.md`
- `assistant/templates/installation-note.md`
- `assistant/templates/large-task-operation-packet.md`
- `assistant/templates/migration-note.md`
- `assistant/templates/operation-request.md`
- `assistant/templates/post-install-message.md`
- `assistant/templates/post-update-message.md`
- `project/contour.md`
- `project/source-of-truth-registry.md`

Removed target template surfaces:
- `assistant/approvals/ALATYR-20260711-background-assistant-work.md`
- `assistant/approvals/ALATYR-20260711-dev-domain-reachability.md`
- `assistant/approvals/ALATYR-20260711-framework-update.md`
- `assistant/approvals/ALATYR-20260711-gap-cleanup.md`
- `assistant/approvals/ALATYR-20260711-no-answer-gap-cleanup.md`
- `assistant/approvals/ALATYR-20260711-poc-e2e-profile-ops.md`
- `assistant/approvals/ALATYR-20260711-settings-view.md`
- `assistant/approvals/ALATYR-20260711-specialist-profile-pipeline.md`
- `assistant/approvals/ALATYR-20260711-ui-system.md`
- `assistant/approvals/ALATYR-20260712-adapter-drift-checker-repair.md`
- `assistant/approvals/ALATYR-20260712-background-batching.md`
- `assistant/approvals/ALATYR-20260712-framework-context-router-update.md`
- `assistant/approvals/ALATYR-20260712-framework-update-4654732.md`
- `assistant/approvals/ALATYR-20260712-knowledge-pack-rag-sync.md`
- `assistant/approvals/ALATYR-20260712-lesson-agent-contracts.md`
- `assistant/approvals/ALATYR-20260712-lesson-contract-repair.md`
- `assistant/approvals/ALATYR-20260712-lesson-lifecycle-usage.md`
- `assistant/approvals/ALATYR-20260712-role-operation-model-policy.md`
- `assistant/approvals/ALATYR-20260712-session-progress-tracking.md`
- `assistant/approvals/ALATYR-20260712-tutor-response-blocks.md`
- `assistant/approvals/ALATYR-20260712-verified-learning-loop.md`
- `assistant/approvals/ALATYR-20260713-review-fix-repair.md`
- `assistant/approvals/ALATYR-20260713-runtime-review-issue-repair.md`
- `assistant/approvals/ALATYR-20260714-framework-update-5547fca.md`
- `assistant/approvals/ALATYR-20260714-framework-update-8dab3d1.md`
- `assistant/approvals/ALATYR-20260714-lesson-ux-review-repair.md`
- `assistant/approvals/ALATYR-20260714-onboarding-idempotency-terminal-meeting.md`
- `assistant/approvals/ALATYR-20260714-onboarding-recovery-repair.md`
- `assistant/approvals/ALATYR-20260714-profile-creation-lock-repair.md`
- `assistant/approvals/ALATYR-20260714-profile-generation-user-lock-provider-errors.md`
- `assistant/flows/ai-infrastructure-adaptation.flow.md`
- `assistant/gates/README.md`
- `assistant/gates/approval-gates.md`
- `assistant/gates/diagram-sync-gates.md`
- `assistant/gates/documentation-sync-gates.md`
- `assistant/gates/final-evidence.md`
- `assistant/gates/security-safety-gates.md`
- `assistant/gates/ui-gates.md`
- `assistant/gates/validation-gates.md`
- `assistant/infrastructure-index.md`
- `assistant/reports/ALATYR-20260709-ai-inventory.md`
- `assistant/reports/ALATYR-20260709-blueprint-review.md`
- `assistant/reports/ALATYR-20260709-diagram-render-command.md`
- `assistant/reports/ALATYR-20260709-diagrams-gates-recheck.md`
- `assistant/reports/ALATYR-20260709-egmathteacher-installation-plan.md`
- `assistant/reports/ALATYR-20260709-project-contour-generation.md`
- `assistant/reports/ALATYR-20260710-assistant-infrastructure-reindex.md`
- `assistant/reports/ALATYR-20260710-first-login-student-profile.md`
- `assistant/reports/ALATYR-20260711-framework-update.md`
- `assistant/reports/ALATYR-20260712-framework-update-4654732.md`
- `assistant/reports/ALATYR-20260712-framework-update-context-router.md`
- `assistant/reports/ALATYR-20260714-framework-update-5547fca.md`
- `assistant/reports/ALATYR-20260714-framework-update-8dab3d1.md`
- `assistant/skills/ui-implementation.md`
- `framework/README.md`
- `framework/adapter-maturity.md`
- `framework/ai-infrastructure-routing.md`
- `framework/approval-records.md`
- `framework/blueprint-driven-change.md`
- `framework/bridge-capability-matrix.md`
- `framework/change-risk-model.md`
- `framework/consistency-model.md`
- `framework/context-discovery.md`
- `framework/context-profiles.md`
- `framework/context-router.md`
- `framework/contour.md`
- `framework/diagram-guidance.md`
- `framework/effectiveness-metrics.md`
- `framework/guarantees.md`
- `framework/installed-operations.md`
- `framework/large-task-orchestration.md`
- `framework/lifecycle.md`
- `framework/logical-integrity.md`
- `framework/migration-diff.md`
- `framework/module-profile.md`
- `framework/operation-help.md`
- `framework/portability.md`
- `framework/project-adapter-contract.md`
- `framework/prompt-injection.md`
- `framework/rule-ownership.md`
- `framework/rule-registry.json`
- `framework/rule-registry.md`
- `framework/scaffolding.md`
- `framework/security-safety-guidance.md`
- `framework/skill-adaptation.md`
- `framework/source-of-truth-registry.md`
- `framework/testing-guidance.md`
- `project/README.md`
- `project/architecture.md`
- `project/blueprint.md`
- `project/context-map.md`
- `project/data-model.md`
- `project/diagrams.md`
- `project/diagrams/README.md`
- `project/diagrams/api-modules.mmd`
- `project/diagrams/assistant-governance.mmd`
- `project/diagrams/data-model.mmd`
- `project/diagrams/knowledge-pack-runtime-repair.mmd`
- `project/diagrams/knowledge-upload-sequence.mmd`
- `project/diagrams/onboarding-profile-sequence.mmd`
- `project/diagrams/puppeteer-config.json`
- `project/diagrams/rendered/api-modules.svg`
- `project/diagrams/rendered/assistant-governance.svg`
- `project/diagrams/rendered/data-model.svg`
- `project/diagrams/rendered/knowledge-pack-runtime-repair.svg`
- `project/diagrams/rendered/knowledge-upload-sequence.svg`
- `project/diagrams/rendered/onboarding-profile-sequence.svg`
- `project/diagrams/rendered/source-hashes.sha256`
- `project/diagrams/rendered/system-context.svg`
- `project/diagrams/rendered/tutor-rag-sequence.svg`
- `project/diagrams/rendered/ui-tree.svg`
- `project/diagrams/rendered/webrtc-realtime-sequence.svg`
- `project/diagrams/system-context.mmd`
- `project/diagrams/tutor-rag-sequence.mmd`
- `project/diagrams/ui-tree.mmd`
- `project/diagrams/webrtc-realtime-sequence.mmd`
- `project/gaps.md`
- `project/guards.md`
- `project/knowledge-pack-runtime-repair-plan.md`
- `project/lesson-agent-tools.md`
- `project/runtime-flows.md`
- `project/security-safety.md`
- `project/ui-guidelines.md`
- `project/ui-tree.md`
- `project/use-cases.md`
- `project/validation.md`

## Required Target Actions

- Review affected target adapters before applying changes.
- Create or update a target migration note when the installed adapter is affected.
- Require approval before overwriting existing AI instructions or changing protected adapter behavior.
- Run target validation or record unresolved checks.

## Optional Target Actions

- Run `recheck-after-framework-update` in installed target adapters.
- Compare local deviations against changed rule owners and framework files.

## Approval Needs

Approval needed: `target-dependent`
Approval scope: `required before overwriting existing AI instructions or protected adapter behavior`

## Validation Run

Source validation: `run source-repository checks before release`
Target validation: `target adapter decides local validation or unresolved checks`

## Residual Risks

- Target adapters may have local deviations not visible from source manifest comparison.
- Source migration evidence does not prove target validation.

## Safety

This report is evidence only. It does not modify target files, approve changes, or complete an upgrade.
