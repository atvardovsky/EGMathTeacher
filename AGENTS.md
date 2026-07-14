# Agent Instructions

This repository uses Alatyr Core for AI-assisted development.

## Bootstrap Context

At the start of an Alatyr-guided task, read only the bootstrap context first:

- `.ai/alatyr.yaml`
- `.ai/README.md`
- `.ai/assistant/context-router.json`

Then select the matching profile from `.ai/assistant/context-router.json`.
Use `.ai/assistant/context-profiles.md` for human rationale, conflicts, or
missing router entries, then read the profile-required framework, project,
assistant, flow, gate, policy, and validation files before expanding context.

The router is schema v2: use `preloaded_context`, compact bootstrap,
project-area overlays, and the `large-or-resumable` task-scale overlay when
they apply. Record the expansion reason when context budgets are exceeded.
Expand beyond the selected profile only when the task crosses architecture,
business, data, security, assistant-infrastructure, lifecycle, or governance
boundaries, when an overlay applies, or when evidence conflicts.

## Session Bootstrap

- Do not rely on previous chat messages for Alatyr state.
- After installation or framework update, or when adapter state is unclear,
  read `.ai/assistant/templates/installation-note.md`,
  `.ai/assistant/templates/post-install-message.md`, and
  `.ai/assistant/templates/post-update-message.md`.
- If the user asks for Alatyr help, commands, available actions, or gives an
  unclear Alatyr request, read `.ai/assistant/help.md` and use
  `.ai/assistant/flows/operation-routing.flow.md` before editing files.

## Project Rules

- Project name: EGMathTeacher.
- Primary stack: npm workspaces, NestJS API, React/Vite web app, SQLite,
  OpenAI APIs, Mantine UI.
- Product source-of-truth docs: `README.md`,
  `.ai/project/README.md`, `.ai/project/blueprint.md`,
  `.ai/project/contour.md`, `.ai/project/source-of-truth-registry.md`,
  `.ai/project/context-map.md`, `.ai/project/use-cases.md`,
  `.ai/project/architecture.md`, `.ai/project/runtime-flows.md`,
  `.ai/project/data-model.md`,
  `.ai/project/knowledge-pack-runtime-repair-plan.md`,
  `.ai/project/lesson-agent-tools.md`,
  `.ai/project/validation.md`,
  `.ai/project/gaps.md`,
  `.ai/project/security-safety.md`, `.ai/project/guards.md`,
  `.ai/project/diagrams.md`, `apps/api/README.md`, and
  `apps/api/docs/webrtc-module.md`.
- For WebRTC or inherited voice-assistant behavior, also read
  `apps/api/README.md`, `apps/api/docs/webrtc-module.md`, and
  `apps/api/Agent.md`.
- Validation commands: `npm run build`, `npm test`, `npm run lint`,
  `npm run diagrams:render` when diagram sources change,
  `npm run diagrams:check` for rendered diagram drift, and
  `npm run smoke:dev` against a running dev stack,
  `npm run e2e` for mocked browser E2E, and
  `npm run alatyr:check` for adapter consistency.
- Dev server: `npm run dev`; web is configured for
  `https://localhost:5137` when `.cert/localhost-*` exists, API port `3000`.
- Security policy: use `.ai/assistant/gates/checklist.md`; never expose
  secrets or call live external services without task need and approval.
- AI infrastructure source-access policy:
  `.ai/assistant/policies/ai-infrastructure-source-access.md`.
- Prompt-injection policy:
  `.ai/assistant/policies/prompt-injection.md`.
- Current assistant infrastructure index:
  `.ai/assistant/infrastructure-index.md`.

## Alatyr Core Rules

Canonical rule references: `ALATYR-CONTEXT-001`, `ALATYR-SOURCE-001`,
`ALATYR-RISK-001`, `ALATYR-APPROVAL-001`, `ALATYR-SAFETY-001`,
`ALATYR-SAFETY-002`, `ALATYR-INTEGRITY-001`, `ALATYR-CHANGE-001`,
`ALATYR-ADAPTER-001`, `ALATYR-MODULE-001`, and `ALATYR-EVIDENCE-001`.

- Keep framework rules under `.ai/framework`.
- Keep target project facts under `.ai/project` or target public docs.
- Keep repository adapter workflows, prompts, gates, skills, bridge files, and
  validation facts under `.ai/assistant` or assistant-specific bridge files.
- Do not invent project facts, commands, business rules, security policy, or
  diagram tooling.
- Use logical integrity review for semantic fact changes and repair the
  smallest coherent set of owning files.
- Use blueprint-driven change or the target equivalent for accepted product
  behavior changes.
- Use installed-operation flows for post-install blueprint creation, adapter
  rechecks, framework update reviews, and drift reviews.
- Use `.ai/assistant/module-profile.md` to check whether optional modules are
  enabled, deferred, disabled, not applicable, or blocked before relying on
  them.
- Use `alatyr-ai-inventory` or
  `.ai/assistant/flows/ai-infrastructure-inventory.flow.md` before adding,
  importing, replacing, or removing assistant infrastructure.
- Use `.ai/assistant/ai-infrastructure-router.json` before loading detailed
  skills, prompts, gates, checkers, bridge files, or adaptation context.
- Use `.ai/assistant/flows/large-task-orchestration.flow.md` only when the
  router's `large-or-resumable` overlay is activated.
- Adapt skills, prompts, wrappers, bridges, rules, MCP/tool configs, gates,
  checkers, and third-party assistant infrastructure from target evidence
  before making them canonical.
- Treat `alatyr-adaptation <source>` and `alatyr-add-ai <source>` as AI
  infrastructure adaptation requests. Review existing infrastructure, source
  access, provenance, permissions, safety, prompt-injection risk, and approval
  before importing or normalizing the source into canonical target files.
- Use target validation only when it exists. Report unresolved checks.
- Record protected-change approvals with
  `.ai/assistant/approvals/approval-template.md` when approval scope affects
  files, plan versions, imported infrastructure, or protected actions.

## Approval Gates

Require explicit programmer approval before:

- Architecture changes.
- Accepted business behavior changes.
- Weakened tests, gates, documentation-sync rules, or approval requirements.
- New production dependencies or external services.
- Live, destructive, spend-affecting, or data-loss side effects.
- Importing third-party assistant infrastructure into canonical target files.
- Overwriting existing AI instructions.
- Modifying system web server configuration.

## Final Evidence

Every completed change should report:

- Requested operation or inferred flow.
- Changed facts.
- Files changed.
- Logical integrity result.
- Documentation updated or why none was needed.
- Tests or validation run.
- Skipped checks and residual risk.
- Approvals used.
