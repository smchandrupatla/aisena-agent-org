# Audit & Notification Service

Immutable audit log of every decision in the HSFS pipeline, plus alerting via Slack/email webhooks.

## Responsibility

- Consume all event types from Kafka (`screening.requested`, `screening.completed`, `case.created`, `case.escalated`, `case.closed`, `case.triage.completed`, `enrichment.completed`)
- Persist each event as an immutable audit entry in PostgreSQL
- Send alerts to Slack/email for high-risk events (escalations, high risk scores)
- Expose a REST API for querying the audit log

## API Contract

### `GET /health`
Health check endpoint.

### `GET /api/audit`
List all audit entries.

**Response (200):**
```json
{
  "entries": [{ "id": "...", "eventType": "...", "action": "...", ... }],
  "count": 10
}
```

### `GET /api/audit/:id`
Get a specific audit entry by ID.

## Kafka Topics Consumed

| Topic | Description |
|---|---|
| `screening.requested` | Transaction submitted for screening |
| `screening.completed` | Screening result |
| `case.created` | New case created |
| `case.escalated` | Case escalated to compliance |
| `case.closed` | Case closed |
| `case.triage.completed` | AI triage decision |
| `enrichment.completed` | Beneficiary enrichment result |

## Alerting

Alerts are sent to Slack when:
- A case is escalated (`case.escalated`)
- A screening result has a risk score ≥ 80

Configure the Slack webhook URL via the `SLACK_WEBHOOK_URL` environment variable.

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3005` | HTTP port |
| `KAFKA_BROKER` | `localhost:9092` | Kafka broker address |
| `PG_HOST` | `localhost` | PostgreSQL host |
| `PG_PORT` | `5432` | PostgreSQL port |
| `PG_DATABASE` | `audit_log` | PostgreSQL database |
| `PG_USER` | `aisena` | PostgreSQL user |
| `PG_PASSWORD` | `aisena_pw` | PostgreSQL password |
| `SLACK_WEBHOOK_URL` | — | Slack webhook for alerts |

## Running

```bash
npm install
npm run dev
```
