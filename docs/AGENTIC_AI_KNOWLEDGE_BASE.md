# Agentic AI Knowledge Base

Source: The Complete Agentic AI Cheatsheet (genai.works, August 2026)  
Scope: Build, Deploy & Scale AI Agents That Think, Act & Deliver Results

---

## 10-Step Agentic AI Development Roadmap

| Step | Name | Focus |
|------|------|-------|
| 1 | What is Agentic AI | Definition, key characteristics, differentiation |
| 2 | Use Cases | Customer support, data analysis, coding, content, research |
| 3 | Core Components | LLM brain, memory, planning, tools, orchestration, observability |
| 4 | Choose Tools | Select LLMs, frameworks, vector DBs, memory stores |
| 5 | Design Agent | Goals, persona, loop design, prompts, guardrails |
| 6 | Build & Test | Implement, unit test, integration test, eval loops |
| 7 | Deploy | Containerise, expose API, run in cloud or local |
| 8 | Monitor | Tracing, logs, metrics dashboards, alerting |
| 9 | Optimize | Prompt tuning, latency reduction, cost control, feedback loops |
| 10 | Scale | Multi-agent systems, load balancing, fleet management |

---

## What is Agentic AI

Agentic AI refers to autonomous systems that perceive inputs, plan actions, use tools, and complete multi-step tasks with minimal human intervention.

**Key characteristics:**
- Goal-directed — works toward an objective, not just a single prompt response
- Tool-using — invokes external APIs, databases, code runners, browsers
- Memory-enabled — retains context across turns and sessions
- Self-correcting — reflects on output and replans when needed
- Adaptive — improves from feedback and experience

**Agent vs Chatbot distinction:**  
A chatbot replies. An agent acts, verifies, iterates, and delivers an outcome.

---

## Use Cases

| Domain | Example Agent |
|--------|--------------|
| Customer Support | Triage, resolve, escalate tickets autonomously |
| Data Analysis | Query databases, generate visualizations, produce reports |
| Coding | Write, test, refactor, and document code |
| Content Creation | Research, draft, review, publish content pipelines |
| Research | Web search, summarize, synthesize, cite sources |
| Meeting Summary | Transcribe, extract decisions, assign actions |
| Fraud Detection | Monitor transactions, flag anomalies, raise cases |
| Sanctions Screening | Match entities, validate against lists, produce audit trail |
| Recruitment | Screen CVs, rank candidates, schedule interviews |
| Data Recovery | Identify, retrieve, validate, and restore data |

---

## Core Components

| Component | Role |
|-----------|------|
| **LLM Brain** | Reasoning, language understanding, decision making |
| **Memory** | Short-term (context window), long-term (vector/DB), episodic |
| **Planning** | Break goals into steps; re-plan on failure |
| **Reasoning** | Chain-of-thought, tree-of-thought, ReAct pattern |
| **Autonomy** | Operate without turn-by-turn human instruction |
| **Orchestration** | Coordinate multiple agents, tools, and workflows |
| **Tools / Actions** | Web search, code execution, API calls, file I/O |
| **Personas / Accounts** | Role identity, scoped permissions, system prompt |
| **Observability** | Tracing, token usage, latency, evaluation scores |

---

## Types of Agents

| Type | Description | Best for |
|------|-------------|----------|
| **Simple Reflex** | Condition-action rules, no internal state | Fast deterministic responses |
| **Model-Based** | Maintains internal world model | Stateful multi-turn tasks |
| **Goal-Oriented** | Plans actions to achieve defined objective | End-to-end task completion |
| **Utility-Based** | Maximizes a utility/reward function | Optimization problems |
| **Learning** | Improves from feedback and experience | Evolving tasks, personalization |
| **Multi-Agent Systems** | Multiple agents collaborate or compete | Complex, parallel, specialized work |

---

## Agent Loop (Plan → Reason → Act)

```
         ┌─────────────────────────────┐
         │           GOAL              │
         └────────────┬────────────────┘
                      │
              ┌───────▼──────┐
              │   1. PLAN    │  Break goal into steps
              └───────┬──────┘
                      │
              ┌───────▼──────┐
              │  2. REASON   │  Select next action, chain-of-thought
              └───────┬──────┘
                      │
              ┌───────▼──────┐
              │   3. ACT     │  Call tool / produce output
              └───────┬──────┘
                      │
              ┌───────▼──────┐
              │  OBSERVE &   │  Check result, update memory
              │  REFLECT     │
              └───────┬──────┘
                      │
           ┌──────────▼───────────┐
           │  Goal complete? ─── YES ──► Deliver result
           │       │
           │       NO
           └───────┴──► loop back to PLAN
```

---

## Key Agent Capabilities

| Capability | Description |
|------------|-------------|
| **Memory & Recall** | Retrieve past context, facts, and decisions |
| **Tool Use** | Call APIs, run code, search web, query databases |
| **Reasoning & Planning** | Decompose tasks, sequence actions logically |
| **Decision Making** | Choose between alternatives given constraints |
| **Learning & Adapting** | Update behaviour from feedback signals |
| **Collaboration** | Hand off to or coordinate with other agents |

---

## Best Practices

- Start small, inside first — build a minimal working agent before adding tools
- Define clear goals — vague objectives produce vague agents
- Use the right tools — don't over-engineer tool sets
- Monitor continuously — trace every run, not just failures
- Validate & test rigorously — eval loops are not optional
- Optimize & reduce costs — token efficiency matters at scale
- Keep humans in the loop — especially for high-stakes decisions

---

## Popular Tools & Frameworks

### LLM Providers
| Provider | Notes |
|----------|-------|
| OpenAI (GPT-4o, o1) | Strongest tool-calling, widest ecosystem |
| Anthropic Claude | Long context, strong reasoning, safety-focused |
| Google Gemini | Multimodal, tight Google Cloud integration |
| AWS Bedrock | Managed multi-model, enterprise compliance |
| Mistral AI | Open-weight option, efficient inference |
| Meta Llama | Self-hosted, cost-free at inference |

### Agent Frameworks
| Framework | Strengths |
|-----------|-----------|
| LangChain | Broad ecosystem, chains, agents, tools |
| LangGraph | Stateful multi-agent graphs, cyclic flows |
| AutoGen | Multi-agent conversation, Microsoft |
| CrewAI | Role-based crew orchestration |
| Haystack | Document pipelines, RAG-focused |
| Camel | Communicative multi-agent research framework |

### Vector Databases
| DB | Notes |
|----|-------|
| Pinecone | Managed, production-grade, fast |
| ChromaDB | Embedded, great for local dev |
| Weaviate | Hybrid search, schema-flexible |
| Qdrant | Rust-native, payload filtering |
| FAISS | In-process, no server required |
| Milvus | Distributed, large-scale |

### Memory Stores
| Store | Use case |
|-------|----------|
| Redis | Fast short-term / session memory |
| PostgreSQL | Relational, structured long-term |
| MongoDB | Document, flexible schema |
| SQLite | Embedded, single-file |
| Neo4j | Graph memory, relationship traversal |
| DynamoDB | AWS-native, serverless scale |

### Tools & Integrations
Zapier, Make, n8n, Slack, Notion, Jira, GitHub, Confluence, Google Workspace, HubSpot

### Deployment Platforms
| Platform | Notes |
|----------|-------|
| Railway | Simple container deploys |
| Render | Auto-deploy from Git |
| AWS Lambda | Serverless, event-driven |
| Fly.io | Global edge containers |
| Google Cloud Run | Container-as-a-function |
| Azure Container Apps | Managed Kubernetes-lite |

### Observability
| Tool | Purpose |
|------|---------|
| LangSmith | LangChain-native tracing and eval |
| LangFuse | Open-source LLM observability |
| Arize Phoenix | ML observability, drift detection |
| Weights & Biases | Experiment tracking, evals |
| Helicone | Proxy-based logging, cost tracking |
| PromptLayer | Prompt versioning and analytics |

---

## Agent Architecture

```
                    ┌──────────────────────────────────┐
   User / System ──►│              AGENT               │──► Output
                    │                                  │
                    │  ┌─────────┐    ┌─────────────┐  │
                    │  │ MEMORY  │    │    TOOLS    │  │
                    │  │ Short   │    │  Web search │  │
                    │  │ Long    │    │  Code exec  │  │
                    │  │ Episodic│    │  APIs/DBs   │  │
                    │  └────┬────┘    └──────┬──────┘  │
                    │       │                │         │
                    │       └──── LLM Core ──┘         │
                    │              │                   │
                    └──────────────┼───────────────────┘
                                   │
                         ┌─────────▼──────────┐
                         │    ENVIRONMENT     │
                         │  (context, state,  │
                         │   external world)  │
                         └────────────────────┘
```

---

## Example Agent System Prompt Template

```
You are a [ROLE] agent.
Your goal is to [GOAL].
You have access to the following tools: [TOOL LIST].
Think step-by-step before acting.
If uncertain, ask for clarification before proceeding.
Always verify your output meets the goal before responding.
Escalate to a human when: [ESCALATION CONDITIONS].
```

---

## Evaluation Metrics

| Metric | What it measures |
|--------|-----------------|
| **Task Success Rate** | % of tasks completed correctly end-to-end |
| **Goal Completion** | Did the agent fully achieve the stated goal? |
| **Response Time** | Latency from request to final output |
| **Token Efficiency** | Tokens consumed per successful task |
| **User Satisfaction** | Human-rated quality score |
| **Error Rate** | % of runs with tool errors, hallucinations, or failures |

---

## Common Use Case Examples

| Agent | Core Tools | Output |
|-------|-----------|--------|
| AI Research Assistant | Web search, summarization, citation | Research report |
| Customer Service Agent | CRM API, knowledge base RAG, ticketing | Resolved ticket |
| Meeting Summary Agent | Transcription, NLP, calendar API | Action items doc |
| Coding Assistant | Code interpreter, GitHub API, test runner | PR with tests |
| Data Recovery Agent | DB query, file system, validation logic | Recovered dataset |

---

## Agent Development Checklist

- [ ] Define clear goal and success criteria
- [ ] Choose right model for the task
- [ ] Add tools & validate each one independently
- [ ] Handle errors gracefully (retry logic, fallbacks)
- [ ] Create eval dataset (minimum 20 diverse examples)
- [ ] Set up tracing and observability from day one
- [ ] Implement guardrails (input validation, output filtering)
- [ ] Test edge cases — empty inputs, malformed data, timeouts
- [ ] Document escalation conditions and human override triggers
- [ ] Version-pin all dependencies (model version, framework, tools)

---

## Guard Types

| Guard | Scope | Example |
|-------|-------|---------|
| **Input Guard** | Sanitize and validate incoming requests | Block prompt injection, PII stripping |
| **Output Guard** | Filter or transform agent output | Remove harmful content, format enforcement |
| **Tool Guard** | Control which tools can be invoked | Allowlist APIs, rate limiting |
| **Scope Guard** | Restrict agent to defined domain | Refuse out-of-scope requests |
| **Cost Guard** | Cap token or API spend | Max tokens per run, budget alerts |
| **Human-in-Loop** | Route high-risk actions to approval | Production changes, irreversible actions |

---

## Control Commands

Common patterns for controlling an agent at runtime:

```
PAUSE     — suspend the agent loop, retain state
RESUME    — continue from last checkpoint
RESET     — clear memory and restart from initial state
OVERRIDE  — inject human instruction mid-loop
ESCALATE  — hand off to human operator immediately
ROLLBACK  — undo last N actions and revert state
STATUS    — report current task, memory summary, tool calls made
```

---

## Prompt Starter Patterns

| Pattern | Template |
|---------|---------|
| Goal decomposition | "Break this goal into ordered subtasks: [GOAL]" |
| ReAct | "Thought: ... Action: ... Observation: ... [repeat]" |
| Chain-of-thought | "Let's think step by step: ..." |
| Self-critique | "Review your last output. What could be wrong?" |
| Tool selection | "Which tool is most appropriate here and why?" |
| Clarification | "Before proceeding, confirm: [ASSUMPTION LIST]" |

---

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Vague goal definition | Write explicit success criteria before building |
| Too many tools at once | Start with one tool, add incrementally |
| No eval dataset | Build evals before the agent, not after |
| Ignoring latency | Profile every tool call; cache where possible |
| Trusting LLM output blindly | Always validate tool inputs and outputs |
| No guardrails | Implement input/output guards from the start |
| Skipping observability | Instrument with tracing on day one |
| Hardcoded prompts | Version-control prompts like code |

---

## Levels of AGI (Reference Scale)

| Level | Capability | Example |
|-------|-----------|---------|
| L1 | Chatbot — conversational | GPT-3.5 chat |
| L2 | Reasoner — problem solving | o1, Claude 3.5 |
| L3 | Agent — takes actions | Tool-calling GPT-4o |
| L4 | Innovator — novel solutions | Research agents |
| L5 | Autonomous organization | Multi-agent systems |

---

## Relevance to AISENA Agent Framework

| Cheatsheet Concept | AISENA Implementation |
|---|---|
| Agent Loop (Plan→Reason→Act) | `agents/manager/agent_manager.py` learning loop |
| Memory Stores | PostgreSQL (structured), OpenSearch (vector search) |
| Multi-Agent Systems | 35 specialized roles with explicit handoffs |
| Observability | Prometheus metrics (`:9500`), Grafana dashboards |
| Guardrails / Approval Gates | `docs/AGENT_OPERATIONS_WIKI.md` gate definitions |
| Agent Development Checklist | Per-agent `CHECKLIST.md` in each agent folder |
| Evaluation Metrics | `project/governance/metrics-tracker.md` |
| Tool Use | Flask REST API, Kafka, OpenSearch, PostgreSQL integrations |
| Goal-Oriented Agents | Each `AGENT.md` defines mission, scope, DoD |
| Escalation Controls | Human approval gates in governance model |
