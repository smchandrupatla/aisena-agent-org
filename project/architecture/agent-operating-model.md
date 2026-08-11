# Agent Operating Model

This document describes the AI agent workflow for the repository.

## Workflow

- Project Owner provides direction to the Implementation Manager.
- Implementation Manager assesses the request and routes it to the correct specialist(s).
- Definition roles (Business Analyst, Solution Architect, UI/UX Designer) work in parallel for discovery, requirements, architecture, and design.
- Engineering roles (Frontend, Backend, Database, Integration) implement features after definition artifacts are available.
- Platform and assurance roles (DevOps, Security, QA, Performance) validate and secure the solution.
- Completion roles (Documentation, Release Management) finalize readiness and release support.
- Implementation Manager integrates outputs, maintains project memory, and reports status.

## Agent relationships

- `Business Analyst` provides requirements and user stories.
- `Solution Architect` provides system architecture, interfaces and ADRs.
- `UI/UX Designer` provides user journeys, interaction expectations, and accessibility guidance.
- `Frontend Engineer` consumes requirements, design, and API contracts.
- `Backend Engineer` consumes architecture and business rules.
- `Database Engineer` defines persistence and schema.
- `Integration Engineer` validates external/internal API contracts.
- `DevOps Engineer` creates environment and CI/CD automation.
- `Security Engineer` audits code, dependencies, and configuration.
- `QA Engineer` creates and validates test coverage.
- `Performance Engineer` tests reliability and load assumptions.
- `Documentation Engineer` records implementation and operational details.
- `Release Manager` validates readiness, release criteria, and rollback planning.

## Parallel work guidance

- Business Analyst, Solution Architect, and UI/UX Designer may begin discovery concurrently.
- Frontend, Backend, Database, and Integration may work in parallel once contracts are stable.
- DevOps, Security, QA, and Performance may work alongside engineering with clearly defined boundaries.

## Handoff protocol

- Every meaningful transition should use `/project/handoffs/<task-id>-<from>-to-<to>.md`.
- Handoffs must include objective, files changed, decisions made, and required next action.

## Status reporting

- Use `/project/reports/IMPLEMENTATION_STATUS.md` for team and milestone visibility.
- Update the status dashboard after each completed stage and major task.
