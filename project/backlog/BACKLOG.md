# Shared Backlog

This backlog contains the canonical task list for the AI delivery organisation.

## TASK-0001 — Bootstrap AI delivery organisation

Status: DONE
Priority: High
Owner: Implementation Manager
Requested By: Project Owner
Created: 2026-08-11
Dependencies: None

### Objective
Establish the AI organisation, project memory, backlog, handoff protocols, status reporting, and agent runtime support.

### Context
The repository currently contains only a README and no application source. The first task is to make the repository operational for AI-assisted delivery.

### Acceptance Criteria
- AI delivery directories exist.
- Implementation Manager prompt and documentation are created.
- Shared backlog, handoff template, project state, status dashboard, and risk register exist.
- Agent invocation scripts exist and reference the installed Copilot CLI runtime.
- Bootstrap assessment is created.

### Files / Components
- `/agents/00-implementation-manager/*`
- `/project/backlog/BACKLOG.md`
- `/project/PROJECT_STATE.md`
- `/project/risks/RISK_REGISTER.md`
- `/project/reports/IMPLEMENTATION_STATUS.md`
- `/project/reports/bootstrap-assessment.md`
- `/scripts/agents/run-agent.sh`
- `/project/architecture/agent-operating-model.md`

### Required Reviewers
- Implementation Manager

### Output
Operational AI delivery organisation bootstrap.

### Handoff To
Solution Architect, Business Analyst, UI/UX Designer once bootstrap completes.

### Notes
The repository has no source code yet; future tasks may need to define application scope.

## TASK-0006 — Bootstrap engineering role validation preparation

Status: DONE
Priority: Medium
Owner: Implementation Manager
Requested By: Project Owner
Created: 2026-08-11
Dependencies: TASK-0001, TASK-0002, TASK-0004, TASK-0005

### Objective
Prepare the engineering role validation plan and artifacts so Frontend, Backend, Database, and Integration roles can begin implementation work once the environment supports AI prompt execution.

### Context
Stage 2 depends on stable role definitions and clear handoff criteria from the definition stage.

### Acceptance Criteria
- Engineering role validation tasks are defined in the backlog.
- Required project artifacts for engineering handoffs exist or are referenced.
- The stage plan includes the next validation steps once Copilot runtime is available.
- An engineering readiness report is created.

### Files / Components
- `/project/backlog/BACKLOG.md`
- `/project/architecture/agent-operating-model.md`
- `/project/requirements/REQ-0002-engineering-validation-plan.md`
- `/project/reports/engineering-readiness.md`
- `/project/handoffs`

### Required Reviewers
- Implementation Manager

### Output
A clear Stage 2 preparation plan for engineering roles.

### Handoff To
Frontend Engineer, Backend Engineer, Database Engineer, Integration Engineer

### Notes
This task is process-oriented and can proceed without actual application code.

## TASK-0002 — Bootstrap Business Analyst role

Status: DONE
Priority: High
Owner: Implementation Manager
Requested By: Project Owner
Created: 2026-08-11
Dependencies: TASK-0001

### Objective
Create the Business Analyst operational prompt, supporting files, and validate the role with a sample requirements artifact.

### Context
Stage 1 requires the Business Analyst to convert bootstrap direction into formal requirements and backlog items.

### Acceptance Criteria
- Agent definition files exist under `/agents/01-business-analyst`.
- Requirements documentation is created under `/project/requirements`.
- A handoff document exists from Implementation Manager to Business Analyst.
- Agent runtime invocation is documented.

### Files / Components
- `/agents/01-business-analyst/*`
- `/project/requirements/REQ-0001-bootstrap-scope.md`
- `/project/handoffs/TASK-0001-implementation-manager-to-business-analyst.md`

### Required Reviewers
- Implementation Manager

### Output
Business Analyst role and initial scope documentation.

### Handoff To
Solution Architect, UI/UX Designer

### Notes
This task is complete at the definition/artifact level; runtime smoke testing remains blocked by Copilot model availability.

## TASK-0007 — Diagnose and remediate Copilot runtime

Status: IN_PROGRESS
Priority: High
Owner: Implementation Manager
Requested By: Project Owner
Created: 2026-08-11
Dependencies: TASK-0003

### Objective
Capture the exact Copilot CLI runtime failure mode and identify a remediation path so prompt-based agent execution can resume.

### Context
Agent smoke-testing is blocked by Copilot returning "No supported model available" when attempting non-interactive prompts.

### Acceptance Criteria
- Exact Copilot CLI diagnostic results are documented.
- A clear remediation action or workaround is identified.
- Project readiness reports and status artifacts are updated.
- If necessary, an alternative runtime or environment recommendation is documented.

### Files / Components
- `/project/backlog/BACKLOG.md`
- `/project/reports/codespace-readiness.md`
- `/project/reports/IMPLEMENTATION_STATUS.md`
- `/project/reports/copilot-runtime-diagnosis.md`

### Required Reviewers
- Implementation Manager

### Output
A precise runtime diagnosis and a path to restoring prompt execution.

### Handoff To
Implementation Manager

### Notes
Use the existing Codespace and Copilot logs to determine whether access, account entitlement, or environment configuration is the cause.

## TASK-0008 — HSFS Stage 0 proof task

Status: DONE
Priority: High
Owner: Implementation Manager
Requested By: Project Owner
Created: 2026-08-11
Dependencies: TASK-0001, TASK-0002, TASK-0004, TASK-0005, TASK-0007

### Objective
Create a runnable Stage 0 HSFS proof that validates the agent delivery workflow through a minimal ingest-to-test chain.

### Context
The HSFS product requires a concrete delivery proof before full domain implementation begins. Stage 0 should prove that the agent orchestration and handoff chain can produce a runnable artifact.

### Acceptance Criteria
- A Stage 0 proof requirement is documented under `/project/requirements/REQ-0003-hsfs-stage0-proof.md`.
- Initial HSFS agent roster artifacts exist under `/agents/00-implementation-manager/HSFS-Agent-Roles.md`.
- The implementation plan is visible in the backlog and ready for the next handoff.
- There is a clear walkthrough for how Stage 0 will be executed once prompt runtime is restored.

### Files / Components
- `/project/requirements/REQ-0003-hsfs-stage0-proof.md`
- `/agents/00-implementation-manager/HSFS-Agent-Roles.md`
- `/project/backlog/BACKLOG.md`
- `/project/reports/IMPLEMENTATION_STATUS.md`

### Required Reviewers
- Implementation Manager

### Output
A Stage 0 HSFS proof task that bridges the current bootstrap work to HSFS-specific delivery.

### Handoff To
Product Owner, Solution Architect, QA Engineer

### Notes
This task has been prepared in documentation and artifact form. Execution remains blocked until Copilot runtime model access is restored.

## TASK-0009 — Stage 0 architecture validation and backend implementation planning

Status: Planned
Priority: High
Owner: Backend Engineer
Requested By: Product Owner
Created: 2026-08-11
Dependencies: TASK-0002, TASK-0004, TASK-0005, TASK-0008

### Objective
Validate the Stage 0 architecture and produce the implementation plan and scaffolding for the ingestion, Kafka, screening, and OpenSearch result flow.

### Context
Stage 0 now has a defined story and architecture. The next step is to prepare the backend implementation plan so the proof can be executed once runtime is available.

### Acceptance Criteria
- A Solution Architect handoff exists for the Stage 0 architecture.
- The Backend Engineer has an implementation plan for the toy ingestion and screening path.
- The Stage 0 story and architecture are referenced in the implementation plan.
- QA validation criteria are identified for the OpenSearch screening result.

### Files / Components
- `/project/requirements/REQ-0004-hsfs-stage0-sanctions-screening-story.md`
- `/project/architecture/HSFS-Stage0-Architecture.md`
- `/project/architecture/HSFS-Stage0-Orchestration.md`
- `/project/handoffs/TASK-0009-solution-architect-to-backend-engineer.md`

### Required Reviewers
- Solution Architect
- QA Engineer

### Output
A backend implementation plan and handoff for Stage 0 proof execution.

### Handoff To
Backend Engineer, QA Engineer

### Notes
This task prepares the implementation plan while runtime validation remains blocked.

## TASK-0003 — Resolve Copilot CLI model availability

Status: BLOCKED
Priority: High
Owner: Implementation Manager
Requested By: Project Owner
Created: 2026-08-11
Dependencies: TASK-0001

### Objective
Determine the cause of the Copilot CLI "No supported model available" issue and restore AI prompt execution.

### Context
The repository bootstrap is blocked from smoke-testing AI agent prompts due to Copilot runtime model availability.

### Acceptance Criteria
- The Copilot CLI can execute a simple prompt and return output.
- Agent launch scripts successfully invoke the Business Analyst prompt.
- Documentation records the required remediation steps.

### Files / Components
- `/scripts/agents/run-agent.sh`
- `/project/reports/codespace-readiness.md`
- `/project/reports/IMPLEMENTATION_STATUS.md`

### Required Reviewers
- Implementation Manager

### Output
A resolved Copilot runtime path or documented blocker with next actions.

### Handoff To
Implementation Manager

### Notes
This task requires environment/runtime remediation before smoke tests can proceed.

## TASK-0004 — Bootstrap Solution Architect role

Status: DONE
Priority: High
Owner: Implementation Manager
Requested By: Project Owner
Created: 2026-08-11
Dependencies: TASK-0001, TASK-0002

### Objective
Create the Solution Architect operational prompt, supporting files, and validate the role with an architecture overview and ADR.

### Context
Stage 1 requires the Solution Architect to define system boundaries, interfaces, and key technical decisions.

### Acceptance Criteria
- Agent definition files exist under `/agents/02-solution-architect`.
- A bootstrap architecture overview is created under `/project/architecture`.
- An ADR is recorded under `/project/decisions`.
- A handoff document exists from Business Analyst to Solution Architect.

### Files / Components
- `/agents/02-solution-architect/*`
- `/project/architecture/ARCH-0001-bootstrap-overview.md`
- `/project/decisions/ADR-0001-bootstrap-architecture.md`
- `/project/handoffs/TASK-0002-business-analyst-to-solution-architect.md`

### Required Reviewers
- Implementation Manager

### Output
Solution Architect role and initial bootstrap architecture.

### Handoff To
Frontend Engineer, Backend Engineer, Database Engineer, Integration Engineer

### Notes
This task can proceed with documentation even as AI runtime resolution continues.

## TASK-0010 — Activate autonomous AI shop governance

Status: IN_PROGRESS
Priority: High
Owner: Implementation Manager
Requested By: Product Owner / Client
Created: 2026-08-11
Dependencies: TASK-0001

### Objective
Operationalize the Product Owner autonomous-shop mandate into repo-native requirements, decisions, and append-only operating artifacts.

### Context
The Product Owner has issued an explicit activation requiring self-organizing delivery, continuous learning, strict guardrails, and append-only documentation.

### Acceptance Criteria
- A formal requirement captures the autonomous operating charter.
- A governance ADR records arbitration, approval gates, metrics, and rollback policy.
- Shared append-only docs are established under `/docs`.
- Project state and implementation status include activation and next checkpoints.

### Files / Components
- `/project/requirements/REQ-0005-autonomous-ai-shop-operating-charter.md`
- `/project/decisions/ADR-0002-autonomous-agent-shop-governance.md`
- `/docs/AGENT_OPERATIONS_WIKI.md`
- `/docs/AGENT_CHANGE_LOG.md`
- `/project/backlog/BACKLOG.md`
- `/project/PROJECT_STATE.md`
- `/project/reports/IMPLEMENTATION_STATUS.md`
- `/project/risks/RISK_REGISTER.md`

### Required Reviewers
- Product Owner
- Solution Architect
- Release Manager

### Output
Active autonomous-governance baseline with auditable execution artifacts.

### Handoff To
Solution Architect, Product Owner, Release Manager

### Notes
This task is governance and process activation, not production-system modification.

## TASK-0011 — Implement governance metrics and critic cadence

Status: PLANNED
Priority: High
Owner: Release Manager
Requested By: Implementation Manager
Created: 2026-08-11
Dependencies: TASK-0010

### Objective
Implement recurring metric collection, rotating critic reviews, and cost/resource tracking checkpoints for each implementation increment.

### Context
The governance protocol requires measurable feedback loops and periodic assumption-challenge reviews.

### Acceptance Criteria
- A metric collection checklist is used in release reports.
- Rotating critic assignments are recorded per increment.
- Resource and tool usage anomalies are tracked and flagged.
- Findings are documented in append-only format.

### Files / Components
- `/docs/AGENT_OPERATIONS_WIKI.md`
- `/docs/AGENT_CHANGE_LOG.md`
- `/project/reports/IMPLEMENTATION_STATUS.md`
- `/project/reports/HSFS-Stage0-Implementation-Readiness.md`

### Required Reviewers
- Release Manager
- QA Engineer
- Security and Compliance Engineer

### Output
A measurable governance loop that validates delivery claims.

### Handoff To
Release Manager, QA Engineer, Security and Compliance Engineer

### Notes
Initial implementation can begin with manual checklists before automation.

## TASK-0005 — Bootstrap UI/UX Designer role

Status: DONE
Priority: High
Owner: Implementation Manager
Requested By: Project Owner
Created: 2026-08-11
Dependencies: TASK-0001, TASK-0002

### Objective
Create the UI/UX Designer operational prompt, supporting files, and validate the role with initial UX guidance.

### Context
Stage 1 requires the UI/UX Designer to define user journeys, interaction patterns, and accessibility expectations.

### Acceptance Criteria
- Agent definition files exist under `/agents/03-ui-ux-designer`.
- Initial UX guidance is created under `/project/architecture` or `/project/requirements`.
- A handoff document exists from Business Analyst to UI/UX Designer.

### Files / Components
- `/agents/03-ui-ux-designer/*`
- `/project/architecture/ARCH-0001-bootstrap-overview.md`
- `/project/handoffs/TASK-0003-business-analyst-to-ui-ux-designer.md`

### Required Reviewers
- Implementation Manager

### Output
UI/UX Designer role and UX guidance for the delivery model.

### Handoff To
Frontend Engineer

### Notes
This task can proceed with documentation even as AI runtime resolution continues.
