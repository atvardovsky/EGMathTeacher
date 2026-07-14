# Approval Record

Approval ID: `ALATYR-20260714-framework-update-5547fca`
Operation ID: `framework-update-5547fca-20260714`
Operation type: `framework-upgrade,adapter-only`
Plan version: `framework-update-alpha2-scaffolding-2026-07-14`
Plan hash: `not available; approval was granted in chat for the direct update request`
Requested by: `project owner`
Approved by: `project owner`
Approved at: `2026-07-14T20:00:28+02:00`
Approval source/message: `User request: "update alatyr"`
Expires at or reuse policy: `single framework update operation only`
Scope invalidation rule: `Runtime code changes, product behavior changes, live service calls, dependency changes, system configuration, new target templates, bridge surface changes, or framework source beyond AlatyrCore 5547fca require new approval.`

## Approved Scope

Allowed protected changes:

- Refresh the recorded AlatyrCore baseline from `8dab3d1` to `5547fca`.
- Update `.ai/framework/scaffolding.md` with source-owned scaffold-profile
  wording from `v0.1.0-alpha.2`.
- Update adapter manifest, installation/update notes, module/maturity
  metadata, infrastructure index, and migration evidence for the new baseline.
- Preserve existing EGMathTeacher project facts, product runtime behavior,
  target templates, bridge surfaces, validation gates, and approval rules.

Allowed files or surfaces:

- `.ai/framework/scaffolding.md`
- `.ai/alatyr.yaml`
- `.ai/assistant/module-profile.md`
- `.ai/assistant/maturity-profile.md`
- `.ai/assistant/infrastructure-index.md`
- `.ai/assistant/templates/installation-note.md`
- `.ai/assistant/approvals/ALATYR-20260714-framework-update-5547fca.md`
- `.ai/assistant/reports/ALATYR-20260714-framework-update-5547fca.md`

Excluded actions:

- No product runtime code changes.
- No live OpenAI or other live service calls.
- No production dependency changes.
- No system web server or deployment configuration changes.
- No local database or user data mutation.
- No import of source-repository tools, CI, conformance fixtures, or benchmark
  results into the target adapter.

Allowed actions mode:
`adapter-only`

## Plan Evidence

Approved plan summary:

```text
Update the installed EGMathTeacher Alatyr adapter from AlatyrCore baseline
8dab3d1 to 5547fca / v0.1.0-alpha.2. Copy only the portable framework
scaffolding-profile wording that changed between the baselines, update
manifest and adapter evidence metadata, and leave source-repository tooling,
target templates, product behavior, runtime code, and bridge surfaces
unchanged.
```

Source reviewed:

- `https://github.com/atvardovsky/AlatyrCore`
- Source commit: `5547fca4f5cf7637463c525178f003d1ab65a4bc`
- Source tag: `v0.1.0-alpha.2`
- Source type: Git URL
- License: `unknown`; no `LICENSE` file was present in the checked-out source
  root during this update.

## Use Result

Used by operation/change: `Alatyr framework update to 5547fca`
Patch changed after approval: `no protected scope expansion`
Implementation stayed within approved scope: `yes`
Validation run: `completed 2026-07-14`
Result/evidence:

- `npm run alatyr:check` passed with the current adapter consistency checks.
- `git diff --check` passed.
- Manual migration review confirmed that the rule registry, adapter schema,
  template version, target templates, bridge surfaces, runtime code, and
  product behavior did not change.

Residual risk:

- Source AlatyrCore source-repository tools were reviewed but not installed as
  target validation commands.
- Source license remains `unknown`; no `LICENSE` file was present in the
  checked-out source root.
- Optional `.ai/project/consistency-map.json` remains deferred, so broad fact
  relationship traversal still depends on manual source-of-truth review.
