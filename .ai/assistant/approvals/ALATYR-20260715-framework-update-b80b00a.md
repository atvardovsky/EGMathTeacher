# Approval Record

Approval ID: `ALATYR-20260715-framework-update-b80b00a`
Operation ID: `update-alatyr-20260715`
Operation type: `framework-upgrade`
Evidence classification: `historical-record`
Plan version: `1`
Plan hash: `not available - plan was described in chat and implemented in one operation`
Approved plan file: `not available - no standalone plan file was created`
Approved diff base: `origin/main`
Patch hash: `not available - content hash not preapproved`
Requested by: `user`
Approved by: `user`
Approved at: `2026-07-15`
Repository revision at approval: `aaf63749e6823641023341d13b82e9d0a7457473`
Approval source/message: `User message: update alatyr`
Expires at or reuse policy: `single use for the 2026-07-15 framework update`
Scope invalidation rule: `Any change outside .ai/** or scripts/check-alatyr.sh, any runtime behavior change, or any live/destructive action requires a new approval.`
Machine-readable record: `.ai/assistant/approvals/ALATYR-20260715-framework-update-b80b00a.json`

## Approved Scope

Allowed protected changes:

- `Update installed Alatyr adapter from v0.1.0-alpha.2 to v0.1.0-alpha.3`
- `Overwrite existing assistant adapter instructions within .ai only`
- `Strengthen local Alatyr consistency checker for alpha.3 governance`

Allowed files or surfaces:

- `.ai/**`
- `AGENTS.md`
- `AI_ASSISTANTS.md`
- `scripts/check-alatyr.sh`

Excluded files or surfaces:

- `apps/**`
- `deploy/**`
- `.env*`
- `.cert/**`
- `data/**`

Excluded actions:

- `runtime code changes`
- `live external service calls`
- `database or local data mutation`
- `system web server configuration changes`
- `new production dependencies`

Allowed actions mode:
`adapter-only`

## Plan Evidence

Approved plan summary:

```text
Update EGMathTeacher from Alatyr Core v0.1.0-alpha.2 to v0.1.0-alpha.3,
sync portable framework files, add machine-readable approval template,
update adapter metadata and governance docs, and strengthen the local checker.
```

Approved validation or manual review:

- `npm run alatyr:check`
- `portable validator with explicit machine-readable approval scope`
- `manual adapter source review`

## Use Result

Used by operation/change: `Alatyr alpha.3 adapter migration for EGMathTeacher`
Patch changed after approval: `no - approval covered the adapter-only migration scope`
Implementation stayed within approved scope: `yes - upstream validator enforced changed-path scope against the JSON record`
Validation run: `npm run alatyr:check passed; portable validate_target_adapter.py passed with --enforce-approval-scope against origin/main`
Result/evidence: `.ai/assistant/reports/ALATYR-20260715-framework-update-b80b00a.md and final assistant evidence`
Residual risk: `patch and plan hashes are not cryptographically preapproved; path-scope validation does not prove semantic correctness`
