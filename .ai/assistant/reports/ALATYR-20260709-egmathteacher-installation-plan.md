# Alatyr Core Installation Plan

Installation id: `ALATYR-20260709-egmathteacher`

## Target Repository

- Path: `<TARGET_REPOSITORY_ROOT>`
- New install or upgrade: fresh install
- Primary stack: npm workspaces, NestJS API, React/Vite web app, SQLite,
  OpenAI APIs, Mantine UI
- Existing AI instructions: `apps/api/Agent.md`
- Supported assistants: Codex/AGENTS-aware tools and generic AI assistants

## Goal

Install Alatyr Core as a Markdown-first assistant framework for
EGMathTeacher, with target project facts, assistant flows, gates, operation
help, source-access policy, and root bridge files.

## Non-Goals

- Do not change runtime code or product behavior.
- Do not change deployment services or system web server configuration.
- Do not add production dependencies.
- Do not call live OpenAI services.
- Do not overwrite existing target assistant instruction files.

## Target Facts Collected

- Product purpose: POC AI math tutor for Russian ЕГЭ preparation.
- Architecture/module facts: NestJS API in `apps/api`, React/Vite web in
  `apps/web`, root npm workspace, SQLite local storage, OpenAI RAG/images,
  inherited WebRTC/Realtime voice bridge.
- Blueprint or equivalent source-of-truth docs: `README.md`,
  `apps/api/README.md`, `apps/api/docs/webrtc-module.md`, and newly added
  `.ai/project/blueprint.md`.
- Business/domain rules: teen-focused math tutor, name/password auth, first
  user admin, later users student, admin knowledge upload, tutor returns
  explanations/tasks/examples/images when useful.
- Data model facts: SQLite `users`, `knowledge_files`, `tutor_turns`.
- Runtime flows: auth, tutor message/image, admin knowledge upload, WebRTC
  session/bootstrap/token/offer/answer/ICE/close.
- Test strategy and existing test surface: API Jest tests under
  `apps/api/test`; API ESLint; TypeScript/Vite build.
- Source-of-truth/context map: added `.ai/README.md`,
  `.ai/project/contour.md`, `.ai/project/blueprint.md`.
- Blueprint-driven change workflow: added
  `.ai/assistant/flows/blueprint-driven-change.flow.md`.
- Installed-operation/help/routing/recheck/chat process: added
  `.ai/assistant/help.md`, flows, templates.
- Risk and approval model: added `.ai/assistant/gates/checklist.md`.
- Security/privacy/live/destructive/dependency/credential policies: added
  adapter-local safety rules in `.ai/assistant/gates/checklist.md` and
  `.ai/assistant/policies/ai-infrastructure-source-access.md`.
- Diagram sources/render/drift checks: none found; manual review gap recorded.
- Skills/prompts/wrappers/provenance: existing `apps/api/Agent.md`; root
  bridges and `.ai` adapter added; no external skill imported.
- AI infrastructure source access policy: added.
- Target validation commands: `npm run build`, `npm test`, `npm run lint`.
- Source commands/scripts not copied: AlatyrCore checker script and source
  maintenance commands were not copied.
- Source test tools/fixtures/CI jobs not copied: none copied from AlatyrCore.
- Source security policies, diagram tooling, lifecycle notes, adapter owner
  facts not copied: only portable framework docs copied.
- Source skill files, assistant-native formats, tool permissions, and
  third-party assistant infrastructure not copied.
- Missing facts: CI, browser E2E tests, diagram render/drift tooling, formal
  production security/privacy policy, project-specific Alatyr checker.

## Framework Core Files

Installed `.ai/framework/*.md` from AlatyrCore:

- `README.md`
- `adapter-maturity.md`
- `blueprint-driven-change.md`
- `change-risk-model.md`
- `context-discovery.md`
- `contour.md`
- `diagram-guidance.md`
- `guarantees.md`
- `installed-operations.md`
- `lifecycle.md`
- `logical-integrity.md`
- `operation-help.md`
- `portability.md`
- `project-adapter-contract.md`
- `security-safety-guidance.md`
- `skill-adaptation.md`
- `testing-guidance.md`

## Project Adapter Files

Created:

- `.ai/README.md`
- `.ai/project/contour.md`
- `.ai/project/blueprint.md`
- `.ai/assistant/contour.md`
- `.ai/assistant/help.md`
- `.ai/assistant/gates/checklist.md`
- `.ai/assistant/flows/*.flow.md`
- `.ai/assistant/policies/ai-infrastructure-source-access.md`
- `.ai/assistant/templates/*.md`
- `.ai/assistant/reports/ALATYR-20260709-egmathteacher-installation-plan.md`
- `AGENTS.md`
- `AI_ASSISTANTS.md`

## Context, Risk, Safety, Testing, And Diagram Adaptation

- Target context entry points: `AGENTS.md`, `.ai/README.md`,
  `.ai/project/blueprint.md`, `README.md`, package files.
- Source-of-truth owners: `.ai/project` and public docs for project facts;
  `.ai/assistant` for adapter facts; `.ai/framework` for portable framework.
- Generated artifacts and owning sources: `dist`, `apps/api/data`, logs,
  `.cert`, and `node_modules` are not source of truth.
- Missing-context escalation: stop or ask before architecture, business,
  security, live-service, destructive, spend-affecting, or validation claims.
- Risk classes and approval triggers: adapted in gate checklist.
- Security/live-service boundaries: no secrets in logs or commits; no live
  OpenAI calls unless required and approved/configured.
- Destructive/dependency approval rules: explicit approval required.
- Credential/privacy/log-redaction rules: adapter-local baseline only.
- Recommended test levels: API unit/service tests, build checks, lint; browser
  E2E remains missing.
- Target validation commands: `npm run build`, `npm test`, `npm run lint`.
- AI infrastructure adaptation/source-access rules: added under
  `.ai/assistant/policies`.
- Operation help/routing rules: added under `.ai/assistant/help.md` and flows.
- Diagram source format/render/drift checks: none found; manual gap.
- Adapter maturity level: usable for focused work; not mature.
- Framework baseline: AlatyrCore `17cf62e`.
- Local deviations: supported bridge files limited to root AGENTS and generic
  AI_ASSISTANTS.

## Existing File Preservation

| File | Action | Approval needed |
| --- | --- | --- |
| `apps/api/Agent.md` | Preserved | No |
| `README.md` | Preserved | No |
| Runtime source files | Preserved | No |

## Rejected Source Facts

- AlatyrCore source maintenance checker was not copied as a target validation
  requirement.
- AlatyrCore source repository commands, ownership facts, and lifecycle owner
  names were not copied into target project facts.
- Assistant bridge templates were not copied with placeholders; root bridge
  files were rewritten from target facts.

## Validation Plan

| Check | Command or review | Required | Notes |
| --- | --- | --- | --- |
| Framework files present | manual file review | yes | `.ai/framework/*.md` |
| Adapter references | manual file review | yes | root bridges and `.ai` |
| Build | `npm run build` | yes | target command |
| Tests | `npm test` | yes | target command |
| Lint | `npm run lint` | yes | target command |
| CI | unresolved | no | no CI found |
| Diagrams | manual gap | no | source diagram now lives in `.ai/project/architecture.md`; no render/drift command |

## Approval Required

No extra approval required for this fresh adapter-only installation because no
existing root assistant instructions were overwritten and runtime behavior was
not changed.

## Risks

- README and `.ai/project/blueprint.md` can drift when runtime URLs or
  deployment facts change.
- No CI enforces adapter or validation consistency.
- No browser E2E tests cover the teenage learner UI.
- No formal production security/privacy policy exists for real student data.
- Source diagram now exists under `.ai/project`; no rendered visual artifact
  or drift check exists.
