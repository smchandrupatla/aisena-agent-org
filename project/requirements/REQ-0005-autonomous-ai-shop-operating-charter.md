# REQ-0005 — Autonomous AI Shop Operating Charter

Status: ACCEPTED
Date: 2026-08-11
Owner: Product Owner / Client Input

## Purpose
Establish the operating requirement that this project is executed by a self-organizing AI development shop that takes only business-goal direction from the Product Owner / Client and owns all downstream technical delivery decisions.

## Source Requirement
Primary source is the Product Owner / Client activation mandate provided on 2026-08-11.

## In Scope
- Autonomous role self-assignment across full SDLC.
- Tooling, architecture, stack, infrastructure, and process decisions made by the agent team.
- Continuous learning and capability self-benchmarking by each role.
- Formal handoffs, disciplined documentation, and traceable change history.
- Guardrails for approvals, rollback, conflict arbitration, critic validation, cost tracking, and business-risk checkpoints.
- Standard intake mode and clone/rebuild intake mode.

## Out of Scope
- Human delegation of low-level technical implementation steps.
- Unapproved production changes that trigger legal, pricing, data, or direct cost exposure.

## Functional Requirements
1. The team must convert Product Owner goals into working specifications and implement them end-to-end.
2. The team must self-assign roles and coordinate work through explicit handoffs.
3. The team must maintain append-only markdown documentation in shared project docs for all material changes.
4. Every change entry must include: what changed, commit/version reference, rationale, and alternatives considered when relevant.
5. The team must track measurable outcomes for quality and delivery claims.
6. Capability gaps must trigger explicit specialist requests with justification.

## Guardrail Requirements
1. Any production-impacting or cost-incurring action requires human approval.
2. Any change with user-data, pricing, or legal exposure requires human sign-off.
3. Every change must have version pinning and tested rollback steps.
4. Disputes between experts must follow an arbitration rule.
5. Rotating critic reviews are mandatory to challenge assumptions.
6. Resource and API spend must be tracked and thresholded.

## Non-Functional Requirements
- Traceability: Full audit trail in append-only docs.
- Reliability: Measurable feedback loops with test and deployment metrics.
- Security and compliance: Explicit checkpoints and approvals.
- Maintainability: Clear handoff and ownership artifacts.

## Acceptance Criteria
- A governance ADR exists and is accepted.
- Shared docs include append-only operational logs and templates.
- Backlog includes activation and governance execution tasks.
- Project state and implementation status reflect autonomous execution mode.
- Risk register includes governance and autonomy risks.

## Dependencies
- Existing handoff templates and backlog process under `/project`.
- Runtime restoration work for prompt execution tasks.

## Notes
This requirement governs process and delivery behavior across all implementation stages.
