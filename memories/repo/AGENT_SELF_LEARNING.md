# Agent Self Learning Registry

This folder tracks the latest self-learning captured by each agent.

## Files
- `memories/repo/agent_self_learning_latest.json`: Latest learning snapshot by agent.
- `memories/repo/agent_self_learning_log.jsonl`: Append-only history.
- `memories/repo/agent-learning-reports/YYYY-MM-DD.md`: Dated evidence-backed domain reports.

The agent manager runs the daily research prompt automatically. To run one
cycle manually, use:

```bash
python3 scripts/agents/daily_self_learning.py --once
```

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
