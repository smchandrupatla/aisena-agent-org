# ADR-0002 — Autonomous Agent Shop Governance Protocol

Status: ACCEPTED
Date: 2026-08-11
Owner: Implementation Manager

## Context
The Product Owner / Client has mandated an autonomous AI development shop model with strict delivery guardrails, append-only documentation, and escalation only for true business-judgment decisions.

## Decision
Adopt a repo-native governance protocol that:
- Treats Product Owner goals as the only external requirement input.
- Self-assigns role responsibilities through backlog and handoff artifacts.
- Requires append-only change logging in shared docs for all significant actions.
- Enforces approval gates for production, cost, user data, pricing, and legal exposure changes.
- Uses measurable quality and delivery feedback loops for claims.

## Alternatives Considered
- Keep the existing lightweight bootstrap process with no expanded controls.
- Use ad hoc per-agent logs without a shared append-only structure.
- Require manual task assignment by the Product Owner for each implementation step.

## Rationale
- The mandate explicitly requires autonomous downstream decision ownership.
- Structured guardrails reduce governance, compliance, and delivery risk.
- Append-only traces preserve institutional memory and improve auditability.
- Measurable checkpoints prevent unverified self-reporting.

## Consequences
- Additional documentation overhead becomes mandatory work.
- Agents must include rollback and approval metadata with each change.
- Delivery velocity is optimized through autonomy but constrained by business-risk sign-offs.

## Arbitration Rule
When role conflict occurs (for example, security vs performance), the designated arbiter is:
1. Solution Architect for technical trade-offs.
2. Security and Compliance Engineer for policy-critical overrides.
3. Product Owner / Client only if business risk tolerance must be chosen.

## Approval Gate Rule
Human sign-off is required before executing changes that:
- Touch production systems.
- Incur real monetary spend.
- Affect user data handling, pricing logic, or legal/compliance exposure.

## Rollback Rule
Every implementation task must include:
- Target commit reference.
- Pinning information for versions/configs.
- Tested rollback command or procedure.

## Metrics Rule
Every implementation increment must report, at minimum:
- Test pass rate.
- Deployment success/failure status.
- Open critical defect count.
- Security scan findings count by severity.

## Status
Accepted and active for all new backlog items from 2026-08-11 onward.
