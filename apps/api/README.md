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
  - `AI_MODEL_PROVIDER` – defaults to `openai`; used by tutor, profile,
    image, file, and vector-store operations. Non-OpenAI model providers are
    stubs in this POC.
  - `OPENAI_API_KEY`, `OPENAI_REALTIME_MODEL` – credentials/aliases used for session token issuance.
  - `OPENAI_INPUT_TRANSCRIPTION_MODEL` – model used to transcribe caller audio.
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

## Notes on OpenAI Realtime

- Persona instructions and voice are injected during `/webrtc` session setup; the Node bridge collapses them into a single `instructions` string and `voice` parameter when creating the OpenAI session.
- File Search ids are accepted but currently ignored because the REST surface does not yet allow attaching them to Realtime sessions.
- Tutor/profile/image/file/vector-store operations go through the
  OpenAI-first `AiModelService` facade; only the realtime voice provider uses
  `AI_PROVIDER`.
- Audio is forwarded as Opus RTP frames end-to-end. Data channel events are processed in-process and persisted into conversation transcripts/token usage through `WebRtcProviderEventService`.
- In translator mode, the bridge waits for completed transcription events and requests translation against the transcribed text to reduce free-form assistant replies.

## Next Steps

1. Add end-to-end tests that validate full browser ↔ bridge ↔ OpenAI SDP/ICE negotiation.
2. Flesh out additional AI providers (Gemini Live, Hume EVI, Retell) behind the common provider interface.
3. Persist conversations in durable storage and surface session analytics/metrics.
4. Harden translation QA with explicit post-generation language/format validation hooks.
