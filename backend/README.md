# AISENA HSFS Backend Architecture

This directory contains the backend microservices and Temporal workflow orchestration for the AISENA High-Speed Financial Screening (HSFS) system.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        API Gateway (3000)                        │
│  JWT Auth • Rate Limiting • Request Routing • Kafka Producer    │
└──────────────┬──────────────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Kafka (screening.requested)                  │
└──────────────┬──────────────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Screening Engine (3002)                     │
│  Rule Engine: Amount • Sanctions • Country • Risk Rating        │
│  → Publishes screening.completed (PASS/FLAG)                   │
└──────────────┬──────────────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Case Management (3003)                       │
│  Case Lifecycle: OPEN → IN_REVIEW → ESCALATED → CLOSED          │
│  → Publishes case.created / case.escalated / case.closed        │
└──────────────┬──────────────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Agent Runtime (3001)                        │
│  AI Triage: Consumes case.created, publishes case.triage.*     │
└──────────────┬──────────────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────────────┐
│                  Temporal Workflow (4000)                       │
│  Orchestrates: Screening → Case → AI Triage → Human Review      │
│  Signal: humanReview (APPROVED/REJECTED)                        │
│  Timer: SLA timeout → auto-escalate                             │
└──────────────┬──────────────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────────────┐
│              Audit & Notification (3005)                        │
│  Immutable audit log • Slack/email alerts                       │
└─────────────────────────────────────────────────────────────────┘
```

## Services

| Service | Port | Responsibility |
|---|---|---|
| **api-gateway** | 3000 | Single entry point, JWT auth, rate limiting, Kafka producer |
| **agent-runtime** | 3001 | Loads agent configs, executes AI triage logic |
| **screening-engine** | 3002 | Core sanctions/fraud rule evaluation (stateless) |
| **case-management** | 3003 | Case lifecycle management, PostgreSQL persistence |
| **enrichment-service** | 3004 | External sanctions list lookups, Redis caching |
| **audit-notification** | 3005 | Immutable audit log, Slack/email alerting |
| **temporal-worker** | — | Hosts Temporal workflow + activities |
| **temporal-workflow-server** | 4000 | Express API to start workflows, send signals, query status |

## Kafka Topics

| Topic | Schema | Publisher | Consumers |
|---|---|---|---|
| `transaction.submitted` | `transaction.submitted.json` | api-gateway | screening-engine |
| `screening.requested` | `screening.requested.json` | api-gateway | screening-engine, enrichment-service |
| `screening.completed` | `screening.completed.json` | screening-engine | case-management, audit-notification |
| `case.created` | `case.created.json` | case-management | agent-runtime, audit-notification |
| `case.escalated` | `case.escalated.json` | case-management | audit-notification |
| `case.closed` | `case.closed.json` | case-management | audit-notification |
| `case.triage.completed` | — | agent-runtime | audit-notification |
| `enrichment.completed` | — | enrichment-service | — |

## Temporal Workflow

The `ScreeningWorkflow` models the core HSFS process:

```
Transaction received
  → Activity: run screening-engine check
  → Decision: pass / flag
      pass  → Activity: log audit record → complete
      flag  → Activity: create case in case-management
            → Activity: assign to agent-runtime for AI triage
            → Signal wait: human review (with timeout)
                approved  → Activity: close case, log audit
                rejected  → Activity: escalate, notify compliance team
```

Key features:
- **Retry policies** on activities for transient failures (external sanctions list lookups)
- **Signal** (`humanReview`) for human reviewers to inject decisions mid-workflow
- **Timer/timeout** (5-minute SLA) to auto-escalate if no human response
- **Audit events** emitted at every state transition

## How to Run Locally

### Prerequisites
- Docker and Docker Compose
- Node.js 22+ (for local development without Docker)
- Make (or just run docker compose commands directly)

### Quick Start

```bash
# Start the full stack from the repository root
make -f backend/Makefile up

# Check service status
make -f backend/Makefile status

# Verify the live Kafka and PostgreSQL flow
make -f backend/Makefile smoke

# View logs
make -f backend/Makefile logs
```

### Service Endpoints

| Service | Health Check | API |
|---|---|---|
| API Gateway | `http://localhost:13000/health` | `http://localhost:13000/api/...` |
| Agent Runtime | `http://localhost:13001/health` | `http://localhost:13001/api/...` |
| Screening Engine | `http://localhost:13002/health` | `http://localhost:13002/api/...` |
| Case Management | `http://localhost:13003/health` | `http://localhost:13003/api/...` |
| Enrichment Service | `http://localhost:13004/health` | `http://localhost:13004/api/...` |
| Audit Notification | `http://localhost:13005/health` | `http://localhost:13005/api/...` |
| Workflow API | `http://localhost:14000/health` | `http://localhost:14000/api/workflows/...` |
| Temporal UI | `http://localhost:18233` | — |
| Grafana | `http://localhost:13006` | admin/admin |
| Prometheus | `http://localhost:19090` | — |

The isolated defaults avoid collisions with the existing AISENA framework stack. Override them with the `HSFS_*_PORT` variables shown in `.env.example`.

### Submitting a Transaction

```bash
curl -X POST http://localhost:13000/api/transactions \
  -H "Authorization: Bearer mock-token" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 15000,
    "currency": "USD",
    "originAccount": "ACC-001",
    "beneficiaryAccount": "ACC-002",
    "beneficiaryName": "John Doe",
    "beneficiaryCountry": "US",
    "transactionType": "WIRE_TRANSFER",
    "customerId": "CUST-001",
    "customerName": "Jane Smith",
    "customerCountry": "US",
    "riskRating": "HIGH"
  }'
```

### Starting a Workflow

```bash
curl -X POST http://localhost:14000/api/workflows/screening \
  -H "Content-Type: application/json" \
  -d '{
    "transactionId": "txn-001",
    "transaction": {
      "amount": 15000,
      "currency": "USD",
      "originAccount": "ACC-001",
      "beneficiaryAccount": "ACC-002",
      "beneficiaryName": "John Doe",
      "beneficiaryCountry": "US",
      "transactionType": "WIRE_TRANSFER"
    },
    "customer": {
      "customerId": "CUST-001",
      "name": "Jane Smith",
      "country": "US",
      "riskRating": "HIGH"
    }
  }'
```

### Sending a Human Review Signal

```bash
curl -X POST http://localhost:14000/api/workflows/screening-txn-001/signal/human-review \
  -H "Content-Type: application/json" \
  -d '{
    "decision": "APPROVED",
    "reviewer": "analyst-001",
    "notes": "Transaction verified"
  }'
```

### Running Tests

```bash
make -f backend/Makefile test
```

The Dockerized Temporal suite covers human approval and SLA auto-escalation. `make -f backend/Makefile smoke` covers the live gateway → Kafka → screening → case → audit flow and verifies PostgreSQL persistence.

### Kubernetes Stubs

Production-oriented deployment stubs are isolated under `backend/k8s`. They assume managed Kafka, PostgreSQL, Redis, and Temporal dependencies and intentionally omit production ingress, autoscaling, workload identity, and secret-manager integration.

```bash
kubectl kustomize backend/k8s
```

### Seeding Data

```bash
make -f backend/Makefile seed-data
```

### Stopping

```bash
make -f backend/Makefile down
```

## Integration with AISENA Agent Org

This backend architecture serves as the execution layer for the AISENA agent organization:

- **Agent 00 (Implementation Manager)**: Orchestrates the overall delivery pipeline
- **Agent 15 (Sanctions Screening SME)**: Provides domain expertise for screening rules
- **Agent 16 (Fraud Detection SME)**: Provides domain expertise for fraud detection rules
- **Agent 26 (Backend Ingestion Streaming)**: Manages the Kafka event backbone
- **Agent 27 (Backend Detection Services)**: Operates the screening-engine service
- **Agent 28 (Backend Data Persistence)**: Manages PostgreSQL schemas and data models
- **Agent 20 (Search/OpenSearch SME)**: Provides search and analytics capabilities
- **Agent 21 (Streaming/Messaging Infra SME)**: Manages Kafka and Temporal infrastructure

The Temporal workflow (`ScreeningWorkflow`) is the durable orchestration layer that coordinates the AI agents (via `agent-runtime`) with human reviewers (via the OpsDesk console) through the case-management service.

## Non-Goals (for this pass)

- Production Kubernetes manifests (stub only)
- Full auth/identity provider integration (mock JWT)
- UI work — OpsDesk console consumes these APIs separately
