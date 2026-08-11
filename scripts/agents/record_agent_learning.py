#!/usr/bin/env python3
"""Record and report agent self-learning entries."""

from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
LATEST_FILE = ROOT / "memories" / "repo" / "agent_self_learning_latest.json"
LOG_FILE = ROOT / "memories" / "repo" / "agent_self_learning_log.jsonl"


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def load_latest() -> dict[str, Any]:
    if not LATEST_FILE.exists():
        raise FileNotFoundError(f"Missing registry file: {LATEST_FILE}")
    return json.loads(LATEST_FILE.read_text(encoding="utf-8"))


def save_latest(data: dict[str, Any]) -> None:
    data["generated_at"] = utc_now()
    LATEST_FILE.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")


def append_log(record: dict[str, Any]) -> None:
    LOG_FILE.parent.mkdir(parents=True, exist_ok=True)
    if not LOG_FILE.exists():
        LOG_FILE.write_text("", encoding="utf-8")
    with LOG_FILE.open("a", encoding="utf-8") as fh:
        fh.write(json.dumps(record) + "\n")


def record_learning(agent: str, learning: str, context: str, evidence: str) -> None:
    data = load_latest()
    agents = data.get("agents", {})
    if agent not in agents:
        known = ", ".join(sorted(agents.keys()))
        raise ValueError(f"Unknown agent '{agent}'. Known agents: {known}")

    timestamp = utc_now()
    record = {
        "timestamp": timestamp,
        "agent": agent,
        "learning": learning,
        "context": context,
        "evidence": evidence,
    }

    agents[agent] = {
        "latest_learning": learning,
        "updated_at": timestamp,
        "context": context,
        "evidence": evidence,
    }

    save_latest(data)
    append_log(record)


def report() -> str:
    data = load_latest()
    agents = data.get("agents", {})
    lines = ["Agent | Updated At | Latest Learning", "---|---|---"]
    for name in sorted(agents.keys()):
        entry = agents[name] or {}
        updated_at = entry.get("updated_at") or "-"
        latest_learning = entry.get("latest_learning") or "-"
        lines.append(f"{name} | {updated_at} | {latest_learning}")
    return "\n".join(lines)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Record or report agent self-learning")
    parser.add_argument("--agent", help="Agent folder name, ex: 05-backend-engineer")
    parser.add_argument("--learning", help="Latest learning statement")
    parser.add_argument("--context", default="", help="Task or project context")
    parser.add_argument("--evidence", default="", help="Evidence file path or artifact")
    parser.add_argument("--report", action="store_true", help="Print latest learning report")
    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()

    if args.report:
        print(report())
        return 0

    if not args.agent or not args.learning:
        parser.error("either --report OR both --agent and --learning are required")

    record_learning(
        agent=args.agent,
        learning=args.learning,
        context=args.context,
        evidence=args.evidence,
    )
    print(f"Recorded learning for {args.agent}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
