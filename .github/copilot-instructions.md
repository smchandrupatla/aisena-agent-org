# Copilot Instructions — AISENA AI Agent Org

## What This Repo Is

An **AI-driven software delivery organization** that builds the AISENA (AISENA) using 37 specialized AI agent roles. Agents coordinate through explicit handoffs, shared project memory, and an autonomous governance framework. The repo contains both the agent role definitions *and* the system being built.

---

## Commands

### Infrastructure

```bash
# Start full local stack (Postgres, Kafka, OpenSearch, Grafana, Prometheus, Loki, Vault, Redmine, Apicurio)
cd infra && docker compose up -d

# Start agent manager (background process, exposes Prometheus metrics on :9500)
bash scripts/start-agent-manager.sh
```

### Services

```bash
python3 services/ingestion/produce.py     # Kafka producer
python3 services/detection/consume.py    # Kafka consumer + screening rule
python3 services/api/app.py              # Flask REST API
```

### Tests

```bash
# Full API test suite
python -m unittest services/api/test_app.py

# Single test
python -m unittest services.api.test_app.AgentApiTests.test_agent_catalog_endpoint_exists

# End-to-end smoke test (ingestion → Kafka → detection → OpenSearch)
bash scripts/run-stage0-smoke.sh
```

---

## Architecture

### Layers

```
Agents (Role Definitions)         agents/NN-role-name/
  └─ Orchestrated by              agents/manager/agent_manager.py

Services (Event-Driven Microservices)
  Ingestion ──Kafka──► Detection ──► PostgreSQL + OpenSearch
  API (Flask)
  Agent Runtime (Express/Node.js)

Infrastructure (docker-compose)
  PostgreSQL 15 :5432  |  Kafka :9092  |  OpenSearch :9200
  Grafana :3000        |  Prometheus :9090  |  Vault :8200
  Redmine :3001        |  Apicurio :8080    |  Loki :3100

Project Memory
  project/PROJECT_STATE.md     ← current milestone + blockers
  project/backlog/BACKLOG.md   ← task queue
  docs/AGENT_CHANGE_LOG.md     ← append-only change log
```

### Agent Tiers

- **Tier 1 – Coordination**: `00-implementation-manager` (single orchestration point)
- **Tier 1 – Definition**: Business Analyst, Solution Architect, UI/UX Designer
- **Tier 2 – Engineering**: Backend, Frontend, DB, DevOps, QA, Security, Docs, Integration, Performance, Release, Product Owner
- **Domain SMEs** (`15`–`25`): Sanctions, Fraud, Payments, Regulatory, Data Architecture, OpenSearch, Streaming, AWS, Security/Identity, Case Management UX, Infrastructure Platform

### Delivery Stages

Stage 0 (proof) → Stage 1 (definition) → Stage 2 (engineering) → Stage 3–5 (build out). Current state is always in `project/PROJECT_STATE.md`.

### Data Flow (Stage 0)

Sample JSON → Ingestion (`produce.py`) → Kafka topic `aisena-stage0-events` → Detection (`consume.py`, flags amount > $1000) → PostgreSQL + OpenSearch index `aisena-stage0-screening-results`

---

## Key Conventions

### New Application Portal Isolation

- Every new application created with this framework must have a web portal separate from the AISENA portal.
- Treat the new application's portal as an independently deployable product surface with its own source boundary, configuration, routes, assets, and branding.
- Do not add new application screens or application-specific navigation to the AISENA portal. The AISENA portal remains the framework and agent-organization management surface.
- Shared libraries and platform services may be reused, but portal builds and deployments must remain independently versioned and releasable.

### Agent Definition Structure

Every agent is a folder under `agents/`:

```
agents/NN-role-name/
├── AGENT.md            # Mission, responsibilities, inputs/outputs, escalation rules
├── RESPONSIBILITIES.md
├── INPUTS.md
├── OUTPUTS.md
├── CHECKLIST.md        # Definition of Done
└── config.json         # Role-specific config (e.g., learning rate alpha)
```

The `agent_manager.py` scans for folders containing `AGENT.md`, runs a continuous learning loop against OpenSearch/PostgreSQL results, and auto-commits updated agent metadata when `AGENT_AUTO_PUSH=true`.

### Naming Conventions

| Type | Pattern | Example |
|---|---|---|
| Agent folders | `NN-role-name/` | `05-backend-engineer/` |
| Tasks | `TASK-NNNN` | `TASK-0003` |
| Requirements | `REQ-NNNN` | `REQ-0005` |
| ADRs | `ADR-NNNN` | `ADR-0002` |
| Change log entries | `LOG-YYYYMMDD-NNN` | `LOG-20260814-001` |
| Handoffs | `project/handoffs/TASK-NNNN-FROM-role-to-ROLE.md` | |

### Change Log (Append-Only)

All meaningful changes must be logged in `docs/AGENT_CHANGE_LOG.md`. Each entry requires:
- Entry ID, date, agent role, task ID
- What changed + files modified + commit ref
- Rationale, alternatives considered, risk level
- Metrics impact, rollback plan
- Whether human approval is needed
- Handoff target (next agent)

Full template is in `docs/AGENT_OPERATIONS_WIKI.md`.

### Approval Gates

Human approval is **required** before changes that are: production-affecting, cost-incurring, user-data-touching, pricing-related, or legally exposed. Everything else is autonomous.

### Conflict Resolution Order

Technical conflicts → Solution Architect → Security Engineer → Product Owner

### Handoff Files

When passing work between agents, create `project/handoffs/TASK-NNNN-FROM-role-to-ROLE.md` with: task ID, objective, files changed, decisions made, next actions, blockers.

### Environment Variables (Agent Manager)

| Variable | Default | Purpose |
|---|---|---|
| `AGENT_AUTO_PUSH` | `true` | Auto-commit agent learning updates |
| `AGENT_LEARN_INTERVAL` | `30` | Seconds between learning loops |
| `AGENT_DAILY_LEARNING_INTERVAL` | `86400` | Seconds between evidence-backed domain self-learning reports |
| `AGENT_METRICS_PORT` | `9500` | Prometheus metrics endpoint |
| `OPENSEARCH_URL` | `http://opensearch:9200` | |
| `POSTGRES_DSN` | `host=postgres dbname=aisena user=aisena password=aisena_pw` | |

### Dev Credentials (Local Only)

- PostgreSQL: `aisena` / `aisena_pw`, db `aisena`
- Grafana: `admin` / `admin`
- Vault: token `root` (dev mode)
- OpenSearch: security disabled

### Languages

- **Python 3.12** — services, agent manager, scripts
- **JavaScript/Node.js** — agent runtime (`services/agent_runtime/`), web frontends
- **Bash** — infra and orchestration scripts
- **Markdown** — all agent definitions and governance docs
