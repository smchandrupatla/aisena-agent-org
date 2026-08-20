# API Gateway

Single entry point for the AISENA HSFS backend. Handles JWT authentication, request routing, rate limiting, and publishes transaction events to Kafka.

## Responsibility

- Authenticate incoming requests (mock JWT for local dev)
- Validate and normalize transaction submission payloads
- Publish `screening.requested` events to Kafka
- Proxy case lookup requests to the case-management service
- Enforce rate limiting and security headers

## API Contract

### `POST /api/transactions`

Submit a transaction for sanctions/fraud screening.

**Headers:**
- `Authorization: Bearer mock-<token>` (mock JWT for local dev)

**Body:**
```json
{
  "amount": 1500.00,
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
}
```

**Response (202):**
```json
{
  "transactionId": "uuid",
  "eventId": "uuid",
  "status": "submitted",
  "message": "Transaction submitted for screening"
}
```

### `GET /api/cases/:caseId`

Retrieve case details (proxied to case-management).

### `GET /health`

Health check endpoint.

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | HTTP port |
| `KAFKA_BROKER` | `localhost:9092` | Kafka broker address |
| `JWT_SECRET` | — | JWT signing secret (mock auth in dev) |

## Running

```bash
npm install
npm run dev
```
