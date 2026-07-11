# EGMathTeacher Assistant Gates

This directory owns assistant guardrails for Alatyr-guided work.

Use `checklist.md` as the compact gate checklist. Use the focused gate files
when the task touches the matching surface:

- `approval-gates.md`: protected changes that require explicit programmer
  approval.
- `validation-gates.md`: target validation command selection and skipped-check
  reporting.
- `security-safety-gates.md`: secrets, live services, destructive operations,
  privacy, and dependency boundaries.
- `documentation-sync-gates.md`: project/framework/adapter documentation sync.
- `diagram-sync-gates.md`: diagram source, visual artifact, and generated-file
  sync.
- `ui-gates.md`: web UI, UX, localization, visual design, and frontend
  interaction gates.
- `final-evidence.md`: final response evidence requirements.
