# EGMathTeacher Lesson Agent Tools

This file is the source of truth for the POC Lesson Decision Agent tool
contract.

## Operating Principle

The lesson process is agent-directed and backend-governed.

The Lesson Decision Agent may propose pedagogical actions after reading the
student message, lesson lifecycle, recent history, profile context, scoped
progress signals, limits, and available tools. It must not directly mutate
lesson sessions, student profiles, skill progress, usage rows, or raw SQL.

Backend policy validates every proposed action before durable state changes.
Rejected actions are still useful observability and can guide the tutor toward
the required next action.

## Evidence Levels

Evidence levels are ordered from weakest to strongest:

- `none`: no meaningful learning evidence.
- `self_reported`: the student says they understand, thanks the tutor, or
  reports that something worked.
- `agent_interpreted`: the agent infers a teaching signal from the dialogue,
  but no independent attempt is available.
- `attempt_submitted`: the student submitted an answer, explanation, or
  worked step that can be checked later.
- `deterministically_verified`: backend verifier checked the attempt.
- `repeated_independent_success`: multiple independent verified successes are
  available.

Self-reported phrases such as "я понял", "спасибо", or "получилось" must not
complete a lesson. They should lead to a requested attempt or explanation.

## Tool Contract

| Tool | Purpose | Allowed State Changes | Required Evidence | Rejected Cases |
| --- | --- | --- | --- | --- |
| `continue_lesson` | Keep the current lesson moving without changing durable goal state. | None. | `agent_interpreted` or lower is acceptable. | Unknown tool arguments are ignored. |
| `explain_concept` | Ask the tutor response to explain or re-explain a concept. | None. | Any teaching context. | None in the POC. |
| `give_example` | Ask for a worked example. | None. | Any teaching context. | None in the POC. |
| `give_task` | Ask for a practice or diagnostic task. | None. | Any teaching context. | None in the POC. |
| `request_student_attempt` | Ask the student to solve or apply a step independently. | None. | Used when completion evidence is missing. | None in the POC. |
| `request_student_explanation` | Ask the student to explain in their own words. | None. | Used for concept, meeting, and reflection checks. | None in the POC. |
| `check_student_answer` | Ask for verification of a submitted attempt. | None by itself; backend verifier writes attempts and mastery evidence. | `attempt_submitted`. | Rejected as mastery proof without backend verifier evidence. |
| `give_hint` | Provide a smaller hint. | None. | Any teaching context. | None in the POC. |
| `change_explanation_strategy` | Change tone, step size, representation, or example strategy. | None; strategy updates are recorded through background evidence later. | `agent_interpreted` or stronger. | None in the POC. |
| `suggest_visual_support` | Ask tutor response to include an image plan block. | None. | Any teaching context. | None in the POC. |
| `propose_goal_completion` | Propose lesson goal completion. | May set lesson status to `goal_reached` only if backend policy accepts it. | Depends on lesson type. | Rejected for self-reported evidence, insufficient turns, or missing verifier evidence where required. |
| `mark_goal_blocked` | Mark current goal blocked and request a smaller next step. | May set `goal_status=blocked` only after repeated current-lesson evidence and non-low confidence. | `agent_interpreted` or stronger after at least two turns. | Rejected on the first turn or low confidence. |
| `suggest_break` | Suggest rest or wrap-up. | Can set response guidance only; hard stops remain backend limit-controlled. | Learning limit state or agent-interpreted overload signal. | Cannot override hard-limit policy. |
| `finish_lesson` | Directly finish a lesson. | None. | Not accepted from the agent. | Always rejected unless represented by an accepted backend policy transition. |
| `record_learning_observation` | Record a teaching-useful observation candidate. | Immediate decision ledger only; durable profile/progress changes happen through background aggregation. | `agent_interpreted` or stronger. | Sensitive or non-teaching details must be discarded. |
| `propose_profile_delta` | Propose a profile/strategy hypothesis. | No immediate profile mutation; sanitized candidate can be written to `background_learning_observations`. | Teaching-useful evidence with confidence and scope. | Rejected from immediate state mutation; routed through background profile filtering. |

## Goal Completion Policy

Minimum accepted evidence by lesson type:

- `meeting`: `agent_interpreted` after at least two turns.
- `reflection`: `agent_interpreted` after at least two turns.
- `tutor`: backend-observed `attempt_submitted` after at least two turns.
- `concept`: backend-observed `attempt_submitted` after at least two turns.
- `exam_strategy`: backend-observed `attempt_submitted` after at least two turns.
- `visual_explanation`: backend-observed `attempt_submitted` after at least two turns.
- `diagnostic`: `agent_interpreted` after at least two turns.
- `practice`: `deterministically_verified` from backend verifier evidence.
- `mistake_review`: `deterministically_verified` from backend verifier evidence.

The POC now has a deterministic verifier for one vertical task type:
`ege.base.linear_equation_numeric` / `algebra.linear.solve_one_variable`.
Practice and mistake-review completion for that vertical can be accepted from
stored backend verifier evidence. Other task types remain pending or rejected
until their verifier contracts are implemented.

## Verified Learning Loop V1

The first closed loop is intentionally narrow:

```text
backend-generated linear-equation task
→ student answer
→ numeric verifier
→ student_attempts row
→ mastery_evidence row when correct
→ policy can accept goal completion
→ usage summary can compute cost per verified outcome
```

The backend, not the decision model, owns `lesson_tasks`, `student_attempts`,
and `mastery_evidence`. The tutor model may explain, hint, or ask for a retry,
but it does not write proof rows.

## Observability

Every decision action is stored in `lesson_decisions` with:

- operation and assistant role;
- provider and model;
- tool name;
- sanitized decision JSON;
- backend policy result JSON;
- accepted/rejected status;
- rejection reason;
- evidence level;
- verifier result when available;
- latency and fallback marker;
- local usage correlation id when available;
- profile-delta routed marker;
- lesson outcome label.

This is debug/product observability, not grading, billing, or clinical
assessment.

## Privacy And Safety

Lesson decisions must not store secrets, raw provider request ids, billing
credentials, clinical labels, personality labels, family details, political or
religious facts, health information, or other non-teaching sensitive details.

Profile hypotheses must be teaching-useful, scoped, reviewable, and routed
through background profile filtering before they affect stored student memory.
