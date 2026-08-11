# Agent Self Learning Registry

This folder tracks the latest self-learning captured by each agent.

## Files
- `memories/repo/agent_self_learning_latest.json`: Latest learning snapshot by agent.
- `memories/repo/agent_self_learning_log.jsonl`: Append-only history.

## Update command

```bash
/home/codespace/.python/current/bin/python scripts/agents/record_agent_learning.py \
  --agent 05-backend-engineer \
  --learning "Use API smoke tests before UI integration to detect schema issues early" \
  --context "integration hardening" \
  --evidence "services/api/app.py"
```

## Reporting query example

```bash
/home/codespace/.python/current/bin/python scripts/agents/record_agent_learning.py --report
```
