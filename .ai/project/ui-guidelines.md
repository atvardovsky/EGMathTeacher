# EGMathTeacher UI Guidelines

This file owns project UI rules for the React/Vite web client.

## Scope

The current product is a browser-based POC with a desktop-style learning
layout, not a packaged desktop runtime. UI work should stay inside:

- `apps/web/src/App.tsx`
- `apps/web/src/i18n.ts`
- `apps/web/src/styles.css`
- project docs and diagrams that describe UI behavior

Use Mantine components, lucide icons, and the existing Vite app. Do not add a
new production UI dependency without explicit programmer approval.

## Audience

The intended learner is a teenager around 14-16 preparing for Russian ЕГЭ
math.

UI should:

- make the next action visible without long instruction text
- use compact chunks instead of dense reading blocks
- avoid childish tone, moralizing, or school-test framing
- look polished and modern without clutter or decorative noise
- keep important controls large enough for touch and coarse pointing
- give the learner control over text input, voice input, voice output, and
  optional images
- support Russian and English static UI text

## Product Flow

The web UI follows this tree:

1. Auth check loading.
2. Auth screen with login/register and language switch.
3. Student first-meeting screen when profile onboarding is required. This
   screen is voice-first: a green start button begins the AI-led meeting,
   tutor speech is enabled when the browser supports it, the mic reopens in
   voice-dialog mode only while the meeting remains non-terminal, text input
   is only a fallback, and unfinished meetings are restored from saved lesson
   history after reload. If the meeting becomes terminal, show a read-only
   transcript with create-profile or start-new-meeting actions and disable mic
   plus text input for that conversation. Reloading during onboarding should
   restore active meetings only when they have stored turns, and should fall
   through to terminal pre-profile meeting history when an empty active
   meeting exists.
4. Main app shell after onboarding or for admin users.
5. Tutor workspace as the default main view.
6. When the tutor workspace has no turns, show a lesson launcher with a
   prominent green first-lesson button and scannable lesson cards. Do not leave
   the student in a blank waiting state after setup.
7. Show a saved-lesson continuity panel in the tutor workspace. It should
   display active lessons separately from historical records, show resume
   actions only for non-terminal lessons, show open-record actions for
   read-only history, and show an explicit empty-history message when no
   lessons are saved yet. If active stored turns exist, the latest active
   saved discussion should be visible without making the student discover a
   hidden history control.
8. Tutor lesson modes expose the main POC choices in the UI: meeting, tutor,
   practice, diagnostic, and mistake review.
9. Tutor workspace shows a compact lesson usage bar for all signed-in users.
   It can expand to safe operation/model/token/image, verifier, and
   decision-policy details, but it should not look like an admin debug
   console.
10. Active lessons must have an obvious finish action. Opening a finished or
    legacy lesson record must make the read-only state visible and disable the
    composer, voice input, and new image-generation actions until the student
    starts a new lesson.
11. Settings view for language, voice, account info, and read-only profile
   memory, including recent session summaries and skill progress/regression.
12. Admin knowledge-materials view only for admin users.

The first screen after auth must be a usable app surface, not a marketing
landing page.

## Multilingual Rules

- Static human-facing UI copy lives in `apps/web/src/i18n.ts`.
- Supported locales are `ru` and `en`.
- The language switch is available before login, during first meeting, in the
  authenticated shell, and inside Settings.
- Locale is persisted in `localStorage` under `egmathteacher.locale`.
- Stored onboarding answer values remain stable Russian canonical values where
  they feed the current profile-generation prompts; translated labels are UI
  presentation.
- API/model responses are not translated by the frontend. The current tutor
  prompt remains ЕГЭ-focused and Russian-first unless a future API locale
  contract is accepted and documented.

## Layout Rules

- Use `AppShell` for authenticated navigation, with a mobile header and
  collapsible navbar.
- Use Mantine form components for inputs, selects, multi-selects, switches,
  segmented controls, file upload, alerts, badges, tables, and progress.
- Use a segmented control for the main lesson type because it is a mode
  choice, not a command. Changing the mode starts a fresh lesson/conversation
  boundary so meeting, tutor, practice, diagnostic, and mistake-review state do
  not drift into each other.
- The first-login meeting must not be a static questionnaire as the primary
  path. Gather profile facts through the AI-led `meeting` dialog and create
  the profile from the stored conversation only after backend readiness scoring
  confirms enough real teaching context.
- Use a green primary button for the first lesson launcher action. The launcher
  may start meeting, diagnostic, or practice only after a user click; it must
  not trigger model calls automatically on page load.
- Use lucide icons for buttons and navigation when an icon exists.
- Keep route-like UI in one predictable tree: auth, first meeting, tutor,
  knowledge materials.
- Do not nest cards inside cards. Use `Paper` for repeated task/example
  panels inside tutor-turn cards.
- Reserve large headings for page-level titles. Use smaller titles or bold
  text inside compact panels.
- Keep card radius at 8px or Mantine default unless the component is a
  page-level shell surface.

## Visual Style

- Primary color: teal.
- Secondary accents: indigo for profile/source context, amber/orange for
  practice or task difficulty, red/yellow only for semantic alerts.
- Background: neutral light surface with subtle structure, not decorative
  blobs or one-hue gradients.
- Typography: system/Inter stack, stable font sizes, no viewport-based font
  scaling, letter spacing `0`.
- Controls should not resize the layout on hover, loading, or localized text.
- Text must wrap rather than overlap; use `overflow-wrap: anywhere` where
  model/user content can be long.

## Accessibility And Interaction

- Every form control needs a visible label or accessible label.
- Important click targets should be at least 36-40px high in this app, with
  spacing between adjacent actions.
- Use visible focus states and keep sticky/header surfaces from covering
  focused controls.
- Voice controls must show disabled state when browser speech recognition or
  speech synthesis is unavailable.
- Voice dialog must have an obvious on/off switch and per-answer speak/stop
  control. It may speak a tutor answer after a user-triggered lesson action or
  message, but it must not start speaking on page load.
- The tutor composer may expose WebRTC/OpenAI Realtime as a separate live
  voice action. It must be user-started, clearly show connection state, be
  disabled for read-only history records, and stop when the student changes
  lesson boundary or leaves the tutor workspace. Closing a signed-in realtime
  session should refresh the usage panel when accounting is enabled. Until
  realtime transcript events are connected to the lesson pipeline, the UI must
  keep the normal saved-message composer visible.
- In voice-dialog mode, the browser should hand the turn back to the student:
  after assistant speech ends, speech recognition starts automatically when the
  browser supports it, permissions allow it, and the returned lesson lifecycle
  is still non-terminal. Goal-reached, hard-limit, and manually finished
  lesson records must not restart the mic.
- Voice input must not fail silently. If browser recognition stops because of
  silence, permission, device, network, language, or automatic-start limits,
  show a short status reason near the mic control and keep the manual mic
  action visible.
- Browser speech synthesis reads only visible tutor answer blocks locally; do
  not add hidden prompt text, raw debug data, citations, secrets, or
  non-visible profile facts to spoken output.
- Browser speech quality is not a production voice layer. The POC may choose a
  locale-matched voice and normalize obvious math phrases, but high-quality
  Russian stress and emotional prosody require a future audio provider.
- Tutor answers render ordered text, task, example, and image blocks inside
  one turn card.
- Tutor turn headers show the source and lesson type so the learner can see
  whether the system is answering, practicing, checking level, or reviewing a
  mistake.
- Image generation remains explicit user action, but the create-image action
  must be visually prominent when a turn includes an image block. Generated
  images need alt text and a short caption connected to the current
  explanation.
- Recent session summaries and skill progress/regression are read-only
  learning memory. They should be compact and should not look like grades.
- The usage bar is learner-facing transparency. Show only the signed-in user's
  own estimated usage, with no raw prompts, hidden instructions, provider
  request ids, or stack traces. Decision rows may show safe tool names,
  accepted/rejected status, evidence level, verifier result, latency, and
  fallback status. Background-job rows may show safe job type, status,
  attempts, sanitized result preview, and stored failure message only. Provide
  a visible refresh action, and auto-refresh only through the safe summary
  endpoint while details are open or jobs are active.
- Error states must be visible near the affected workflow.

## Validation

For UI behavior changes:

- Run `npm run build`.
- Run `npm run e2e` when the affected workflow is covered by the mocked
  browser suite.
- Manually smoke-check uncovered web UI when practical.
- Report missing frontend unit/component, accessibility, and visual regression
  coverage unless target commands are added later.

For diagram source changes:

- Run `npm run diagrams:render`.

## References Inspected

- Mantine documentation through Context7 for AppShell, controls, and theming
  patterns.
- Nielsen Norman Group teenager UX guidance:
  `https://www.nngroup.com/articles/usability-of-websites-for-teenagers/`
- W3C internationalization guidance:
  `https://www.w3.org/International/i18n-drafts/nav/about`
- W3C WCAG 2.2 and target-size guidance:
  `https://www.w3.org/TR/WCAG22/` and
  `https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html`
