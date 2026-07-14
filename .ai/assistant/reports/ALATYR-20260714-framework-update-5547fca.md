# Alatyr Migration Note

Migration ID: `ALATYR-20260714-framework-update-5547fca`
Operation ID: `framework-update-5547fca-20260714`
From framework version: `0.1.0-alpha.0`
To framework version: `0.1.0-alpha.2`
From adapter schema version: `1`
To adapter schema version: `1`
From template version: `2`
To template version: `2`
Prepared by: `Codex`
Prepared at: `2026-07-14T20:00:28+02:00`

## Changed Framework Rules

Added rules:

- none; stable rule IDs remain unchanged.

Changed rules:

- none in `framework/rule-registry.json`; all 13 registered Alatyr rules are
  unchanged between installed baseline `8dab3d1` and `5547fca`.

Removed or deprecated rules:

- none.

## Required Target Actions

- Update `.ai/alatyr.yaml` framework version and source baseline to
  `v0.1.0-alpha.2` / `5547fca4f5cf7637463c525178f003d1ab65a4bc`.
- Copy the portable framework scaffolding-profile wording into
  `.ai/framework/scaffolding.md`.
- Update installation, module, maturity, infrastructure-index, approval, and
  migration evidence to reflect the new baseline.

## Optional Target Actions

- None for runtime, target templates, bridge surfaces, or product behavior.
- Source maintainers can use the upstream native cross-platform tooling and
  conformance evidence in AlatyrCore; EGMathTeacher does not install those
  source-repository tools as target validation commands.

## Local Deviations

- EGMathTeacher keeps target-local `scripts/check-alatyr.sh` as the canonical
  local checker.
- Source AlatyrCore tools, source CI, conformance fixtures, and benchmark
  results are review evidence only and are not copied into the target.
- The optional consistency-map module is deferred.
- Unsupported assistant bridge surfaces remain deferred; only AGENTS-aware,
  Codex, and generic Markdown assistants are supported.
- Scaffolding remains deferred as a source-tooling concept; scaffold profiles
  do not become target modules or target maturity proof.

## Affected Target Surfaces

- `.ai/alatyr.yaml`: framework version and source commit updated.
- `.ai/framework/scaffolding.md`: portable scaffold-profile wording added.
- `.ai/assistant/templates/installation-note.md`: current baseline and update
  history updated.
- `.ai/assistant/module-profile.md`: review baseline and scaffolding residual
  risk updated.
- `.ai/assistant/maturity-profile.md`: review baseline updated.
- `.ai/assistant/infrastructure-index.md`: framework baseline plus approval
  and report indexes updated.
- `.ai/assistant/approvals`: approval record added.
- `.ai/assistant/reports`: this migration note added.
- bridge files: unchanged.
- validation or manual review: `npm run alatyr:check`, `git diff --check`,
  and manual source/adaptation review.

## Approval And Validation

Approval needed: `yes; existing assistant instruction metadata and one copied framework rule file were overwritten`
Approval record:
`.ai/assistant/approvals/ALATYR-20260714-framework-update-5547fca.md`
Validation run:

- `npm run alatyr:check`: passed with the current adapter consistency checks.
- `git diff --check`: passed.
- Manual migration review: passed; source diff from `8dab3d1` to `5547fca`
  changes the recorded framework version and portable scaffolding-profile
  wording only for installed target purposes. Source-repository tools,
  conformance results, CI, and benchmark artifacts were not copied.

## Final Evidence

Migration result: `Alatyr baseline updated from 8dab3d15c6e0dc983096c2aaca89fba75fe6fa14 to 5547fca4f5cf7637463c525178f003d1ab65a4bc. Framework version updated from 0.1.0-alpha.0 to 0.1.0-alpha.2. Adapter schema and template version remained unchanged. Rule registry and target templates remained unchanged.`
Remaining gaps: `backup owner remains unassigned as a known gap; optional consistency-map module is deferred; no target-owned scaffolder is installed; production privacy/incident policy and production backup/rollback runbooks remain unresolved.`
Residual risk: `source AlatyrCore license file was not found; source-repository tools and conformance evidence were reviewed but not installed or executed as target validation commands; semantic correctness of project facts remains manual; browser/API/product tests are not required for this adapter-only framework metadata update.`
