#!/usr/bin/env python3
"""Create the aisena_tasks / aisena_issues tables and (optionally) backfill
them from the existing JSON stores:

  - project/tasks.json                         -> aisena_tasks
  - project/orchestrator/tickets/<app_id>.json  -> aisena_issues

Usage:
    python scripts/db/init_tasks_issues_db.py            # create tables only
    python scripts/db/init_tasks_issues_db.py --import   # create + backfill

Environment:
    POSTGRES_DSN  Connection string (default matches docker-compose.yml).
"""
import argparse
import json
import os
from pathlib import Path

import psycopg2

ROOT = Path(__file__).resolve().parents[2]
SCHEMA_SQL = (ROOT / "project" / "db" / "schema.sql").read_text(encoding="utf-8")

POSTGRES_DSN = os.environ.get("POSTGRES_DSN", "host=localhost dbname=aisena user=aisena ******")


def create_tables(conn):
    with conn.cursor() as cur:
        cur.execute(SCHEMA_SQL)
    conn.commit()


def import_tasks(conn):
    tasks_path = ROOT / "project" / "tasks.json"
    if not tasks_path.exists():
        print(f"No tasks.json found at {tasks_path}, skipping task import.")
        return 0
    tasks = json.loads(tasks_path.read_text(encoding="utf-8"))
    count = 0
    with conn.cursor() as cur:
        for t in tasks:
            cur.execute(
                """
                INSERT INTO aisena_tasks
                    (id, title, description, owner, status, priority, dependency,
                     next_checkpoint, tags, comments, activity_log, app_label,
                     created_at, updated_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (id) DO UPDATE SET
                    title = EXCLUDED.title,
                    description = EXCLUDED.description,
                    owner = EXCLUDED.owner,
                    status = EXCLUDED.status,
                    priority = EXCLUDED.priority,
                    dependency = EXCLUDED.dependency,
                    next_checkpoint = EXCLUDED.next_checkpoint,
                    tags = EXCLUDED.tags,
                    comments = EXCLUDED.comments,
                    activity_log = EXCLUDED.activity_log,
                    app_label = EXCLUDED.app_label,
                    updated_at = EXCLUDED.updated_at
                """,
                (
                    t.get("id"),
                    t.get("title"),
                    t.get("description"),
                    t.get("owner"),
                    t.get("status") or "Backlog",
                    t.get("priority") or "Medium",
                    t.get("dependency"),
                    t.get("next_checkpoint"),
                    json.dumps(t.get("tags") or []),
                    json.dumps(t.get("comments") or []),
                    json.dumps(t.get("activity_log") or []),
                    t.get("app_label"),
                    t.get("created_at"),
                    t.get("updated_at"),
                ),
            )
            count += 1
    conn.commit()
    return count


def import_issues(conn):
    tickets_dir = ROOT / "project" / "orchestrator" / "tickets"
    if not tickets_dir.exists():
        print(f"No tickets directory found at {tickets_dir}, skipping issue import.")
        return 0
    count = 0
    with conn.cursor() as cur:
        for ticket_file in tickets_dir.glob("*.json"):
            tickets = json.loads(ticket_file.read_text(encoding="utf-8"))
            for tk in tickets:
                cur.execute(
                    """
                    INSERT INTO aisena_issues
                        (id, app_id, title, description, attempted, why_blocked,
                         decision_needed, status, github_issue_number, created_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (id) DO UPDATE SET
                        app_id = EXCLUDED.app_id,
                        title = EXCLUDED.title,
                        description = EXCLUDED.description,
                        attempted = EXCLUDED.attempted,
                        why_blocked = EXCLUDED.why_blocked,
                        decision_needed = EXCLUDED.decision_needed,
                        status = EXCLUDED.status,
                        github_issue_number = EXCLUDED.github_issue_number
                    """,
                    (
                        tk.get("id"),
                        tk.get("app_id"),
                        tk.get("title"),
                        tk.get("description"),
                        tk.get("attempted"),
                        tk.get("why_blocked"),
                        tk.get("decision_needed"),
                        tk.get("status") or "open",
                        tk.get("github_issue_number"),
                        tk.get("created_at"),
                    ),
                )
                count += 1
    conn.commit()
    return count


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--import", dest="do_import", action="store_true",
                         help="Backfill tables from project/tasks.json and orchestrator ticket files.")
    args = parser.parse_args()

    conn = psycopg2.connect(POSTGRES_DSN)
    try:
        create_tables(conn)
        print("aisena_tasks / aisena_issues tables ready.")
        if args.do_import:
            n_tasks = import_tasks(conn)
            n_issues = import_issues(conn)
            print(f"Imported {n_tasks} task(s), {n_issues} issue(s).")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
