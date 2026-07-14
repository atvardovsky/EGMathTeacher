# EGMathTeacher Security And Safety

This file records project-owned security and safety boundaries from repository
evidence. It is not a full production security or privacy policy.

## Secrets

Treat these as secrets:

- `OPENAI_API_KEY`
- `JWT_SECRET`
- `GEMINI_API_KEY`
- `HUME_API_KEY`
- `HUME_SECRET_KEY`
- `RETELL_API_KEY`
- TLS private keys
- signed auth cookies
- OpenAI Realtime client secrets

Do not print, commit, transform, or invent secret values.

## Authentication And Sessions

Current implementation:

- local name/password auth
- bcrypt password hashing
- first registered user gets `admin`
- later users get `student`
- signed HMAC session token
- HTTP-only cookie
- `sameSite: lax`
- cookie `secure` controlled by `AUTH_COOKIE_SECURE`
- session expiry controlled by `AUTH_SESSION_DAYS`

Auth gaps:

- no password reset
- no rate limiting
- no account lockout
- no MFA
- no CSRF-specific token beyond SameSite cookie behavior
- no formal session revocation store

These gaps are accepted for the current POC only. Do not claim production auth
readiness until explicit auth hardening requirements are added and
implemented.

## Authorization

Current guards:

- `AuthGuard` protects tutor endpoints.
- `AuthGuard` protects the signed-in user's usage summary and background job
  recovery endpoints.
- `AdminGuard` protects admin knowledge endpoints.

Guard coverage details are owned by `.ai/project/guards.md`.

Current unguarded endpoints:

- auth endpoints
- health endpoint
- WebRTC controller endpoints

Do not broaden access or weaken guards without explicit approval.

## Live External Services

OpenAI calls can happen through the current model and realtime providers:

- Responses API
- Images API
- Files API
- Vector Stores API
- Realtime API

The local `npm run knowledge:sync -- --sync-rag` command can create/reuse
OpenAI vector stores, upload files, attach files, and detach superseded
vector-store file attachments. `--dry-run` must not perform live OpenAI
create/upload/attach/delete calls.

Current knowledge-pack sync safety posture:

- zip extraction and pack scanning are bounded by archive size, total unpacked
  size, file count, single-file size, directory depth, extension, and
  path-traversal guardrails, but remain trusted local operator workflows
- non-dry-run RAG sync records durable local sync jobs and can recover failed
  or attached-timeout jobs that captured recoverable OpenAI file ids
- parallel upload/attach paths are locally claimed by sync job key, but there
  is no distributed lock beyond the SQLite process boundary
- vector-store indexing readiness is polled when `--wait-ready` is used; a
  sync job is marked `indexed` only after remote `completed`, while timeouts
  remain attached with timeout metadata and keep stale active attachments in
  place until recovery promotes the replacement

Other configured providers are stubs unless implemented later.

Assistants must not trigger live external calls unless the task explicitly
requires it and the user has approved credential/spend risk.

## Student Data And Privacy

Potential student data in this POC:

- user names
- password hashes
- tutor prompts
- tutor answers
- first-login onboarding answers
- AI-made knowledge state, learning preferences, tutoring-focused
  psychopedagogical profile, explanation strategy, and profile summary
- specialist profile evidence and confidence fields used for teaching strategy
- background learning observations, grouped analysis windows, learning signals,
  session summaries, skill progress/regression rows, profile-refresh evidence,
  strategy-refresh evidence, and quality-review records
- lesson session lifecycle rows, lesson effectiveness signals, lesson decision
  action/policy observability, and local AI usage ledger rows for the signed-in
  user's operation/model/token/image/cost estimates
- backend-generated lesson tasks, bounded student attempts, deterministic
  verifier results, and mastery evidence for supported task types
- generated images and prompts; in the POC, generated image data URLs can be
  stored inside the signed-in user's `tutor_turns.answer_json` image block for
  lesson continuity
- uploaded knowledge file metadata
- voice transcripts and transcript files
- remote OpenAI files/vector stores/model outputs

Current data-minimization rule:

- store only information that can help choose explanations, pacing, tone,
  examples, hints, practice, diagnostics, and visual support
- do not store family, health, clinical, political, religious, intimate,
  address/contact, or other non-teaching sensitive details
- drop unsafe freeform details before profile generation, storage, and later
  specialist prompt chaining
- background AI jobs, stored observations, grouped analysis windows, and
  results must sanitize payloads before storage; session summaries and skill
  progress/regression rows must stay teaching-useful and must not store raw
  sensitive personal details, clinical diagnoses, or non-teaching facts
- lesson decision rows must store teaching-action evidence and policy results,
  not clinical labels, sensitive personal details, raw hidden prompts, provider
  request ids, secrets, or billing credentials
- verifier rows must store only task/answer evidence needed for teaching and
  debugging; expected answers must not be exposed to the student before an
  attempt is submitted
- conversation-based first-meeting profile creation is idempotent by signed-in
  user, conversation id, and transcript hash so HTTP retries or duplicate tabs
  do not repeatedly send the same transcript through the four onboarding AI
  calls after success; stale running claims are retryable after the configured
  lease while fresh running claims remain blocked to avoid duplicate spend
- the legacy structured JSON onboarding endpoint is disabled for student use
  by default; `ONBOARDING_STRUCTURED_ENDPOINT_ENABLED=true` is required for
  trusted fallback/import workflows

Raw student prompts and tutor answer JSON still remain in `tutor_turns` during
the POC. Profile sanitation limits long-term teaching memory, but it does not
delete the source transcript. Production use requires a separate transcript
retention, redaction, deletion, consent, and storage-protection policy.

The authenticated web settings view may display the signed-in user's own
read-only tutoring profile memory. It must not add profile editing, export,
or administrative profile browsing without a separate security and privacy
review.

The tutor workspace may display a signed-in user's own usage bar. The usage
bar can show operation names, assistant roles, model names, token counts,
image counts, service tier, local estimated cost, decision action outcomes,
evidence levels, verifier results, and cost per verified outcome. It must not
show raw prompts, hidden system/developer instructions, RAG chunks, provider
request ids, secrets, billing credentials, stack traces, or another user's
usage. Cost values are local estimates based on configured prices and are not
provider billing proof.

The usage panel may offer background job recovery only for recoverable failed
jobs owned by the signed-in user. The recovery request must not expose raw
background payloads and must schedule later worker execution instead of
running a provider call synchronously in the HTTP request.

Browser voice output in the tutor workspace reads only visible tutor answer
blocks through local speech synthesis. It must not speak hidden prompts,
debug-only data, secrets, raw RAG chunks, or non-visible profile facts, and it
does not create a stored generated-audio artifact.

Gaps:

- no formal privacy policy
- no retention policy
- no transcript redaction/deletion lifecycle for accidental sensitive details
- no delete/export workflow
- no production compliance review

## Logging And Redaction

Current rule:

- do not log secrets, auth cookies, session tokens, raw provider payloads, raw
  tutor prompts, raw voice transcripts, or raw psychopedagogical profile data
- WebRTC provider event logs may include event type, ids, and payload keys, but
  not transcript or delta text
- transcript files remain student data and are governed by the retention and
  delete/export gaps listed in this file

Current gaps:

- no comprehensive automated log-redaction scanner
- no production log retention policy

Psychopedagogical profile rule:

- store only tutoring-relevant signals
- do not store clinical diagnoses or sensitive family/health/private details
- sanitize first-meeting freeform text and AI-made profile JSON before storage
- sanitize background observations, learning signals, grouped analysis windows,
  session summaries, skill progress/regression rows, and AI-made background
  refresh outputs before storage
- use the profile only to adapt explanations, pacing, tone, examples, and
  practice strategy
- phrase psychopedagogical fields as teaching hypotheses with evidence and
  confidence when possible
- do not claim production readiness for profiling minors without privacy review

Do not claim this is production-ready for real student data until those gaps
are closed.

## Destructive Operations

Require explicit programmer approval before:

- deleting SQLite data
- deleting transcript logs
- deleting remote OpenAI files or vector stores
- detaching remote OpenAI vector-store files outside the approved
  knowledge-pack replacement path
- changing system web server config
- reloading production services
- rotating credentials
- changing cookie/security settings in production

## Dependencies

Current dependency managers and package manifests:

- root `package.json`
- `apps/api/package.json`
- `apps/web/package.json`
- `package-lock.json`

Adding production dependencies or external services requires approval.

## Deployment Safety

Deployment reference files exist under `deploy/`. They are repository
references, not proof of active server state.

Do not install, reload, or alter Apache, Nginx, PM2, certificate, or system
configuration unless the user explicitly asks for that deployment action.
