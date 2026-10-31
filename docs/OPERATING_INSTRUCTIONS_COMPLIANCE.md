# Operating Instructions — Compliance Status

**Canonical policy:** `docs/AI_SENA_OPERATING_INSTRUCTIONS.md`  
**Last reviewed:** 2026-08-27

This file tracks how fully AISENA (`smchandrupatla/aisena-agent-org`) implements the AI Sena Operating Instructions. Agents must follow the policy even where structure is incomplete; open gaps are work items, not excuses to ignore the rules.

---

## Status legend

| Status | Meaning |
|--------|--------|
| Done | Enforced in process and reflected in repo practice |
| Partial | Directionally present; policy tightened, tooling/structure incomplete |
| Open | Not yet implemented |

---

## Section checklist

| § | Topic | Status | Notes |
|---|--------|--------|-------|
| 1 | Sibling directory separation | Partial | Logical mapping defined in Operating Instructions; physical sibling layout not yet done |
| 1 | DB schema segregation | Partial | Prefer `aisena_*` vs app tables; enforce in schema reviews |
| 1 | Extraction / clean shippable repo | Open | Need scripted, repeatable extraction |
| 2 | Owner-directed work | Done | Implementation Manager / PO path |
| 2 | Self-initiated requires approval | Done (policy) | Agents must not implement without logged approval |
| 3 | Change pipeline + no CD | Partial | CI present; no CD; enforce full regression + human go-ahead for live |
| 3 | Risk Low/Med/High + Med/High review | Done (policy) | Required in change log |
| 4 | Changelog + architecture + rollback | Done | `AGENT_CHANGE_LOG.md`, `project/architecture/` |
| 5 | GUI visibility of every change | Partial | Policy requires UI surface or logged waiver |
| 5 | Plain-language UI verification summary | Done (policy) | Required in change log / handoff |
| 6 | Config console + runtime config | Open | Backlog: web config console, zero-downtime apply |
| 7 | Operator self-service recovery | Open | Health UI partial via observability; remediation buttons / flags needed |
| 8 | Enterprise NFRs | Partial | Observability stack present; multi-tenant, full NFR set incomplete |
| 9 | Continuous security scanning | Open | Role exists; scheduled vuln scan + patch queues needed |

---

## Priority backlog (to close Open/Partial)

1. **P0 — Policy binding (this PR):** Operating Instructions, Development Practices, AGENTS.md, wiki alignment.
2. **P1 — Change discipline:** Require regression evidence + risk tag + plain-language UI summary on every meaningful change-log entry; block “ready” without them.
3. **P1 — Schema segregation:** Document official shop vs app schemas; reject shared-table PRs.
4. **P2 — Extraction workflow:** Script to produce application-only tree with Sena removed and deps resolved.
5. **P2 — Configuration console:** Runtime feature flags / business toggles with RBAC.
6. **P2 — Operator recovery:** Diagnostics dashboard + remediation actions + safe feature flags.
7. **P3 — Physical sibling layout:** Optional split of shop vs application into sibling directories or repos once extraction is reliable.
8. **P3 — Continuous security:** Scheduled dependency/vuln scanning; low-risk auto-patch path; med/high review queue.

---

## How agents should behave today

* Follow `AI_SENA_OPERATING_INSTRUCTIONS.md` and `DEVELOPMENT_PRACTICES_AGENT.md` on every task.
* Do not implement self-initiated work without approval.
* Do not mark work complete without tests/regression evidence (or an explicit blocker).
* Always risk-tag, rollback-plan, and write a non-dev summary of how to verify in the UI.
* Do not worsen structural gaps (no new shared shop/app schema coupling; no silent CD).
