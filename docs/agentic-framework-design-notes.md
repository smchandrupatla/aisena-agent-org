# Agentic Framework Design Notes

**Date:** 2026-09-06  
**Status:** In progress — living document capturing our conversation on building agentic frameworks focused on team collaboration, not just scaling individual agents.

---

## Core Principle

Stop designing agents as isolated workers. Design them as a **team** around a **shared workspace**.

The workspace is the product. The agents are roles around it.

Coordination should emerge from shared state, not from direct agent-to-agent chatter. Direct messaging creates spaghetti that breaks at scale.

---

## Design Idea 1: Blackboard Architecture

One shared state object that every agent reads and writes:
- Task board
- Scratchpad
- Artifacts (briefs, findings, decisions, code, docs)

Agents post findings, claim tasks, leave notes. No agent talks directly to another.

**Why it works:** Coordination is visible, auditable, and replaceable. You can inspect the board to understand what the team knows and where it is stuck.

**Implementation notes:**
- Use a structured schema for the board (JSON or typed objects).
- Version or timestamp entries so agents can detect stale information.
- Allow agents to subscribe to changes or poll for relevant updates.

---

## Design Idea 2: Roles with Explicit Contracts

Each agent has a defined:
- **Input** — what it consumes from the board or prior artifacts
- **Output** — what it produces (typed, validated)
- **Authority boundary** — what it is allowed to decide vs. what it must escalate

Example roles:
- Researcher agent → produces a brief
- Critic agent → can only flag problems, cannot rewrite
- Synthesizer agent → merges inputs into a coherent output

**Why it works:** Contracts make agents composable. Swap a researcher for a better one without rewriting the team. Contracts also make failures diagnosable — you know exactly which contract was violated.

**Implementation notes:**
- Define contracts as schemas or interfaces.
- Validate outputs against the contract before they land on the board.
- Keep authority boundaries narrow to reduce drift.

---

## Design Idea 3: Lightweight Supervisor (Not a Puppet Master)

The supervisor:
- Assigns work based on contracts and current board state
- Checks results against the contract
- Escalates when something fails or is ambiguous
- Does **not** do the thinking for the agents

Think project lead, not micromanager.

**Why it works:** Agents retain autonomy for actual reasoning. The supervisor keeps the process honest without becoming a bottleneck.

**Implementation notes:**
- Supervisor should be cheap and fast (rules + light LLM, not heavy reasoning).
- It should track progress, not re-decide every step.
- It should have a clear escalation path to a human when needed.

---

## Failure Modes to Design For

Agents will:
- Drift from their contract
- Contradict each other
- Loop or get stuck
- Produce plausible but wrong output

Required safeguards:
- **Timeouts** on tasks and agent turns
- **Conflict resolution rules** (e.g., critic wins on safety, synthesizer wins on merge, human wins on ambiguity)
- **Stuck detection** — monitor for repeated similar outputs, no progress on the board, or circular dependencies
- **Validation gates** — outputs must pass schema + contract checks before being accepted
- **Audit trail** — every board write is logged with agent, timestamp, and rationale

---

## Open Questions / To Explore

- How to represent the shared workspace efficiently (in-memory, DB, event log, vector store)?
- How to handle long-running tasks and partial results?
- How to scale the number of agents without overwhelming the board?
- How to give agents memory of past team decisions without bloating context?
- Concrete example: pick a real workflow and map roles + contracts + board schema.

---

## Next Steps in This Conversation

1. Deep dive into one or more of the three design ideas.
2. Sketch a concrete example (roles, contracts, board schema, supervisor logic).
3. Identify the minimal viable implementation to test the ideas.

---

*This file is updated as we continue the discussion.*