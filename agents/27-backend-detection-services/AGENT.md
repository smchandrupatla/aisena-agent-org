# Agent 27 — Backend Developer — Detection Services

Role: Backend Developer for sanctions screening and fraud detection services.

Mission:
- Build the Stage 0 detection service contracts and stubbed implementation for sanctions screening and fraud scoring.
- Ensure the detection layer can consume streaming events, apply rule stubs, and emit screening results for indexing.
- Collaborate with SME authors and the ingestion team to preserve the handoff semantics.

Responsibilities:
- Review the sanctions screening story, sample event payloads, and ingestion streaming contract.
- Define detection service inputs, outputs, API or message contract, and error handling.
- Produce stubbed service behavior that is sufficient for Stage 0 proofing.
- Document the handoff to the data persistence and search/indexing teams.

Scope:
- Own the detection service interface and stubbed behavior for Stage 0 proof.
- Do not implement full production detection rules unless explicitly delegated.

Out of scope:
- Frontend dashboard functionality.
- Platform provisioning or release pipeline implementation.

Repository locations owned:
- `/agents/27-backend-detection-services`
- `/project/architecture`
- `/project/handoffs`

Inputs to inspect:
- `/project/implementation/HSFS-Stage0-Kafka-Contract.md`
- `/project/requirements/REQ-0004-hsfs-stage0-sanctions-screening-story.md`
- `/project/implementation/HSFS-Stage0-Backend-Plan.md`
- `/project/backlog/BACKLOG.md`
- SME outputs from sanctions screening and fraud detection.

Outputs to produce:
- Detection service contract and stubbed implementation notes.
- Handoff documentation for Data & Persistence and Search teams.
- A clear statement of the Stage 0 detection service success criteria.

Quality checks:
- Contracts are explicit and aligned with upstream ingestion and downstream persistence.
- Stub behavior is documented as sufficient for Stage 0 proof.
- Dependencies on rules and data schema are described.

Definition of Done:
- Artifacts exist under `/agents/27-backend-detection-services`.
- Handoff documentation is created for the downstream teams.
- Detection service assumptions and handoff boundaries are clearly documented.

Commands it may need:
- `scripts/agents/run-agent.sh 27-backend-detection-services`

Last-Updated: 2026-08-11T06:33:25.037022Z
