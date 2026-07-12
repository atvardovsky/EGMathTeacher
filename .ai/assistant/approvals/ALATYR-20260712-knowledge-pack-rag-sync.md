# Approval Record

Approval ID: `ALATYR-20260712-knowledge-pack-rag-sync`
Operation ID: `knowledge-pack-rag-sync-20260712`
Operation type: `data-change + architecture-change + security-sensitive external-boundary change`
Plan version: `1`
Plan hash: `not available - plan was approved in chat as an implementation request`
Requested by: `atvardovsky`
Approved by: `atvardovsky`
Approved at: `2026-07-12T22:28:52+02:00`
Approval source/message: `User requested: "make an migrations into db for all what we need there. Make an infrastructure that will download needed files int RAG..."`
Expires at or reuse policy: `single implementation scope for EGMathTeacher knowledge-pack DB import and optional RAG sync`
Scope invalidation rule: `Invalid if new production dependencies, new external providers, destructive live cleanup beyond replacing synced pack files, or production service changes are added.`

## Approved Scope

Allowed protected changes:

- Add SQLite migrations for EGMathTeacher knowledge-pack structured curriculum, task-bank, misconception, lesson-plan, import-ledger, and project AI resource state.
- Add local infrastructure and commands to import structured knowledge-pack data into SQLite.
- Add optional OpenAI RAG sync infrastructure for selected Markdown files with content-hash idempotency.
- Add provider methods needed to detach outdated OpenAI vector-store files when a synced local file changes.
- Update documentation, diagrams, validation notes, env examples, and tests for the new local ingestion/sync flow.

Allowed files or surfaces:

- `apps/api/src/database`
- `apps/api/src/knowledge`
- `apps/api/src/ai-model`
- `apps/api/src/openai`
- `apps/api/test`
- root and API package scripts and env examples
- project source-of-truth docs and diagrams under `.ai/project`
- approval evidence under `.ai/assistant/approvals`

Excluded actions:

- Do not commit `EGMathTeacher-knowledge-pack-v1.0.zip`.
- Do not run live OpenAI sync during validation unless explicitly requested again with credential/spend approval.
- Do not delete unrelated remote OpenAI files or vector stores.
- Do not add production dependencies.
- Do not modify system web server configuration.

Allowed actions mode:
`code-and-tests`

## Plan Evidence

Approved plan summary:

```text
Create migration 008 for structured knowledge-pack storage and RAG sync state.
Implement a local KnowledgePackService and CLI that accepts an extracted pack
or zip, imports JSON/JSONL into SQLite, and optionally syncs selected Markdown
files to the active OpenAI vector store. Use source_path + sha256 to skip
unchanged files and replace changed synced files. Persist active vector store
ids locally so tutor/profile/background RAG automatically uses uploaded files
when OPENAI_VECTOR_STORE_IDS is not configured.
```

Approved validation or manual review:

- `npm run build`
- `npm test`
- `npm run lint`
- `npm run diagrams:render` and `npm run diagrams:check` when diagram sources change
- `npm run alatyr:check` when `.ai` files change
- Manual no-live-call review for OpenAI sync path

## Use Result

Used by operation/change: `knowledge-pack-rag-sync-20260712`
Patch changed after approval: `yes - implementation details followed the approved plan and stayed within the approved surfaces`
Implementation stayed within approved scope: `yes - no production dependency, system service, or live OpenAI sync was added/run outside the optional CLI path`
Validation run: `npm run build`; `npm test`; `npm run lint`; `npm run diagrams:render`; `npm run diagrams:check`; `npm run alatyr:check`; focused real-pack local CLI smoke with temporary SQLite and no OpenAI calls
Result/evidence: `build/tests/lint/diagrams/Alatyr passed; real-pack DB import loaded 14 structured files and 701 rows into a temp SQLite DB; real-pack RAG dry-run selected 81 Markdown files with zero live OpenAI writes`
Residual risk: `non-dry-run --sync-rag still requires valid OPENAI_API_KEY and intentional spend/live-service approval; remote OpenAI vector-store cleanup cannot be transactionally coupled to local SQLite state`
