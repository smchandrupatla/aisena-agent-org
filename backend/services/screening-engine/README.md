# Screening Engine

Core sanctions/fraud rule evaluation service. Stateless and horizontally scalable.

## Responsibility

- Consume `screening.requested` events from Kafka
- Evaluate transactions against a set of screening rules (amount thresholds, sanctions list matches, high-risk countries, customer risk ratings)
- Publish `screening.completed` events with the screening result (PASS/FLAG)
- Expose a REST endpoint for direct screening calls (used by Temporal workflow activities)

## API Contract

### `GET /health`
Health check endpoint.

### `POST /api/screen`
Screen a transaction directly (synchronous).

**Body:**
```json
{
  "transaction": {
    "amount": 15000,
    "currency": "USD",
    "beneficiaryName": "John Doe",
    "beneficiaryCountry": "US"
  },
  "customer": {
    "customerId": "CUST-001",
    "riskRating": "HIGH"
  }
}
```

**Response (200):**
```json
{
  "screeningId": "uuid",
  "transactionId": "...",
  "status": "FLAG",
  "rulesMatched": ["RULE-001", "RULE-002"],
  "riskScore": 80,
  "details": { ... }
}
```

## Kafka Topics

| Topic | Direction | Description |
|---|---|---|
| `screening.requested` | Consume | Transaction submitted for screening |
| `screening.completed` | Publish | Screening result (PASS/FLAG) |

## Rules

| ID | Name | Score | Description |
|---|---|---|---|
| RULE-001 | High Amount Threshold | 30 | Amount > $10,000 |
| RULE-002 | Sanctions List Match | 50 | Beneficiary on sanctions list |
| RULE-003 | High Risk Country | 25 | Beneficiary country is high-risk |
| RULE-004 | High Risk Customer | 20 | Customer risk rating is HIGH |

A transaction is flagged if the total risk score ≥ 50.

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3002` | HTTP port |
| `KAFKA_BROKER` | `localhost:9092` | Kafka broker address |

## Running

```bash
npm install
npm run dev
```
