# EGMathTeacher Diagram And Generated-File Policy

This file owns project diagram and generated-artifact policy.

## Diagram Source

Current editable architecture diagram sources:

- `.ai/project/diagrams/README.md`
- `.ai/project/diagrams/system-context.mmd`
- `.ai/project/diagrams/api-modules.mmd`
- `.ai/project/diagrams/onboarding-profile-sequence.mmd`
- `.ai/project/diagrams/tutor-rag-sequence.mmd`
- `.ai/project/diagrams/knowledge-upload-sequence.mmd`
- `.ai/project/diagrams/knowledge-pack-runtime-repair.mmd`
- `.ai/project/diagrams/webrtc-realtime-sequence.mmd`
- `.ai/project/diagrams/data-model.mmd`
- `.ai/project/diagrams/assistant-governance.mmd`
- `.ai/project/diagrams/ui-tree.mmd`

`.ai/project/architecture.md` embeds a quick overview copy for reading, but
the `.mmd` files are the focused editable diagram sources.

## Visual Artifacts

Rendered SVG diagram artifacts are produced by:

```bash
npm run diagrams:render
```

Output path: `.ai/project/diagrams/rendered/*.svg`.
The render command also writes
`.ai/project/diagrams/rendered/source-hashes.sha256`, which records the
editable Mermaid source hashes used for the rendered artifacts.

Rendered SVG drift is checked by:

```bash
npm run diagrams:check
```

When updating rendered artifacts:

- keep the editable source diagram as the source of truth
- do not edit the rendered visual as the only source of truth
- update source, visual artifacts, and the source-hash manifest together when
  diagram facts change

## Diagram Update Triggers

Update the source diagram when changes affect:

- containers or major modules
- API/proxy routing
- external service boundaries
- persistence ownership
- knowledge-pack import/sync ownership
- knowledge-pack runtime connection, strict import, RAG reconciliation, or
  sync recovery behavior
- lesson decision/tool-policy flow
- WebRTC/media flow ownership
- deployment shape
- generated artifact ownership

For endpoint-only changes that do not affect the high-level architecture,
updating endpoint tables in `.ai/project/architecture.md` may be enough.

## Generated Artifacts

Generated or local artifacts are not source of truth:

- `apps/api/dist`
- `apps/web/dist`
- `node_modules`
- `apps/web/node_modules`
- `coverage`
- `*.tsbuildinfo`
- `apps/api/data`
- `apps/api/logs`
- root `logs`
- `.cert`
- `.ai/project/diagrams/rendered/*.svg`

Regenerate or recreate these artifacts from source when needed. Do not commit
local certificates, SQLite databases, transcript logs, or secrets.

## Current Gaps

- No public architecture diagram page exists.
