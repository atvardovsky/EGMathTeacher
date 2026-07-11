# Diagram Sync Gates

Before diagram-relevant work, read:

- `.ai/framework/diagram-guidance.md`
- `.ai/project/diagrams.md`
- `.ai/project/diagrams/README.md`

## Source Of Truth

Editable diagram sources live under `.ai/project/diagrams`.

Rendered SVG artifacts are produced by:

```bash
npm run diagrams:render
```

Output path: `.ai/project/diagrams/rendered/*.svg`.

Do not claim visual rendering validation unless this command was run.

## Update Triggers

Update diagram source when a change affects:

- system actors or external boundaries
- containers, modules, or dependency direction
- endpoint routing or reverse proxy shape
- data model, tables, persistence, or remote object ownership
- WebRTC/media sequence
- assistant governance, gates, or operation flow

## Evidence

Final evidence should say:

- which diagram sources changed
- whether `npm run diagrams:render` was run
- which rendered artifacts changed, if any
- whether no diagram update was needed and why
