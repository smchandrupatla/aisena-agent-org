# ADR-0005 — AISENA Confirmed Technology Stacks

Status: ACCEPTED
Date: 2026-08-22
Owner: Implementation Manager

## Context

TASK-0003 asked the Implementation Manager to confirm the actual backend and frontend technology stacks used for AISENA and to document the decision. The repository had previously listed unconfirmed stack options (including a possible Java/Spring path), so this ADR records the stacks that are actually implemented and in use after inspecting the codebase.

## Decision

### AISENA Framework / Agent-Organization Services

| Layer | Stack | Evidence |
|---|---|---|
| Task/Issue API | **Python 3 + Flask** | `services/api/app.py`, `services/api/requirements.txt` |
| Orchestrator | **Python 3 + Flask** | `services/orchestrator/app.py`, `services/orchestrator/requirements.txt` |
| Ingestion / Detection (Stage 0) | **Python 3** | `services/ingestion/produce.py`, `services/detection/consume.py` |
| Agent Manager / Scripts | **Python 3** | `agents/manager/`, `scripts/agents/` |
| Agent Runtime (legacy framework) | **Node.js + Express** | `services/agent_runtime/package.json` |
| Capabilities Site | **Node.js** | `services/capabilities_site/` |
| CRM Portal | **React 18 + TypeScript + Vite** | `services/crm-portal/package.json` |
| Web Portal (framework management surface) | **Vanilla JavaScript + HTML/CSS** | `webportal/tasks/dashboard.html`, `webportal/tasks/dashboard.js` |

### AISENA HSFS Backend (High-Speed Financial Screening)

All HSFS microservices are implemented as **Node.js + TypeScript + Express**:

| Service | Port | Responsibility |
|---|---|---|
| api-gateway | 3000 (host: 13000) | JWT auth, rate limiting, routing, Kafka producer |
| agent-runtime | 3001 (host: 13001) | Agent config loading + AI triage logic |
| screening-engine | 3002 (host: 13002) | Sanctions/fraud rule evaluation |
| case-management | 3003 (host: 13003) | Case lifecycle + PostgreSQL persistence |
| enrichment-service | 3004 (host: 13004) | External sanctions lookups + Redis caching |
| audit-notification | 3005 (host: 13005) | Immutable audit log + alerts |
| temporal-worker | — | Temporal workflow activities |
| temporal-workflow-server | 4000 (host: 14000) | Express API to start/signal/query workflows |

Evidence: `backend/README.md`, `backend/tsconfig.base.json`, and each service's `package.json` under `backend/services/<service>/`.

### Shared Infrastructure

| Concern | Technology |
|---|---|
| Messaging | Apache Kafka |
| Workflow orchestration | Temporal |
| Primary database | PostgreSQL 15 |
| Caching | Redis |
| Search / analytics | OpenSearch |
| Metrics / logs | Prometheus, Grafana, Loki |
| Secrets | HashiCorp Vault (dev mode) |
| Container orchestration | Docker Compose (local), Kubernetes stubs under `backend/k8s/` |

## Alternatives Considered

- **Java / Spring Boot for backend services**: rejected. No Java source files or build files exist in the repository. All backend microservices are Node.js/TypeScript.
- **Python for HSFS microservices**: rejected. While Python is used for the framework API, ingestion, detection, and orchestrator, the HSFS backend was intentionally built with Node.js/TypeScript to align with the existing `services/agent_runtime` (Node.js/Express) and the OpsDesk/JavaScript-based console surfaces.
- **Single monolithic backend**: rejected. The codebase uses an event-driven microservice architecture with Kafka and Temporal.

## Rationale

- The confirmed stacks match the actual files under version control; no inference or future-state tooling is claimed.
- Keeping the decision in an ADR gives all agents a single reference point and closes the ambiguity that previously included Java/Spring as an unconfirmed option.
- Separating "framework services" (Python-heavy) from "HSFS backend" (Node.js/TypeScript-heavy) is important because the repository contains both and they serve different purposes.

## Consequences

- New AISENA framework features should prefer Python/Flask for services and React/TypeScript for new application portals.
- New HSFS backend capabilities must use Node.js/TypeScript/Express to stay consistent with the existing microservices.
- Documentation, test plans, and agent prompts should reference the confirmed stacks and stop listing Java/Spring as a current option.

## Rollback Rule

Supersede this ADR with a new decision record if a future increment intentionally introduces a new stack; do not silently drift from the stacks documented here.

## Status

Accepted and active for all AISENA and HSFS work from 2026-08-22 onward.
