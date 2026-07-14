# Approval Record

Approval ID: `ALATYR-20260714-framework-update-8dab3d1`
Operation ID: `framework-update-8dab3d1-20260714`
Operation type: `framework-upgrade,ai-infrastructure,adapter-only`
Plan version: `framework-update-v2-routing-2026-07-14`
Plan hash: `not available; approval was granted in chat for the direct update request`
Requested by: `project owner`
Approved by: `project owner`
Approved at: `2026-07-14T17:40:19+02:00`
Approval source/message: `User request: "update alatyr"`
Expires at or reuse policy: `single framework update operation only`
Scope invalidation rule: `Runtime code changes, product behavior changes, live service calls, dependency changes, system configuration, or framework source beyond AlatyrCore 8dab3d1 require new approval.`

## Approved Scope

Allowed protected changes:

- Refresh copied portable `.ai/framework` files from AlatyrCore.
- Update adapter manifest, installation/update notes, context routing, module
  and maturity metadata for the new framework baseline.
- Add target-owned AI infrastructure routing and large-task orchestration
  adapter surfaces introduced by template version 2.
- Strengthen the local Alatyr checker for schema-v2 routing and new adapter
  surfaces.
- Update root bridge files so future assistant sessions can find the compact
  bootstrap and new routing surfaces.

Allowed files or surfaces:

- `.ai/framework/*`
- `.ai/alatyr.yaml`
- `.ai/README.md`
- `.ai/assistant/*`
- `.ai/project/source-of-truth-registry.md`
- `.ai/project/validation.md`
- `.ai/project/gaps.md`
- `AGENTS.md`
- `AI_ASSISTANTS.md`
- `scripts/check-alatyr.sh`

Excluded actions:

- No product runtime code changes.
- No live OpenAI or other live service calls.
- No production dependency changes.
- No system web server or deployment configuration changes.
- No local database or user data mutation.

Allowed actions mode:
`adapter-only`

## Plan Evidence

Approved plan summary:

```text
Update the installed EGMathTeacher Alatyr adapter from AlatyrCore baseline
4654732 to 8dab3d1, adopt template version 2 routing metadata, add compact AI
infrastructure item routing, add large-task orchestration packet templates,
record deferred consistency-map state, refresh bridge/help/module/maturity
metadata, and strengthen npm run alatyr:check.
```

Source reviewed:

- `https://github.com/atvardovsky/AlatyrCore`
- Source commit: `8dab3d15c6e0dc983096c2aaca89fba75fe6fa14`
- Source type: Git URL
- License: `unknown`; no `LICENSE` file was present in the checked-out source
  root during this update.

## Use Result

Used by operation/change: `Alatyr framework update to 8dab3d1`
Patch changed after approval: `no protected scope expansion`
Implementation stayed within approved scope: `yes`
Validation run: `completed 2026-07-14`
Result/evidence:

- `npm run diagrams:render` passed and rendered 10 diagrams.
- `npm run diagrams:check` passed for 10 diagrams.
- `npm run alatyr:check` passed with the strengthened schema-v2 and AI-router
  checks.
- `git diff --check` passed.

Residual risk:

- Source AlatyrCore tools were reviewed but not executed or installed as
  target validation commands.
- Source license remains `unknown`; no `LICENSE` file was present in the
  checked-out source root.
- Optional `.ai/project/consistency-map.json` remains deferred, so broad fact
  relationship traversal still depends on manual source-of-truth review.
