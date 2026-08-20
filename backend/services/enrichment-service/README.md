# Enrichment Service

Pulls external sanctions lists and KYC data, caches results in Redis.

## Responsibility

- Consume `screening.requested` events from Kafka
- Enrich beneficiary data by checking against sanctions lists (OFAC, UN, EU)
- Cache enrichment results in Redis (1-hour TTL)
- Publish `enrichment.completed` events with enrichment data
- Expose a REST endpoint for direct enrichment calls

## API Contract

### `GET /health`
Health check endpoint.

### `POST /api/enrich`
Enrich a beneficiary name.

**Body:**
```json
{
  "name": "John Doe"
}
```

**Response (200):**
```json
{
  "name": "John Doe",
  "isSanctioned": true,
  "matches": [{ "listSource": "OFAC-SDGT", "entityType": "individual" }],
  "kycVerified": true,
  "kycScore": 85,
  "cached": false
}
```

## Kafka Topics

| Topic | Direction | Description |
|---|---|---|
| `screening.requested` | Consume | Enrich beneficiary data |
| `enrichment.completed` | Publish | Enrichment results |

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3004` | HTTP port |
| `KAFKA_BROKER` | `localhost:9092` | Kafka broker address |
| `REDIS_HOST` | `localhost` | Redis host |
| `REDIS_PORT` | `6379` | Redis port |

## Running

```bash
npm install
npm run dev
```
