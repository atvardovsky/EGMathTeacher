# WebRTC Module Guide

This document explains how the `WebRtcModule` works, the endpoints it exposes, and how a client can establish a live audio session with the assistant using the OpenAI Realtime API. Use this as a blueprint when building a WebRTC-capable caller application. The browser interacts with the NestJS service for signaling/token logistics, while the actual media bridge lives inside the service (`OpenAiRealtimeBridgeService`) via the `wrtc` library.

## Overview

The module lives under `src/webrtc/` and contains four main pieces, backed by the generic AI provider module in `src/providers/`:

- `WebRtcController` – REST API for session bootstrap.
- `WebRtcSessionService` – In-memory tracking for each active RTC session and integration with conversation transcripts.
- `WebRtcSignalingService` – Provides ICE server metadata and AI persona options to the client.
- `WebRtcMediaService` – Orchestrates session setup with the in-process realtime bridge and tracks the associated session id. It terminates browser WebRTC connections, forwards media to OpenAI, streams provider events back to the conversation stack, and routes authenticated browser `lesson-events` data-channel messages into the existing tutor engine.

A shared `ConversationService` (from `src/conversation/`) stores per-session voice turns and writes a transcript file when the session ends.

```
Client ──POST /webrtc/session──────▶ WebRtcController
       ◀─ bootstrap payload ─────── WebRtcSignalingService
          │
          ├─ registers session ────▶ WebRtcSessionService
          │
          ├─ optional token request ─▶ WebRtcAuthService ──▶ AI Provider (OpenAI/Gemini/Hume/Retell)
          │
          └─ uses conversation id for dialogue memory
```

## Session Bootstrap API

- **Endpoint:** `POST /webrtc/session`
- **Body (JSON):**
  ```json
  {
    "conversationSeed": "optional-stable-id",
    "translation": {
      "languageA": "en",
      "languageB": "es"
    }
  }
  ```
  `conversationSeed` provides a stable conversation id for a client. The server still resets history for every new session, so each session remains isolated.
  `translation` enables strict bidirectional translation between the two languages. Omit it to run the normal assistant.

- **Response:**
  ```json
  {
    "sessionId": "uuid",
    "conversationId": "conv_1715099739123_8f81b5c2-3a6c-4e47-9f2a-30e8d6b64f28",
    "iceServers": [
      { "urls": "stun:stun.l.google.com:19302" }
    ],
    "openaiRealtimeModel": "gpt-4o-realtime-preview",
    "personality": {
      "name": "EGE Math Tutor",
      "description": "A realtime voice tutor for Russian EGE math students aged 14-16.",
      "tone": "calm, concise, and supportive",
      "locale": "ru-RU",
      "rules": "Speak Russian by default. Ask one short question at a time. Explain EGE math with simple steps, short examples, and a calm tone."
    },
    "fileSearch": {
      "documentationIds": ["file_doc1", "file_doc2"],
      "ruleIds": ["file_rule1"]
    },
    "voices": {
      "default": "alloy",
      "available": ["alloy", "verse", "sol"]
    },
    "translation": {
      "languageA": "en",
      "languageB": "es"
    },
    "maxTurnMillis": 120000
  }
  ```

### Client Responsibilities After Bootstrap

1. Create an `RTCPeerConnection` using the returned `iceServers` array.
2. Capture microphone audio and attach it to the peer connection.
3. Use the `sessionId` and `conversationId` when requesting tokens or debugging.
4. Honour the `personality.rules` string when crafting UI guidance or local prompts (the backend forwards it to the provider automatically).
5. Exchange SDP offer/answer with the server-side bridge so audio flows to the AI provider and synthetic speech returns to the client.
6. Create an ordered data channel named `lesson-events` before generating the SDP offer if the client wants typed lesson messages to use the persistent WebRTC session. Supported client events are `client_ready`, `heartbeat`, and `student_text`.
7. When the call ends, inform the backend so it can close the session—this triggers transcript finalization and file logging.
8. Select an assistant voice from `voices.available` (default provided) and pass it when requesting a realtime token if you want a specific timbre (also used by the server bridge).

### Translation Mode

If `translation` is provided in the bootstrap call, the backend switches the session persona to a strict translator:

- Always translate between `languageA` and `languageB`.
- Output only the translation (no extra commentary).
- Preserve punctuation and question marks; if the input is a question, the output must also be a question.
- Preserve meaning, tone, and formatting.
- In translator mode, response generation is triggered from completed transcription events so the model translates the exact caller text.

The backend ignores `translation` when either language is missing/blank or both languages are identical.

> **Note:** The bridge currently supports `openai-realtime`. Providers `google-gemini-live`, `hume-evi`, and `retell-ai` return “not implemented” until their connectors are built.

## Signaling API

With the bootstrap response in hand, the client and server can trade SDP and ICE candidates through the REST endpoints below. A future media bridge worker will use the same services internally, so this surface stays stable.

| Endpoint | Direction | Description |
|----------|-----------|-------------|
| `POST /webrtc/session/{sessionId}/offer` | Client → Server | Submit the client SDP offer; the bridge responds with a generated answer. |
| `GET /webrtc/session/{sessionId}/offer` | Internal tools | Inspect the stored client offer (debugging). |
| `POST /webrtc/session/{sessionId}/answer` | Server → Client | Exposed for completeness (the bridge fulfils this internally). |
| `GET /webrtc/session/{sessionId}/answer` | Client → Server | Poll for the server SDP answer until it is available. |
| `POST /webrtc/session/{sessionId}/ice/client` | Client → Server | Queue a client ICE candidate (optional once the initial answer is applied). |
| `GET /webrtc/session/{sessionId}/ice/client` | Internal tools | Drain queued client ICE candidates. |
| `POST /webrtc/session/{sessionId}/ice/server` | Server → Client | Queue a server ICE candidate for the client (mostly unused with bundled ICE). |
| `GET /webrtc/session/{sessionId}/ice/server` | Client → Server | Poll for server ICE candidates. |
| `GET /webrtc/session/{sessionId}/signaling` | Either | Snapshot of the current signaling state (offer, answer, candidate queues). |
| `POST /webrtc/session/{sessionId}/close` | Either | Trigger session shutdown, finalize transcripts, and tear down the bridge. |
| `POST /webrtc/session/{sessionId}/events` | Provider bridge → Server | Ingest provider event batches for transcript and token capture; empty batches are accepted and ignored. |

Clients can start with simple polling; when the dedicated media worker arrives it can switch to more efficient transports without breaking compatibility.

`WebRtcMediaService` spins up two peer connections—one facing the browser, one facing the AI provider—and forwards audio in both directions. The current implementation uses OpenAI Realtime; other providers share the same abstraction but still return “not implemented” until their connectors are added. The browser-facing peer can also accept a `lesson-events` data channel. That channel is server-local and is not forwarded to OpenAI; it calls `TutorService.answerMessage` for authenticated `student_text` events.

### Lesson Data Channel Contract

The optional browser data channel label is `lesson-events`.

Client events:

```json
{"type":"client_ready"}
{"type":"heartbeat","sentAt":1715099739123}
{"type":"student_text","requestId":"uuid","message":"Решим 2x + 3 = 15","lessonType":"practice","source":"text"}
```

Server events:

```json
{"type":"session_ready","sessionId":"...","conversationId":"...","lessonSessionId":"...","lessonType":"practice"}
{"type":"heartbeat_ack","sessionId":"...","receivedAt":1715099739999}
{"type":"tutor_answer","requestId":"uuid","turn":{},"answer":{},"conversationId":"...","lessonSessionId":"...","lessonType":"practice","terminal":false}
{"type":"error","requestId":"uuid","code":"auth_required","message":"..."}
```

`student_text` requires a signed-in app session captured during
`POST /webrtc/session`. The API stores only non-secret user metadata in the
in-memory WebRTC session so the data-channel message can enter the same
governed tutor path as `POST /tutor/message`. The data channel does not bypass
lesson lifecycle, terminal-conversation rejection, RAG, verifier policy, usage
ledger writes, or background observation logic. Raw audio/provider events stay
on the Realtime transcript path and do not become verifier evidence by
themselves.

## OpenAI Realtime Token API

- **Endpoint:** `POST /webrtc/session/{sessionId}/token`
- **Path Params:** `sessionId` returned from the bootstrap call.
- **Body (JSON, optional):**
  ```json
  {
    "voice": "alloy",
    "locale": "en-GB"
  }
  ```
  `voice` is forwarded to OpenAI if provided, letting the client request a specific synthesized voice (must be one of the `voices.available` values returned by the bootstrap endpoint). `locale` overrides the configured persona locale; omit it or send `"auto"` to let the assistant infer the caller’s locale dynamically.

- **Response (example):**
  ```json
  {
    "id": "sess_abc123",
    "model": "gpt-4o-realtime-preview",
    "client_secret": {
      "value": "rtm_XXXX",
      "expires_at": "2024-05-07T10:15:00Z"
    }
  }
  ```

Use the returned `client_secret.value` when authenticating directly with the OpenAI Realtime API from the client. Tokens expire quickly (typically 1 minute), so request a fresh one right before establishing the Realtime connection.

> The backend automatically injects the configured personality metadata and file-search attachment ids when creating the token, so every client session inherits the same grounding without duplicating configuration logic on the caller.

## Realtime Session Handshake

When the provider module is set to `openai-realtime`, the bridge talks to OpenAI’s REST Realtime endpoint. The handshake looks like this:

1. **Create the session** using `POST /v1/realtime/sessions` with `model` and optional `voice`, `instructions`, and `input_audio_transcription`. For signed-in tutoring sessions, `instructions` include compact server-only teaching context from the active lesson and recent analytic memory.
2. **Exchange SDP** – the bridge posts `pcProvider.localDescription.sdp` to `POST /v1/realtime?model=…` and applies the returned answer.
3. **Open the data channel** – once the “oai-events” channel opens, translator sessions send a system message with strict translation rules:
   ```json
   {"type":"conversation.item.create","item":{"type":"message","role":"system","content":[{"type":"input_text","text":"...translator instructions..."}]}}
   ```
4. **Request responses**:
   - Standard assistant mode: `response.create` is triggered from speech/transcription lifecycle events.
   - Translator mode: `response.create` is triggered only after completed input transcription events and includes the transcribed text to translate.
5. **Stream audio** – OpenAI pushes PCM over the provider peer connection while responses are generated. Audio frames and provider data-channel events are bridged back to the caller-side services. Browser `lesson-events` messages stay inside NestJS and are not forwarded to OpenAI Realtime.

If OpenAI extends the schema, update this sequence and the `OpenAiRealtimeProvider` payload accordingly. For non-OpenAI providers, swap in the appropriate handshake inside `AiProviderModule`.

### Conversation Capture

`OpenAiRealtimeBridgeService` subscribes to the provider “oai-events” data channel and forwards events into `WebRtcProviderEventService`:

- `conversation.item.created/completed` (role `user`) and `input_audio_transcription.*` events populate caller transcript turns.
- `response.audio_transcript.delta/done` and `response.content_part.*` accumulate assistant output; final text is persisted as a conversation turn.
- `response.done` usage payloads (when supplied by OpenAI) are attached to the most recent user/assistant turns so the transcript log records total incoming/outgoing token counts.
- `conversation.item.truncated` is noted in the transcript to highlight when the provider clipped audio.
- `system` role items are ignored when persisting transcript turns.

Any transcript fragments still buffered when the session closes are flushed before teardown, guaranteeing that the conversation log written to `TRANSCRIPT_LOG_DIR` contains every completed turn.
For signed-in app sessions, close also writes one `ai_usage_ledger` row with
operation `webrtc.realtime_session`, the Realtime model, session duration, and
the accumulated incoming/outgoing token counts when provider usage events were
captured. If token usage was not captured, the ledger row uses
`usage_unavailable:realtime_tokens` and keeps the local cost estimate at zero.
The ledger row intentionally stores safe session metadata only, not raw
transcripts or provider payloads.
When the transcript contains teaching-useful content for a signed-in app
session, close can create or reuse a lesson session and write one compact
voice-origin `tutor_turns` row so the next tutor message can continue from the
live discussion. That saved row is continuity context only: it is not verifier
evidence and does not create task blocks, images, mastery evidence, or
goal-completion state. By contrast, typed `student_text` events sent through
the `lesson-events` data channel are normal tutor turns and can create whatever
the tutor engine would create for the same `POST /tutor/message` payload.

Close can also enqueue a `realtime_session_review` background job. That job
uses the cheaper background model policy to store sanitized teaching
observations and an optional compact session summary. It must not write
verifier attempts, `student_skill_progress`, mastery evidence, or
goal-completion state.

## Session Lifecycle

1. **Create** – `WebRtcSessionService.createSession()` reserves a session id and associates it with the conversation plus optional signed-in user, lesson session id, and lesson type metadata for usage attribution.
2. **Activate** – When the media bridge is ready (future implementation), call `activateSession()` so status becomes `active`.
3. **Lesson data events** – While active, authenticated `student_text` messages on the `lesson-events` channel call the tutor engine and return `tutor_answer` events over WebRTC. The WebRTC session `updatedAt` timestamp is touched by every valid channel event so idle cleanup does not close an active text exchange.
4. **Close** – On hangup, call `closeSession()`. This finalizes the conversation, stitches together transcripts, writes them to `TRANSCRIPT_LOG_DIR` as `<conversationId>_<timestamp>.txt`, saves a compact authenticated lesson turn when useful transcript content exists, records authenticated Realtime usage, and can enqueue the safe background Realtime teaching review.
5. **Retrieve Transcript & Token Stats** – Use `getTranscriptForSession()` or the conversation service helpers to access the saved text or file path. Finalization logs include total “incoming” (caller) and “outgoing” (assistant) token counts once the media bridge begins recording usage.
6. **Teardown Bridge** – Clients (or future automation) should hit `POST /webrtc/session/{sessionId}/close` to invoke `WebRtcMediaService.closeSession`, which finalizes transcripts and clears in-memory bridge state.

## Configuration

Environment variables used by the module:

| Variable | Description | Default |
|----------|-------------|---------|
| `AI_PROVIDER` | Which AI provider module to load (`openai-realtime`, `google-gemini-live`, `hume-evi`, `retell-ai`). | `openai-realtime` |
| `OPENAI_API_KEY` | Server-side key for creating OpenAI Realtime sessions (required when `AI_PROVIDER=openai-realtime`). | _(required for OpenAI)_ |
| `OPENAI_REALTIME_MODEL` | Model alias to advertise to clients (OpenAI only). | `gpt-4o-realtime-preview` |
| `GEMINI_API_KEY` | Google Gemini API key (required for `google-gemini-live`). | _(empty)_ |
| `GEMINI_LIVE_MODEL` | Gemini Live model identifier. | _(empty)_ |
| `HUME_API_KEY` | Hume EVI API key. | _(empty)_ |
| `HUME_SECRET_KEY` | Hume EVI secret key. | _(empty)_ |
| `RETELL_API_KEY` | Retell AI API key. | _(empty)_ |
| `WEBRTC_ICE_SERVERS` | Comma-separated list of STUN/TURN URLs advertised to clients. | `stun:stun.l.google.com:19302` |
| `WEBRTC_MAX_SESSIONS` | Hard limit on concurrently open sessions (0 disables the limit). | `25` |
| `WEBRTC_ENABLE_BARGE_IN` | Cancel an in-flight response when caller speech starts. | `true` |
| `WEBRTC_SESSION_IDLE_TIMEOUT_MS` | Milliseconds of inactivity before an open session is closed. | `300000` |
| `WEBRTC_IDLE_SWEEP_INTERVAL_MS` | Interval for scanning and closing idle sessions. | `60000` |
| `OPENAI_REALTIME_REQUEST_TIMEOUT_MS` | Timeout for OpenAI REST calls made by the Realtime bridge. Falls back to legacy `OPENAI_REQUEST_TIMEOUT_MS` when unset. | `30000` |
| `OPENAI_REQUEST_RETRIES` | Retry count for OpenAI REST calls made by the bridge. | `2` |
| `OPENAI_CLIENT_SECRET_GRACE_MS` | Refresh threshold before OpenAI client-secret expiry. | `5000` |
| `AI_BACKGROUND_REALTIME_REVIEW_ENABLED` | Enable the optional post-close Realtime teaching-observation background review. | `true` |
| `AI_BACKGROUND_REALTIME_REVIEW_MAX_TRANSCRIPT_CHARS` | Maximum sanitized transcript characters sent to the Realtime review job. | `4000` |
| `AI_OPERATION_BACKGROUND_REALTIME_SESSION_REVIEW_MODEL` | Optional model override for the Realtime review background operation. | _(empty = background model defaults)_ |
| `AI_OPERATION_BACKGROUND_REALTIME_SESSION_REVIEW_SERVICE_TIER` | Optional service-tier override for the Realtime review operation. | _(empty = background service tier)_ |
| `TRANSCRIPT_LOG_DIR` | Directory where final transcript `.txt` files are written. | `./logs` |
| `ASSISTANT_PERSONALITY_NAME` | Display name for the assistant persona. | `EGE Math Tutor` |
| `ASSISTANT_PERSONALITY_DESCRIPTION` | Short description exposed to OpenAI Realtime. | `A realtime voice tutor for Russian EGE math students aged 14-16.` |
| `ASSISTANT_PERSONALITY_TONE` | Qualifier for the assistant tone (e.g., `friendly`, `calm`). | `calm, concise, and supportive` |
| `ASSISTANT_PERSONALITY_LOCALE` | Locale/voice hint for synthetic speech. | `ru-RU` |
| `ASSISTANT_RULES` | Plain-text behavioral rules the assistant must follow. | `Speak Russian by default. Ask one short question at a time. Explain EGE math with simple steps, short examples, and a calm tone. Do not claim verifier-backed mastery or progress from realtime voice alone.` |
| `FILE_SEARCH_DOCUMENTATION_IDS` | Comma-separated list of OpenAI File IDs to load as documentation context. | _(empty)_ |
| `FILE_SEARCH_RULE_IDS` | Comma-separated list of OpenAI File IDs for rules/policies. | _(empty)_ |
| `ASSISTANT_DEFAULT_VOICE` | Default OpenAI voice to use when none is specified by the client. | `alloy` |
| `ASSISTANT_AVAILABLE_VOICES` | Comma-separated list of allowed OpenAI voice ids advertised to clients. | `alloy,verse,sol` |
| `OPENAI_INPUT_TRANSCRIPTION_MODEL` | Model used to transcribe caller audio (OpenAI only). | `gpt-4o-mini-transcribe` |
| `CORS_ORIGINS` | Comma-separated list of allowed origins for CORS (use `*` only when credentials are disabled). | _(empty = reflect request origin)_ |
| `CORS_CREDENTIALS` | Allow cookies/authorization headers on CORS requests (`true`/`false`). | `true` |
| `HTTPS_KEY_PATH` | File path to TLS private key for HTTPS (optional). | _(empty)_ |
| `HTTPS_CERT_PATH` | File path to TLS certificate for HTTPS (optional). | _(empty)_ |

The bootstrap server sets `Referrer-Policy: strict-origin-when-cross-origin` on responses.

## Live Smoke Check

The repository provides a guarded manual smoke command for real OpenAI
Realtime negotiation through the running app:

```bash
npm run smoke:realtime
REALTIME_SMOKE_LIVE=true npm run smoke:realtime
```

Without `REALTIME_SMOKE_LIVE=true`, the command exits without live provider
calls. With the flag set, the dev stack must already be running and the API
process must have valid OpenAI credentials.

### Session Limits & Cleanup

- `WebRtcSessionService` enforces `WEBRTC_MAX_SESSIONS` for sessions whose status is not `closed`. Clients attempting to create additional sessions will receive HTTP `429 Too Many Requests`.
- Closed sessions remain in memory for five minutes by default. Call `cleanupClosedSessions()` (e.g., from a scheduled job) to purge old entries sooner if needed.

## Next Implementation Steps

The scaffold omits several critical pieces that need to be built:

1. **Ephemeral Realtime Tokens** – ✅ Exposed via `POST /webrtc/session/{sessionId}/token`; integrate with the client handshake flow.
2. **Signaling Channel** – ✅ REST endpoints available for SDP/ICE exchange; the bridge consumes them directly.
3. **Media Bridge** – ✅ Browser audio is forwarded to OpenAI Realtime and synthetic speech is relayed back to the client. Persona metadata is collapsed into the `instructions` field (file search ids are currently ignored until tooling is added). Gemini/Hume/Retell support still TODO.
4. **Session Limits & Cleanup** – ✅ Limit enforcement in place; wire up periodic calls to `cleanupClosedSessions()` and add retry policies.
5. **Observability** – Usage-ledger accounting and cheap background teaching review exist for authenticated session close. Add metrics and structured logs for session state, transcription success, call quality, and provider-side billing reconciliation before production.

With these additions the module will provide a production-ready entry point for any WebRTC-capable voice client.
