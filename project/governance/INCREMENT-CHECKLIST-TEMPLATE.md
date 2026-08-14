# Increment Governance Checklist (Template)

Copy this file to `project/governance/INCREMENT-<id>-<YYYY-MM-DD>.md` at the start of each increment.

## Increment Metadata
- Increment ID: INC-XXXX
- Date Started: YYYY-MM-DD
- Date Closed: YYYY-MM-DD
- Primary Agent(s): <roles>
- Task IDs In Scope: <TASK-XXXX, ...>
- Critic Assigned: <role — must not be a primary author of this increment>

---

## Pre-Work Gate (complete before starting implementation)

- [ ] Task objectives and acceptance criteria are documented in BACKLOG.md.
- [ ] All upstream task dependencies are DONE.
- [ ] Requirement traceability established (task → REQ link recorded).
- [ ] Risk register reviewed; new risks identified and added if applicable.
- [ ] Human approval required? [ ] Yes — obtained  [ ] No (reason on record)
- [ ] Rollback plan documented.

---

## Implementation Checklist

- [ ] Code / artifacts created match acceptance criteria.
- [ ] All changed files listed in change log entry.
- [ ] No secrets, credentials, or API keys committed.
- [ ] Dependencies added to manifest (if any new packages introduced).
- [ ] Tests exist or are explicitly deferred with documented rationale.

---

## Metrics Capture

| Metric | Value | Notes |
|---|---|---|
| Test pass rate | - | |
| Deployment success/failure | - | |
| Security findings (critical/high/med/low) | - | |
| New defects introduced | - | |
| Defects closed | - | |
| Mean time to remediate (critical) | - | |
| Agent invocations (estimate) | - | |
| Runtime cost delta | - | |

---

## Rotating Critic Review

Critic Role: <assigned role>
Review Date: YYYY-MM-DD

### Findings
(Append findings here. Critic must challenge at least: assumptions, evidence quality, test adequacy, security posture.)

| # | Area | Finding | Severity | Recommendation |
|---|---|---|---|---|
| 1 | | | | |

### Outcome
- [ ] Approved with no findings.
- [ ] Approved with minor findings (tracked in backlog).
- [ ] Blocked — major findings require resolution before merge/close.

Critic Signature (role): _______________
Date: _______________

---

## Post-Work Gate (complete before marking increment DONE)

- [ ] All acceptance criteria verified.
- [ ] Change log entry appended to `/docs/AGENT_CHANGE_LOG.md`.
- [ ] BACKLOG.md task status updated to DONE.
- [ ] PROJECT_STATE.md and IMPLEMENTATION_STATUS.md updated.
- [ ] Handoff document created if work transitions to another role.
- [ ] Risk register updated with resolved or new risks.
- [ ] Critic review completed and findings tracked.

---

## Rollback Plan

Steps to undo this increment if it must be reverted:
1.
2.
3.

Rollback decision authority: <role or human>
