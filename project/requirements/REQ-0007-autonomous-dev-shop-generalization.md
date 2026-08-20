# REQ-0007 — Autonomous Dev Shop Generalization (Multi-Client, Multi-App Engine)

Status: ACCEPTED
Date: 2026-08-20
Owner: Product Owner / Client Input

## Purpose
Generalize the Sena operating model (REQ-0006 / ADR-0003) — previously scoped to a single application (AISENA) with a fixed 37-role roster — into a stack-agnostic, multi-client, multi-app autonomous software development engine. A client supplies specifications and standing best-practice guidelines once; a dynamically-assembled team of AI expert agents then designs, builds, tests, and iterates on the resulting application, from MVP through enterprise scale, with minimal human intervention.

## Source Requirement
Product Owner / Client "Autonomous AI Dev Shop — System Prompt & Architecture Spec" supplied on 2026-08-20.

## Relationship to REQ-0006 / ADR-0003
This requirement supersedes REQ-0006/ADR-0003's single-app, fixed-roster scope while keeping every delivery-pipeline, audit, and separation guarantee they established. Concretely:
- The existing 37 `agents/NN-role-name/` folders remain the bootstrap library of known personas, but are no longer treated as an exhaustive fixed roster — the Orchestrator matches workstreams against them first and synthesizes new persona folders on demand when nothing fits (Section 5).
- The single implementation-manager instance generalizes to one Orchestrator capable of onboarding multiple clients and apps, each with its own isolated audit trail, ticket history, and push-mode configuration, while retaining REQ-0006's no-shared-schema and gated-change-pipeline rules per app.
- Sibling-workspace separation, isolated schemas, extraction workflow, and the mandatory implementation → test → regression → risk-tagging → human-go-ahead pipeline (REQ-0006 §1, §3) remain in force for every app built under this model.

## In Scope
- Client onboarding: VCS identity/credentials, naming conventions, initial specification, standing best-practice guidelines, and push-mode selection (Section 3).
- Configurable auto-push vs. manual-approval GitHub workflow, selectable per client or per project (Section 4).
- Dynamic expert agent spin-up: an Orchestrator that decomposes a specification into workstreams and matches or synthesizes the expert persona each workstream needs, rather than relying on a static role list (Section 5).
- Distinct behavior for mobile apps (standalone, no imposed interoperability) vs. enterprise-grade apps (plug-and-play interoperability contract checked against sibling enterprise apps) (Section 6).
- Iterative MVP lifecycle: every new specification is treated as an incremental enhancement against the existing app, not a rebuild (Section 7).
- Issue/ticket handling: autonomous escalation when an agent cannot resolve a problem, labeled with the originating app's identifier for traceability (Section 8).
- Per-app audit logging and a queryable history of every app ever built through the engine (Section 9).

## Out of Scope
- Automated production deployment (unchanged from REQ-0006 — CI only, never CD).
- Removing or bypassing the mandatory human go-ahead gate for Medium/High risk changes.
- A real LLM-based spec decomposition or NLP model — the first cut uses a deterministic keyword-based heuristic as an explicit, swappable seam.

## Functional Requirements

### 1. Client Onboarding
- Capture GitHub identity/credentials, org/repo naming conventions, initial specification, standing best-practice guidelines, and push-mode selection at onboarding, editable per project thereafter.

### 2. Push Mode (GitHub Integration)
- `auto_push`: Orchestrator commits and opens/merges pull requests autonomously.
- `manual_approval`: Orchestrator commits and opens pull requests but leaves them for human review/merge.
- Configurable per client at setup and editable per project at any time.

### 3. Dynamic Expert Assignment
- Every workstream derived from a specification is matched against the existing persona library by role/skill overlap.
- When no existing persona matches well enough, the Orchestrator synthesizes a new persona folder (`agents/dynamic/<role-slug>/`) following the same `AGENT.md`/`config.json` convention as the bootstrap roster.

### 4. App Type Behavior
- Mobile apps: standalone, no automatic interoperability layer.
- Enterprise apps: must declare an interoperability contract; the Orchestrator checks new enterprise apps against every other enterprise app already in the registry and reports a compatibility summary.

### 5. Issue Escalation & Traceability
- Unresolvable problems open a ticket carrying: what was attempted, why it couldn't be resolved, and what decision/input is needed.
- Every ticket is tagged with its originating app identifier; when a GitHub repo is configured, a matching GitHub issue is opened with the app identifier as a label.

### 6. Audit Trail & App History
- Every app has its own append-only audit log (design decisions, spec submissions, workstream assignments, interoperability checks, ticket escalations).
- The full set of apps ever onboarded is queryable independent of any single app's own storage.

## Acceptance Criteria
- An ADR exists and is accepted codifying the Orchestrator, dynamic-expert-registry, and GitHub push-mode decisions implied by this requirement.
- A client can onboard an app with a chosen push mode and app type, submit a specification, and receive back a decomposed set of workstreams each assigned to a matched or newly synthesized expert.
- Enterprise apps receive an interoperability report referencing every other enterprise app already onboarded; mobile apps do not.
- Every escalated issue is retrievable by its app identifier, independent of other apps' tickets.
- Every app's audit trail and full app registry are independently queryable and covered by automated tests.

## Summary Principle
Sena/the Orchestrator remains stack-agnostic and minimal-intervention by design: a client supplies a specification once, the Orchestrator assembles whichever expert personas the work requires (drawing from the existing roster first, inventing new ones only when necessary), and every app it touches keeps its own isolated audit trail, ticket history, and GitHub push-mode behavior — regardless of how many clients or apps the engine serves.
