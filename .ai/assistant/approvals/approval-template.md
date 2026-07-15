# Approval Record

Copy this template when a protected change needs durable approval evidence.
Use `.ai/assistant/approvals/approval-record-template.json` for deterministic
scope enforcement. This Markdown record remains the human review and evidence
surface; narrative path mentions do not expand the machine-readable scope.

Approval ID: `<approval-id>`
Operation ID: `<operation-id>`
Operation type: `<operation-type>`
Evidence classification: `historical-record`
Plan version: `<plan-version>`
Plan hash: `<plan-sha256-or-not-available-with-reason>`
Approved plan file: `<target-relative-plan-file-or-not-available-with-reason>`
Approved diff base: `<approved-git-diff-base>`
Patch hash: `<patch-sha256-or-not-available-with-reason>`
Requested by: `<requester>`
Approved by: `<approver>`
Approved at: `<timestamp>`
Repository revision at approval: `<repository-revision-at-approval>`
Approval source/message: `<approval-message-reference>`
Expires at or reuse policy: `<expiration-or-reuse-policy>`
Scope invalidation rule: `<what-invalidates-this-approval>`
Machine-readable record: `<target-relative-approval-record-json>`

## Approved Scope

Allowed protected changes:

- `<allowed-protected-change>`

Allowed files or surfaces:

- `<allowed-file-or-surface>`

Excluded actions:

- `<excluded-action>`

Excluded files or surfaces:

- `<excluded-file-or-surface-or-none>`

Allowed actions mode:
`<read-only|docs-only|adapter-only|code-and-tests|full-with-approval>`

## Plan Evidence

Approved plan summary:

```text
<approved-plan-summary>
```

Approved validation or manual review:

- `<approved-validation-or-review>`

## Use Result

Used by operation/change: `<task-operation-or-change-reference>`
Patch changed after approval: `<yes-no-and-reason>`
Implementation stayed within approved scope: `<yes-no-and-reason>`
Validation run: `<validation-run-or-skipped-with-reason>`
Result/evidence: `<result-or-evidence-reference>`
Residual risk: `<residual-risk>`
