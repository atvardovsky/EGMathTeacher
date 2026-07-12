# Approval Record

Approval ID: `ALATYR-20260712-framework-context-router-update`
Operation ID: `EGMT-20260712-framework-context-router-update`
Operation type: `framework-upgrade ai-governance adapter-only`
Plan version: `v1`
Plan hash: `not available; approval was given as a direct update request before patch content existed`
Requested by: `project maintainer`
Approved by: `project maintainer`
Approved at: `2026-07-12T09:09:04+02:00`
Approval source/message: `User: "uodate alatyr"`
Expires at or reuse policy: `single implementation pass only`
Scope invalidation rule: `Approval is invalid if implementation changes product code, runtime config, production services, live-service access, destructive operations, dependencies, or accepted product behavior.`

## Approved Scope

Allowed protected changes:

- Update the installed Alatyr Core framework mirror from baseline
  `f66f857ae9992501d055c662c0c963bb9de7578d` to
  `6a6bef16d6966264b0686534c813cdbda210194a`.
- Add the target-owned machine-readable context router and align adapter
  bootstrap, help, bridge, module, maturity, installation, and post-update
  references.
- Update the local Alatyr consistency checker to require and validate the
  context router.
- Create framework-update migration evidence.

Allowed files or surfaces:

- `.ai/framework`
- `.ai/alatyr.yaml`
- `.ai/README.md`
- `.ai/assistant`
- `AGENTS.md`
- `AI_ASSISTANTS.md`
- `scripts/check-alatyr.sh`

Excluded actions:

- No product code changes.
- No runtime configuration changes.
- No live external calls.
- No destructive operations.
- No production dependency additions.
- No system web server, PM2, certificate, or deployment changes.
- No accepted business behavior changes.

Allowed actions mode:
`adapter-only`

## Plan Evidence

Approved plan summary:

```text
Compare installed Alatyr baseline against the current local AlatyrCore source,
copy portable framework updates, add an EGMathTeacher-specific
context-router.json, sync adapter-owned bootstrap/help/template references,
update the Alatyr checker, and run adapter validation.
```

Approved validation or manual review:

- `npm run alatyr:check`
- `git diff --check`
- manual source-doc review

## Use Result

Used by operation/change: `EGMT-20260712-framework-context-router-update`
Patch changed after approval: `yes; adapter-only implementation details were completed within the approved scope`
Implementation stayed within approved scope: `yes`
Validation run: `npm run alatyr:check`; `git diff --check`
Result/evidence: `Alatyr consistency check passed and git diff whitespace check passed`
Residual risk: `adapter validation proves required files and router shape, not semantic correctness of every future profile selection`
