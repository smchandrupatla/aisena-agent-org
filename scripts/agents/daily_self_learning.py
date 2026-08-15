#!/usr/bin/env python3
"""Run a daily, evidence-backed self-learning prompt for every agent."""

from __future__ import annotations

import argparse
import os
import re
import subprocess
import time
from datetime import datetime, timezone
from pathlib import Path

try:
    from .record_agent_learning import record_learning
except ImportError:  # Direct script execution.
    from record_agent_learning import record_learning

ROOT = Path(__file__).resolve().parents[2]
AGENTS_DIR = ROOT / "agents"
REPORTS_DIR = ROOT / "memories" / "repo" / "agent-learning-reports"
DAILY_INTERVAL_SECONDS = int(os.environ.get("AGENT_DAILY_LEARNING_INTERVAL", "86400"))


def utc_now() -> datetime:
    return datetime.now(timezone.utc).replace(microsecond=0)


def agent_paths() -> list[Path]:
    return sorted(
        path for path in AGENTS_DIR.iterdir()
        if path.is_dir() and (path / "AGENT.md").exists()
    ) if AGENTS_DIR.exists() else []


def build_learning_prompt(agent_path: Path) -> str:
    instructions = (agent_path / "AGENT.md").read_text(encoding="utf-8")
    return f"""You are the {agent_path.name} domain agent in the AISENA project.

Every 24 hours, research the most important new finding from the last 24 hours
that affects your domain. Use current, authoritative public sources when
available. Do not invent a finding or citation. If no credible new finding is
available, say so and identify the most recent relevant source instead.

Return exactly these sections in plain text:
FINDING: one concise, actionable statement
WHY_IT_MATTERS: impact on AISENA and this agent's responsibilities
EVIDENCE: one or more URLs, publication dates, or repository artifacts
RECOMMENDED_ACTION: the smallest useful change or follow-up

Agent instructions:
{instructions}
"""


def run_agent_research(agent_path: Path, runner=subprocess.run) -> str:
    prompt = build_learning_prompt(agent_path)
    try:
        result = runner(
            ["copilot", "-p", prompt, "--allow-all", "--allow-all-paths",
             "--allow-all-tools", "--output-format", "text"],
            cwd=str(ROOT), text=True, capture_output=True, timeout=300,
            check=False,
        )
    except (FileNotFoundError, subprocess.TimeoutExpired) as exc:
        return f"Research could not run: {exc.__class__.__name__}."

    if result.returncode != 0:
        detail = (result.stderr or result.stdout or "").strip()
        return f"Research could not run (exit {result.returncode}): {detail or 'no error detail'}"

    output = (result.stdout or result.stderr or "").strip()
    return output or "Research returned no finding."


def extract_learning(response: str) -> str | None:
    match = re.search(r"^FINDING:\s*(.+)$", response, re.MULTILINE)
    return match.group(1).strip() if match else None


def write_report(timestamp: datetime, entries: list[dict[str, str]]) -> Path:
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    report_path = REPORTS_DIR / f"{timestamp.date().isoformat()}.md"
    lines = [
        f"# Daily Agent Learning Report - {timestamp.date().isoformat()}",
        "",
        f"Generated at: {timestamp.isoformat().replace('+00:00', 'Z')}",
        "",
    ]
    for entry in entries:
        lines.extend([
            f"## {entry['agent']}",
            "",
            entry["response"],
            "",
        ])
    report_path.write_text("\n".join(lines), encoding="utf-8")
    return report_path


def run_once(runner=subprocess.run) -> Path:
    timestamp = utc_now()
    entries = []
    report_path = REPORTS_DIR / f"{timestamp.date().isoformat()}.md"
    for agent_path in agent_paths():
        response = run_agent_research(agent_path, runner=runner)
        learning = extract_learning(response)
        if learning:
            record_learning(
                agent=agent_path.name,
                learning=learning,
                context="daily domain self-learning",
                evidence=str(report_path.relative_to(ROOT)),
            )
        entries.append({"agent": agent_path.name, "response": response})
    return write_report(timestamp, entries)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Run daily agent domain research")
    parser.add_argument("--once", action="store_true", help="Run one learning cycle and exit")
    parser.add_argument("--interval", type=int, default=DAILY_INTERVAL_SECONDS)
    return parser


def main() -> int:
    args = build_parser().parse_args()
    while True:
        report_path = run_once()
        print(f"Wrote daily agent learning report: {report_path}")
        if args.once:
            return 0
        time.sleep(args.interval)


if __name__ == "__main__":
    raise SystemExit(main())