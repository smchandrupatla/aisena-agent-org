# AGENTS.md — AISENA binding instructions

These instructions apply to **every AI coding agent** working in this repository.

## Canonical policy (read first)

1. **`docs/AI_SENA_OPERATING_INSTRUCTIONS.md`** — product and delivery governance (change pipeline, risk, visibility, config, security).
2. **`docs/DEVELOPMENT_PRACTICES_AGENT.md`** — how to write, test, and hand off code.
3. **`docs/AGENT_OPERATIONS_WIKI.md`** — logging template, escalation, approval gates.
4. **`docs/OPERATING_INSTRUCTIONS_COMPLIANCE.md`** — what is Done / Partial / Open; do not ignore Open items.

## Non-negotiables

* **No continuous deployment** — CI only; human go-ahead before live.
* **Every meaningful change:** tests + regression evidence, risk tag (Low/Medium/High), rollback plan, plain-language summary (what / why / how to verify in the UI), entry in `docs/AGENT_CHANGE_LOG.md`.
* **Medium and High risk** always require explicit human review before live, regardless of tests.
* **Self-initiated improvements** require explicit approval before implementation — never silent.
* **Shop vs application:** keep logical separation (see Operating Instructions §1). Do not merge shop schema with application schema.
* Do not invent scope. Flag out-of-scope architecture issues; do not silently expand them.

## Handoffs and architecture

* Handoffs: `/project/handoffs/<task-id>-<from>-to-<to>.md`
* Architecture: `project/architecture/`
* Status: `/project/reports/IMPLEMENTATION_STATUS.md` when used

## When done

State explicitly whether the full applicable regression suite was run and passed. If not run, the task is **not complete**.
