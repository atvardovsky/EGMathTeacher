# EGMathTeacher Validation

This file records validation commands and test coverage discovered in the
repository.

## Commands

Run from repository root unless noted.

| Purpose | Command | Source |
| --- | --- | --- |
| Start dev stack | `npm run dev` | `package.json` |
| Start API dev server | `npm run dev:api` | `package.json` |
| Start web dev server | `npm run dev:web` | `package.json` |
| Build all workspaces | `npm run build` | `package.json` |
| API tests | `npm test` | `package.json` |
| API lint | `npm run lint` | `package.json` |
| Browser E2E | `npm run e2e` | `package.json`, `playwright.config.ts`, `apps/web/e2e` |
| Render Alatyr diagrams | `npm run diagrams:render` | `package.json` |
| Check Alatyr diagram drift | `npm run diagrams:check` | `package.json`, `scripts/check-diagrams.sh`, `.ai/project/diagrams/rendered/source-hashes.sha256` |
| Smoke-check running dev stack | `npm run smoke:dev` | `package.json`, `scripts/smoke-dev.sh` |
| Check Alatyr adapter consistency | `npm run alatyr:check` | `package.json`, `scripts/check-alatyr.sh` |
| API test watch | `npm run test:watch --workspace @egmathteacher/api` | `apps/api/package.json` |
| Web preview | `npm run preview --workspace @egmathteacher/web` | `apps/web/package.json` |

## Existing Test Surface

Jest tests live under `apps/api/test`.

Current covered areas:

- auth registration/login/session token behavior
- student profile onboarding requirement, AI profile storage, and tutor context
  summary behavior, including specialist profile pipeline calls
- background AI job queueing, optional observation-window batching, legacy
  per-turn mode, flex-tier and prompt-cache payload shape, learning-signal
  storage, and profile/strategy refresh merging
- tutor structured output and image data URL behavior
- AI model-provider facade delegation
- WebRTC token creation payload cleanup
- WebRTC signaling service payload and translation config
- WebRTC controller token/event paths
- WebRTC provider event transcript/token accumulation behavior
- WebRTC provider event debug logging avoids raw transcript text
- student profile teaching-only storage sanitation and POC migration ledger
  through background observation-window storage

The `wrtc` library is mocked in `apps/api/test/__mocks__/wrtc.js`.

Playwright E2E tests live under `apps/web/e2e` and currently mock API routes
to avoid live OpenAI, SQLite test-data coupling, or system service dependency.
They start a local HTTP Vite server on `E2E_PORT` or default `5138` so the
normal `https://localhost:5137` dev server can keep running. They cover
auth/localization, first-login meeting completion, tutor answer rendering,
citation display, and explicit image rendering.

## Existing Static Checks

- TypeScript API build: `tsc -p apps/api/tsconfig.build.json` through
  workspace build.
- Web TypeScript and Vite build through `apps/web` build script.
- API ESLint through `apps/api/eslint.config.mjs`.
- GitHub Actions CI is defined in `.github/workflows/ci.yml` and runs
  `npm ci`, `npm run build`, `npm test`, `npm run lint`, Playwright Chromium
  installation, `npm run e2e`, `npm run diagrams:check`, and
  `npm run alatyr:check`.
- Alatyr adapter consistency is checked by `scripts/check-alatyr.sh`.
- Diagram drift can be checked with `npm run diagrams:check`, which compares
  current Mermaid source hashes to the rendered manifest and verifies that
  sources still render.

## Missing Validation

- No frontend unit/component tests were found.
- No accessibility test command was found.
- No visual regression test command was found.
- No production migration rollback/backfill validation exists.
- No live OpenAI smoke-test policy exists.

## When To Run

- Docs-only project/adapter changes: manual source-doc review is usually
  sufficient unless docs claim command behavior changed.
- API behavior changes: run `npm run build`, `npm test`, and `npm run lint`.
- Web behavior changes: run `npm run build`; run `npm run e2e` when the
  affected workflow is covered by the mocked browser suite.
- Diagram source changes: run `npm run diagrams:render`.
- Diagram generated-artifact checks: run `npm run diagrams:check`.
- Dev-server/routing changes: start `npm run dev` and smoke-check the affected
  URL and `/health`, or run `npm run smoke:dev` against an already running
  dev stack.
- Adapter consistency checks: run `npm run alatyr:check` after changing
  `.ai`, bridge files, validation commands, CODEOWNERS, CI, or Alatyr-owned
  scripts.
- OpenAI integration changes: use mocked/unit validation by default; only call
  live OpenAI when the user explicitly requests or approves live validation
  with credentials and spend risk understood.

## Final Evidence Format

Report:

- commands run
- pass/fail result
- skipped checks and reason
- manual checks performed
- residual risk for missing browser tests, live-service checks, production
  validation, or unobserved remote CI
