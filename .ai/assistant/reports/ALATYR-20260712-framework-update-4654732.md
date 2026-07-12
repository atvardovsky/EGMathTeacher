# Alatyr Migration Note

Migration ID: `ALATYR-20260712-framework-update-4654732`
Operation ID: `framework-update-4654732-20260712`
From framework version: `0.1.0-alpha.0`
To framework version: `0.1.0-alpha.0`
From adapter schema version: `1`
To adapter schema version: `1`
From template version: `1`
To template version: `1`
Prepared by: `Codex`
Prepared at: `2026-07-12T20:22:00+02:00`

## Changed Framework Rules

Added rules:

- none

Changed rules:

- `ALATYR-ADAPTER-001`: adapter contract now explicitly requires target-local checker status when deterministic checks exist.
- `ALATYR-LIFECYCLE-001`: installed-operation rechecks now call out adapter drift hazards, local path leakage, stale checker claims, duplicate context references, owner placeholders, and checker coverage.

Removed or deprecated rules:

- none

## Required Target Actions

- Update `.ai/framework` from AlatyrCore commit `465473284966676d86bb6e55d1254b20e415bf5c`.
- Update `.ai/alatyr.yaml` source baseline.
- Adapt adapter recheck, operation routing, gate checklist, source-access policy, and output-contract evidence to include drift-check and local-checker status.
- Keep using target-local validation command `npm run alatyr:check`.

## Optional Target Actions

- Do not install or run the new AlatyrCore source validator as a target command unless a later approved task decides to vendor or wrap it.

## Local Deviations

- EGMathTeacher keeps target-local `scripts/check-alatyr.sh` as the canonical local checker.
- Source AlatyrCore tools are review evidence only and are not target commands.
- Source license file was not found in the checked-out AlatyrCore repository; license status recorded as `unknown`.

## Affected Target Surfaces

- `.ai/alatyr.yaml`: source commit updated to `465473284966676d86bb6e55d1254b20e415bf5c`.
- `.ai/framework`: portable framework copy updated.
- `.ai/project`: unchanged.
- `.ai/assistant`: recheck flow, operation routing flow, gate checklist, source-access policy, output contracts, approval record, migration note, installation note, maturity/module review attribution, and infrastructure index updated.
- `.ai/assistant/module-profile.md`: review attribution updated for this framework update.
- bridge files: unchanged.
- validation or manual review: `npm run alatyr:check`, `git diff --check`, manual source-diff review, and manual adapter drift scan.

## Approval And Validation

Approval needed: `yes; update overwrites existing assistant/framework instructions`
Approval record: `.ai/assistant/approvals/ALATYR-20260712-framework-update-4654732.md`
Validation run: `2026-07-12T20:27:12+02:00: npm run alatyr:check; git diff --check`

## Final Evidence

Migration result: `Alatyr baseline updated from 6a6bef16d6966264b0686534c813cdbda210194a to 465473284966676d86bb6e55d1254b20e415bf5c. Target adapter drift-check evidence requirements were applied.`
Remaining gaps: `backup owner remains unassigned as a known gap; production privacy/incident policy and production backup/rollback runbooks remain unresolved; source AlatyrCore validator is not installed as a target command.`
Residual risk: `source AlatyrCore license file was not found; remote source tools were reviewed but not executed; .ai/framework/context-router.md differs from source only by target whitespace normalization to pass git diff --check.`
