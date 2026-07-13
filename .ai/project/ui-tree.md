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
│  ├─ Progress/status strip
│  ├─ Step chips
│  ├─ Step 1: exam, grade, score goal, motivation
│  ├─ Step 2: current level, feeling, feedback style
│  ├─ Step 3: weak topics, explanation style, pace, visuals, practice, interests
│  └─ Step 4: short diagnostic answers and freeform context
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
      │  │  ├─ Resume latest action
      │  │  ├─ New lesson action
      │  │  └─ Recent saved lesson rows with goal, status, summary, last question
      │  ├─ Lesson usage bar
      │  │  ├─ Today estimate
      │  │  ├─ Current lesson estimate
      │  │  ├─ Goal status and active-learning time
      │  │  ├─ Verified outcome and cost-per-outcome estimates
      │  │  ├─ Manual refresh action
      │  │  └─ Expandable safe operation/model/token/image/decision/background-job details
      │  ├─ Textarea composer
      │  ├─ Voice dialog switch
      │  ├─ Voice action
      │  ├─ Send action
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
      │     │  └─ Image block prompt/action/display
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
- On load, the tutor workspace fetches saved lessons from `GET /tutor/lessons`.
  It shows a saved-lessons panel even when no history exists. When stored
  turns exist, the latest saved discussion is opened into the tutor turn list,
  and continuing that lesson reuses the saved `conversationId`.
- Admin users can switch to the materials view.
- Authenticated users can switch to Settings.
- Student users without a stored profile must complete the first meeting before
  the tutor workspace. After setup, the tutor workspace starts at the lesson
  launcher rather than a blank state.
- The language switch changes static UI copy immediately and persists locally.
- Browser speech recognition language follows the selected UI locale.
- Browser speech synthesis can speak tutor answers aloud in the tutor
  workspace. Voice dialog is enabled by default when supported, can be turned
  off from the composer, and every tutor answer has a speak/stop action. In
  voice-dialog mode, the mic starts again after the spoken tutor answer when
  browser support and permissions allow it. If browser recognition stops from
  silence, permission, device, language, network, or automatic-start limits,
  a voice-status message explains the reason near the mic control.
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
  background jobs are active.

## Non-Goals

- No client-side router exists in the current POC.
- No packaged desktop shell exists in the current repository.
- No parent, teacher, school, class, payment, or progress-dashboard UI exists.
  The usage bar is cost transparency, not a subscription or billing dashboard.
- Mocked frontend E2E exists. No accessibility or visual regression suite exists.
