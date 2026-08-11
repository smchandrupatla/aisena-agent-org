# Agent Operations Wiki (Append-Only)

Status: ACTIVE
Effective Date: 2026-08-11

## Purpose
This wiki defines how the autonomous AI shop operates, logs work, measures outcomes, and escalates only when business judgment is required.

## Operating Commitments
- Product Owner / Client defines the business goal.
- Agent team owns all downstream technical decisions.
- SDLC work is coordinated through explicit handoffs and backlog ownership.
- Significant work is logged in append-only markdown entries.

## Work Entry Template
Copy this section for each meaningful change and append at the end of the appropriate log file.

### Entry Template
- Entry ID: LOG-YYYYMMDD-XXX
- Date: YYYY-MM-DD
- Agent Role: <role>
- Task ID: <task>
- What Changed: <summary>
- Files Changed: <paths>
- Commit / Version Ref: <hash, tag, or pending>
- Rationale: <why>
- Alternatives Considered: <options and trade-offs>
- Risk Impact: <none/low/med/high>
- Metrics Observed: <tests, scans, perf, failure rates>
- Rollback Plan: <steps>
- Human Approval Required: <yes/no and reason>
- Handoff Target: <next role>

## Approval Gates
Human approval is mandatory before any action that:
- Touches production systems.
- Triggers real infrastructure or API spend.
- Changes user-data handling.
- Changes pricing behavior.
- Creates legal or regulatory exposure.

## Conflict Arbitration
1. Attempt direct technical resolution with documented trade-off analysis.
2. Escalate to Solution Architect for architecture-level arbitration.
3. Escalate to Security and Compliance Engineer for policy-risk arbitration.
4. Escalate to Product Owner / Client only for business-risk tolerance decisions.

## Rotating Critic Pattern
- Frequency: At least once per major increment.
- Assignment: A role not directly authoring the increment.
- Objective: Challenge assumptions, spot blind spots, verify evidence quality.
- Output: Append-only critic log entry with findings and recommendations.

## Continuous Learning and Gap Escalation
Each role must:
- Research current best practices before implementation decisions.
- Self-benchmark confidence and capability fit.
- Raise capability gap requests when a specialist is needed.

Gap request format:
- Needed Specialist Role:
- Why Existing Team Is Insufficient:
- Specific Decision or Task Blocked:
- Proposed Scope and Duration:

## Measurable Feedback Loops
Minimum metrics recorded per increment:
- Test pass rate.
- Deployment success/failure.
- Security findings by severity.
- Defect counts and reopen rates.
- Mean time to remediate critical defects.

## Cost and Resource Tracking
Track:
- Agent/tool invocation volume.
- Runtime/resource consumption where available.
- Cloud/resource cost deltas for non-local environments.

Flag thresholds:
- Repeated retries without new signal.
- Unbounded model/tool loops.
- Cost growth without milestone progress.

## Version Pinning and Rollback
Every meaningful change must include:
- Version pinning details.
- Commit reference.
- Verified rollback procedure.

## Clone/Rebuild Intake Mode
When a reference app/site/repo is provided:
1. Document observed functionality, UX flows, architecture clues, and stack signals.
2. Produce a rebuild specification as the working requirement.
3. Continue through normal SDLC with all governance rules active.

## Change Log Rule
This file is append-only. Add dated sections at end; do not rewrite prior entries.

### 2026-08-11 Initial Activation Entry
- Activated autonomous AI shop governance protocol.
- Bound operations to REQ-0005 and ADR-0002.
- Established append-only templates, gates, and arbitration.
