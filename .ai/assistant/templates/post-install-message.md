# Post-Install Assistant Message

Alatyr Core is installed for EGMathTeacher.

Use:

- `Alatyr help` or `help` for available operations.
- `alatyr-recheck` or `recheck-after-framework-update` to recheck adapter
  completeness.
- `alatyr-change` or `product-change` for blueprint-driven code or product
  changes.
- `alatyr-integrity` or `logical-integrity-review` for drift or consistency
  review.
- `alatyr-ai-inventory` before adding assistant infrastructure.
- `alatyr-adaptation <source>` to review and adapt external assistant
  infrastructure.

Current adapter maturity: usable for focused work, with explicit project
guards, focused assistant gates, a schema-v2 context router, context profiles,
module profile, source of truth registry, compact AI infrastructure router,
prompt-injection policy, Mermaid diagram sources, and a diagram render command.
Current validation includes CI, mocked browser E2E, diagram drift checks, and a
local Alatyr consistency check.
Remaining gaps: formal production security/privacy policy, frontend
component/accessibility/visual regression commands, POC-only auth hardening,
production backup/restore/rollback runbooks, and deferred machine-readable
consistency-map coverage.
