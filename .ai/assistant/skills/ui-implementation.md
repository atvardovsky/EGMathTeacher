---
name: ui-implementation
description: Use when changing EGMathTeacher web UI, UX, localization, visual design, Mantine component structure, or frontend interaction behavior in apps/web. Follow project UI guidelines, UI tree, and UI gates before editing or finalizing UI work.
---

# UI Implementation Skill

Use this project-local skill for EGMathTeacher web UI work.

## Workflow

1. Read `.ai/project/ui-guidelines.md`, `.ai/project/ui-tree.md`, and
   `.ai/assistant/gates/ui-gates.md`.
2. Inspect the affected `apps/web/src` files before editing.
3. Keep UI copy in `apps/web/src/i18n.ts` for Russian and English.
4. Use existing Mantine and lucide dependencies. Do not add UI dependencies
   without explicit approval.
5. Prefer Mantine components for layout, forms, buttons, badges, alerts,
   tables, navigation, and progress.
6. Keep teen-facing copy concise, respectful, and action-oriented.
7. Keep controls touch-friendly and responsive. Check mobile wrapping for
   translated text.
8. Run `npm run build` for UI code changes.
9. Run `npm run e2e` when the affected workflow is covered by the mocked
   browser suite.
10. Report missing frontend unit/component, accessibility, and visual
    regression checks unless target commands are added later.

## Rejection Criteria

Revise UI work that:

- hard-codes new static copy in components instead of `i18n.ts`
- removes labels or accessible names from controls
- adds a new production dependency without approval
- hides the tutor workflow behind a landing page
- introduces nested cards, text overlap, or mobile-only broken states
- changes accepted product flow without blueprint/source-of-truth sync
