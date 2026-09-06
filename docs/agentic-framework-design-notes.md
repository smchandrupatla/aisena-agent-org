# Agentic Framework Design Notes

**Date:** 2026-09-06  
**Status:** In progress — living document capturing our conversation on building agentic frameworks focused on team collaboration, not just scaling individual agents.

---

## Core Principle

Stop designing agents as isolated workers. Design them as a **team** around a **shared workspace**.

The workspace is the product. The agents are roles around it.

Coordination should emerge from shared state, not from direct agent-to-agent chatter. Direct messaging creates spaghetti that breaks at scale.

---

## Agentic Coordination Models

An **agentic coordination model** is the pattern that defines *how* agents work together on an implementation task — the rules of their interaction, not the agents themselves. The agents are the actors; the model is the game they play. This keeps the design composable: swap agents in and out, but the coordination model stays.

Four models are under consideration.

---

### Model 1: Scrivener Model (Blackboard / Whiteboard Approach)

**Named after:** the medieval clerk who sat in the corner of the room and wrote everything down while the others talked. No one spoke to each other; the scrivener recorded it all, and anyone who needed to know read the record.

**Core idea:** Agents do not interact with each other at all. Everything is written to a shared board. The board is the only medium of exchange.

**How it works:**
- One shared state object — the board — that every agent reads and writes.
- Agents post findings, claim tasks, leave notes, publish artifacts.
- No agent sends a message to another agent. Coordination is entirely through the board.

**Board structure (three layers):**
1. **Task queue** — claimed and unclaimed work items.
2. **Scratchpad** — findings, notes, intermediate reasoning.
3. **Artifact store** — finished, typed outputs (briefs, code, docs, decisions).

Each entry carries a timestamp, an author (which agent wrote it), and a version, so agents can tell what is fresh and what is stale.

**Why it works:** Coordination is visible, auditable, and replaceable. You can inspect the board at any moment to understand what the team knows and where it is stuck. Agents are fully decoupled — a better researcher can replace a weaker one without touching anyone else.

**Failure modes:**
- Board becomes a bottleneck or a dumping ground of noise.
- Agents write conflicting or contradictory entries with no one to reconcile them.
- Stale entries mislead agents that read them later.

**Safeguards:**
- Versioning and timestamps on every entry.
- Conflict-resolution rules (e.g., a critic entry supersedes a researcher entry on the same claim).
- Garbage collection or archival of resolved/stale entries.
- Optional event log so the full history can be replayed.

**Open design choice:** simple structured JSON object vs. a richer event log that replays history. The event log is more powerful for audit and debugging but heavier to query.

---

### Model 2: Relay Model

**Core idea:** Agents pass work hand to hand, like a baton in a relay race. Agent A finishes its piece, hands the artifact to Agent B, which picks it up and continues.

**How it works:**
- Work flows in a defined sequence: research → draft → review → finalize.
- Each agent receives the previous agent's output as its input.
- The handoff is explicit — the artifact is passed, not shared.

**Why it works:** Clean and simple for linear pipelines. Easy to reason about, easy to debug (follow the chain), and each agent has a clear, narrow job.

**Failure modes:**
- Brittle — a failure anywhere stalls the entire chain.
- No parallelism; throughput is limited by the slowest agent.
- Errors compound silently down the chain if not caught at each hop.
- Hard to insert a new step or reorder without rewriting the pipeline.

**Safeguards:**
- Validation gate at every handoff (output must pass schema + contract checks before being accepted by the next agent).
- Timeouts on each hop so a stuck agent does not block forever.
- Retry or fallback agent for a failed hop.
- Optional checkpointing so a failed chain can resume from the last good artifact.

**Best fit:** Sequential workflows where order is mandatory and parallelism adds no value — e.g., code generation followed by review followed by deployment.

---

### Model 3: Council Model

**Core idea:** Agents work in parallel on the same problem, then vote or debate to converge on one answer. Strength in numbers and diversity of reasoning.

**How it works:**
- Multiple agents (or the same agent with different prompts/seeds) tackle the task independently.
- Their outputs are collected and compared.
- Convergence happens through voting, weighted scoring, or structured debate.
- A tie-breaker rule resolves deadlocks.

**Why it works:** Strong for judgment calls and hard problems where no single agent is reliable. Diversity of reasoning surfaces blind spots that one agent would miss. The final answer is more robust than any individual contribution.

**Failure modes:**
- Expensive — N agents doing the same work costs N times the compute.
- Slow — you wait for the slowest participant plus the convergence step.
- Groupthink if agents share similar training or prompts; the council adds no real diversity.
- Debate can loop without converging if the tie-breaker is weak.

**Safeguards:**
- Diversity requirement: agents must differ in model, prompt, or perspective.
- Hard cap on debate rounds to prevent infinite loops.
- A designated tie-breaker (a stronger model, a human, or a deterministic rule).
- Cost budget per council session.

**Best fit:** High-stakes decisions, ambiguous requirements, or quality-critical outputs where a single agent's answer is not trustworthy enough — e.g., architecture review, security assessment, or final go/no-go on a release.

---

### Model 4: Market Model

**Core idea:** Agents bid on tasks. The best-suited agent claims the work and is "paid" in an internal currency. Supply and demand balance the team automatically.

**How it works:**
- Tasks are posted with a description, required skills, and a budget (in internal credits).
- Agents evaluate the task against their own capabilities and bid.
- The highest-value or lowest-cost bid wins the claim.
- Completed work earns credits, which fund future bids.
- Idle or underperforming agents naturally receive less work.

**Why it works:** Scales beautifully and self-balances. No central scheduler needed. Agents specialize organically because specialization earns more. The system adapts to changing workloads without reconfiguration.

**Failure modes:**
- Pricing logic is hard to get right — too cheap and important work goes unclaimed; too expensive and the budget burns.
- Quiet but critical tasks (monitoring, cleanup, documentation) get starved because they pay poorly.
- Agents may game the system — overbid, underdeliver, or hoard credits.
- Requires a trusted accounting layer; a bug in the ledger corrupts the whole economy.

**Safeguards:**
- Reserve prices or subsidies for essential but unglamorous tasks.
- Reputation scoring layered on top of bids (past delivery quality affects future win rates).
- Audit of the ledger and anti-gaming rules (e.g., penalty for abandoned claims).
- Human override to force-assign work the market neglects.

**Best fit:** Large, heterogeneous teams with many task types and dynamic workloads — e.g., a platform org where dozens of agents handle tickets, incidents, refactors, and research in parallel.

---

## Comparison at a Glance

| Model | Coordination style | Strength | Weakness | Best for |
|---|---|---|---|---|
| **Scrivener** | Shared board, no direct talk | Auditable, decoupled, inspectable | Board can become noisy | Most general-purpose team work |
| **Relay** | Sequential handoff | Simple, easy to debug | Brittle, no parallelism | Linear pipelines |
| **Council** | Parallel + vote/debate | Robust on hard judgments | Expensive, slow | High-stakes decisions |
| **Market** | Bid and claim | Self-balancing, scales | Pricing complexity, starvation risk | Large dynamic teams |

Models can also be **composed**: a Scrivener board can host Relay pipelines as sub-tasks, a Council can sit on top of a Scrivener board to resolve conflicts, and a Market can allocate which Scrivener board an agent joins. The models are building blocks, not mutually exclusive choices.

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

## Do Agents Need LLMs?

No. An LLM is just one possible brain. The coordination models are brain-agnostic: an agent can be a rules engine, a classical planner, a retrieval system, or a human in the loop.

The LLM earns its place where the work is fuzzy — language, judgment, open-ended reasoning. For deterministic steps like parsing a file or running a calculation, a plain function is cheaper, faster, and more reliable.

**Design principle:** Put the LLM only where uncertainty lives, and keep the rest as ordinary code.

---

## Capabilities of Non-LLM Agents

Without an LLM, an agent is a **deterministic worker** — it needs a fixed set of capabilities it can execute reliably.

Core capabilities:
- A task parser that reads structured input
- A tool executor that calls APIs or runs code
- A state reader and writer for the shared board
- A rule-based decision engine that picks the next action from a defined set of options

Beyond that:
- Validation — checking outputs against a schema before writing them
- Error handling that knows how to retry, escalate, or mark a task failed

These non-LLM agents are often the most reliable members of the team, because they never hallucinate. They just do exactly what they're told, every time.

---

## Inner Working of a Non-LLM Agent

The loop is a fixed cycle: read the board, match a task to your capabilities, execute it, validate the output, write the result back.

Concretely — the agent wakes up, scans the task queue for anything matching its role, picks one, and runs a deterministic function against it. Say it's a data-extraction agent: it takes a file path, calls a parser, checks the output against a schema, and if it passes, posts the structured result to the artifact store with its signature.

No reasoning step in the middle. The "decision" is just pattern matching — if task type equals X and my capability covers X, do X. If not, skip it.

The only branching is error handling: validation fails, retry once, then mark the task failed and move on. Everything else is straight-line code.

The agent is just a program with a **trigger** — something wakes it, it runs, it exits. No thinking, no conversation, no inner monologue.

The trigger is usually an event: a new task appears on the board, a timer fires, or another agent's write completes. The agent subscribes to those events, wakes, does its one job, writes the result, and goes back to sleep.

So the "inner working" is really three pieces of plumbing: an event listener, a function that does the work, and a writer that posts the result. The agent never asks "what should I do" — the event already told it.

---

## The Hard Boundary: Non-LLM Agents Cannot Create

A non-LLM agent is a **deterministic executor**, not a creator. It can run a recipe perfectly, but it can't write the recipe.

Example: ask it to build a website.
- With templates: it matches the request to a template, fills slots, runs a build, validates, posts. You get a cookie-cutter site — a landing page, a blog, a form — but nothing original.
- Without templates, no internet, no LLM: it has no source of content, no design decisions, no code to emit. The only websites it could produce are ones baked into its own code at build time — a hardcoded page it ships with.
- Ask it to build something new and it has nothing to work with.

**Build time** is the moment the agent's code gets compiled or packaged — before it ever runs. Whatever you write into the source files then becomes the only behavior it can ever have. "Baked in at build time" means the website lives inside the agent's own code: a string of HTML, a function that returns a page, a template file shipped alongside it. The agent doesn't create it at runtime — it just serves or assembles what was already there when it was built. Change the website later and you have to rebuild and redeploy the agent. It can't learn, adapt, or invent anything new on its own.

---

## Cost Control: LLM Spend Is Not Free

LLMs cost money per call. The main lever is **routing** — only call the LLM when the task actually needs judgment, and use cheap deterministic code everywhere else. A non-LLM agent doing parsing or validation costs you nothing per call.

Other levers:
- **Cache** LLM outputs so repeated questions don't re-spend
- Use **smaller or quantized models** for routine steps
- **Batch** work so one call handles many items
- **Self-host open models** (Llama, Mistral) to kill the per-token cost entirely if you have the hardware

The design principle stays the same — LLM only where uncertainty lives, code everywhere else.

---

## Deployment Tiers: Where the Model Runs

A second classification axis: where the model is built and runs. Three tiers:

1. **Cloud API** — pay per token, zero ops, but your data leaves the building. The default.
2. **Self-hosted open model** — models like Llama or Mistral run on your own GPUs. Kills the per-token cost and keeps data local, but you need hardware and someone to run them.
3. **Edge** — tiny quantized models on the device itself. Near-zero latency, capped at small capabilities.

**The interesting design move is hybrid:** a small local model handles classification and routing, and only escalates to a big cloud model when the task genuinely needs it. That keeps most of your spend near zero while preserving quality where it matters.

This hybrid split also maps cleanly onto the coordination models — the local classifier can decide which coordination model a task needs before any expensive model ever wakes up.

---

## Closed-World Agents: A Fifth Coordination Model

A distinct model of building agents with **no LLM dependency at all**. The agent is fully capable of its assigned tasks using only capabilities baked in at build time. It does exactly what it is told and nothing more.

**Core idea:** Closed-world capability. The agent ships with a complete, frozen skill set. Its entire job is executing that set perfectly. Nothing is learned at runtime, nothing is fetched, nothing is improvised.

**What you hand it on day one:**
- A **capability manifest** — every task type it can handle, with the exact input schema and output schema for each. If a task doesn't match a manifest entry, the agent rejects it rather than guessing.
- A **tool registry** — the concrete functions it can call: parsers, validators, API clients, build scripts. Each tool is versioned and pinned, so behavior never drifts.
- **Decision rules** — a deterministic mapping from task type to tool sequence. No branching on judgment, only on data shape.
- **Validation gates** — every output checked against its schema before it's written anywhere. Fail closed: invalid output is an error, not a best guess.
- **Error contracts** — what to do on failure: retry count, fallback path, escalation target. All pre-declared.

**The hard part is the manifest.** You have to enumerate every task the agent will ever face, which means the problem domain has to be stable and well-understood. That's why this works for CI/CD and testing but not for design work — you can't enumerate "write a good feature" the way you can enumerate "run the test suite."

**The trap:** the manifest is a liability, not just a spec. Every task type you enumerate is a promise you have to keep forever — change the domain, and you're rebuilding the agent, not patching it. That's why these agents belong in stable, well-bounded domains. The moment the problem space moves, the closed-world assumption breaks and you're back to needing an LLM.

**Security angle:** Predictability is the whole point. An agent that only does what it's told never surprises you, never drifts, never takes an action you didn't authorize. A closed-world agent can't be prompt-injected into doing something outside its manifest, because there's no reasoning path to exploit. The attack surface shrinks to the manifest itself.

**The cost:** brittleness — it fails loudly instead of adapting. But in a team design, that's fine: the LLM agents handle the fuzzy edges, and these agents hold the line on the deterministic core.

**Is it positive or negative?** Positive — and it's a feature, not a bug. People often want agents to do exactly what they are capable of rather than doing additional thinking. That reliability and scope discipline is beneficial, especially for security-sensitive or compliance-heavy work.

---

## Retrieval-Grounded Agents (Book-Style Example)

Yes — a closed-world agent can be built to stick strictly to provided sources (e.g., a book) rather than inventing new things. This is a **retrieval-grounded** agent, one of the strongest use cases for the closed-world model.

The book becomes the agent's entire world: it reads from it, answers from it, and has no generative path to invent anything.

**How to wire it:**
- The agent doesn't "know" the book — it searches it at query time, pulls the relevant passage, and responds only from that passage.
- If the answer isn't in the book, it says so instead of filling the gap.
- This is safer than an LLM with the book stuffed into its context, because an LLM can still hallucinate even when grounded. A closed-world agent with retrieval has no mechanism to invent — it can only return what it found.

**Sources timing:**
- **Bake sources in at build time** → frozen specialist. The book is part of the binary, never changes, fully self-contained with zero runtime dependencies.
- **Feed sources at query time** → generalist that stays current. Swap the book, update the knowledge, no rebuild. Tradeoff: a runtime dependency on wherever the sources live, and that access must be reliable.
- For a book-grounded agent, lean build-time if content is stable, query-time if it isn't.

---

## Sealed Agent Unit (Closed Group)

A **closed group** means the sources are part of the agent's own package — the book, the manifest, the tools, all shipped together as one unit. Nothing external to reach for, nothing to fail at runtime.

The whole agent is one sealed unit: code, skills, and knowledge bundled at build time, so it runs identically on any machine with no network, no database, no external service.

**Real payoff: portability.** You can ship it to an air-gapped server, a customer site, or a device with no internet, and it behaves exactly the same. The sealed unit is also easier to audit: everything it can ever do is in the package, so there's no hidden behavior waiting to surprise you.

---

## Web Portal Interaction Without LLM

Yes — the portal is just a web UI talking to the agent over a local API. The agent runs as a service on your machine or server, the browser sends a request, the agent executes its manifest, and returns the result. No LLM in the chain at all.

- The UI itself can be static HTML and JavaScript — a form for the question, a display for the answer.
- The only moving part is the agent process behind it, which is fully deterministic.
- If the agent needs to stream long answers or handle many concurrent users, use a small web framework like FastAPI or Flask in front of it. But that's ordinary code, not intelligence.

**Summary of the proposal:** We can build agents without depending on LLMs, which work as an agent-as-a-service on the local machine without even an internet connection, with all the intelligence baked in. This is a self-contained agent service — intelligence baked in at build time, running locally with zero external dependencies.

**The one caveat:** "intelligence" here means **encoded capability**, not learned understanding. It does exactly what you programmed, perfectly, and nothing more. That's the trade — reliability for flexibility.

---

## Open Questions / To Explore

- How to represent the shared workspace efficiently (in-memory, DB, event log, vector store)?
- How to handle long-running tasks and partial results?
- How to scale the number of agents without overwhelming the board?
- How to give agents memory of past team decisions without bloating context?
- Concrete example: pick a real workflow and map roles + contracts + board schema.
- Which coordination model (or composition of models) fits the AISENA agent org best?
- How to operationalize the hybrid routing layer (what does the local classifier look like)?
- How to version and migrate closed-world manifests when the domain evolves?
- How to compose sealed agents with LLM agents in the same Scrivener board?

---

## Next Steps in This Conversation

1. Pick a coordination model (or composition) and sketch a concrete workflow mapped onto it.
2. Define roles, contracts, and a board schema for that workflow.
3. Identify the minimal viable implementation to test the ideas.
4. Prototype a sealed non-LLM agent with a web portal for a stable domain (e.g., document Q&A from a fixed book).

---

*This file is updated as we continue the discussion.*