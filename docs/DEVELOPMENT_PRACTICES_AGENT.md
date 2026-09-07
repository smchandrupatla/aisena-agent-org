# Development Practices — Agent Instructions

**Status:** ACTIVE
**Binds:** every AI coding agent working in this repository
**Parent policy:** `docs/AI_SENA_OPERATING_INSTRUCTIONS.md`

---

## Before Writing Code

* Read existing code in the area you're touching before adding new code. Match existing patterns, naming conventions, and file structure unless there's a clear reason to deviate — and if you deviate, say why.
* If a requirement is ambiguous or underspecified, state your assumption explicitly and proceed with a sensible default rather than stalling. Don't invent scope that wasn't asked for.
* For anything non-trivial (new module, schema change, cross-cutting change), briefly outline the approach before implementing, so mistakes get caught at the plan stage, not after 500 lines of code.
* Self-initiated improvements require explicit approval before implementation (see Operating Instructions §2).

---

## Code Quality

* Prefer clarity over cleverness. Optimize for the next person (or agent) reading this code with no context.
* Keep functions small and single-purpose. If a function needs a comment to explain what it does as a whole, it probably needs to be split.
* No dead code, no commented-out blocks, no TODO without an owner/ticket reference.
* Match the project's existing formatting/linting config — don't introduce a new style.
* Avoid premature abstraction. Duplicate two or three times before extracting a shared abstraction; guessing at the wrong abstraction early costs more than short-term duplication.

---

## Correctness & Testing

* Every change gets a test. No new function, fix, or behavior change ships without a corresponding test — not just the happy path, but edge cases, empty/null inputs, and boundary conditions.
* When fixing a bug, write a test that reproduces it first, then fix it, then confirm the test passes.
* Run the full regression suite after every change, no exceptions. Never rely on "this change is small, it should be fine." Run it before declaring any task done.
* If the regression suite fails, do not mark the task complete or move to the next task — fix the failure or clearly flag it as a blocking issue first.
* If a test suite doesn't exist yet for the code you're touching, that's a signal to add minimal coverage as part of the change, not skip testing entirely.
* For anything touching money, risk scoring, sanctions/fraud logic, or other decision-critical paths: favor explicit, auditable logic over "smart" implicit behavior. These paths should be easy to explain to a non-engineer auditor, and get extra test coverage given the cost of a silent failure.

### Local regression (minimum)

* Python / API / orchestrator: unit tests and `tests/test_feature_health.py` as applicable
* GUI / portal: Selenium suite or documented equivalent when UI is touched
* State explicitly in the summary that the suite was run and passed (or that it could not be run, in which case the task is **not** complete)

---

## Error Handling

* Fail loudly and specifically. No silent catches, no swallowed exceptions, no generic "something went wrong."
* Validate inputs at system boundaries (API endpoints, user input, external data) — don't trust upstream data implicitly.
* Log enough context to debug a production issue without needing to reproduce it locally.

---

## Security

* Never hardcode secrets, API keys, or credentials — use environment variables / secret managers, and check that nothing sensitive is about to be committed.
* Sanitize/escape anything rendered from user input (XSS), and parameterize all queries (no string-concatenated SQL).
* Treat any change to auth, permissions, or data access as **High** risk — call it out explicitly rather than bundling it quietly into an unrelated change.

---

## Git & Change Hygiene

* Small, focused commits with clear messages describing why, not just what.
* Don't mix refactoring with behavior changes in the same commit — makes review and rollback harder.
* Before marking a task complete, self-review the diff as if you were the reviewer: does this do only what was asked, and nothing more?

---

## Architecture Consistency

* New code should fit the existing architecture (module boundaries, state management approach, data flow patterns) unless explicitly asked to refactor.
* Flag — don't silently fix — architectural inconsistencies you notice outside the scope of the current task. Note them, let the user decide priority.
* Keep business logic separate from UI/presentation layer and from framework-specific glue code, so either can change independently.
* Respect shop vs application logical separation (Operating Instructions §1).

---

## Documentation

* Public functions/APIs get a short docstring: what it does, params, return value, and any non-obvious side effects.
* Update README/setup docs when you change how something is run, configured, or deployed — stale setup docs cost more time than writing none.
* Complex business rules (e.g., fraud scoring thresholds, sanctions logic) should be documented in plain language near the code, not just in commit history.
* Append a change-log entry per `docs/AGENT_OPERATIONS_WIKI.md` for every meaningful change.

---

## Performance

* Don't optimize prematurely, but don't ignore obvious inefficiencies (N+1 queries, unnecessary re-renders, unbounded loops over large data).
* For anything user-facing, consider loading states and failure states, not just the success path.

---

## When Done

* Confirm the regression suite was run and passed. State this explicitly in your summary — don't leave it implied.
* Summarize what changed and why in plain language (non-developer friendly: what / why / how to verify in the UI).
* Tag **Risk Level: Low | Medium | High**. Medium and High require human review before live.
* Include a rollback plan.
* Explicitly flag any assumptions made, any scope left out, and any follow-up work you'd recommend.
* If tests weren't run or couldn't be run, say so plainly and treat the task as **not complete** — don't imply verification that didn't happen.
