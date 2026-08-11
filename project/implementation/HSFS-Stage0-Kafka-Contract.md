# HSFS Stage 0 Kafka Contract

## Topic: hsfs-stage0-events

### Message schema
- `transactionId`: string
- `customerName`: string
- `customerCountry`: string
- `amount`: number
- `currency`: string
- `purpose`: string
- `referenceId`: string

### Example message
```json
{
  "transactionId": "TX-0001",
  "customerName": "Acme Global Industries",
  "customerCountry": "US",
  "amount": 12500.00,
  "currency": "USD",
  "purpose": "International supplier payment",
  "referenceId": "REF-12345"
}
```

### Notes
- This contract is intentionally minimal for Stage 0.
- The backend implementation should validate the required fields.
- The screening service will consume from this topic and write results to OpenSearch.
