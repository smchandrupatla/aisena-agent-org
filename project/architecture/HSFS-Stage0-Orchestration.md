# HSFS Stage 0 Orchestration

## Purpose
Describe the Stage 0 orchestration model and how the HSFS proof-of-concept flows through the agent delivery chain.

## Stage 0 Goal
Prove a trivial, runnable data pipeline from a sample input through ingestion, basic sanctions screening, Kafka event streaming, and storage/indexing, with every role producing a concrete output.

## Involved Agents
- Implementation Manager
- Product Owner
- Solution Architect
- Backend Engineer — Ingestion & Streaming
- QA Engineer
- Release Manager
- Sanctions Screening SME

## Agent Handoff Flow
1. Implementation Manager defines the Stage 0 proof and creates the agent roles.
2. Product Owner sequences the Stage 0 story and backlog.
3. Solution Architect validates the minimal architecture and interface contracts.
4. Backend Engineer implements the toy ingestion, Kafka topic, and screening output path.
5. QA Engineer defines and executes validation checks for the minimal flow.
6. Release Manager confirms readiness and documents how to run the proof.
7. Sanctions Screening SME provides the domain story, sample data, and acceptance criteria.

## Files and Shared Context
- `/project/backlog/BACKLOG.md` — Stage 0 tasks and status.
- `/project/requirements/REQ-0003-hsfs-stage0-proof.md` — Stage 0 proof requirement.
- `/project/requirements/REQ-0004-hsfs-stage0-sanctions-screening-story.md` — Stage 0 story and sample data.
- `/project/architecture/HSFS-Stage0-Orchestration.md` — this orchestration definition.
- `/project/handoffs` — handoff artifacts for every role transition.
- `/project/reports/IMPLEMENTATION_STATUS.md` — progress and status reporting.

## Execution Commands
Once Copilot runtime is available, the Stage 0 chain can be started with these scripts:
- `scripts/agents/run-agent.sh 00-implementation-manager`
- `scripts/agents/run-business-analyst.sh`
- `scripts/agents/run-solution-architect.sh`
- `scripts/agents/run-04-frontend-engineer.sh`
- `scripts/agents/run-05-backend-engineer.sh`
- `scripts/agents/run-10-qa-engineer.sh`
- `scripts/agents/run-13-release-manager.sh`

## Notes
- This orchestration document captures the planned handoff chain and the expected outputs for Stage 0.
- The actual runtime is currently blocked by Copilot model availability, so the commands are present as the execution path once the environment is restored.
- The orchestration is intentionally lightweight and file-based to keep the process reviewable and reproducible.
