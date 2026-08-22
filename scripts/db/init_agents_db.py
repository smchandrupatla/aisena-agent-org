#!/usr/bin/env python3
"""Create the aisena_agents table and (optionally) backfill it from the
existing catalog file and AGENT.md content:

  - services/capabilities_site/agents.json  -> aisena_agents (metadata)
  - agents/<folder>/AGENT.md                -> aisena_agents.content

Usage:
    python scripts/db/init_agents_db.py            # create table only
    python scripts/db/init_agents_db.py --import   # create + backfill

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


def import_agents(conn):
    catalog_path = ROOT / "services" / "capabilities_site" / "agents.json"
    if not catalog_path.exists():
        print(f"No agents.json found at {catalog_path}, skipping agent import.")
        return 0
    agents = json.loads(catalog_path.read_text(encoding="utf-8"))
    count = 0
    with conn.cursor() as cur:
        for a in agents:
            agent_file = a.get("agentFile") or ""
            content_path = ROOT / agent_file if agent_file else None
            content = content_path.read_text(encoding="utf-8") if content_path and content_path.exists() else None
            cur.execute(
                """
                INSERT INTO aisena_agents
                    (id, key, folder, name, agent_group, focus, prompt, agent_file,
                     run_command, run_command_fallback, has_dedicated_runner, content)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (id) DO UPDATE SET
                    key = EXCLUDED.key,
                    folder = EXCLUDED.folder,
                    name = EXCLUDED.name,
                    agent_group = EXCLUDED.agent_group,
                    focus = EXCLUDED.focus,
                    prompt = EXCLUDED.prompt,
                    agent_file = EXCLUDED.agent_file,
                    run_command = EXCLUDED.run_command,
                    run_command_fallback = EXCLUDED.run_command_fallback,
                    has_dedicated_runner = EXCLUDED.has_dedicated_runner,
                    content = EXCLUDED.content,
                    updated_at = now()
                """,
                (
                    a.get("id"),
                    a.get("key"),
                    a.get("folder"),
                    a.get("name"),
                    a.get("group"),
                    a.get("focus"),
                    a.get("prompt"),
                    agent_file,
                    a.get("runCommand"),
                    a.get("runCommandFallback"),
                    bool(a.get("hasDedicatedRunner")),
                    content,
                ),
            )
            count += 1
    conn.commit()
    return count


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--import", dest="do_import", action="store_true",
                         help="Backfill aisena_agents from agents.json and AGENT.md files.")
    args = parser.parse_args()

    conn = psycopg2.connect(POSTGRES_DSN)
    try:
        create_tables(conn)
        print("aisena_agents table ready.")
        if args.do_import:
            n_agents = import_agents(conn)
            print(f"Imported {n_agents} agent(s).")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
