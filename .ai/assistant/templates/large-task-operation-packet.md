# Large-Task Operation Packet

Use this template only for large, cross-boundary, multi-workstream, or
resumable operations. The completed packet is coordination evidence, not a
source of truth for EGMathTeacher project facts.

## Operation

- Operation ID:
- Parent request or issue:
- Goal:
- Non-goals:
- Allowed actions:
- Activation reason:
- Current phase: discovery | planning | execution | convergence | complete
- Packet status: active | blocked | complete | archived
- Packet owner:
- Storage and retention policy:

## Routed Context

- Selected task profile:
- Task-scale overlay: `large-or-resumable`
- Selected project areas:
- Context budget:
- Loaded files and reasons:
- Approximate context volume:
- Expansion triggers:
- Intentionally omitted context:
- Residual context risk:

## Changed Facts

Repeat this block for each changed or disputed fact.

### Fact `<FACT_ID>`

- Statement:
- Canonical owner:
- Consistency map node: not enabled | missing | `<NODE_ID>`
- Selected relationship edges:
- Skipped or missing edges:
- Risk class:
- Affected surfaces:
- Approval state:
- Owning workstream:
- Reconciliation state: pending | consistent | conflict | unresolved

## Workstreams

Repeat this block for each coherent workstream.

### Workstream `<WORKSTREAM_ID>`

- Goal:
- Project area:
- Changed facts:
- Dependencies:
- Blocking decisions:
- Required context:
- Deferred context:
- Allowed surfaces:
- Expected outputs:
- Validation:
- Status: ready | active | blocked | locally validated | complete
- Evidence:
- Unresolved risk:
- Handoff state:

## Checkpoints

Repeat after local validation, an approval boundary, a handoff, or before a
context reset.

### Checkpoint `<CHECKPOINT_ID>`

- Recorded at:
- Completed work:
- Decisions and evidence:
- Approval state:
- Validation state:
- Invalidated assumptions:
- Context receipt delta:
- Unresolved items:
- Next ready action:
- Resume context:

## Final Convergence

- Completed workstreams:
- Unresolved workstreams:
- Changed-fact reconciliation:
- Relationship impact closure:
- Source-of-truth synchronization:
- Cross-workstream conflicts:
- Approval scope versus applied changes:
- Combined validation:
- Global logical integrity review:
- Skipped checks:
- Final residual risk:
- Packet disposition:

## Resume Rule

On resume, load the compact adapter bootstrap, this packet, the active
workstream's minimum context, its changed-fact owners, and dependencies. Check
packet claims against current repository evidence before continuing. Do not
load completed workstream context again unless evidence changed.
