# Agent Runtime

Loads agent configurations, executes agent logic (AI triage), and reports status back to case management.

## Responsibility

- Maintain a registry of AI agent configurations
- Consume `case.created` events from Kafka
- When a case is assigned to an AI agent, perform triage logic
- Publish `case.triage.completed` events with the AI decision

## API Contract

### `GET /health`
Health check endpoint.

### `GET /api/agents`
List all registered agents.

**Response (200):**
```json
{
  "agents": [{ "id": "...", "name": "...", "role": "...", ... }],
  "count": 1
}
```

### `GET /api/agents/:agentId`
Get a specific agent configuration.

### `POST /api/agents`
Register a new agent.

**Body:**
```json
{
  "name": "Custom Agent",
  "role": "custom",
  "description": "...",
  "capabilities": ["..."],
  "config": {}
}
```

## Kafka Topics

| Topic | Direction | Description |
|---|---|---|
| `case.created` | Consume | Triggered when a case is created and assigned to AI |
| `case.triage.completed` | Publish | AI triage decision (APPROVE/REJECT/ESCALATE) |

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3001` | HTTP port |
| `KAFKA_BROKER` | `localhost:9092` | Kafka broker address |

## Running

```bash
npm install
npm run dev
```
