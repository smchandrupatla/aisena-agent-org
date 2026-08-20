# Project State

## Current Architecture
- Repository currently contains only a README.
- No clear frontend, backend, database, or CI infrastructure exists yet.
- AI delivery organisation is being bootstrapped as a domain-agnostic implementation system rather than a single-vertical product.

## Current Milestone
- Stage 1: Definition roles created and initial scope documented.
- Stage 2 preparation underway for engineering role validation.

## Active Tasks
- TASK-0009 — Stage 0 architecture validation and backend implementation planning (IN_PROGRESS)
- TASK-0011 — Governance metrics and critic cadence (IN_PROGRESS)
- TASK-0012 — Sena operating model rollout: sibling-workspace separation, schema isolation, extraction workflow, gated change pipeline, configuration console, self-service ops (IN_PROGRESS)

## Recently Completed Tasks
- Repository discovery and environment inspection.
- Creation of core AI delivery directories.
- Initial Business Analyst role definition and bootstrap scope documentation.
- Initial Solution Architect role definition and architecture overview.
- Initial UI/UX role definition and guidance documentation.
- Engineering role validation preparation artifacts created and documented.
- AISENA Stage 0 proof plan and agent roster defined.
- TASK-0010 DONE: Autonomous governance baseline activated (2026-08-14).
- TASK-0011 DONE: Governance metrics loop, critic cadence, and cost tracker implemented (2026-08-14).

## Delivery Model
Single-agent delivery adopted 2026-08-15. Implementation Manager drives all work directly. Specialist roles are expressed through outputs, artifacts, and handoff documents. Coordination follows handoff, backlog, and change-log protocols unchanged.

## Blockers
- None. Delivery model changed to single-agent (2026-08-15). Runtime constraint documented and closed.

## Upcoming Work
- Create and validate Business Analyst, Solution Architect, and UI/UX Designer roles.
- Clarify project purpose and architecture.
- Establish agent execution scripts and Codespaces readiness documentation.

## Update 2026-08-11 — Autonomous Shop Activation

### New Direction
- Product Owner / Client mandate adopted: self-organizing AI development shop with autonomous technical decision ownership and strict governance guardrails.

### New Artifacts
- REQ-0005 created to formalize autonomous operating requirements.
- ADR-0002 accepted to codify approvals, arbitration, metrics, and rollback rules.
- Append-only operations wiki and change log created under `/docs`.

### Active Governance Tasks
- TASK-0010 DONE: governance baseline activated and critic pass completed (2026-08-14).
- TASK-0011 BLOCKED: critic cadence, metrics capture, and cost/resource tracking loop — blocked on Copilot CLI runtime resolution.

### Governance Baseline Status (2026-08-14 critic pass)
- Governance checklist applied to all active tasks: TASK-0003, TASK-0007, TASK-0009, TASK-0010.
- Critic reviewers assigned: Solution Architect (TASK-0003), QA Engineer (TASK-0007), Security Engineer (TASK-0009), Release Manager (TASK-0010).
- Change log entries recorded: LOG-20260814-001 through LOG-20260814-005.

### Governance Artifacts Created
- /project/governance/INCREMENT-CHECKLIST-TEMPLATE.md
- /project/governance/METRICS-AND-COST-TRACKER.md
- /project/governance/CRITIC-REVIEW-LOG.md
- /project/governance/CRITIC-ROTATION-SCHEDULE.md
- /project/governance/INC-0001-2026-08-14.md

### Human Sign-Off Boundaries
- Required only for production-impacting, cost-incurring, user-data, pricing, or legal-exposure changes.

### Current Constraint
- Copilot CLI runtime blocked: permission host returning "denied-interactively-by-user". Run `copilot` in an interactive terminal session to accept permission prompts, then retry non-interactive use. This blocks TASK-0011.

## Update 2026-08-20 — Sena Operating Model Codified

### New Direction
- Product Owner / Client supplied a full "AI Sena — Operating Instructions" charter: Sena operates as a sibling dev shop beside each application, never mixed into its codebase, with an isolated database schema, a repeatable clean-repo extraction workflow, and a mandatory gated change pipeline (implementation → tests → regression → risk tagging → human go-ahead) with no automated deployment.

### New Artifacts
- REQ-0006 created to formalize the Sena operating instructions as a requirement.
- ADR-0003 accepted to codify workspace/schema separation, the change-delivery pipeline, audit-trail artifacts, and the configuration-console/self-service model.

### Active Governance Tasks
- TASK-0012 IN_PROGRESS: roll out sibling-workspace separation, schema isolation, extraction workflow, gated change pipeline, configuration console, and self-service operator recovery for applications built under this model.

## Update 2026-08-20 — Autonomous Dev Shop Generalization (Orchestrator)

### New Direction
- Product Owner / Client supplied an "Autonomous AI Dev Shop" spec generalizing the single-app, fixed-37-role Sena model into a stack-agnostic, multi-client, multi-app engine with dynamic expert spin-up, configurable GitHub push modes, per-app ticketing, and a queryable app history.

### New Artifacts
- REQ-0007 created to formalize the generalization, superseding REQ-0006/ADR-0003's single-app/fixed-roster scope while preserving their delivery-pipeline and separation guarantees.
- ADR-0004 accepted to codify the new `services/orchestrator` service, dynamic expert capability registry, and GitHub push-mode integration.
- TASK-0013 added to the backlog: implement and test the Orchestrator service.

### Implementation Status
- `services/orchestrator/` implemented: app/audit/ticket registries, capability registry (match existing persona or synthesize `agents/dynamic/<role-slug>/` on demand), GitHub client (push-mode-aware PR creation/merge, injectable session for tests), and Flask API.
- 12 unit tests passing (`docker build -f services/orchestrator/Dockerfile -t orchestrator-test .` then `docker run --rm orchestrator-test python -m unittest test_orchestrator.py -v`).
- Wired into root `docker-compose.yml` as the `orchestrator` service (port 5100).

### Active Governance Tasks
- TASK-0013 IN_PROGRESS: Orchestrator service delivered; pending human review of GitHub push-mode behavior before enabling real `GITHUB_TOKEN`/`GITHUB_ORG` credentials in any environment.

