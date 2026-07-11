# EGMathTeacher AI Adapter

This repository uses Alatyr Core for AI-assisted development.

Alatyr Core is Markdown guidance for assistants. It is not a runtime service,
CLI, daemon, package dependency, or product feature.

## Manifest

Start with `.ai/alatyr.yaml` for installed framework version, adapter schema,
template version, supported assistants, enabled modules, validation commands,
known gaps, and local deviations.

## Contours

- `.ai/framework`: portable Alatyr Core rules copied from
  `https://github.com/atvardovsky/AlatyrCore`.
- `.ai/project`: EGMathTeacher project facts, source-of-truth notes, and
  accepted product context.
- `.ai/assistant`: repository adapter files for assistant workflows, gates,
  operation help, source-access rules, infrastructure index, and final
  evidence.
- Root `AGENTS.md` and `AI_ASSISTANTS.md`: bridge files that point assistants
  to this adapter.

## Source Of Truth

Start with:

- `README.md` for public project purpose, run commands, and deployment notes.
- `.ai/project/README.md` for the project source-of-truth doc index.
- `.ai/project/blueprint.md` for the assistant-facing project blueprint.
- `.ai/project/contour.md` for ownership boundaries.
- `.ai/project/context-map.md`, `.ai/project/use-cases.md`,
  `.ai/project/architecture.md`, `.ai/project/runtime-flows.md`,
  `.ai/project/data-model.md`, `.ai/project/validation.md`,
  `.ai/project/gaps.md`, `.ai/project/security-safety.md`,
  `.ai/project/guards.md`,
  `.ai/project/diagrams.md`, `.ai/project/ui-guidelines.md`, and
  `.ai/project/ui-tree.md` for detailed project facts.
- `apps/api/README.md` and `apps/api/docs/webrtc-module.md` for the inherited
  voice assistant and WebRTC module.
- Package files for commands and dependency facts:
  `package.json`, `apps/api/package.json`, `apps/web/package.json`.
- `.ai/project/source-of-truth-registry.md` for canonical owner and derived
  surface decisions when project facts have multiple mirrors.

If those sources disagree, use `.ai/framework/logical-integrity.md` and
`.ai/assistant/flows/logical-integrity-review.flow.md` before editing.

## Context Profiles

Use `.ai/assistant/context-profiles.md` to choose the smallest sufficient
context for each task after bootstrap. Expand only when a task crosses
architecture, business, data, security, assistant-infrastructure, lifecycle,
or governance boundaries, or when evidence conflicts.

## Installed Operation Help

When a user asks for Alatyr help, available Alatyr actions, adapter recheck, AI
infrastructure inventory, or gives an unclear Alatyr request, read:

- `.ai/assistant/help.md`
- `.ai/assistant/flows/operation-routing.flow.md`

Then select the matching operation or ask for the smallest missing decision.

## Current Assistant Infrastructure

The current repository assistant infrastructure index is
`.ai/assistant/infrastructure-index.md`. Use it for `alatyr-ai-inventory`,
adapter rechecks, and assistant-infrastructure sync work.

Prompt-injection and imported-source handling is owned by
`.ai/assistant/policies/prompt-injection.md` and
`.ai/assistant/policies/ai-infrastructure-source-access.md`.
