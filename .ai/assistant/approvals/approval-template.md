# Approval Record

Copy this template when a protected change needs durable approval evidence.

Approval ID: `<approval-id>`
Operation ID: `<operation-id>`
Operation type: `<operation-type>`
Plan version: `<plan-version>`
Plan hash: `<plan-hash-or-not-available-with-reason>`
Requested by: `<requester>`
Approved by: `<approver>`
Approved at: `<timestamp>`
Approval source/message: `<approval-message-reference>`
Expires at or reuse policy: `<expiration-or-reuse-policy>`
Scope invalidation rule: `<what-invalidates-this-approval>`

## Approved Scope

Allowed protected changes:

- `<allowed-protected-change>`

Allowed files or surfaces:

- `<allowed-file-or-surface>`

Excluded actions:

- `<excluded-action>`

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
