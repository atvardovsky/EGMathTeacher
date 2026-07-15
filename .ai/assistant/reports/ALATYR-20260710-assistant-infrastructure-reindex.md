# Assistant Infrastructure Reindex

Operation: reindex all repository assistant infrastructure, including Alatyr.

Date: 2026-07-10

Allowed actions used: `adapter-only`, `docs-only`.

## Goal

Create a current index of assistant infrastructure after the Alatyr adapter,
focused gates, diagram sources, diagram render command, and rendered SVG
artifacts were added.

## Files Added

- `.ai/assistant/infrastructure-index.md`
- `.ai/assistant/reports/ALATYR-20260710-assistant-infrastructure-reindex.md`

## Files Updated

- `AGENTS.md`
- `AI_ASSISTANTS.md`
- `.ai/README.md`
- `.ai/assistant/contour.md`
- `.ai/assistant/help.md`
- `.ai/assistant/gates/checklist.md`
- `.ai/assistant/policies/ai-infrastructure-source-access.md`
- `.ai/assistant/templates/installation-note.md`
- `.ai/project/architecture.md`
- `.ai/project/contour.md`

## Inventory Result

Current assistant infrastructure includes:

- root bridges: `AGENTS.md`, `AI_ASSISTANTS.md`
- inherited voice assistant prompt-adjacent docs: `apps/api/Agent.md`
- installed Alatyr root: `.ai/README.md`
- Alatyr framework files: `.ai/framework/*.md`
- project source-of-truth files: `.ai/project/*.md`
- diagram infrastructure: `.ai/project/diagrams/*.mmd`,
  `.ai/project/diagrams/puppeteer-config.json`,
  `.ai/project/diagrams/rendered/*.svg`, `scripts/render-diagrams.sh`, and
  `package.json` script `diagrams:render`
- assistant adapter files: `.ai/assistant/contour.md`,
  `.ai/assistant/help.md`, `.ai/assistant/infrastructure-index.md`,
  `.ai/assistant/flows/*.flow.md`, `.ai/assistant/gates/*.md`,
  `.ai/assistant/policies/*.md`, `.ai/assistant/templates/*.md`, and
  `.ai/assistant/reports/*.md`

This historical 2026-07-10 snapshot predated the target-owned
`npm run alatyr:check` adapter checker. Later adapter updates superseded the
checker portion of this inventory; use `.ai/assistant/infrastructure-index.md`
and `.ai/assistant/ai-infrastructure-router.json` for current state.

## Logical Integrity Review

Change intent: refresh current assistant infrastructure indexing and remove
stale current references that still said no diagram render command or visual
artifacts existed.

Changed facts: assistant index ownership and current inventory facts.

Risk class: AI governance documentation, documentation-only, generated
artifact documentation.

Source of truth: `.ai/assistant/infrastructure-index.md` for current assistant
infrastructure inventory; historical reports remain evidence snapshots.

Conflicts found: current docs in `.ai/assistant/contour.md`,
`.ai/assistant/templates/installation-note.md`, `.ai/project/contour.md`, and
`.ai/project/architecture.md` still described diagram rendering as missing
after `npm run diagrams:render` was added.

Repair set: added canonical infrastructure index, updated source-access policy
to point to it, refreshed bridge/gate/template/source-of-truth references, and
corrected stale current render-command statements.

Validation: manual source-doc scan.

Approvals: the user explicitly requested reindexing assistant infrastructure,
including Alatyr. No runtime code, product behavior, live service, dependency,
secret, or deployment surface was changed.

Residual risk: CI and `npm run alatyr:check` enforce adapter structure, but
the index still depends on manual semantic review. Global
assistant settings outside this repository were not inventoried.
