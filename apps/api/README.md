# Voice Assistant Service (Work in Progress)

This repository houses a NestJS orchestration service that now handles both signaling and the realtime WebRTC bridge to OpenAI’s Realtime API. The Node layer manages configuration, conversation metadata, transcripts, and the media bridge (via `wrtc`), so no external Go gateway is required.

## Architecture Overview

- **NestJS service (`src/`)** – Exposes REST endpoints for session bootstrap, conversation tracking, persona/voice configuration, and ephemeral token issuance. Stores conversation transcripts to disk when a session closes.
- **Realtime bridge (Node, `OpenAiRealtimeBridgeService`)** – Accepts SDP offers from browsers, spins up peer connections via `wrtc`, and dials OpenAI Realtime over WebRTC (bidirectional Opus audio + data channel). Provider events stream directly into Nest for transcript enrichment.
- **Clients** – Obtain bootstrap metadata from `/webrtc/session`, post their SDP offer back to the NestJS proxy, and then speak/listen over the direct browser ↔ Node bridge connection.

## Getting Started

1. **Install Node dependencies**
   ```bash
   npm install
   ```
2. **Configure environment**
   ```bash
   cp .env.example .env
   ```
   Populate `OPENAI_API_KEY` plus persona/voice settings.
3. **Run the NestJS service (bridge included)**
   ```bash
   npm run start:dev
   ```
   NestJS listens on `PORT` (default `3000`) and terminates the WebRTC peer connection in-process.
4. **Optional: run tests**
   ```bash
   npm test
   ```

## Environment Configuration

- **NestJS (.env)**
  - `AI_PROVIDER` – defaults to `openai-realtime`; other providers are stubbed.
  - `AI_MODEL_PROVIDER` – defaults to `openai`; used by lesson-decision,
    tutor, profile, image, file, and vector-store operations. Non-OpenAI model
    providers are stubs in this POC.
  - `AI_OPERATION_*_MODEL` – optional per-role/per-operation model overrides
    for lesson decisions, tutor answers, RAG tutor answers, onboarding
    specialists, background assistants, quality review, and image generation.
    Empty values fall back to `OPENAI_RESPONSES_MODEL`, `OPENAI_IMAGE_MODEL`,
    or the background model defaults.
  - `AI_OPERATION_*_SERVICE_TIER` – optional per-operation service-tier
    overrides for Responses API operations. Empty tutor/onboarding values use
    the standard tier; empty background values fall back to
    `OPENAI_BACKGROUND_SERVICE_TIER`.
  - `OPENAI_API_KEY`, `OPENAI_REALTIME_MODEL` – credentials/aliases used for session token issuance.
  - `OPENAI_INPUT_TRANSCRIPTION_MODEL` – model used to transcribe caller audio.
  - `AI_BACKGROUND_*`, `OPENAI_BACKGROUND_RESPONSES_MODEL`,
    `OPENAI_BACKGROUND_WINDOW_RESPONSES_MODEL`,
    `OPENAI_BACKGROUND_REFRESH_RESPONSES_MODEL`, and
    `OPENAI_BACKGROUND_SERVICE_TIER` – delayed tutor/profile assistant work.
    `AI_BACKGROUND_BATCHING_ENABLED=true` stores sanitized tutor observations
    locally and drains grouped learning windows by count, idle timeout, or
    quality trigger. Set it to `false` to restore legacy per-turn signal
    extraction and split profile/strategy jobs.
    `AI_BACKGROUND_RUNNING_JOB_TIMEOUT_MS` controls stale running-job and
    queued-observation recovery. `flex` requests lower-cost OpenAI Flex
    processing when the OpenAI model provider supports it.
  - `LESSON_*_LIMIT_MINUTES` and `LESSON_*_TURN_SECONDS` – configurable POC
    lesson lifecycle heuristics for daily/continuous learning limits and
    active-time estimation.
  - `TASK_BANK_REQUIRED` – when `true`, supported verifier lessons fail if no
    imported task-bank task matches the resolved curriculum. When `false`, the
    POC generated linear-equation task remains as an explicitly logged
    empty-DB fallback.
  - `MASTERY_CRITERIA_REQUIRED` – defaults to `true`. When enabled, supported
    verifier skills require an active imported `curriculum_mastery_criteria`
    row before a correct answer can write mastery evidence or complete a
    practice goal.
  - `KNOWLEDGE_RAG_INDEX_WAIT_ATTEMPTS` and
    `KNOWLEDGE_RAG_INDEX_WAIT_DELAY_MS` – tune how long `--wait-ready` polls
    vector-store file indexing before leaving the sync job attached but not
    indexed.
  - `AI_USAGE_*` – local usage-ledger settings. Prices are configured locally
    for user-visible estimates and are not provider billing proof.
  - `OPENAI_VECTOR_STORE_IDS` – optional comma-separated vector store ids.
    If empty, manual admin upload or knowledge-pack sync creates/reuses a
    local project vector store recorded in SQLite.
  - `WEBRTC_ICE_SERVERS`, `WEBRTC_MAX_SESSIONS`, `TRANSCRIPT_LOG_DIR` – handshake + operational tuning.
  - `WEBRTC_ENABLE_BARGE_IN`, `WEBRTC_SESSION_IDLE_TIMEOUT_MS`, `WEBRTC_IDLE_SWEEP_INTERVAL_MS` – realtime turn-taking and idle-session behavior.
  - `OPENAI_REQUEST_TIMEOUT_MS`, `OPENAI_REQUEST_RETRIES`, `OPENAI_CLIENT_SECRET_GRACE_MS` – OpenAI request resiliency tuning.
  - `ASSISTANT_PERSONALITY_*`, `ASSISTANT_RULES` – persona instructions forwarded to the gateway/provider.
  - `ASSISTANT_DEFAULT_VOICE`, `ASSISTANT_AVAILABLE_VOICES` – voice catalogue exposed to clients.
  - `FILE_SEARCH_DOCUMENTATION_IDS`, `FILE_SEARCH_RULE_IDS` – stored for future Realtime file-search support (OpenAI currently ignores them).
  - `CORS_ORIGINS`, `CORS_CREDENTIALS` – control CORS behavior for browser clients.
  - `HTTPS_KEY_PATH`, `HTTPS_CERT_PATH` – enable HTTPS when both are set.
- **Realtime bridge (Node)**
  - Uses the same `OPENAI_*` and assistant settings; no extra env vars are required.

## Project Structure

- `src/` – NestJS modules (conversation, WebRTC signaling, AI provider abstraction).
- `docs/` – Supplemental design notes (`docs/webrtc-module.md` now describes the Nest ↔ OpenAI flow).
- `logs/` – Default transcript output directory.

## Knowledge Pack Import And RAG Sync

Run from the repository root after placing the uncommitted knowledge-pack zip
locally:

```bash
npm run knowledge:sync -- --pack ./EGMathTeacher-knowledge-pack-v1.0.zip --import-db
npm run knowledge:sync -- --pack ./EGMathTeacher-knowledge-pack-v1.0.zip --import-db --sync-rag
npm run knowledge:sync -- --pack ./EGMathTeacher-knowledge-pack-v1.0.zip --sync-rag --dry-run
npm run knowledge:sync -- --pack ./EGMathTeacher-knowledge-pack-v1.0.zip --sync-rag --partial --no-reconcile-rag
npm run knowledge:sync -- --recover-rag --wait-ready
```

`--import-db` loads structured curriculum, task-bank, misconception, and
lesson-plan JSON/JSONL into SQLite. Strict mode is the default and requires
all canonical structured files; `--partial` permits missing files and records
warnings. Imports validate required fields, enum-like verifier kinds, JSONL
line parsing, and core cross-references before writing runtime tables.

`--sync-rag` uploads only selected student-facing Markdown files to the active
OpenAI vector store. RAG sync is content-hash based: unchanged files are
skipped, changed files are uploaded, superseded files are detached, and
Markdown paths removed from the local pack are detached during reconciliation.
Reconciliation is intended for strict authoritative packs and is disabled for
partial packs unless a future operator flow explicitly proves authority.
`--wait-ready` polls vector-store file status until terminal readiness; jobs
are marked `indexed` only after the remote status is actually `completed`.
Timeouts keep the job at the attached stage with timeout metadata, store the
new local row as `sync_status='indexing'`, and keep the old active vector file
attached until `--recover-rag --wait-ready` later sees the replacement as
`completed`.
`--dry-run` performs no OpenAI create/upload/attach/delete calls.
`--recover-rag` retries failed or attached-timeout sync jobs that recorded a
recoverable OpenAI file id. Recovery waits for completed indexing by default;
if `--no-wait-ready` is used and the remote file is still queued, the local
row remains `sync_status='indexing'` and stale active attachments are kept.

The lesson runtime now reads active curriculum rows from SQLite and selects
linear-equation verifier tasks, including hint ladders, from imported
`task_bank_tasks` when available. Imported mastery criteria decide whether a
verified answer can write mastery evidence or complete a practice goal.
Independent successes are counted by canonical `source_task_id` across lesson
sessions, while repeated copies of the same source task remain one independent
success. Task-bank `common_errors` can route the next hint through imported
misconception playbooks before falling back to the generic hint ladder. The old
hardcoded task remains only as an explicitly logged empty-DB fallback for the
POC, or can be disabled with `TASK_BANK_REQUIRED=true`.

## WebRTC Flow (Browser ↔ NestJS ↔ OpenAI)

1. Client hits `POST /webrtc/session` to reserve a session; response includes conversation id, ICE servers, persona + voice options.
2. Client records mic audio, creates SDP offer, and posts it to `POST /webrtc/session/{id}/offer`.
3. NestJS forwards the offer to the in-process realtime bridge, which negotiates with OpenAI Realtime and returns an SDP answer.
4. Audio flows directly between the browser and the NestJS bridge; the bridge relays it to/from OpenAI and streams provider events into the conversation service.
5. When the call ends, the client calls `POST /webrtc/session/{id}/close`; NestJS finalizes the transcript and tears the session down.

## Translation Module

Translation runs per session and is enabled by passing language pair settings in the bootstrap request:

```json
{
  "translation": {
    "languageA": "English",
    "languageB": "Russian"
  }
}
```

- The bridge enforces bidirectional translation only (`languageA` ↔ `languageB`).
- Translator responses are triggered from completed transcription events, so the model translates captured caller text instead of free-form replying.
- Output is constrained to translation-only behavior with punctuation/question preservation.
- If either language is missing or both are the same, translation mode is ignored.

For full API details and translator behavior, see `docs/webrtc-module.md` (`Session Bootstrap API`, `Translation Mode`, and `Realtime Session Handshake`).

## API Surface

The signaling API lives under `/webrtc`. See `docs/webrtc-module.md` for the full endpoint list and bootstrap flow.

Tutor/product API surfaces also include:

- `GET /tutor/lessons` for the signed-in user's recent lessons, stored turns,
  summaries, and legacy saved discussions so the web client can show lesson
  records and resume a previous `conversationId`.
- `POST /tutor/message` for lesson-aware tutor answers with Lesson Decision
  Agent policy, request idempotency, lifecycle, verifier evidence, and usage
  snapshots.
- `POST /tutor/image` for explanatory image generation with optional lesson
  usage attribution and tutor-turn/block identity so generated POC data URLs
  can be persisted back into the same answer block.
- `GET /usage/me/summary` for the signed-in user's own usage estimates,
  per-operation, decision, verifier, verified-outcome details, and recent safe
  background job status/result/error previews.
- `POST /usage/me/background/recover` for a signed-in user to requeue one or a
  few of their own recoverable failed background jobs without exposing raw job
  payloads or running the provider call synchronously in the request.

## Notes on OpenAI Realtime

- Persona instructions and voice are injected during `/webrtc` session setup; the Node bridge collapses them into a single `instructions` string and `voice` parameter when creating the OpenAI session.
- File Search ids are accepted but currently ignored because the REST surface does not yet allow attaching them to Realtime sessions.
- Lesson-decision, tutor/profile/image/file/vector-store operations go through the
  OpenAI-first `AiModelService` facade. `AiOperationPolicyService` resolves
  the assistant role, operation name, model, metadata, prompt-cache eligibility,
  and optional service tier before the provider call. Only the realtime voice
  provider uses `AI_PROVIDER`.
- Background profile/signal assistant jobs also go through the `AiModelService`
  facade. In batched mode, sanitized tutor observations are stored in SQLite
  first, then grouped into learning windows before model calls; legacy
  per-turn extraction remains available through configuration.
- Audio is forwarded as Opus RTP frames end-to-end. Data channel events are processed in-process and persisted into conversation transcripts/token usage through `WebRtcProviderEventService`.
- In translator mode, the bridge waits for completed transcription events and requests translation against the transcribed text to reduce free-form assistant replies.

## Next Steps

1. Add end-to-end tests that validate full browser ↔ bridge ↔ OpenAI SDP/ICE negotiation.
2. Flesh out additional AI providers (Gemini Live, Hume EVI, Retell) behind the common provider interface.
3. Persist conversations in durable storage and surface session analytics/metrics.
4. Harden translation QA with explicit post-generation language/format validation hooks.
