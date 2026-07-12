# EGMathTeacher Alatyr Module Profile

This file records which Alatyr Core capabilities are enabled, deferred,
blocked, or not applicable for EGMathTeacher.

## Required Core Profile

Core profile state: complete with documented gaps
Last reviewed: 2026-07-12
Reviewed by: Codex using Alatyr update approval from the programmer

Core item: `contours`
State: enabled
Owner or file: `.ai/project/contour.md`, `.ai/framework/contour.md`,
`.ai/assistant/contour.md`
Required files:

- `.ai/project/contour.md`
- `.ai/framework/contour.md`
- `.ai/assistant/contour.md`

Evidence: framework, project, and assistant ownership boundaries are present.
Validation or review: manual source-doc review.
Approval needs: required before architecture, business, or assistant-instruction
overwrites.
Residual risk: broad future changes still need profile-specific context.

Core item: `manifest-and-versioning`
State: enabled
Owner or file: `.ai/alatyr.yaml`
Required files:

- `.ai/alatyr.yaml`
- `.ai/assistant/templates/installation-note.md`
- `.ai/assistant/templates/migration-note.md`

Evidence: manifest records framework version, adapter schema version, template
version, source commit, supported assistants, known gaps, and deviations.
Validation or review: `npm run alatyr:check` and manual manifest/source
review.
Approval needs: required before overwriting existing assistant instructions.
Residual risk: the local checker covers required files, script wiring, current
gap text, CODEOWNERS, CI wiring, and diagram source hashes; it does not prove
semantic correctness of every project fact.

Core item: `adapter-ownership`
State: enabled with gap
Owner or file: `.ai/assistant/contour.md`
Required files:

- `.ai/assistant/contour.md`
- `AGENTS.md`
- `AI_ASSISTANTS.md`

Evidence: root bridge files, `.github/CODEOWNERS`, and assistant contour define
current ownership.
Validation or review: `npm run alatyr:check` and manual bridge review.
Approval needs: required before adding supported bridge surfaces or changing
approval gates.
Residual risk: CODEOWNERS is not proof of GitHub branch protection or review
enforcement.

Core item: `context-profiles`
State: enabled
Owner or file: `.ai/assistant/context-profiles.md`
Required files:

- `.ai/assistant/context-profiles.md`

Evidence: task profiles exist for docs, code, business, architecture, data,
security, AI infrastructure, and framework upgrades.
Validation or review: manual profile review.
Approval needs: required before weakening mandatory context or approval
requirements.
Residual risk: context selection remains assistant-enforced, not
machine-enforced.

Core item: `context-router`
State: enabled
Owner or file: `.ai/assistant/context-router.json`
Required files:

- `.ai/assistant/context-router.json`
- `.ai/assistant/context-profiles.md`

Evidence: machine-readable routing exists for canonical task profiles and
points to EGMathTeacher bootstrap context, required context, validation,
approval gates, and final evidence fields.
Validation or review: `npm run alatyr:check` and manual router/profile review.
Approval needs: required before weakening mandatory context, approval
requirements, validation expectations, or final evidence.
Residual risk: the router is a deterministic aid; human profile rationale and
logical integrity review still govern conflicts and boundary expansion.

Core item: `source-of-truth-registry`
State: enabled
Owner or file: `.ai/project/source-of-truth-registry.md`
Required files:

- `.ai/project/source-of-truth-registry.md`

Evidence: registry maps product, business, architecture, data, validation,
security, assistant operation, and AI infrastructure facts to owners.
Validation or review: manual source-doc review.
Approval needs: required before changing canonical ownership for protected
facts.
Residual risk: the local consistency checker does not prove full semantic
source-of-truth registry sync.

Core item: `risk-approval-integrity`
State: enabled
Owner or file: `.ai/assistant/gates/checklist.md`
Required files:

- `.ai/framework/change-risk-model.md`
- `.ai/framework/approval-records.md`
- `.ai/framework/logical-integrity.md`
- `.ai/assistant/gates/checklist.md`
- `.ai/assistant/flows/logical-integrity-review.flow.md`

Evidence: framework rules, focused gates, and logical integrity flow are
installed.
Validation or review: manual gate review.
Approval needs: explicit programmer approval for protected categories.
Residual risk: durable approval records are optional and manually maintained.

Core item: `validation-and-final-evidence`
State: enabled with gap
Owner or file: `.ai/project/validation.md` and
`.ai/assistant/gates/final-evidence.md`
Required files:

- `.ai/project/validation.md`
- `.ai/assistant/gates/validation-gates.md`
- `.ai/assistant/gates/final-evidence.md`
- `.ai/assistant/templates/adapter-output-contracts.md`

Evidence: build, test, lint, browser E2E, diagram-render, and manual review
expectations are documented.
Validation or review: target commands when task-relevant; manual source review
for adapter-only work.
Approval needs: required before weakening validation or final evidence.
Residual risk: no frontend unit/component, accessibility, or visual regression
test command exists.

## Optional Modules

Module: `blueprint-change`
State: enabled
Owner or file: `.ai/assistant/flows/blueprint-driven-change.flow.md`
Required files:

- `.ai/project/blueprint.md`
- `.ai/assistant/flows/blueprint-driven-change.flow.md`

Reason: product behavior, architecture, data, and runtime facts already have
source-of-truth docs.
Validation or review: target commands selected by risk.
Approval needs: protected product or architecture changes require explicit
approval.
Residual risk: CI is configured but not proven by a remote run in this local
workspace.
Next action: keep blueprint docs synced with code changes.

Module: `diagrams`
State: enabled
Owner or file: `.ai/project/diagrams.md`
Required files:

- `.ai/project/diagrams.md`
- `.ai/project/diagrams/*.mmd`

Reason: Mermaid sources and rendered SVG artifacts exist.
Validation or review: `npm run diagrams:render` when diagram sources change.
Approval needs: approval only when diagram edits encode protected fact changes.
Residual risk: diagram drift checks run locally and in GitHub Actions, but no
remote CI run was observed in this local workspace.
Next action: add CI only if project needs stronger automation.

Module: `ai-infrastructure`
State: enabled
Owner or file: `.ai/assistant/infrastructure-index.md`
Required files:

- `.ai/assistant/flows/ai-infrastructure-inventory.flow.md`
- `.ai/assistant/flows/skill-adaptation.flow.md`
- `.ai/assistant/policies/ai-infrastructure-source-access.md`
- `.ai/assistant/policies/prompt-injection.md`

Reason: assistant infrastructure inventory and source-access rules exist.
Validation or review: manual inventory review; target validation when
canonical recurring behavior changes.
Approval needs: required before importing third-party infrastructure or
broadening permissions.
Residual risk: no assistant-native skills are installed.
Next action: use `alatyr-ai-inventory` before add/adapt/remove work.

Module: `multi-assistant-bridges`
State: deferred
Owner or file: `.ai/assistant/bridge-capability-matrix.md`
Required files:

- `.ai/assistant/bridge-capability-matrix.md`
- `AGENTS.md`
- `AI_ASSISTANTS.md`

Reason: current repo only supports AGENTS-aware, Codex, and generic assistant
entry points.
Validation or review: manual bridge review.
Approval needs: required before adding or overwriting assistant bridge files.
Residual risk: Claude, Gemini, Cursor, GitHub Copilot, Devin/Cascade, and
Windsurf wrappers are not installed.
Next action: add a bridge only when the project starts using that assistant.

Module: `installed-operations`
State: enabled
Owner or file: `.ai/assistant/help.md`
Required files:

- `.ai/assistant/help.md`
- `.ai/assistant/help-reference.md`
- `.ai/assistant/flows/operation-routing.flow.md`

Reason: installed Alatyr requests are already used for help, update, inventory,
and change flows.
Validation or review: manual operation-routing review.
Approval needs: required before weakening approval or routing rules.
Residual risk: operations are assistant request aliases, not executable
commands.
Next action: keep help and root bridge aliases aligned.

Module: `durable-approvals`
State: enabled
Owner or file: `.ai/assistant/approvals/approval-template.md`
Required files:

- `.ai/assistant/approvals/approval-template.md`

Reason: protected adapter and AI infrastructure updates may need reusable
approval evidence.
Validation or review: manual approval record review.
Approval needs: approval must be explicit in the user message.
Residual risk: approval records are manually created when needed.
Next action: create records for broad protected changes when final evidence
needs durable scope.

Module: `local-alatyr-consistency-checker`
State: enabled
Owner or file: `scripts/check-alatyr.sh`
Required files:

- `scripts/check-alatyr.sh`
- `package.json`
- `.github/workflows/ci.yml`
- `.github/CODEOWNERS`

Reason: local deterministic checks now verify required adapter files, package
scripts, CI wiring, CODEOWNERS, current gap text, and diagram source-hash
consistency.
Validation or review: `npm run alatyr:check`.
Approval needs: required before weakening checker coverage, validation gates,
or approval requirements.
Residual risk: checker coverage is structural and deterministic; it does not
prove semantic correctness of every business, architecture, security, or
documentation-sync fact.
Next action: expand only when new deterministic invariants become valuable.

Module: `migration-diff`
State: enabled
Owner or file: `.ai/assistant/templates/migration-note.md`
Required files:

- `.ai/assistant/templates/migration-note.md`

Reason: framework update from AlatyrCore now requires migration evidence.
Validation or review: manual migration review; source tooling can be used as
evidence only.
Approval needs: required before applying protected target migrations.
Residual risk: no target-local migration-diff checker exists.
Next action: keep migration notes with framework-update reports.

Module: `effectiveness-metrics`
State: deferred
Owner or file: `.ai/assistant/templates/effectiveness-report.md`
Required files:

- `.ai/assistant/templates/effectiveness-report.md`

Reason: template is installed, but no comparable baseline measurements exist.
Validation or review: manual report review.
Approval needs: not normally required unless metrics change gates or behavior.
Residual risk: effectiveness claims remain qualitative until measured.
Next action: use only when comparing comparable tasks across adapter states.

Module: `scaffolding`
State: deferred
Owner or file: `.ai/framework/scaffolding.md`
Required files:

- none in target runtime

Reason: AlatyrCore scaffolder is source tooling, not a target mechanism.
Validation or review: source dry-run output can inform update planning.
Approval needs: required before writing or overwriting target instructions.
Residual risk: no target-owned scaffolder or checker exists.
Next action: continue using manual adapter-specific merges.

## Evidence

Report enabled modules, deferred modules, blocked modules, validation,
approvals, skipped checks, and residual risk before claiming adapter maturity.
