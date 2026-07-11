# EGMathTeacher Runtime Flows

This file records runtime flows from current source evidence.

## Development Startup

1. User runs `npm run dev` from the repository root.
2. `concurrently` starts:
   - `npm run start:dev --workspace @egmathteacher/api`
   - `npm run dev --workspace @egmathteacher/web`
3. API listens on `PORT` from env or `3000`.
4. Web dev server listens on `5137`.
5. If `.cert/localhost-key.pem` and `.cert/localhost-cert.pem` exist, Vite
   serves HTTPS at `https://localhost:5137`.
6. Vite proxies `/auth`, `/student-profile`, `/tutor`, `/admin`, `/webrtc`,
   and `/health` to the API on `127.0.0.1:3000`.

## SQLite Schema Initialization Flow

1. `DatabaseService` opens the configured SQLite file and enables WAL plus
   foreign keys.
2. It creates `schema_migrations` when missing.
3. It applies migration `001_initial_schema` using idempotent `CREATE TABLE IF
   NOT EXISTS` statements for current POC tables.
4. It records the applied migration version and timestamp in
   `schema_migrations`.

## Auth Flow

1. Web client initializes static UI locale from `localStorage` or browser
   language and can switch between Russian and English locally.
2. Web client checks `GET /auth/me`.
3. User submits login or registration form.
4. API validates name/password.
5. Registration creates a SQLite user with role:
   - first user: `admin`
   - later users: `student`
6. API signs a session token and sets an HTTP-only cookie.
7. Authenticated API guards read the cookie and attach `request.user`.

## First-Login Student Profile Flow

1. After auth, the web client calls `GET /student-profile/me`.
2. If the authenticated user is a student without a stored profile, the web
   client shows the first meeting instead of the normal tutor workspace.
3. The first meeting gathers tutoring-relevant context:
   - exam and target score
   - current math confidence and emotional relation to math
   - weak topics and short diagnostic answers
   - explanation style, pacing, hint/practice preference, visual preference,
     and interests for analogies
4. The web client submits answers to `PUT /student-profile/me`.
5. `StudentProfileService` normalizes answers, drops non-teaching sensitive
   details, and reads active vector store ids.
6. `AiModelService` runs three specialist model calls:
   - math knowledge diagnostician creates `knowledgeState`
   - tutoring-focused psychopedagogical profiler creates `learningPreferences`
     and `psychologicalProfile`
   - teaching strategy planner creates `explanationStrategy` and compact
     `aiSummary`
7. Specialist prompts ask for confidence and evidence for meaningful profile
   inferences when possible.
8. RAG is used only for shared AI knowledge such as questionnaire strategy,
   diagnostic rubrics, task strategy, and teaching playbooks.
9. SQLite stores only teaching-useful personal profile signals in
   `student_profiles`.
10. Future tutor requests reload the DB profile so context compaction does not
   erase who the AI is speaking with.

## Tutor Message Flow

1. Authenticated user submits text or browser speech-recognition text.
2. Web client calls `POST /tutor/message` with:
   - `message`
   - optional `conversationId`
   - source `text` or `voice`
3. `TutorService` normalizes the message and conversation id.
4. `StudentProfileService` loads the stored student profile summary and
   explanation strategy when available.
5. `KnowledgeService` returns configured or uploaded vector store ids.
6. `TutorService` builds a model-provider request:
   - Russian ЕГЭ tutor instructions
   - user name
   - source type
   - optional DB-backed student profile context
   - user prompt
   - optional `file_search` tool
7. The current OpenAI-backed provider calls Responses API.
8. API parses model output as structured tutor JSON when possible.
9. API extracts citations from file-search annotations/results.
10. API writes the tutor turn to `tutor_turns`.
11. Web client renders answer, tasks, examples, citations, and optional image
   action.

## Tutor Image Flow

1. Tutor response says `needsImage=true` and includes `imagePrompt`, or the
   service infers a visual prompt for unstructured visual text.
2. User clicks image generation in the web client.
3. Web client calls `POST /tutor/image`.
4. API calls the model-provider image operation. The current implementation
   delegates to OpenAI image generation using configured model, size, and
   quality.
5. API returns a PNG data URL.
6. Web client renders the generated image in the tutor turn.

## Settings Flow

1. Authenticated user opens the settings view from the app shell.
2. Web client renders local interface settings:
   - Russian/English language switch
   - current browser speech-recognition language derived from selected locale
3. Web client renders current account facts from the existing auth session:
   user name, role, and creation timestamp.
4. If a stored student profile exists, the web client renders read-only
   profile memory from the already loaded `GET /student-profile/me` response:
   AI summary, first-meeting answers, knowledge state, learning preferences,
   teaching hypotheses, and explanation strategy.
5. Settings does not edit account data or regenerate the AI profile in the
   current POC.

## Knowledge Upload Flow

1. Admin opens the knowledge screen.
2. Web client calls `GET /admin/knowledge/status`.
3. Admin uploads a supported file to `POST /admin/knowledge/files`.
4. API rejects empty files or unsupported extensions.
5. API uses an existing vector store id or creates `EGMathTeacher ЕГЭ
   knowledge` through the model provider.
6. API uploads the file through the model provider.
7. API attaches the file to the vector store through the model provider.
8. API stores local metadata in `knowledge_files`.
9. Status refresh can query vector store file status and update local metadata.

## WebRTC Flow

The inherited WebRTC service lives under `/webrtc`.

High-level flow:

1. Client creates session with `POST /webrtc/session`.
2. API creates in-memory WebRTC session and conversation state.
3. Client can request a realtime token with
   `POST /webrtc/session/:sessionId/token`.
4. Client submits SDP offer to `POST /webrtc/session/:sessionId/offer`.
5. API media bridge negotiates with OpenAI Realtime and returns SDP answer.
6. ICE candidates can be queued or drained through the documented endpoints.
7. Provider events update conversation transcript state.
8. Session close finalizes transcript text and writes transcript file when
   available.

Detailed WebRTC endpoint behavior is owned by `apps/api/docs/webrtc-module.md`
and `apps/api/src/webrtc`.

## Production Routing Flow

The production routing pattern is documented, but system state is not source
truth inside this repository.

Expected reference shape:

1. Built web files are served from `apps/web/dist`.
2. API runs on `127.0.0.1:3000`.
3. Reverse proxy routes `/auth`, `/student-profile`, `/tutor`, `/admin`,
   `/webrtc`, and `/health` to the API.
4. Other paths serve the web app for client-side routing.

Do not modify or reload system web server configuration unless explicitly
requested.

## Error And Gap Notes

- OpenAI API calls fail when `OPENAI_API_KEY` is not configured.
- Non-OpenAI text/RAG/image/file model providers are configured as stubs until
  their provider contracts are implemented.
- OpenAI Realtime file-search ids are logged as unsupported by the current
  Realtime REST path.
- Gemini Live, Hume EVI, and Retell providers are stubs.
- Browser speech recognition depends on browser support.
- WebRTC audio support depends on the installed `wrtc` build.
- No retry/idempotency contract for knowledge upload is documented.
