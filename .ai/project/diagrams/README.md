# EGMathTeacher Diagram Sources

This directory contains editable Mermaid source diagrams for project and
assistant review.

Mermaid source is the current diagram source of truth. Rendered SVG artifacts
are generated into `rendered/`.

## Diagrams

- `system-context.mmd`: browser, API, local stores, reverse proxy, model
  provider facade, and OpenAI boundaries.
- `api-modules.mmd`: NestJS module ownership, background AI worker,
  model-provider facade, and dependency direction.
- `onboarding-profile-sequence.mmd`: first-login student profile creation,
  specialist evaluator pipeline, RAG/shared-knowledge lookup, DB memory
  persistence, and transition to tutor.
- `tutor-rag-sequence.mmd`: tutor text/voice request, RAG, persistence,
  optional batched background observation windows, legacy background enqueue,
  profile/strategy refresh, and optional image flow.
- `knowledge-upload-sequence.mmd`: admin document upload and vector store flow.
- `webrtc-realtime-sequence.mmd`: WebRTC session, token, SDP, media bridge,
  provider events, and transcript close flow.
- `data-model.mmd`: local SQLite tables, background AI jobs, observation
  windows, learning signals, in-memory runtime state, file artifacts, and
  remote OpenAI objects.
- `assistant-governance.mmd`: Alatyr framework/project/assistant contours,
  gates, operations, and evidence flow.
- `ui-tree.mmd`: web UI state tree from auth through first meeting, tutor,
  optional image generation, and admin materials.

## Maintenance

Update the matching diagram when project facts change across:

- actors or external boundaries
- module ownership
- endpoint routing
- persistence or data ownership
- first-login profile or tutor personalization flow
- WebRTC/media behavior
- assistant governance/gate behavior
- web UI navigation, localization, or major state tree behavior

If a diagram-relevant fact changes and no diagram update is needed, final
evidence should say why.

## Render

Run from repository root:

```bash
npm run diagrams:render
```

The command renders every `*.mmd` source in this directory to
`rendered/<diagram-name>.svg`.
