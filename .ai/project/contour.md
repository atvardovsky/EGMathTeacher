# EGMathTeacher Project Contour

This contour defines project-owned facts for EGMathTeacher.

## Owns

The project contour owns:

- Product purpose: a POC AI math tutor for Russian ЕГЭ preparation.
- Target audience: teenagers around 14-16 years old.
- Main user workflows: registration/login, voice or text math questions,
  first-login student profile meeting, tutor answers, practice tasks, worked
  examples, optional explanatory images, and admin knowledge upload.
- Runtime architecture: NestJS API under `apps/api`, React/Vite web app under
  `apps/web`, shared root npm workspace, SQLite local storage, OpenAI-first
  model provider facade for RAG/profile/tutor/image flows, and inherited
  WebRTC/Realtime voice bridge.
- Data ownership: local SQLite tables for users, student profiles, knowledge
  file metadata, and tutor turns; OpenAI owns uploaded files, vector stores,
  model responses, profile-generation responses, and generated images.
- UI facts: the web client uses Mantine, lucide icons, browser speech
  recognition, Russian/English static UI localization, and a teen-friendly
  modern tutor workspace.
- Deployment notes: API defaults to port `3000`; current dev web HTTPS is
  `https://localhost:5137` and can also be reached on this host at
  `https://atvardovsky.dev:5137`; production domain notes live in `README.md`
  and `deploy/`.
- Validation commands discovered in the repository.

## Does Not Own

The project contour does not own:

- Portable Alatyr Core process rules. Those live under `.ai/framework`.
- Assistant operation flows, gates, help menus, source-access policy, or final
  evidence format. Those live under `.ai/assistant`.
- Generated build output under `dist`, local SQLite data under `apps/api/data`,
  transcript logs, node modules, or local certificates under `.cert`.
- Private secrets such as `OPENAI_API_KEY`, `JWT_SECRET`, TLS keys, or external
  provider credentials.

## Main Source Files

- Project docs: `.ai/project/README.md`, `.ai/project/blueprint.md`,
  `.ai/project/context-map.md`, `.ai/project/source-of-truth-registry.md`,
  `.ai/project/use-cases.md`, `.ai/project/architecture.md`,
  `.ai/project/runtime-flows.md`, `.ai/project/data-model.md`,
  `.ai/project/validation.md`, `.ai/project/gaps.md`,
  `.ai/project/security-safety.md`,
  `.ai/project/guards.md`, `.ai/project/diagrams.md`,
  `.ai/project/ui-guidelines.md`, `.ai/project/ui-tree.md`.
- API modules: `apps/api/src/auth`, `apps/api/src/student-profile`,
  `apps/api/src/tutor`, `apps/api/src/knowledge`, `apps/api/src/webrtc`,
  `apps/api/src/openai`, `apps/api/src/database`.
- Web app: `apps/web/src/App.tsx`, `apps/web/src/api.ts`,
  `apps/web/src/types.ts`, `apps/web/src/styles.css`.
- Tests: `apps/api/test`.
- Runtime config examples: `apps/api/.env.example`, `apps/web/.env.example`.
- Deployment references: `deploy/`.

## Missing Or Weak Project Facts

- GitHub Actions CI configuration exists under `.github/workflows/ci.yml`.
- Diagram sources, rendered SVG artifacts, `npm run diagrams:render`, and
  `npm run diagrams:check` exist.
- Mocked browser E2E is checked by `npm run e2e`.
- Local Alatyr adapter consistency is checked by `npm run alatyr:check`.
- Baseline project security/safety boundaries are documented in
  `.ai/project/security-safety.md`, but no formal production privacy policy or
  incident procedure was found.
- A POC SQLite schema migration ledger exists; production backup, restore,
  rollback, and backfill policy are still missing.
- CODEOWNERS exists at `.github/CODEOWNERS`.
