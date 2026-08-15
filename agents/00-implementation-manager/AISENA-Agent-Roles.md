# AISENA Initial Agent Roles

This file captures the initial AISENA-specific agent role definitions for Stage 0.

## Stage 0 Agent Roster

The Implementation Manager will bootstrap the first AISENA delivery chain with these roles:

- **Implementation Manager** — orchestrates the agent organisation, creates role definitions, and reports status.
- **Product Owner** — owns the initial AISENA backlog, sequences work, and ensures the toy proof aligns with sponsor goals.
- **Solution Architect** — defines the minimum AISENA architecture and validates the end-to-end toy flow.
- **Backend Developer — Ingestion & Streaming** — implements the minimal feed ingestion and Kafka transport needed for Stage 0.
- **QA Engineer** — defines and validates the automated smoke test that proves the pipeline is runnable.
- **Release Manager** — coordinates the Stage 0 proof, packages the runnable deliverable, and reports readiness.
- **Sanctions Screening SME** — provides the initial domain story for a minimal sanctions/fraud screening proof.

## Initial AISENA Scope for Stage 0

- A tiny runnable flow from a sample input through the agent handoff chain.
- Minimal AISENA content: a toy sanitised sanctions screening story, a basic ingestion pipeline, and a proof that the agent workflow can produce a runnable artifact.
- All output is documented under `/project/requirements`, `/project/backlog`, and `/project/reports`.

## How this artifact is used

- The Implementation Manager uses this file to seed the AISENA-specific agent definitions and Stage 0 plan.
- This file is a durable, reviewable statement of the initial AISENA agent roster and should be updated as Stage 0 is refined.

## Tier 1 SME Agent Roles

The following Subject Matter Experts are available to provide domain stories, implementation guidance, and acceptance criteria for AISENA:

- **Sanctions Screening SME** — OFAC SDN, 31 CFR, list ingestion cadence, signature/fuzzy matching rules.
- **Fraud Detection SME** — transaction fraud typologies, scoring thresholds, model risk and feature guidance.
- **Payments & Messaging SME (ISO 20022)** — payment formats, message parsing, mapping, and rail-specific SLA guidance.
- **Regulatory & Compliance SME** — BSA/AML, FFIEC, Wolfsberg, SR 11-7 controls, audit trail, and governance stories.
- **Data Architecture & Database SME** — schema design, Iceberg/Parquet modeling, normalization, retention, and partitioning guidance.
- **Search & OpenSearch SME** — index mappings, relevance tuning, fuzzy matching, and latency targets.
- **Streaming & Messaging Infra SME (Kafka/Flink)** — topic design, exactly-once processing, partitioning, and backpressure handling.
- **Cloud & AWS SME** — environment provisioning, scaling policy, cost guardrails, and AWS service recommendations.
- **Security & Identity SME** — auth flows, secrets management, mTLS, Keycloak/OpenBao, and zero-trust patterns.
- **Case Management & UX SME** — analyst workflows, alert triage UX, case lifecycle, and disposition tracking stories.

These SMEs support the Product Owner and delivery team by turning domain knowledge into actionable backlog items.
