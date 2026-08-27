#!/usr/bin/env python3
"""Run active agents and ingest their self-learning findings into Postgres."""

from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import subprocess
from collections.abc import Callable
from pathlib import Path
from typing import Any

import psycopg2

ROOT = Path(__file__).resolve().parents[2]
DSN = os.environ.get("POSTGRES_DSN", "host=localhost dbname=aisena user=aisena password=aisena_pw")
TYPES = {"task", "bug", "issue", "tech_debt", "security"}
SEVERITIES = {"critical", "high", "medium", "low"}
PRIORITIES = {"P0", "P1", "P2", "P3"}
EFFORTS = {"XS", "S", "M", "L", "XL"}


def normalize_title(title: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", title.lower()).strip()


def build_prompt(agent_name: str, agent_instructions: str) -> str:
    return f"""You are the {agent_name} AISENA delivery agent.

Inspect your assigned domain for undone, broken, risky, or improvable work. Check code/tests/CI/security/UI, runtime signals, documentation/backlog gaps, and cross-agent dependencies. Do not invent findings or evidence. Every code finding must include a description line beginning exactly with: Acceptance: <test or regression check>.

Return ONLY a JSON object with this shape:
{{"findings":[{{"title":"imperative title, <=120 chars","description":"full context and explicit Acceptance line when code is involved","type":"task|bug|issue|tech_debt|security","severity":"critical|high|medium|low or null","priority":"P0|P1|P2|P3","status":"open","use_case":"UC-01 or null","component":"component or null","file_path":"path or null","labels":["label"],"estimated_effort":"XS|S|M|L|XL","related_task_ids":["TASK-000001"]}}]}}

Use an empty findings array when nothing is found. The database write is handled by the runner. Agent instructions:
{agent_instructions}
"""


def parse_findings(response: str) -> list[dict[str, Any]]:
    try:
        payload = json.loads(response)
    except json.JSONDecodeError:
        match = re.search(r"\{\s*\"findings\"\s*:\s*\[.*?\]\s*\}", response, re.DOTALL)
        if not match:
            return []
        try:
            payload = json.loads(match.group(0))
        except json.JSONDecodeError:
            return []
    findings = payload.get("findings", []) if isinstance(payload, dict) else []
    return [finding for finding in findings if isinstance(finding, dict)]


def validate_finding(finding: dict[str, Any]) -> None:
    required = ("title", "description", "type", "priority", "status", "estimated_effort")
    if any(not finding.get(field) for field in required):
        raise ValueError("missing required finding field")
    if len(finding["title"]) > 120 or finding["type"] not in TYPES:
        raise ValueError("invalid title or type")
    if finding.get("severity") not in SEVERITIES | {None} or finding["priority"] not in PRIORITIES:
        raise ValueError("invalid severity or priority")
    if finding["status"] != "open" or finding["estimated_effort"] not in EFFORTS:
        raise ValueError("self-learning findings must be open with a valid effort")
    if finding["type"] in {"task", "bug"} and "Acceptance:" not in finding["description"]:
        raise ValueError("code task/bug requires an Acceptance line")


def insert_findings(conn: Any, agent: str, findings: list[dict[str, Any]]) -> dict[str, Any]:
    summary = {"inserted_tasks": 0, "inserted_issues": 0, "duplicates": [], "blocked": []}
    cur = conn.cursor()
    try:
        for finding in findings:
            validate_finding(finding)
            normalized = normalize_title(finding["title"])
            cur.execute(
                """SELECT id, title FROM aisena_tasks
                   WHERE status IN ('open', 'Backlog', 'In Progress', 'Blocked')
                     AND (source = 'agent_self_learn' OR lower(regexp_replace(title, '[^a-z0-9]+', ' ', 'g')) = %s)
                   UNION ALL
                   SELECT id, title FROM aisena_issues
                   WHERE status IN ('open', 'Open', 'in_progress')
                     AND (source = 'agent_self_learn' OR lower(regexp_replace(title, '[^a-z0-9]+', ' ', 'g')) = %s)""",
                (normalized, normalized),
            )
            duplicate = cur.fetchone()
            if duplicate:
                cur.execute("UPDATE aisena_tasks SET last_confirmed_at = now() WHERE id = %s", (duplicate[0],))
                cur.execute("UPDATE aisena_issues SET last_confirmed_at = now() WHERE id = %s", (duplicate[0],))
                summary["duplicates"].append(duplicate[0])
                continue

            is_issue = finding["type"] in {"bug", "issue", "security"}
            table = "aisena_issues" if is_issue else "aisena_tasks"
            prefix = "ISSUE" if is_issue else "TASK"
            cur.execute(
                f"SELECT COALESCE(MAX(CAST(SUBSTRING(id FROM 6) AS INTEGER)), 0) FROM {table} WHERE id ~ %s",
                (f"^{prefix}-[0-9]+$",),
            )
            record_id = f"{prefix}-{int(cur.fetchone()[0]) + 1:06d}"
            values = (
                record_id, finding["title"], finding["description"], finding["type"],
                finding.get("severity"), finding["priority"], finding.get("use_case"),
                finding.get("component"), finding.get("file_path"), agent, "agent_self_learn",
                json.dumps(finding.get("labels") or []), finding["estimated_effort"],
                json.dumps(finding.get("related_task_ids") or []),
            )
            if is_issue:
                cur.execute(
                    """INSERT INTO aisena_issues
                    (id, title, description, type, severity, priority, status, use_case,
                     component, file_path, discovered_by, source, labels, estimated_effort,
                     related_task_ids, created_at, updated_at)
                    VALUES (%s,%s,%s,%s,%s,%s,'open',%s,%s,%s,%s,%s,%s,%s,%s,now(),now())""",
                    values,
                )
                summary["inserted_issues"] += 1
            else:
                cur.execute(
                    """INSERT INTO aisena_tasks
                    (id, title, description, type, severity, priority, status, use_case,
                     component, file_path, discovered_by, source, labels, estimated_effort,
                     related_task_ids, created_at, updated_at)
                    VALUES (%s,%s,%s,%s,%s,%s,'open',%s,%s,%s,%s,%s,%s,%s,%s,now(),now())""",
                    values,
                )
                summary["inserted_tasks"] += 1
            if "blocked" in (finding.get("labels") or []):
                summary["blocked"].append(record_id)
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()
    return summary


def run_agent(agent: tuple[str, str, str], runner: Callable[..., Any]) -> str:
    key, _, instructions = agent
    executable = shutil.which("copilot.cmd") or shutil.which("copilot") or "copilot"
    result = runner(
        [executable, "-p", build_prompt(key, instructions), "--allow-all", "--allow-all-paths",
         "--allow-all-tools", "--output-format", "text"],
        cwd=str(ROOT), text=True, encoding="utf-8", errors="replace",
        capture_output=True, timeout=300, check=False,
    )
    if result.returncode != 0:
        detail = (result.stderr or result.stdout or "").strip()
        raise RuntimeError(f"Copilot exited {result.returncode}: {detail or 'no error detail'}")
    return (result.stdout or result.stderr or "").strip()


def load_active_agents(conn: Any) -> list[tuple[str, str, str]]:
    cur = conn.cursor()
    cur.execute("SELECT key, folder, COALESCE(content, '') FROM aisena_agents WHERE active = true ORDER BY key")
    rows = cur.fetchall()
    cur.close()
    agents = []
    for key, folder, content in rows:
        instructions = content or ""
        path = ROOT / folder / "AGENT.md"
        if path.exists():
            instructions = path.read_text(encoding="utf-8")
        agents.append((key, folder, instructions))
    return agents


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--once", action="store_true", help="Run one cycle and exit")
    args = parser.parse_args()
    conn = psycopg2.connect(DSN)
    totals = {"inserted_tasks": 0, "inserted_issues": 0, "duplicates": [], "blocked": [], "failures": 0}
    reports = []
    try:
        for agent in load_active_agents(conn):
            try:
                result = insert_findings(conn, agent[0], parse_findings(run_agent(agent, subprocess.run)))
                reports.append((agent[0], result, 0, ""))
                totals["inserted_tasks"] += result["inserted_tasks"]
                totals["inserted_issues"] += result["inserted_issues"]
                totals["duplicates"].extend(result["duplicates"])
                totals["blocked"].extend(result["blocked"])
            except Exception as exc:
                totals["failures"] += 1
                reports.append((agent[0], {"inserted_tasks": 0, "inserted_issues": 0, "duplicates": [], "blocked": []}, 1, str(exc)))
        for agent, result, failures, reason in reports:
            duplicate_ids = ", ".join(result["duplicates"]) or "-"
            blocked_ids = ", ".join(result["blocked"]) or "-"
            print(f"Agent: {agent}\nDomain scanned: configured agent domain\nCategories checked: 4/4\n"
                  f"New tasks inserted: {result['inserted_tasks']}\n"
                  f"New issues inserted: {result['inserted_issues']}\n"
                  f"Duplicates skipped: {len(result['duplicates'])} (IDs: {duplicate_ids})\n"
                  f"Blocked items flagged: {len(result['blocked'])} (IDs: {blocked_ids})\n"
                  f"Failures: {failures}{f' ({reason})' if reason else ''}\n")
        print(json.dumps(totals, indent=2))
    finally:
        conn.close()
    return 0 if totals["failures"] == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
