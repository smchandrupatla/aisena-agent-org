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

Yes — a closed-world agent can be built to stick strictly to provided sources (e.g., a book) rather than inventing new things. This is a **retrieval-grounded** agent. The book becomes the agent's entire world: it reads from it, answers from it, and has no generative path to invent anything.

The key is how you wire it. The agent doesn't "know" the book — it searches it at query time, pulls the relevant passage, and responds only from that passage. If the answer isn't in the book, it says so instead of filling the gap.

That's actually safer than an LLM with the book stuffed into its context, because an LLM can still hallucinate even when grounded. A closed-world agent with retrieval has no mechanism to invent — it can only return what it found.

---

## Sources: Build-Time vs. Query-Time

Both work, but they give you different agents. Bake the sources in at build time and you get a frozen specialist — the book is part of the binary, it never changes, and the agent is fully self-contained with zero runtime dependencies.

Feed them at query time and you get a generalist that stays current — swap the book, update the knowledge, no rebuild. The tradeoff is a runtime dependency: the agent needs access to wherever the sources live, and that access has to be reliable.

For a book-grounded agent, I'd lean build-time if the content is stable, query-time if it isn't.

---

## Sealed Unit: The Closed Group

A closed group means the sources are part of the agent's own package — the book, the manifest, the tools, all shipped together as one unit. Nothing external to reach for, nothing to fail at runtime. The whole agent is one sealed unit: code, skills, and knowledge bundled at build time, so it runs identically on any machine with no network, no database, no external service.

That's the real payoff — **portability**. You can ship it to an air-gapped server, a customer site, or a device with no internet, and it behaves exactly the same. The sealed unit is also easier to audit: everything it can ever do is in the package, so there's no hidden behavior waiting to surprise you.

---

## Running as a Local Service

Run it as a local web server — the agent is just a Python process listening on localhost. FastAPI or Flask wraps the manifest and retrieval layer, you start it with one command, and your browser hits it at a local address like localhost colon eight thousand.

For something that survives reboots, wrap it as a background service — on Mac that's launchd, on Windows a scheduled task or NSSM. The whole thing runs offline, no cloud, no API keys, just your laptop and the baked-in catalog.

---

## Docker Packaging

Yes — Docker is actually the natural home for a sealed agent. You bake the catalog, the manifest, and the code into one image, and it runs identically on any machine with Docker installed.

That gives you the portability we talked about earlier, plus easy versioning: ship a new image when the catalog updates, roll back by reverting the image tag.

---

## VS Code Development

Open VS Code, install the **Dev Containers** extension, and point it at your Dockerfile — VS Code then opens the project inside the container, so your editor, terminal, and debugger all run against the same environment the agent ships in.

From there it's standard: a Python virtualenv or the container's own Python, a requirements file for FastAPI and your retrieval library, and a launch config so you can hit F5 and debug the agent locally. The catalog and manifest live in the repo, so everything the agent needs is version-controlled alongside the code.

---

## The Prompt as a Spec

That prompt is really a **spec** — the more precise it is, the less the model has to guess. Spell out the refusal rules, the citation format, and the exact task types in the prompt, or the model will fill gaps with assumptions you didn't intend.

---

## ISO 20022 SME: Concrete Example

A closed-world agent service named **ISO 20022 SME** answers questions about the ISO 20022 catalog only, citing the exact clause for every answer, and refusing anything not found in the catalog.

The ISO catalog becomes the sealed knowledge base. The manifest covers question types like "what does clause X require" or "compare standard A and B," and retrieval pulls the exact passage before answering.

The one thing to get right: the retrieval has to be precise. ISO standards are dense and cross-referenced, so a fuzzy search that returns the wrong clause will give you a confident wrong answer. Index by clause number, not just keywords, and make the agent cite the exact clause it pulled from — so you can verify every answer against the source in seconds.

---

## Value-Added Services Beyond Chat

Beyond chat, the strongest add-ons are **compliance checking** — paste in a message or mapping spec and the agent flags which ISO 20022 rules it violates — and **cross-standard comparison**, lining up two versions or two message types side by side with clause citations.

A few more worth building in:

- **Gap analysis** — feed it your current implementation, it returns a checklist of missing requirements against the catalog.
- **Clause lookup API** — a machine endpoint other tools can call, not just a human portal.
- **Change tracking** — when you update the catalog, the agent diffs the new version and reports what changed and what breaks downstream.
- **Export** — answers and compliance reports as PDF or structured JSON for audit trails.
- **Schema conversion** — convert the provided XSD definitions into JSON Schema on demand. The conversion is a deterministic transform — XSD types map to JSON Schema types, restrictions become constraints, and the agent runs a fixed function with no LLM. No second copy of the schema is stored; it is generated from the catalog at request time. Also support exporting the original XML alongside the generated JSON Schema so the user can compare both views.

The pattern is the same everywhere: the catalog is the source of truth, and every service is just a different way of querying it.

---

## Schema Conversion Service (XSD to JSON Schema)

Beyond chat and compliance, the agent offers a **schema conversion** service: given an XSD definition from the catalog, it produces the equivalent JSON Schema.

**Why it fits the closed-world model:** The conversion is fully deterministic. XSD constructs map to JSON Schema constructs through a fixed rule table — `xs:string` to `string`, `xs:decimal` to `number` with constraints, `xs:enumeration` to `enum`, `xs:complexType` to `object` with `properties`, and so on. No judgment, no generation, no LLM. The agent simply runs the transform and returns the result.

**Design rules:**
- The XSD is the single source of truth; JSON Schema is derived, never stored separately.
- Every generated schema is validated against the JSON Schema meta-schema before being returned.
- The original XML and the generated JSON Schema are both exportable, so the user can inspect both views side by side.
- Fail closed: if a construct has no defined mapping, the agent reports it rather than guessing.

**Value:** Teams building APIs or data pipelines on top of ISO 20022 message definitions get a machine-readable JSON Schema without maintaining a parallel artifact that can drift out of sync with the standard.

---

## Builder Prompt: ISO 20022 SME Closed-World Agent Service

Paste this into VS Code chat to have the builder create the full service:

> Build a closed-world agent service named **ISO 20022 SME**. It answers questions about the ISO 20022 catalog only, citing the exact clause for every answer, and refusing anything not found in the catalog.
>
> Before writing any code, research current best practices for closed-world agents — retrieval-grounded Q&A, sealed knowledge bases, fail-closed refusal rules, citation enforcement — and apply them.
>
> Architecture: FastAPI service, embedded retrieval index over the catalog, pinned tool registry, deterministic manifest of task types, no runtime LLM dependency. Package everything into a Dockerfile that builds and runs offline. Add a simple web portal — static HTML form, question in, cited answer out.
>
> Also implement these value-added services beyond chat:
> - Compliance checking: paste in a message or mapping spec, the agent flags which ISO 20022 rules it violates, with clause citations.
> - Cross-standard comparison: line up two versions or two message types side by side with clause citations.
> - Gap analysis: feed in a current implementation, return a checklist of missing requirements against the catalog.
> - Clause lookup API: a machine endpoint other tools can call.
> - Change tracking: when the catalog updates, diff the new version and report what changed and what breaks downstream.
> - Export: answers and compliance reports as PDF or structured JSON for audit trails.
> - Schema conversion: convert the provided XSD definitions into JSON Schema on demand. The conversion is a deterministic transform — XSD types map to JSON Schema types, restrictions become constraints, and the agent runs a fixed function with no LLM. No second copy of the schema is stored; it is generated from the catalog at request time. Also support exporting the original XML alongside the generated JSON Schema so the user can compare both views.
>
> Deliverables: the full source tree, the Dockerfile, a docker-compose file, and a README with run instructions. I will provide the catalog files separately — structure the code so they drop into a data directory and get indexed at build time.

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
