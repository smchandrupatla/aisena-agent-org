# ADR-0003 — Sena/Application Separation and Change-Delivery Model

Status: ACCEPTED
Date: 2026-08-20
Owner: Implementation Manager

## Context
REQ-0006 requires Sena to operate as an autonomous dev shop that sits beside every application it builds rather than inside it, to guarantee the application is production-ready after every change, and to make every change visible, auditable, reversible, and configurable at runtime. This ADR codifies the concrete structural and pipeline decisions needed to satisfy that requirement.

## Decision

### Workspace and data separation
- Sena's role/agent definitions, orchestration code, and implementation-manager state live in a directory tree that is a sibling of each application's own repository/workspace — never nested inside the application's source tree.
- Sena's implementation-manager database schema is provisioned and migrated independently from any application database schema (separate database, or at minimum a separate schema/namespace with no shared tables).
- A repeatable "extraction" procedure must exist (script or documented runbook) that produces a clean copy of an application repository with all Sena-only files, configuration, and dependencies removed, verified to build and deploy standalone.

### Change pipeline
- Every change (product-owner-requested or Sena self-initiated) is implemented as a discrete unit of work that must pass, in order: implementation → full automated test suite → regression suite → risk tagging (Low/Medium/High) → human go-ahead, before it is applied to the live application.
- CI is used to validate every change; no step in the pipeline triggers automatic deployment to production.
- Medium and High risk changes are blocked from proceeding past the "ready" state without recorded explicit human review, regardless of automated test outcomes.
- Self-initiated (Sena-proposed) changes are held at a proposal state and never enter implementation until explicit human approval is recorded.

### Audit trail and documentation
- Each application's Sena instance maintains: (a) an append-only running changelog of every change and its rationale, (b) a living architecture document updated alongside feature work, and (c) a rollback plan attached to every change before it is marked ready. These follow the same append-only conventions already established in [`docs/AGENT_CHANGE_LOG.md`](../../docs/AGENT_CHANGE_LOG.md) and [`docs/AGENT_OPERATIONS_WIKI.md`](../../docs/AGENT_OPERATIONS_WIKI.md).

### Visibility and configuration
- No change may exist only in code, config files, or backend logs — each must be observable through the application's own GUI, and shipped with a plain-language, non-developer-oriented change summary describing what changed, why, and how to verify it.
- Business-tunable behavior is implemented as configuration (feature flags, toggles, option lists) surfaced in a web-based configuration console, applied at runtime with zero downtime and no restart.
- The configuration console also exposes RBAC-gated self-service operator actions (retry, reset, reindex, clear cache) and safe-default feature flags for emergency disablement.

## Alternatives Considered
- Embedding Sena's orchestration code directly inside the application repository: rejected — breaks clean extraction, risks schema/state coupling, and blurs audit boundaries.
- Allowing continuous deployment straight from a passing test suite: rejected — conflicts with the mandatory human go-ahead gate and risk-tiering requirement.
- Storing configuration only as static files requiring redeploy: rejected — violates the zero-downtime, no-restart configuration requirement.

## Rationale
- Sibling-workspace and schema isolation make on-demand extraction and independent scaling/deployment possible without surgery.
- A staged, gated pipeline with mandatory human sign-off for medium/high risk changes balances autonomy with production safety.
- Append-only audit artifacts and GUI-visible changes give non-technical stakeholders full oversight without needing to read code or logs.
- Runtime configuration and self-service recovery reduce vendor dependency for common operational issues, consistent with the B2B self-service philosophy.

## Consequences
- Every new application scaffolded under this model requires: a sibling Sena directory, an isolated database/schema, a changelog + architecture doc pair, an extraction script/runbook, and a configuration console from the outset — this is added overhead versus a minimal MVP.
- Delivery velocity for Medium/High risk changes is bounded by human review availability.
- No feature can ship as "backend-only"; every feature requires a corresponding GUI surface, which extends UI/UX scope for otherwise backend-only work.

## Approval Gate Rule
Unchanged from ADR-0002, with the addition that:
- Any change tagged Medium or High risk requires explicit human review before being marked ready, independent of test outcomes.
- Any self-initiated (Sena-proposed) change requires explicit human approval before implementation may begin.

## Rollback Rule
Every change must include a tested rollback plan as part of being marked "ready," per REQ-0006 §4.

## Status
Accepted and active for all new applications and increments delivered under the Sena operating model from 2026-08-20 onward.
