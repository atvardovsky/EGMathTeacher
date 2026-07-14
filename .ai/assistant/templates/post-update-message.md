# Post-Update Assistant Message

Alatyr Core or its EGMathTeacher adapter was updated.

Recommended next action:

1. Run `alatyr-recheck` with allowed actions `adapter-only` when a follow-up
   audit is needed.
2. Compare `.ai/alatyr.yaml`, framework baseline, module profile, context
   router, context profiles, AI infrastructure router, bridge capability
   matrix, large-task orchestration files, and local adapter references.
3. Check root bridge files still point to `.ai/alatyr.yaml`, `.ai/README.md`,
   `.ai/assistant/context-router.json`,
   `.ai/assistant/context-profiles.md`, `.ai/assistant/help.md`,
   `.ai/assistant/help-reference.md`,
   `.ai/assistant/flows/operation-routing.flow.md`, and
   `.ai/assistant/templates/installation-note.md`.
4. Check whether the optional consistency-map module is still deferred or now
   needs `.ai/project/consistency-map.json`.
5. Run target validation if code, package, runtime, diagram source, or
   docs-linked behavior changed.

Report updated surfaces, framework version, adapter schema version, template
version, validation, skipped checks, approvals, and remaining migration gaps.
