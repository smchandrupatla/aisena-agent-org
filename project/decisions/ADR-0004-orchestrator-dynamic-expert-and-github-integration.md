# ADR-0004 — Orchestrator Service: Dynamic Expert Registry and GitHub Push-Mode Integration

Status: ACCEPTED
Date: 2026-08-20
Owner: Implementation Manager

## Context
REQ-0007 generalizes the single-app, fixed-37-role Sena model (REQ-0006/ADR-0003) into a multi-client, multi-app autonomous dev shop with dynamic expert spin-up, configurable GitHub push modes, per-app ticketing, and a queryable app history. This ADR codifies the concrete service, data model, and integration decisions needed to satisfy that requirement while preserving every guarantee ADR-0003 already established (schema isolation, gated change pipeline, no automated deployment).

## Decision

### New service: `services/orchestrator`
- A standalone Flask service (`services/orchestrator/app.py`), independent of `services/api` (which remains the AISENA-specific screening app API), owning:
  - `app_registry.py` — JSON-file-backed registry of every app ever onboarded (`project/orchestrator/apps.json`), independently queryable.
  - `audit.py` — append-only JSONL audit log per app (`project/orchestrator/audit/<app_id>.jsonl`).
  - `tickets.py` — per-app ticket store (`project/orchestrator/tickets/<app_id>.json`).
  - `capability_registry.py` — matches workstreams against the existing `agents/NN-role-name/` persona library (role + `config.json` skills overlap); synthesizes a new `agents/dynamic/<role-slug>/` persona (same `AGENT.md`/`config.json` shape) when no existing persona matches.
  - `github_client.py` — thin GitHub REST client with push-mode-aware PR handling (`apply_push_mode`): auto-push opens and immediately merges a PR; manual-approval opens the PR and stops, leaving it for human review. Repo names are validated against a strict allow-list regex before use in any API path (path/command-injection defense).
  - `orchestrator.py` — the engine tying the above together: `onboard_client`, `decompose_spec` (deterministic keyword-based heuristic, explicitly isolated so it can be replaced by a real LLM-based decomposition later without touching any other module), `submit_spec`, `check_interoperability`, `escalate_issue`, `get_app_history`.
- The 37 existing `agents/` folders remain in place unchanged and continue to serve as the bootstrap persona library; they are not deleted or renumbered.

### Dynamic expert assignment
- `CapabilityRegistry.match_expert()` scores existing personas by word-overlap between the workstream description and each persona's declared role/skills; the best-scoring persona above zero overlap is used.
- `CapabilityRegistry.synthesize_expert()` is the fallback: it creates a new `agents/dynamic/<role-slug>/AGENT.md` + `config.json` pair on demand, tagged as synthesized, so future workstreams can also match against it.

### GitHub push-mode integration
- Push mode (`auto_push` / `manual_approval`) is stored per app in the app registry and passed explicitly into `apply_push_mode()` — never inferred or hardcoded — so it stays editable per project as REQ-0007 requires.
- `GitHubClient` accepts an injectable HTTP session so the integration is unit-testable without live network calls or credentials; `GITHUB_TOKEN`/`GITHUB_ORG` are read from environment variables and never logged or echoed in error messages.

### Enterprise interoperability
- `check_interoperability()` runs only for `app_type == "enterprise"` apps, is recorded to that app's audit trail, and reports every other enterprise app currently in the registry as a peer requiring manual API-contract compatibility verification. Mobile apps never run this check, matching REQ-0007 §Section 4.

### Issue escalation
- `escalate_issue()` always creates a local ticket tagged with the app id; if the app has a configured GitHub repo and the GitHub client is enabled, it additionally opens a GitHub issue labeled with the app id, satisfying REQ-0007 §5's traceability requirement.

### Deployment
- Added as an `orchestrator` service in the root `docker-compose.yml` (port 5100), independent of the existing `api`/`agent-manager` services, following the same `context: .` + service-scoped Dockerfile pattern already used by `services/api`.

## Alternatives Considered
- Extending `services/api` in place with orchestrator routes: rejected — conflates the AISENA-specific screening API with the generic multi-app engine and would make future app-agnostic evolution harder to isolate.
- Hardcoding push mode as a single global environment variable: rejected — REQ-0007 requires push mode to be configurable per client and per project, not per deployment.
- Calling a real LLM for spec decomposition immediately: rejected for this increment — no LLM credential/runtime is available in this environment; the deterministic heuristic is implemented as an explicit, isolated seam (`decompose_spec`) so it is a drop-in replacement later.

## Rationale
- Keeping the Orchestrator as its own service preserves REQ-0006/ADR-0003's separation principle at the meta level: the engine that builds apps stays cleanly separable from any one app's own API.
- A match-then-synthesize capability registry gives "dynamic expertise, not a fixed roster" (REQ-0007 §5) without discarding the already-defined 37-role library, which remains useful as the common case.
- Injectable-session GitHub client and env-var credentials keep the integration testable and avoid credential leakage (OWASP A02/A09 relevant concerns: no secrets in logs, no secrets in error strings).

## Consequences
- Every app onboarded through the Orchestrator now has three new isolated artifacts under `project/orchestrator/`: a registry entry, an audit log, and a ticket store — additive, does not touch `project/tasks.json`/`project/issues.json` used by the existing single-app AISENA capabilities site.
- Real GitHub automation (repo creation, PR merge, issue creation) requires `GITHUB_TOKEN`/`GITHUB_ORG` to be configured; without them the Orchestrator still functions for spec decomposition, expert assignment, interoperability checks, and local ticketing, but GitHub-side actions are skipped rather than failing the whole request.
- The existing REQ-0006/ADR-0003 gated change pipeline (implementation → tests → regression → risk tagging → human go-ahead) is unchanged and still applies to changes made **within** any app the Orchestrator builds; this ADR only changes how the *team assembling and integrating* those changes is composed and how GitHub push behavior is configured.

## Approval Gate Rule
Unchanged from ADR-0002/ADR-0003: Medium/High risk changes and any self-initiated (Orchestrator-proposed) change require explicit human approval before implementation begins, regardless of push mode.

## Rollback Rule
Remove the `orchestrator` service from `docker-compose.yml`, delete `services/orchestrator/`, and delete `project/orchestrator/` — no other service or existing app data is touched.

## Status
Accepted and active for all new clients/apps onboarded through the Orchestrator from 2026-08-20 onward. REQ-0006/ADR-0003 remain in force as the per-app delivery-pipeline and separation baseline that every app built through the Orchestrator must still satisfy.
