# ARCH-0001 — Initial Bootstrap Architecture Overview

Status: DRAFT

## Context
The repository currently contains no application source. The initial architecture is focused on creating a reproducible AI delivery and project coordination layer.

## Proposed Architecture
- Implementation Manager: central orchestration and project memory ownership.
- Specialist agents: defined roles with clear domain ownership and handoff protocols.
- Shared project directories: requirements, architecture, decisions, backlog, handoffs, reviews, risks, reports.
- Scripts: agent invocation, bootstrap validation, and agent runner wrappers.

## Component Boundaries
- `/agents`: agent definitions and prompts.
- `/project`: durable project memory, status, and decision artifacts.
- `/scripts`: bootstrap and agent runtime helpers.

## Interfaces
- Agents consume project artifacts in `/project` and update backlog/handoffs accordingly.
- Implementation Manager integrates work and updates `/project/reports` and `/project/PROJECT_STATE.md`.
- Handoff documents facilitate transitions between agents.

## Risks
- The AI runtime is not yet fully validated due to Copilot model availability.
- No application-specific technology stack is defined.

## Next Steps
- Finalise definition-stage agent outputs.
- Resolve the Copilot CLI model availability blocker.
- Add application scaffolding once the project scope is confirmed.
