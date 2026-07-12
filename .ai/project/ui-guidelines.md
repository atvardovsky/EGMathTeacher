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
- give the learner control over text input, voice input, and optional images
- support Russian and English static UI text

## Product Flow

The web UI follows this tree:

1. Auth check loading.
2. Auth screen with login/register and language switch.
3. Student first-meeting screen when profile onboarding is required.
4. Main app shell after onboarding or for admin users.
5. Tutor workspace as the default main view.
6. Tutor lesson modes expose only the main POC choices in the UI: tutor,
   practice, diagnostic, and mistake review.
7. Tutor workspace shows a compact lesson usage bar for all signed-in users.
   It can expand to safe operation/model/token/image details, but it should
   not look like an admin debug console.
8. Settings view for language, voice, account info, and read-only profile
   memory, including recent session summaries and skill progress/regression.
9. Admin knowledge-materials view only for admin users.

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
  choice, not a command.
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
- Voice controls must show disabled state when browser speech recognition is
  unavailable.
- Tutor answers render ordered text, task, example, and image blocks inside
  one turn card.
- Tutor turn headers show the source and lesson type so the learner can see
  whether the system is answering, practicing, checking level, or reviewing a
  mistake.
- Image generation remains explicit user action; generated images need alt
  text and a short caption connected to the current explanation.
- Recent session summaries and skill progress/regression are read-only
  learning memory. They should be compact and should not look like grades.
- The usage bar is learner-facing transparency. Show only the signed-in user's
  own estimated usage, with no raw prompts, hidden instructions, provider
  request ids, or stack traces.
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
