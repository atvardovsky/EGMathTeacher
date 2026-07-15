# EGMathTeacher UI Tree

This file owns the project UI structure for the current React/Vite web client.

## State Tree

```text
App
├─ Auth/session loading
├─ AuthScreen
│  ├─ LanguageSwitch
│  ├─ Login/Register segmented control
│  ├─ Name/password form
│  └─ Math visual + concise product proof points
├─ FirstMeetingScreen
│  ├─ LanguageSwitch
│  ├─ Logout
│  ├─ Meeting status strip
│  ├─ Active meeting hydration from saved lesson history
│  ├─ Terminal pre-profile meeting hydration from saved history
│  ├─ Green voice-meeting start/restart action
│  ├─ Voice dialog switch
│  ├─ Mic action
│  ├─ Text fallback composer
│  ├─ Backend readiness-gated create-profile-from-conversation action
│  ├─ Terminal meeting read-only state
│  │  ├─ Disabled mic and text fallback input
│  │  └─ Create profile or start-new-meeting actions
│  ├─ Voice status and readiness alerts
│  └─ First-meeting transcript list
│     ├─ Student prompt bubble
│     └─ Tutor answer bubble with speak/stop action
└─ Authenticated AppShell
   ├─ Header
   │  ├─ Mobile menu burger
   │  ├─ Brand
   │  ├─ Role badge
   │  └─ LanguageSwitch
   ├─ Navbar
   │  ├─ User panel
   │  ├─ Tutor nav item
   │  ├─ Settings nav item
   │  ├─ Materials nav item for admin users only
   │  └─ Logout
   └─ Main
      ├─ TutorWorkspace
      │  ├─ Page title and profile/conversation status badges
      │  ├─ Lesson type segmented control: meeting, tutor, practice, diagnostic, mistake review
      │  ├─ Question -> walkthrough -> practice step strip
      │  ├─ Quick prompt pills
      │  ├─ Lesson continuity panel
      │  │  ├─ Explicit empty saved-lessons state
      │  │  ├─ Resume latest active lesson action
      │  │  ├─ New lesson action
      │  │  └─ Recent saved lesson rows with goal, status, summary, last question
      │  │     ├─ Continue action for active rows
      │  │     └─ Open read-only record action for finished/legacy rows
      │  ├─ Lesson usage bar
      │  │  ├─ Today estimate
      │  │  ├─ Current lesson estimate
      │  │  ├─ Goal status and active-learning time
      │  │  ├─ Verified outcome and cost-per-outcome estimates
      │  │  ├─ Manual refresh action
      │  │  ├─ Retry-one action for visible failed background jobs
      │  │  └─ Expandable safe operation/model/token/image/duration/decision/background-job details
      │  ├─ Textarea composer
      │  ├─ WebRTC/OpenAI Realtime live voice
      │  │  ├─ Start/stop live voice action
      │  │  ├─ Connection state and model badge
      │  │  ├─ Synced compact voice turn after close when transcript exists
      │  │  ├─ Usage refresh after close
      │  │  └─ Disabled state for read-only history records
      │  ├─ Voice dialog switch
      │  ├─ Voice action
      │  ├─ Send action
      │  ├─ Finish lesson action when an active lesson is open
      │  ├─ Read-only history alert when a finished/legacy record is open
      │  ├─ Lesson launcher when there are no turns
      │  │  ├─ Green "start first lesson" button
      │  │  ├─ First meeting card
      │  │  ├─ Level check card
      │  │  ├─ Linear-equation practice card
      │  │  ├─ Topic explanation card
      │  │  └─ Mistake-review card
      │  └─ TutorTurnCard list
      │     ├─ Prompt/source/lesson-type header
      │     ├─ Speak/stop answer action
      │     ├─ Ordered response blocks
      │     │  ├─ Text block
      │     │  ├─ Task block
      │     │  ├─ Example block
      │     │  └─ Image block prompt/action/auto-required-generation/display
      │     ├─ Citation badges
      │     └─ Optional generated image inside the related block
      ├─ SettingsView
      │  ├─ Interface card
      │  │  ├─ Language switch
      │  │  └─ Voice input language derived from UI locale
      │  ├─ Account card
      │  │  ├─ Name
      │  │  ├─ Role
      │  │  └─ Created timestamp
      │  └─ Learning profile card
      │     ├─ AI summary
      │     ├─ First-meeting answers
      │     ├─ Knowledge state
      │     ├─ Learning preferences
      │     ├─ Explanation strategy
      │     ├─ Teaching hypotheses
      │     ├─ Recent session summaries
      │     └─ Skill progress/regression
      └─ KnowledgeAdmin
         ├─ Status refresh
         ├─ File upload form
         ├─ Vector store badges
         └─ Knowledge files table
```

## Current Navigation Rules

- The tutor workspace is the default authenticated view.
- The tutor workspace exposes the main POC lesson modes: meeting, tutor,
  practice, diagnostic, and mistake review. Older API clients may omit lesson
  type and let the API infer it. Changing the visible lesson mode clears the
  current conversation id so the next prompt starts a fresh lesson session.
- When the tutor workspace has no local turns, it shows a lesson launcher
  instead of an empty waiting panel. The green first-lesson button and the
  first meeting, level check, and practice cards send starter prompts only
  after user click. Topic explanation and mistake-review cards prefill the
  composer and wait for the student to add details.
- On load, the tutor workspace fetches active saved lessons from
  `GET /tutor/lessons?scope=active` and archived records from
  `GET /tutor/lessons?scope=history`. It shows a saved-lessons panel even
  when no history exists. When active stored turns exist, the latest active
  saved discussion is opened into the tutor turn list, and continuing that
  lesson reuses the saved `conversationId`.
- Finished and legacy records open as read-only history. In that state the
  composer, voice action, and image-generation actions are disabled, and the
  visible next step is to start a new lesson. The backend also rejects terminal
  lesson `conversationId` reuse, so the read-only state is enforced beyond the
  browser UI.
- Admin users can switch to the materials view.
- Authenticated users can switch to Settings.
- Student users without a stored profile must complete the first meeting before
  the tutor workspace. The first meeting starts as an AI-led voice dialog; the
  profile is created from stored `meeting` turns, not from a static form. The
  create-profile action is enabled only after
  `GET /student-profile/me/meeting-readiness` reports enough teaching context.
  Reloading this screen restores the latest active saved `meeting` lesson only
  when it has stored turns; an empty active meeting does not hide terminal
  pre-profile meeting history. After setup, the tutor workspace starts at the
  lesson launcher rather than a blank state.
- The language switch changes static UI copy immediately and persists locally.
- Browser speech recognition language follows the selected UI locale.
- Browser speech synthesis can speak tutor answers aloud in the tutor
  workspace. Voice dialog is enabled by default when supported, can be turned
  off from the composer, and every tutor answer has a speak/stop action. In
  voice-dialog mode, the mic starts again after the spoken tutor answer only
  when the returned lesson lifecycle is non-terminal. Terminal responses clear
  the active conversation boundary and open read-only history state. If browser
  recognition stops from silence, permission, device, language, network, or
  automatic-start limits, a voice-status message explains the reason near the
  mic control.
- The tutor composer exposes a separate WebRTC/OpenAI Realtime live voice
  path for faster audio. It starts only from a user click, shows idle,
  connecting, live, closing, and error states, is disabled for read-only
  history, and closes on lesson-boundary changes. On authenticated close with
  useful transcript content, the UI receives a compact synced voice turn,
  prepends it to the current lesson, refreshes usage/history, and keeps the
  lesson resumable when non-terminal. The normal message composer remains
  visible because verified tasks, images, mastery, and structured response
  blocks still use the normal tutor message pipeline.
- Voice output reads only the visible tutor answer blocks locally in the
  browser; it does not call backend audio generation or store generated audio.
- Settings is read-only for account/profile data in the current POC.
- Settings can display compact recent session summaries and skill
  progress/regression rows that were already returned by
  `GET /student-profile/me`.
- The tutor workspace displays the signed-in user's own usage bar. It is
  informational for all users, not admin-only. It must stay compact by default
  and only show safe usage, verifier, decision-policy, and background-job
  result/error details when expanded. The usage bar includes a visible refresh
  action and may poll the safe usage endpoint while expanded or while
  background jobs are active. When visible failed background jobs exist, it
  offers a retry-one action scoped to the signed-in user's recoverable jobs.
- Required image blocks from a freshly returned tutor answer can start one
  automatic image generation after the text response is visible. Saved
  historical turns with missing generated images keep the manual image action.

## Non-Goals

- No client-side router exists in the current POC.
- No packaged desktop shell exists in the current repository.
- No parent, teacher, school, class, payment, or progress-dashboard UI exists.
  The usage bar is cost transparency, not a subscription or billing dashboard.
- Mocked frontend E2E exists. No accessibility or visual regression suite exists.
