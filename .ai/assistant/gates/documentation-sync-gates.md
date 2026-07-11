# Documentation Sync Gates

When a fact changes, update the owner and all affected mirrors.

## Project Facts

Project fact owners include:

- `README.md`
- `.ai/project/*`
- `.ai/project/source-of-truth-registry.md`
- `apps/api/README.md`
- `apps/api/docs/webrtc-module.md`
- `apps/api/Agent.md`
- env examples
- package files
- tests that describe behavior

## Adapter Facts

Assistant workflow, approval, validation, operation, bridge, prompt, and AI
infrastructure facts live under:

- `.ai/assistant`
- `AGENTS.md`
- `AI_ASSISTANTS.md`
- `.ai/alatyr.yaml`

## Framework Facts

Portable process rules live under `.ai/framework`. Do not change framework
rules for project-specific facts.

## Final Check

Before finalizing, run a small source-doc scan for stale names, ports,
placeholders, and old assumptions when documentation changed.
