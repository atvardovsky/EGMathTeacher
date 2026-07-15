# EGMathTeacher Context Map

This file maps project facts to their owning sources.

## Canonical Entry Points

- `README.md`: public project purpose, run commands, local URLs, production
  domain notes, and high-level capabilities.
- `.ai/project/README.md`: index of project-owned Alatyr docs.
- `.ai/project/blueprint.md`: high-level project blueprint.
- `.ai/project/contour.md`: project ownership boundary.
- `.ai/project/source-of-truth-registry.md`: canonical owner and derived
  surface decisions for facts with multiple mirrors.
- `package.json`, `apps/api/package.json`, `apps/web/package.json`: package
  manager, scripts, workspaces, dependencies, and validation commands.
- `apps/api/README.md`: inherited voice assistant service overview.
- `apps/api/docs/webrtc-module.md`: WebRTC/Realtime module API and flow details.

## Source Owners By Fact

| Fact | Source of truth |
| --- | --- |
| Product purpose and audience | `README.md`, `.ai/project/blueprint.md`, `.ai/project/use-cases.md` |
| Project ownership boundary | `.ai/project/contour.md` |
| Source-of-truth ownership | `.ai/project/source-of-truth-registry.md` |
| Architecture and module ownership | `.ai/project/architecture.md`, `apps/api/src/app.module.ts`, package files |
| Runtime flows | `.ai/project/runtime-flows.md`, controllers/services under `apps/api/src`, `apps/web/src/App.tsx` |
| API endpoints | Controllers under `apps/api/src`, `.ai/project/architecture.md` |
| Data model | `apps/api/src/database/database.service.ts`, `.ai/project/data-model.md`, `.ai/project/lesson-agent-tools.md`, `apps/web/src/types.ts` |
| Auth and roles | `apps/api/src/auth`, `.ai/project/security-safety.md`, `.ai/project/use-cases.md` |
| First-login profile, backend meeting-readiness scoring, active/terminal meeting reload restore, onboarding usage attribution, profile-creation idempotency/conversation locking/recovery, and student memory | `apps/api/src/student-profile`, `apps/web/src/App.tsx`, `.ai/project/use-cases.md`, `.ai/project/runtime-flows.md`, `.ai/project/data-model.md` |
| Background AI job queue, stored observations, analysis windows, transition-confirmed lesson-closure review, learning signals, session summaries, and skill progress/regression | `apps/api/src/background-ai`, `apps/api/src/database/database.service.ts`, `.ai/project/runtime-flows.md`, `.ai/project/data-model.md` |
| Tutor/RAG/image/lesson-type behavior and knowledge-pack sync | `apps/api/src/tutor`, `apps/api/src/knowledge`, `.ai/project/runtime-flows.md`, `.ai/project/data-model.md` |
| Knowledge-pack runtime repair implementation, imported curriculum runtime connection, task-bank task selection, strict import, RAG reconciliation, sync recovery, archive guardrails, and sync locking | `.ai/project/knowledge-pack-runtime-repair-plan.md`, `apps/api/src/knowledge`, `apps/api/src/lesson`, `.ai/project/runtime-flows.md`, `.ai/project/data-model.md`, `.ai/project/gaps.md` |
| Lesson lifecycle, transition-confirmed boundary changes, terminal conversation rejection, decision tools, deterministic verifier V1, curriculum ids, goal stop, learning-time heuristics, mastery evidence, and effectiveness signals | `apps/api/src/lesson`, `apps/api/src/tutor`, `apps/api/src/database/database.service.ts`, `.ai/project/lesson-agent-tools.md`, `.ai/project/use-cases.md`, `.ai/project/runtime-flows.md`, `.ai/project/data-model.md` |
| Model-provider facade and role/operation model policy for profile, lesson-decision, tutor, background, image, and knowledge flows | `apps/api/src/ai-model`, `apps/api/src/openai`, `.ai/project/architecture.md`, `.ai/project/runtime-flows.md` |
| AI usage ledger, decision observability, verified-outcome economics, and signed-in user usage summaries | `apps/api/src/usage`, `apps/api/src/ai-model`, `apps/api/src/lesson`, `apps/api/src/tutor`, `apps/web/src/App.tsx`, `.ai/project/runtime-flows.md`, `.ai/project/data-model.md` |
| WebRTC behavior, signed-in realtime teaching context, session-level realtime usage, and post-close realtime background review | `apps/api/docs/webrtc-module.md`, `apps/api/src/webrtc`, `apps/api/src/teaching-context`, `apps/api/src/background-ai`, `apps/api/src/usage`, `apps/api/README.md`, `.ai/project/runtime-flows.md`, `.ai/project/data-model.md` |
| Frontend workflow/UI facts, voice-dialog continuation rules, terminal read-only state, and first-meeting hydration | `apps/web/src/App.tsx`, `apps/web/src/i18n.ts`, `apps/web/src/styles.css`, `.ai/project/ui-guidelines.md`, `.ai/project/ui-tree.md`, `.ai/project/use-cases.md` |
| Validation commands | package files, `.ai/project/validation.md` |
| Deployment references | `README.md`, `deploy/`, `.ai/project/runtime-flows.md` |
| Secrets and live-service boundaries | env examples, `.ai/project/security-safety.md` |
| Diagram and generated artifacts | `.ai/project/diagrams.md`, `.ai/project/architecture.md` |

## Generated Or Local Artifacts

These are not source of truth:

- `node_modules`
- `apps/*/dist`
- `apps/web/dist`
- `apps/web/node_modules`
- `apps/api/data`
- `apps/api/logs`
- `logs`
- `.cert`
- `coverage`
- `*.tsbuildinfo`

Generated artifacts may be inspected for debugging, but repair source files
instead of editing generated output.

## Missing Context Escalation

Stop and ask the programmer before inventing facts when a task depends on:

- production student-data privacy or compliance policy
- psychopedagogical profiling policy beyond tutoring-focused strategy
- production incident response
- live OpenAI calls or spend-affecting validation
- production data migration rollback, backfill, backup, restore, or retention policy
- packaged desktop runtime requirements
- system web server changes
- new dependencies or external services
- frontend component, accessibility, or visual regression testing requirements
- assistant infrastructure import or broader tool permissions

If the task is docs-only and the missing fact can be safely recorded as a gap,
mark it as missing instead of blocking.
