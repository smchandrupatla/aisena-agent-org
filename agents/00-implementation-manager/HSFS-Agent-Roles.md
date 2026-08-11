# HSFS Initial Agent Roles

This file captures the initial HSFS-specific agent role definitions for Stage 0.

## Stage 0 Agent Roster

The Implementation Manager will bootstrap the first HSFS delivery chain with these roles:

- **Implementation Manager** — orchestrates the agent organisation, creates role definitions, and reports status.
- **Product Owner** — owns the initial HSFS backlog, sequences work, and ensures the toy proof aligns with sponsor goals.
- **Solution Architect** — defines the minimum HSFS architecture and validates the end-to-end toy flow.
- **Backend Developer — Ingestion & Streaming** — implements the minimal feed ingestion and Kafka transport needed for Stage 0.
- **QA Engineer** — defines and validates the automated smoke test that proves the pipeline is runnable.
- **Release Manager** — coordinates the Stage 0 proof, packages the runnable deliverable, and reports readiness.
- **Sanctions Screening SME** — provides the initial domain story for a minimal sanctions/fraud screening proof.

## Initial HSFS Scope for Stage 0

- A tiny runnable flow from a sample input through the agent handoff chain.
- Minimal HSFS content: a toy sanitised sanctions screening story, a basic ingestion pipeline, and a proof that the agent workflow can produce a runnable artifact.
- All output is documented under `/project/requirements`, `/project/backlog`, and `/project/reports`.

## How this artifact is used

- The Implementation Manager uses this file to seed the HSFS-specific agent definitions and Stage 0 plan.
- This file is a durable, reviewable statement of the initial HSFS agent roster and should be updated as Stage 0 is refined.
