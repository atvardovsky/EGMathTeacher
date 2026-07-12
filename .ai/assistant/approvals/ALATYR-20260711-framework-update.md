# Approval Record

Approval ID: `ALATYR-APPROVAL-20260711-framework-update`
Operation ID: `ALATYR-20260711-framework-update`
Operation type: `recheck-after-framework-update`
Plan version: `1`
Plan hash: not available; plan was reviewed in chat and scoped by explicit
programmer approval.
Requested by: programmer
Approved by: programmer
Approved at: 2026-07-11
Approval source/message: user message `approve`
Expires at or reuse policy: one-time use for this Alatyr update operation
Scope invalidation rule: invalid if product code, runtime config, system web
server config, live services, new dependencies, or unsupported bridge files are
added to scope.

## Approved Scope

Allowed protected changes:

- Adapter-only Alatyr update from `https://github.com/atvardovsky/AlatyrCore` at
  `f66f857ae9992501d055c662c0c963bb9de7578d`.
- Add new Alatyr framework/assistant files.
- Manually merge existing `.ai/framework`, `.ai/assistant`, `AGENTS.md`, and
  `AI_ASSISTANTS.md`.
- Preserve EGMathTeacher project facts.

Allowed files or surfaces:

- `.ai/framework`
- `.ai/assistant`
- `.ai/alatyr.yaml`
- `.ai/project` docs and assistant-governance diagram sources needed for
  documentation sync
- `AGENTS.md`
- `AI_ASSISTANTS.md`

Excluded actions:

- product code changes
- runtime configuration changes
- system web server configuration changes
- live external service calls
- new production dependencies
- optional assistant bridge files for unsupported assistant surfaces

Allowed actions mode: `adapter-only`

## Plan Evidence

Approved plan summary:

```text
Update the installed EGMathTeacher Alatyr adapter from baseline 17cf62e to
AlatyrCore f66f857 by syncing portable framework files, adding new manifest,
profile, registry, bridge, approval, prompt-injection, output-contract, and
migration surfaces, and manually merging target-owned assistant bridge and
operation files without changing product runtime behavior.
```

Approved validation or manual review:

- Compare `.ai/framework` against `<ALATYR_SOURCE_CHECKOUT>/framework`.
- Check required adapter files exist.
- Scan current target-owned adapter files for unresolved source placeholders.
- Render diagrams because `assistant-governance.mmd` changed.
- Skip product build/tests/lint because no product code changed.

## Use Result

Used by operation/change: `ALATYR-20260711-framework-update`
Patch changed after approval: no; implementation stayed within adapter-only
Alatyr update scope.
Implementation stayed within approved scope: yes; no product code, runtime
config, live service, system web server, dependency, or unsupported bridge file
changes were made.
Validation run: manual source review, framework diff, JSON registry parse,
required-file check, placeholder scan, and `npm run diagrams:render`.
Result/evidence: `.ai/assistant/reports/ALATYR-20260711-framework-update.md`
Residual risk: no target-owned Alatyr consistency checker, no CI, no automated
diagram drift check.
