# ADR-0001 — Bootstrap Architecture and AI Delivery Operating Model

Status: ACCEPTED
Date: 2026-08-11
Owner: Implementation Manager

## Context
This repository currently contains only a `README.md`. The first objective is to bootstrap an AI-assisted software delivery organisation, not to implement a specific product.

## Decision
The repository will adopt an AI delivery operating model with an Implementation Manager and thirteen specialist agents.

## Alternatives Considered
- Starting product implementation immediately without a delivery framework.
- Using a single monolithic AI prompt instead of distinct specialist agents.

## Rationale
- A structured delivery model ensures clear ownership, traceability, and agent collaboration.
- The specialist roles align with the expected lifecycle of requirements, architecture, implementation, assurance, documentation, and release.
- This approach reduces the risk of fragmented or inconsistent AI contributions.

## Consequences
- The repository will contain significant process and coordination artifacts before application code.
- Early work focuses on operating model, project memory, and runtime validation.
- Agent runtime availability becomes a gating factor for smoke testing.

## Risks
- The current AI runtime is unavailable due to "No supported model available" from the Copilot CLI.
- The model must remain flexible if the eventual technology stack changes.
