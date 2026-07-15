# EGMathTeacher Alatyr Adapter Output Contracts

Use this file to define minimum evidence after installation, framework update,
or adapter recheck work.

When protected-change scope needs deterministic path containment, pair the
human approval record with
`.ai/assistant/approvals/approval-record-template.json` and report the
explicit JSON record plus Git diff base used for the check.

## Contract: `installation-output`

Use after the initial Alatyr Core installation or a scoped adapter expansion.

- Operation id
- Operation type: installation or adapter expansion
- Installation id
- Requested by
- Framework source or baseline
- Framework version
- Adapter schema version
- Template version
- Manifest path: `.ai/alatyr.yaml`
- Installation plan path or summary
- Approval records used or why not required
- Approval scope enforcement or why not required
- Surfaces created
- Surfaces updated
- Surfaces skipped and reason
- Existing files preserved
- Existing files overwritten with approval, if any
- Required core profile result
- Optional module profile result
- Context router result
- Context profiles result
- Source-of-truth registry result
- Re-derived invariant result
- Review-item reconciliation result
- Task-specific maturity result
- Bridge capability matrix result
- Root entry points checked
- Supported bridge files checked
- Adapter drift checks result
- Local path leakage result
- Target-local checker status or unresolved gap
- AI infrastructure inventory result or skipped reason
- Validation run or manual review
- Validation skipped or unresolved
- Post-install message result
- Final evidence
- Residual risk

## Contract: `framework-update-output`

Use after updating or comparing an installed adapter against a newer Alatyr
Core baseline.

- Operation id
- Operation type: framework update or impact review
- Update source or baseline
- Previous framework version
- New framework version
- Previous adapter schema version
- New adapter schema version
- Previous template version
- New template version
- Manifest path: `.ai/alatyr.yaml`
- Migration note path: `.ai/assistant/reports/<report-or-migration-note>.md`
- Migration diff result
- Changed rule ids
- Added or removed framework files
- Target adapter actions required
- Target adapter actions optional
- Surfaces created
- Surfaces updated
- Surfaces skipped and reason
- Existing files preserved
- Approval records used or why not required
- Approval scope enforcement
- Required core profile result
- Optional module profile result
- Context router result
- Context profiles result
- Source-of-truth registry result
- Re-derived invariant result
- Review-item reconciliation result
- Task-specific maturity result
- Operation help and routing result
- AI infrastructure router result
- Large-task orchestration and packet template result
- Consistency-map module state
- Bridge capability matrix result
- Adapter drift checks result
- Local path leakage result
- Target-local checker status or unresolved gap
- Validation run or manual review
- Validation skipped or unresolved
- Post-update message result
- Final evidence
- Residual risk

## Contract: `adapter-recheck-output`

Use after read-only, adapter-only, or maturity-focused rechecks of an installed
adapter.

- Operation id
- Operation type: adapter recheck or maturity review
- Recheck trigger
- Allowed actions
- Manifest path: `.ai/alatyr.yaml`
- Installation note status
- Framework version
- Adapter schema version
- Template version
- Approval records used or why not required
- Approval scope enforcement or why not required
- Surfaces created or none
- Surfaces updated or none
- Surfaces skipped and reason
- Existing files preserved
- Required core profile result
- Optional module profile result
- Context router result
- Context profiles result
- Source-of-truth registry result
- Re-derived invariant result
- Review-item reconciliation result
- Task-specific maturity result
- Bridge capability matrix result
- Operation help and routing result
- Approval-record policy result
- Adapter drift checks result
- Local path leakage result
- Target-local checker status or unresolved gap
- AI infrastructure inventory result or skipped reason
- AI infrastructure item route or skipped reason
- Prompt-injection policy result
- Validation run or manual review
- Validation skipped or unresolved
- Recommended next operation
- Final evidence
- Residual risk
