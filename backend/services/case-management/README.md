# Case Management

Owns the case lifecycle (open, in-review, escalated, closed) and assignment to human/AI reviewers.

## Responsibility

- Create cases from flagged screening results
- Manage case status transitions (OPEN → IN_REVIEW → ESCALATED/CLOSED)
- Assign cases to AI agents or human reviewers
- Publish case lifecycle events to Kafka (`case.created`, `case.escalated`, `case.closed`)
- Persist case data to PostgreSQL

## API Contract

### `GET /health`
Health check endpoint.

### `POST /api/cases`
Create a new case.

**Body:**
```json
{
  "transactionId": "uuid",
  "screeningId": "uuid",
  "reason": "Flagged by rules: RULE-001, RULE-002",
  "riskScore": 80,
  "assignedTo": "ai-triage-001",
  "assignedType": "AI"
}
```

**Response (201):**
```json
{
  "caseId": "uuid",
  "transactionId": "...",
  "screeningId": "...",
  "status": "OPEN",
  "assignedTo": "ai-triage-001",
  "assignedType": "AI",
  "reason": "...",
  "riskScore": 80,
  "createdAt": "...",
  "updatedAt": "..."
}
```

### `GET /api/cases/:caseId`
Get a case by ID.

### `PATCH /api/cases/:caseId/status`
Update case status.

**Body:**
```json
{
  "status": "CLOSED",
  "reviewer": "analyst-001",
  "notes": "Transaction approved after review"
}
```

### `GET /api/cases`
List all cases.

## Kafka Topics

| Topic | Direction | Description |
|---|---|---|
| `screening.completed` | Consume | Creates cases for flagged transactions |
| `case.created` | Publish | New case created |
| `case.escalated` | Publish | Case escalated to compliance |
| `case.closed` | Publish | Case closed (approved/rejected) |

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3003` | HTTP port |
| `KAFKA_BROKER` | `localhost:9092` | Kafka broker address |
| `PG_HOST` | `localhost` | PostgreSQL host |
| `PG_PORT` | `5432` | PostgreSQL port |
| `PG_DATABASE` | `case_management` | PostgreSQL database |
| `PG_USER` | `aisena` | PostgreSQL user |
| `PG_PASSWORD` | `aisena_pw` | PostgreSQL password |

## Running

```bash
npm install
npm run dev
```
