# Adapter Recheck Flow

Use this flow after installing or updating Alatyr Core in EGMathTeacher, or
when the programmer asks whether the installed adapter is still coherent.

## Target Sources

- Framework baseline/source: `.ai/alatyr.yaml` and
  `.ai/assistant/templates/installation-note.md`
- Adapter manifest: `.ai/alatyr.yaml`
- Project source of truth: `.ai/project/README.md`,
  `.ai/project/blueprint.md`, `.ai/project/contour.md`, and
  `.ai/project/source-of-truth-registry.md`
- Context router: `.ai/assistant/context-router.json`
- Context profiles: `.ai/assistant/context-profiles.md`
- AI infrastructure router: `.ai/assistant/ai-infrastructure-router.json`
- Module profile: `.ai/assistant/module-profile.md`
- Maturity profile: `.ai/assistant/maturity-profile.md`
- Bridge capability matrix: `.ai/assistant/bridge-capability-matrix.md`
- Target validation: `.ai/project/validation.md`
- Supported assistants: AGENTS-aware, Codex, and generic Markdown assistants
- Operation help and routing: `.ai/assistant/help.md`,
  `.ai/assistant/help-reference.md`, and
  `.ai/assistant/flows/operation-routing.flow.md`
- AI infrastructure inventory:
  `.ai/assistant/flows/ai-infrastructure-inventory.flow.md`
- Large-task orchestration:
  `.ai/assistant/flows/large-task-orchestration.flow.md`
- Large-task packet template:
  `.ai/assistant/templates/large-task-operation-packet.md`
- Chat-message templates: `.ai/assistant/templates/post-install-message.md`,
  `.ai/assistant/templates/post-update-message.md`
- Migration note template: `.ai/assistant/templates/migration-note.md`
- Effectiveness report template:
  `.ai/assistant/templates/effectiveness-report.md`
- Approval templates: `.ai/assistant/approvals/approval-template.md` and
  `.ai/assistant/approvals/approval-record-template.json`

## Steps

1. Treat `AGENTS.md` as host-preloaded when available, then load compact
   bootstrap: `.ai/alatyr.yaml`, `.ai/README.md`, and
   `.ai/assistant/context-router.json`.
2. Identify whether this is a post-installation recheck, framework update
   recheck, bridge compatibility review, or maturity audit.
3. Compare installed framework files against the recorded framework baseline or
   update source.
4. Compare framework version, adapter schema version, template version, module
   states, known gaps, local deviations, and owner facts in `.ai/alatyr.yaml`.
5. Check required core and optional module state in
   `.ai/assistant/module-profile.md`.
6. Check target adapter references to framework files, operation help, routing
   flows, AI infrastructure router and inventory, large-task orchestration
   files, gates, prompts, skills, bridge files, checker rules, chat-message
   templates, and final-evidence expectations.
7. Check adapter drift hazards: hard-coded local machine paths in `.ai/*`,
   root assistant entry points, bridge files, templates, and policies; stale
   statements about whether local Alatyr or adapter checkers exist; duplicate
   required-context references inside context profiles or router entries;
   missing `.ai/assistant/context-router.json` references where bootstrap
   routing is described; unresolved owner placeholders that are not recorded as
   known gaps; missing approval-record machine template or manifest reference;
   and target-local adapter checker evidence that no longer matches repository
   files.
8. Check project blueprint/source-of-truth ownership, registry entries,
   invariant/dependency constraints, missing facts, and drift.
9. Check security, live-service, destructive-operation, dependency, credential,
   diagram, generated-artifact, validation, and lifecycle policies.
10. Check task-specific maturity using `.ai/assistant/maturity-profile.md`.
11. Check bridge behavior using `.ai/assistant/bridge-capability-matrix.md`.
12. Check the optional consistency-map module state and report that
    `.ai/project/consistency-map.json` is absent when the module is deferred.
13. Identify required migrations, approvals, unresolved facts, and skipped
    checks.
14. Use `.ai/assistant/templates/migration-note.md` when a framework update
    requires target migration evidence.
15. Use `.ai/assistant/templates/effectiveness-report.md` only when comparing
    adapter effectiveness across comparable tasks or adapter states.
16. Run target validation that exists. Do not invent commands.
17. Report final evidence and residual risk.

## Final Evidence

Report:

- recheck type
- framework baseline or update source
- framework version, adapter schema version, and template version
- files inspected
- adapter references changed or still current
- adapter drift checks result, including local path leakage, stale checker
  statements, duplicate profile references, context-router references, owner
  placeholders, and target-local checker evidence
- blueprint/source-of-truth registry status
- invariant/dependency constraint status
- context router and context profile status
- module profile status
- help, routing, AI infrastructure router/inventory, large-task orchestration,
  consistency-map state, bridge, prompt, skill, gate, checker, diagram,
  chat-message, and lifecycle status
- bridge capability matrix status
- target validation run or unresolved
- approval scope enforcement result when a JSON approval record is selected
- approvals needed
- task-specific maturity level and gaps
- migration note created or not needed
- residual risk

## Rejection Criteria

Reject or revise recheck work that:

- claims success without inspecting the installed target adapter
- overwrites target facts just because the source framework changed
- copies Alatyr Core source-repository commands into the target
- ignores supported assistant bridge drift
- hides missing validation, missing approval, or maturity gaps
