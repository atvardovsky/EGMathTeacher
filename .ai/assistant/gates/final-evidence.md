# Final Evidence Gate

Every completed Alatyr-guided change should report:

- requested operation or inferred flow
- changed facts
- files changed
- logical integrity result
- documentation and diagram sync result
- validation run and outcome
- skipped checks and reasons
- approvals used or why approval was not required
- residual risk

For installation, framework update, or adapter recheck work, use the matching
contract in `.ai/assistant/templates/adapter-output-contracts.md`.

For docs-only adapter/project changes, manual source-doc review can be the
validation result when no runtime files changed.

Do not claim:

- CI passed when no CI exists
- E2E passed when no E2E test exists
- live OpenAI worked without approved live validation
- diagram rendering passed when no render process exists
- production deployment changed unless the user explicitly requested and the
  command evidence exists
