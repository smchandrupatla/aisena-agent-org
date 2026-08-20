# Temporal Workflow Orchestration

Temporal workflow orchestration for the AISENA HSFS (High-Speed Financial Screening) pipeline.

## Responsibility

- Orchestrate the screening → escalation workflow as durable, versioned code
- Coordinate activities across services (screening-engine, case-management, agent-runtime, audit-notification)
- Handle human review signals with SLA timeouts
- Auto-escalate if no human response within the SLA window

## Workflow: ScreeningWorkflow

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

## Components

| File | Description |
|---|---|
| `src/types.ts` | Shared types for workflow input/output |
| `src/activities.ts` | Activity implementations (call service REST APIs) |
| `src/workflow.ts` | Workflow definition with signal handlers |
| `src/worker.ts` | Temporal worker that hosts workflow + activities |
| `src/index.ts` | Express server exposing workflow start/signal/query endpoints |
| `src/workflow-starter.ts` | CLI script to start a workflow |

## API Contract

### `GET /health`
Health check endpoint.

### `POST /api/workflows/screening`
Start a new screening workflow.

**Body:**
```json
{
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
}
```

**Response (202):**
```json
{
  "workflowId": "screening-txn-001",
  "runId": "uuid",
  "status": "STARTED"
}
```

### `POST /api/workflows/:workflowId/signal/human-review`
Send a human review decision to a running workflow.

**Body:**
```json
{
  "decision": "APPROVED",
  "reviewer": "analyst-001",
  "notes": "Transaction verified"
}
```

### `GET /api/workflows/:workflowId`
Query workflow status.

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `4000` | HTTP port |
| `TEMPORAL_ADDRESS` | `localhost:7233` | Temporal server address |
| `TEMPORAL_TASK_QUEUE` | `hsfs-screening` | Temporal task queue |
| `SCREENING_ENGINE_URL` | `http://screening-engine:3002` | Screening engine URL |
| `CASE_MANAGEMENT_URL` | `http://case-management:3003` | Case management URL |
| `AGENT_RUNTIME_URL` | `http://agent-runtime:3001` | Agent runtime URL |
| `AUDIT_NOTIFICATION_URL` | `http://audit-notification:3005` | Audit notification URL |

## Running

```bash
npm install
npm run build
npm run start:worker  # In one terminal
npm run start         # In another terminal (workflow server)
```
