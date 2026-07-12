# Approval Record

Approval ID: `ALATYR-20260712-framework-update-4654732`
Operation ID: `framework-update-4654732-20260712`
Operation type: `framework-upgrade ai-infrastructure adapter-only`
Plan version: `2026-07-12-framework-update-4654732-v1`
Plan hash: `not available; approval followed the direct user request "update alatyr"`
Requested by: `atvardovsky`
Approved by: `atvardovsky`
Approved at: `2026-07-12T20:22:00+02:00`
Approval source/message: `User said "update alatyr".`
Expires at or reuse policy: `single framework-update scope only`
Scope invalidation rule: `new AlatyrCore source commit, new bridge surface, checker permission change, production dependency, or product behavior change requires fresh approval`

## Approved Scope

Allowed protected changes:

- Update installed portable `.ai/framework` files from AlatyrCore.
- Update `.ai/alatyr.yaml` source baseline.
- Adapt target-owned adapter flow, gate, source-access, output-contract, and migration evidence files for the new framework drift-check guidance.
- Preserve EGMathTeacher product facts and validation commands.

Allowed files or surfaces:

- `.ai/framework`
- `.ai/alatyr.yaml`
- `.ai/assistant/flows`
- `.ai/assistant/gates`
- `.ai/assistant/policies`
- `.ai/assistant/templates`
- `.ai/assistant/reports`
- `.ai/assistant/approvals`
- `.ai/assistant/infrastructure-index.md`
- `.ai/assistant/module-profile.md`
- `.ai/assistant/maturity-profile.md`

Excluded actions:

- Product code or business behavior changes.
- New production dependencies or external services.
- Live OpenAI or other spend-affecting validation.
- Executing remote AlatyrCore tools or scripts as target commands.
- System web server, deployment, TLS, PM2, or database destructive actions.

Allowed actions mode:
`adapter-only`

## Plan Evidence

Approved plan summary:

```text
Update the installed Alatyr Core baseline from 6a6bef1 to 4654732, carry the
new adapter drift-check guidance into EGMathTeacher-owned adapter files, record
migration/approval evidence, and validate the target adapter with existing
local checks.
```

Approved validation or manual review:

- `npm run alatyr:check`
- `git diff --check`
- manual framework source diff review
- manual adapter drift scan

## Use Result

Used by operation/change: `framework-update-4654732-20260712`
Patch changed after approval: `yes; target-owned wording was adapted to EGMathTeacher files instead of copied with placeholders`
Implementation stayed within approved scope: `yes`
Validation run: `2026-07-12T20:27:12+02:00: npm run alatyr:check; git diff --check; manual framework source diff review; manual adapter drift scan`
Result/evidence: `local Alatyr consistency and whitespace checks passed; source diff reviewed from AlatyrCore commit 465473284966676d86bb6e55d1254b20e415bf5c; source tools were not executed or installed`
Residual risk: `source AlatyrCore license file was not found; source validator remains uninstalled target tooling; framework/context-router.md has target whitespace normalization only`
