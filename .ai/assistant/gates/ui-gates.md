# UI Gates

Use this focused gate when changing EGMathTeacher web UI, UX, visual design,
localization, frontend copy, or frontend interaction behavior.

## Required Context

- `.ai/project/ui-guidelines.md`
- `.ai/project/ui-tree.md`
- `.ai/project/use-cases.md`
- `.ai/project/architecture.md`
- `.ai/project/validation.md`
- affected files under `apps/web/src`

## Gate Checklist

- Keep the first authenticated surface usable; do not replace the app with a
  marketing landing page.
- Preserve the current product flow unless the user explicitly approves a
  business behavior change.
- Use Mantine components and lucide icons already present in the project.
- Do not add production UI dependencies without explicit approval.
- Keep Russian and English static UI copy in `apps/web/src/i18n.ts`.
- Keep translated UI values stable where onboarding data feeds profile
  generation.
- Keep labels visible for forms and accessible labels for icon-only controls.
- Keep important targets touch-friendly and avoid text overlap at mobile width.
- Avoid card nesting; use `Paper` for repeated panels inside larger cards.
- Avoid decorative gradient blobs, one-note palettes, and childish tone.
- Run `npm run build` for UI code changes and smoke-check the affected UI when
  practical.

## Evidence

Final evidence should state:

- UI facts changed.
- Locale/copy surfaces changed.
- Screens or states inspected.
- Validation run.
- Missing frontend test/accessibility/visual/E2E coverage.
