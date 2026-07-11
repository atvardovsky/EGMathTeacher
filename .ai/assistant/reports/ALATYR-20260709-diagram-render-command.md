# Alatyr Diagram Render Command

Operation: add render command for Alatyr Mermaid diagram sources.

Date: 2026-07-09

Allowed actions used: `docs-only`, `dev-tooling`.

## Goal

Create a repository command that renders the existing Mermaid diagram sources.

## Files Added

- `scripts/render-diagrams.sh`
- `.ai/project/diagrams/puppeteer-config.json`
- `.ai/project/diagrams/rendered/api-modules.svg`
- `.ai/project/diagrams/rendered/assistant-governance.svg`
- `.ai/project/diagrams/rendered/data-model.svg`
- `.ai/project/diagrams/rendered/knowledge-upload-sequence.svg`
- `.ai/project/diagrams/rendered/system-context.svg`
- `.ai/project/diagrams/rendered/tutor-rag-sequence.svg`
- `.ai/project/diagrams/rendered/webrtc-realtime-sequence.svg`

## Files Updated

- `package.json`
- `package-lock.json`
- `README.md`
- `.ai/project/diagrams.md`
- `.ai/project/diagrams/README.md`
- `.ai/project/validation.md`
- `.ai/assistant/gates/diagram-sync-gates.md`
- `.ai/assistant/gates/validation-gates.md`
- `.ai/assistant/templates/post-install-message.md`

## Command

```bash
npm run diagrams:render
```

The command renders every `.ai/project/diagrams/*.mmd` source into
`.ai/project/diagrams/rendered/*.svg`.

## Validation

Ran:

```bash
npm run diagrams:render
```

Result: passed. Seven SVG files were generated.

Also ran:

```bash
npm audit --omit=dev --audit-level=moderate
```

Result: reported 13 production dependency vulnerabilities. The listed paths
are in existing NestJS, Multer, Lodash, and `wrtc`/`node-pre-gyp` dependency
chains; remediation was outside this render-command operation.

## Logical Integrity Review

The previous project state recorded Mermaid sources but no render command. This
operation adds the smallest coherent tooling set: a root npm script, a local
renderer script, Mermaid CLI as a root dev dependency, Puppeteer config, docs,
and generated SVG outputs.

## Residual Risk

- No automated diagram drift check exists.
- No public architecture diagram page exists.
- npm production audit findings remain unresolved.
