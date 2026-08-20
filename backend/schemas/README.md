# @aisena/schemas

Shared Kafka event schemas for the AISENA HSFS (High-Speed Financial Screening) backend services.

## Purpose

All services import from this package to avoid contract drift. Each schema is a JSON Schema (draft-07) document that defines the shape of a Kafka message on a given topic.

## Topics

| Topic | Schema | Publisher | Consumers |
|---|---|---|---|
| `transaction.submitted` | `transaction.submitted.json` | api-gateway | screening-engine |
| `screening.requested` | `screening.requested.json` | api-gateway | screening-engine |
| `screening.completed` | `screening.completed.json` | screening-engine | case-management, audit-notification |
| `case.created` | `case.created.json` | case-management | agent-runtime, audit-notification |
| `case.escalated` | `case.escalated.json` | case-management | audit-notification |
| `case.closed` | `case.closed.json` | case-management | audit-notification |

## Usage

```typescript
import { topicSchemas } from '@aisena/schemas';
import Ajv from 'ajv';

const ajv = new Ajv();
const validate = ajv.compile(topicSchemas['screening.requested']);
const valid = validate(event);
```

## Validation

```bash
npm run validate
```
