# Agent Operations Wiki (Append-Only)

Status: ACTIVE  
Effective Date: 2026-08-11  
**Superseding governance:** `docs/AI_SENA_OPERATING_INSTRUCTIONS.md` (adopted 2026-08-27)  
**Agent coding rules:** `docs/DEVELOPMENT_PRACTICES_AGENT.md`  
**Entry point:** `AGENTS.md`

## Purpose
This wiki defines how the autonomous AI shop operates, logs work, measures outcomes, and escalates only when business judgment is required. It implements day-to-day mechanics for the AI Sena Operating Instructions.

## Operating Commitments
- Product Owner / Client defines the business goal.
- Agent team owns downstream technical decisions **within** approved scope; self-initiated work needs explicit approval before implementation.
- SDLC work is coordinated through explicit handoffs and backlog ownership.
- Significant work is logged in append-only markdown entries (`docs/AGENT_CHANGE_LOG.md`).
- Continuous integration only — **never** continuous deployment. Human go-ahead before live.
- Every change is risk-tagged Low / Medium / High. **Medium and High always require explicit human review** before live, regardless of test results.

## Work Entry Template
Copy this section for each meaningful change and append at the end of `docs/AGENT_CHANGE_LOG.md`.

### Entry Template
- Entry ID: LOG-YYYYMMDD-XXX
- Date: YYYY-MM-DD
- Agent Role: <role>
- Task ID: <task>
- Source: <product-owner | self-initiated (approval ref)>
- What Changed: <summary>
- Plain-language (non-dev): what changed, why, how to see/verify in the UI
- Files Changed: <paths>
- Commit / Version Ref: <hash, tag, or pending>
- Rationale: <why>
- Alternatives Considered: <options and trade-offs>
- Risk Level: <Low | Medium | High>
- Metrics Observed: <tests, scans, perf, failure rates>
- Regression suite run: <yes/no; command or CI link; result>
- Rollback Plan: <steps>
- Human Approval Required: <yes/no and reason>
- Handoff Target: <next role>

## Change Pipeline (no exceptions)
1. Implementation  
2. Full test suite  
3. Regression testing  
4. Marked ready only after passing all tests  
5. Final human go-ahead before touching the live application  

Do not mark a task complete if regression was not run unless the failure is explicitly flagged as blocking.

## Approval Gates
Human approval is mandatory before any action that:
- Touches production systems.
- Triggers real infrastructure or API spend.
- Changes user-data handling.
- Changes pricing behavior.
- Creates legal or regulatory exposure.
- Is **Medium or High** risk (in addition to the above).
- Implements a **self-initiated** improvement (approval before coding starts).

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
This file is append-only for historical activation notes. Prefer operational entries in `docs/AGENT_CHANGE_LOG.md`. Add dated sections at end; do not rewrite prior entries.

### 2026-08-11 Initial Activation Entry
- Activated autonomous AI shop governance protocol.
- Bound operations to REQ-0005 and ADR-0002.
- Established append-only templates, gates, and arbitration.

### 2026-08-27 Operating Instructions Adoption
- Adopted `docs/AI_SENA_OPERATING_INSTRUCTIONS.md` as canonical charter.
- Added `docs/DEVELOPMENT_PRACTICES_AGENT.md`, `docs/OPERATING_INSTRUCTIONS_COMPLIANCE.md`, and root `AGENTS.md`.
- Tightened change pipeline, risk review, self-initiated approval, and plain-language UI verification requirements in this wiki.
