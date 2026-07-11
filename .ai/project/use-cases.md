# EGMathTeacher Use Cases And Business Rules

This file records project-owned user workflows and domain rules.

## Audience

The intended learner audience is teenagers around 14-16 years old preparing
for Russian ЕГЭ math.

UI and tutor behavior should favor:

- clear Russian-language explanations
- Russian and English static UI labels where the browser client owns the text
- predictable controls
- visible next actions
- short chunks of reasoning
- practice tasks and examples
- optional visuals when they genuinely clarify a concept

## Implemented User Roles

- `student`: default role for users after the first account.
- `admin`: first registered user; can upload knowledge files.

No parent, teacher, school, class, subscription, or multi-tenant role is
implemented.

## Main Use Cases

### Register Or Log In

User submits name and password in the web client.

Rules from current implementation:

- Name length must be between 2 and 64 characters.
- Password length must be between 4 and 256 characters.
- User names are unique.
- First registered user becomes `admin`; later users become `student`.
- Successful auth sets an HTTP-only signed cookie.
- Static UI language can be switched between Russian and English before login,
  during first meeting, and inside the authenticated shell.

### Ask The Tutor

Authenticated user sends a math question by text or browser speech
recognition.

Rules from current implementation:

- Tutor requests are sent to `POST /tutor/message`.
- The API records source as `text` or `voice`.
- Tutor responses are expected to include explanation text, tasks, examples,
  image need flag, image prompt, and citations when file search provides them.
- The tutor prompt instructs the model to answer in Russian, explain step by
  step, check understanding, and avoid returning only the final answer.
- If RAG vector stores exist, the OpenAI-backed model provider uses file
  search.
- If RAG materials are missing, the tutor prompt says not to invent citations.
- If a student profile exists, the tutor prompt includes its compact DB summary
  and explanation strategy so the answer can adapt to the teenager.

### Complete First-Login Meeting

Student users complete a guided first meeting before the normal tutor
workspace.

Rules from current implementation:

- Profile status is loaded through `GET /student-profile/me`.
- Student profile creation uses `PUT /student-profile/me`.
- Admin users do not require onboarding by default.
- The meeting asks for exam context, target score, confidence, emotional
  relation to math, weak topics, explanation preferences, pacing, visual
  preference, analogy interests, and short diagnostic answers.
- The wording avoids presenting the diagnostic as a school test.
- The API creates the profile through specialist AI evaluator calls:
  - math knowledge diagnostician
  - tutoring-focused psychopedagogical profiler
  - teaching strategy planner
- Specialist outputs should include confidence and evidence for meaningful
  inferences when possible.
- OpenAI is the implemented model provider for those specialist calls in the
  current POC; non-OpenAI model providers are stubs.
- If RAG vector stores exist, profile generation may use file search only for
  shared pedagogy, questionnaire strategies, rubrics, and explanation
  playbooks.
- Personal profile memory is stored in SQLite, not in RAG.
- The stored psychopedagogical profile is for explanation strategy only; it
  must not diagnose, manipulate, or preserve unnecessary sensitive details.
- First-meeting answers and AI-made profile sections are filtered before
  storage so only teaching-useful signals remain for explanation strategy.

### Review Settings

Authenticated users can open the settings view from the app shell.

Rules from current implementation:

- Settings can change the static UI language between Russian and English.
- Browser speech-recognition language follows the selected UI language.
- Settings shows account name, role, and creation timestamp from the current
  session.
- Settings shows read-only learning profile memory when it is already loaded:
  compact AI summary, first-meeting answers, knowledge state, learning
  preferences, pedagogical hypotheses, and explanation strategy.
- Settings does not edit account fields, profile fields, privacy actions, or
  provider/RAG configuration in the current POC.

### Generate An Explanatory Image

Authenticated user can request image generation when a tutor turn includes an
image prompt.

Rules from current implementation:

- Image requests use `POST /tutor/image`.
- The API calls the model-provider image operation. The current implementation
  delegates to OpenAI image generation and returns a PNG data URL.
- Images should explain math concepts, graphs, schemes, or coordinate-plane
  reasoning.

### Upload Knowledge Materials

Admin user uploads documents for RAG grounding.

Rules from current implementation:

- Endpoint: `POST /admin/knowledge/files`.
- Guard: admin-only.
- Accepted extensions: `.pdf`, `.md`, `.txt`, `.docx`, `.tex`.
- Upload limit: 25 MB.
- OpenAI file and vector store ids are stored in SQLite metadata for the
  current OpenAI-backed provider.
- Status can be checked through `GET /admin/knowledge/status`.

### Use WebRTC Voice Assistant

The inherited voice service exposes WebRTC endpoints under `/webrtc`.

Rules from current implementation:

- Sessions are in memory.
- Conversation transcripts can be written to the transcript log directory on
  close.
- OpenAI Realtime is implemented; Gemini Live, Hume EVI, and Retell are
  configured as stubs.
- Translation mode is supported by passing two languages during session
  bootstrap.

## Explicit Non-Features

These were not found in the repository:

- packaged desktop runtime
- formal ЕГЭ curriculum map
- student progress dashboard
- parent/teacher accounts
- payments or subscriptions
- production privacy/compliance policy
- frontend component, accessibility, or visual regression tests
- production auth hardening beyond the POC
