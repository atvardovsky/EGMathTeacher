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
      │  ├─ Question -> walkthrough -> practice step strip
      │  ├─ Quick prompt pills
      │  ├─ Textarea composer
      │  ├─ Voice action
      │  ├─ Send action
      │  ├─ Empty state
      │  └─ TutorTurnCard list
      │     ├─ Prompt/source header
      │     ├─ Explanation
      │     ├─ Task panels
      │     ├─ Example panels
      │     ├─ Citation badges
      │     └─ Optional image generation/display
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
      │     └─ Teaching hypotheses
      └─ KnowledgeAdmin
         ├─ Status refresh
         ├─ File upload form
         ├─ Vector store badges
         └─ Knowledge files table
```

## Current Navigation Rules

- The tutor workspace is the default authenticated view.
- Admin users can switch to the materials view.
- Authenticated users can switch to Settings.
- Student users without a stored profile must complete the first meeting before
  the tutor workspace.
- The language switch changes static UI copy immediately and persists locally.
- Browser speech recognition language follows the selected UI locale.
- Settings is read-only for account/profile data in the current POC.

## Non-Goals

- No client-side router exists in the current POC.
- No packaged desktop shell exists in the current repository.
- No parent, teacher, school, class, payment, or progress-dashboard UI exists.
- No frontend automated E2E, accessibility, or visual regression suite exists.
