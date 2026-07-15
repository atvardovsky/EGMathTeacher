# Alatyr Release Migration Report

Generated from `tools/report_migration_diff.py` using the shape in `docs/release-migration-report-template.md`.

Report ID: `generated-migration-diff`
Prepared by: `tools/report_migration_diff.py`
Prepared at: `not recorded by this source helper`

## Version Scope

From manifest: `<TARGET_REPOSITORY_ROOT>/.ai/framework/rule-registry.json`
To manifest: `https://github.com/atvardovsky/AlatyrCore framework/rule-registry.json`
From framework version: `0.1.0-alpha.0`
To framework version: `0.1.0-alpha.0`
From adapter schema version: `1`
To adapter schema version: `1`
From template version: `1`
To template version: `1`

## Summary

- Added rules: 0
- Changed rules: 1
- Removed rules: 0
- Unchanged rules: 12
- Added rule owner categories: 0
- Changed rule owner categories: 1
- Removed rule owner categories: 0
- Added framework files: 1
- Changed framework files: 7
- Removed framework files: 0
- Added target template surfaces: 1
- Changed target template surfaces: 11
- Removed target template surfaces: 0

## Adapter Contract Impact

- Framework version: `unchanged`
- Adapter schema version: `unchanged`
- Template version: `unchanged`
- Rule registry: `changed`
- Rule ownership: `changed`
- Framework files: `changed`
- Target template surfaces: `changed`

## Affected Rule Categories

- `CONTEXT`

## Affected Task Profiles

- `all installed adapter tasks`

## Affected Canonical Sources

- `framework/context-profiles.md`

## Migration Action Hints

- Compare installed `.ai/framework` files against changed framework sources before applying updates.
- Compare installed adapter templates against changed target template surfaces before applying updates.
- Recheck context profiles and bootstrap routing.

## Rule Changes

## Added Rules

- none

## Changed Rules

- `ALATYR-CONTEXT-001`

## Removed Rules

- none

## Unchanged Rules

- `ALATYR-ADAPTER-001`
- `ALATYR-APPROVAL-001`
- `ALATYR-BRIDGE-001`
- `ALATYR-CHANGE-001`
- `ALATYR-EVIDENCE-001`
- `ALATYR-INTEGRITY-001`
- `ALATYR-LIFECYCLE-001`
- `ALATYR-MODULE-001`
- `ALATYR-RISK-001`
- `ALATYR-SAFETY-001`
- `ALATYR-SAFETY-002`
- `ALATYR-SOURCE-001`

## Rule Owner Changes

Added rule owner categories:
- none

Changed rule owner categories:
- `CONTEXT`

Removed rule owner categories:
- none

## Framework File Changes

From framework directory: `<TARGET_REPOSITORY_ROOT>/.ai/framework`
To framework directory: `https://github.com/atvardovsky/AlatyrCore framework/`

Added framework files:
- `context-router.md`

Changed framework files:
- `README.md`
- `context-profiles.md`
- `guarantees.md`
- `installed-operations.md`
- `project-adapter-contract.md`
- `rule-ownership.md`
- `rule-registry.json`

Removed framework files:
- none

## Target Template Surface Changes

From template directory: `<TEMPORARY_TEMPLATE_DIR>/templates/target`
To template directory: `https://github.com/atvardovsky/AlatyrCore templates/target`

Added target template surfaces:
- `.ai/assistant/context-router.json`

Changed target template surfaces:
- `.ai/alatyr.yaml`
- `.ai/assistant/context-profiles.md`
- `.ai/assistant/flows/adapter-recheck.flow.md`
- `.ai/assistant/help.md`
- `.ai/assistant/templates/installation-note.md`
- `.ai/assistant/templates/operation-request.md`
- `.ai/assistant/templates/post-install-message.md`
- `.ai/assistant/templates/post-update-message.md`
- `.github/copilot-instructions.md`
- `AGENTS.md`
- `AI_ASSISTANTS.md`

Removed target template surfaces:
- none

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
