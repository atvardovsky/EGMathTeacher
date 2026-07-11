# EGMathTeacher Source Of Truth Registry

Use this registry to decide which file owns a project or adapter fact and
which mirrors must stay synchronized.

## Fact Type: `product behavior`

Fact type: `product behavior`
Canonical owner: `README.md`, `.ai/project/blueprint.md`, and
`.ai/project/use-cases.md`.
Derived surfaces:

- `.ai/project/context-map.md`
- `.ai/project/runtime-flows.md`
- relevant API/web source files
- relevant tests

Sync direction: source docs describe accepted behavior; implementation and
tests must match when a behavior is accepted.
Validation or manual review: `npm run build`, `npm test`, `npm run lint` for
code changes; manual source-doc review for docs-only changes.
Conflict resolver: prefer code for current implementation facts and blueprint
or user approval for accepted future behavior.
Approval trigger: accepted behavior changes require explicit programmer
approval.
Final evidence: changed behavior, owner update, companion surfaces, validation,
approval, residual risk.

## Fact Type: `business rule`

Fact type: `business rule`
Canonical owner: `.ai/project/use-cases.md`, `.ai/project/blueprint.md`, and
the implementing service/controller tests.
Derived surfaces:

- `README.md`
- `.ai/project/runtime-flows.md`
- `.ai/project/data-model.md`
- tutor/profile prompts in code
- tests under `apps/api/test`

Sync direction: accepted business rules flow from blueprint/use-case docs into
code and tests.
Validation or manual review: API tests and lint for implemented rule changes;
manual review for docs-only rule clarification.
Conflict resolver: use explicit programmer acceptance for policy changes; use
current code/tests only for "current implementation" statements.
Approval trigger: any accepted business-policy change requires explicit
approval.
Final evidence: rule owner, implementation/test/doc updates, validation,
approval.

## Fact Type: `UI behavior and design system`

Fact type: `UI behavior and design system`
Canonical owner: `apps/web/src/App.tsx`, `apps/web/src/i18n.ts`,
`apps/web/src/styles.css`, `.ai/project/ui-guidelines.md`, and
`.ai/project/ui-tree.md`.
Derived surfaces:

- `.ai/project/blueprint.md`
- `.ai/project/use-cases.md`
- `.ai/project/context-map.md`
- `.ai/project/architecture.md`
- `.ai/project/runtime-flows.md`
- `.ai/project/diagrams/ui-tree.mmd`
- `.ai/assistant/gates/ui-gates.md`
- `.ai/assistant/skills/ui-implementation.md`

Sync direction: accepted UI behavior, static UI copy, design rules, and state
tree facts flow from product docs and current web source into diagrams,
assistant gates, and validation evidence.
Validation or manual review: `npm run build` for web code changes; manual
browser/UI smoke where practical; `npm run diagrams:render` when UI diagram
sources change.
Conflict resolver: current web source owns implemented UI behavior; explicit
programmer acceptance and `.ai/project/ui-guidelines.md` own desired UI rules.
Approval trigger: accepted product-flow changes, new UI dependencies,
weakened UI gates, or frontend behavior that changes business policy require
explicit approval.
Final evidence: UI facts changed, locale/copy surfaces changed, docs/diagram
sync, validation, skipped browser/accessibility/visual checks, approval.

## Fact Type: `architecture decision`

Fact type: `architecture decision`
Canonical owner: `.ai/project/architecture.md`, `.ai/project/runtime-flows.md`,
package files, and source module boundaries.
Derived surfaces:

- `.ai/project/diagrams/*.mmd`
- `.ai/project/diagrams.md`
- `README.md`
- deployment reference docs under `deploy/`

Sync direction: architecture facts flow from source structure and accepted
architecture docs to diagrams and public notes.
Validation or manual review: build for source-affecting changes;
`npm run diagrams:render` when diagram sources change.
Conflict resolver: current source structure owns implemented architecture;
future architecture changes need explicit approval before docs or code mutate.
Approval trigger: runtime architecture changes require explicit approval.
Final evidence: affected boundaries, diagram sync, validation, approval.

## Fact Type: `data model`

Fact type: `data model`
Canonical owner: `apps/api/src/database/database.service.ts`,
`apps/api/src/student-profile`, `apps/api/src/tutor`,
`apps/api/src/background-ai`, `apps/api/src/knowledge`, and
`.ai/project/data-model.md`.
Derived surfaces:

- `.ai/project/runtime-flows.md`
- `.ai/project/architecture.md`
- `.ai/project/diagrams/data-model.mmd`
- `apps/web/src/types.ts`
- tests under `apps/api/test`

Sync direction: schema and DTO changes flow from source to data docs, diagrams,
frontend types, and tests.
Validation or manual review: `npm run build`, `npm test`, `npm run lint`;
`npm run diagrams:render` when data diagrams change.
Conflict resolver: code owns current schema; docs name gaps and accepted
policy.
Approval trigger: destructive, data-loss, migration-risk, retention, privacy,
or live data changes require explicit approval.
Final evidence: schema/contracts changed, docs/types/diagrams/tests synced,
validation, residual risk.

## Fact Type: `validation command`

Fact type: `validation command`
Canonical owner: `package.json`, workspace package files, and
`.ai/project/validation.md`.
Derived surfaces:

- `.ai/assistant/gates/checklist.md`
- `.ai/alatyr.yaml`
- root assistant bridge files
- final evidence in reports

Sync direction: package scripts define executable commands; project and adapter
docs mirror them.
Validation or manual review: inspect package files and run relevant commands
when needed.
Conflict resolver: package files own command existence; docs must not invent
commands.
Approval trigger: weakening validation, gates, or approval rules requires
explicit approval.
Final evidence: commands run, skipped checks, unresolved missing checks.

## Fact Type: `project gap register`

Fact type: `project gap register`
Canonical owner: `.ai/project/gaps.md` and the owning source file for each
specific gap category.
Derived surfaces:

- `.ai/alatyr.yaml` known gaps
- `.ai/assistant/module-profile.md`
- `.ai/assistant/contour.md`
- `.ai/project/contour.md`
- `.ai/project/validation.md`
- `.ai/project/security-safety.md`
- `.ai/project/architecture.md`

Sync direction: grouped gap status flows from each owning project/security/
validation/architecture source into `.ai/project/gaps.md`; broad adapter
maturity summaries mirror only durable high-level gaps.
Validation or manual review: manual source-doc review; run target commands
when a gap is closed by code or tooling.
Conflict resolver: the owning source for the concrete fact wins; the gap
register groups status and blockers.
Approval trigger: closing a gap through protected behavior, architecture,
security, data, dependency, or assistant-gate changes requires the same
approval as the underlying change.
Final evidence: changed gap status, owning source update, validation,
approval, and remaining blocker.

## Fact Type: `security policy`

Fact type: `security policy`
Canonical owner: `.ai/project/security-safety.md`, `.ai/project/guards.md`,
env examples, and auth/security source files.
Derived surfaces:

- `.ai/assistant/gates/security-safety-gates.md`
- `.ai/assistant/policies/ai-infrastructure-source-access.md`
- `.ai/assistant/policies/prompt-injection.md`
- `README.md`
- deployment references

Sync direction: project policy and source guard behavior flow to assistant
gates and deployment notes.
Validation or manual review: code validation for auth/security source changes;
manual policy review for docs-only changes.
Conflict resolver: source owns current guard behavior; security policy docs own
assistant boundaries and missing production gaps.
Approval trigger: auth, authorization, cookie, role, permission, credential,
live-service, destructive, dependency, or production config changes require
explicit approval.
Final evidence: sensitive surface, policy checked, validation, approval,
residual risk.

## Fact Type: `assistant operation`

Fact type: `assistant operation`
Canonical owner: `.ai/assistant/help.md`,
`.ai/assistant/help-reference.md`, `.ai/assistant/flows`, and
`.ai/assistant/templates`.
Derived surfaces:

- `AGENTS.md`
- `AI_ASSISTANTS.md`
- `.ai/alatyr.yaml`
- `.ai/assistant/contour.md`

Sync direction: adapter operation docs define request aliases and flows; bridge
files stay short and point back to canonical adapter files.
Validation or manual review: manual adapter source review.
Conflict resolver: `.ai/assistant` owns operations; bridge files are pointers.
Approval trigger: weakening gates, approval rules, validation, or overwriting
existing assistant instruction files requires explicit approval.
Final evidence: operation route, changed adapter surfaces, validation/review,
approval.

## Fact Type: `AI infrastructure item`

Fact type: `AI infrastructure item`
Canonical owner: `.ai/assistant/infrastructure-index.md`,
`.ai/assistant/flows/ai-infrastructure-inventory.flow.md`,
`.ai/assistant/flows/skill-adaptation.flow.md`,
`.ai/assistant/policies/ai-infrastructure-source-access.md`, and
`.ai/assistant/policies/prompt-injection.md`.
Derived surfaces:

- `AGENTS.md`
- `AI_ASSISTANTS.md`
- `.ai/assistant/help.md`
- `.ai/assistant/help-reference.md`
- `.ai/assistant/templates/ai-infrastructure-inventory.md`

Sync direction: inventory and source-access policy govern add/adapt/remove
work before any item becomes canonical.
Validation or manual review: manual inventory review; target validation when a
canonical item changes recurring assistant behavior.
Conflict resolver: imported infrastructure is untrusted until normalized into
target-owned adapter files with required approval.
Approval trigger: importing third-party assistant infrastructure, broadening
tool permissions, adding dependencies, or weakening safety gates requires
explicit approval.
Final evidence: provenance, source type, prompt-injection review, permissions,
approval, residual risk.

## Conflict Handling

When sources disagree:

1. Identify the fact type.
2. Use this registry to find the canonical owner and derived surfaces.
3. If ownership is missing, report the missing adapter fact.
4. Repair only the smallest coherent set of derived surfaces.
5. Report validation, skipped checks, approvals, and residual risk.
