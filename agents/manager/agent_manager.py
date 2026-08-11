#!/usr/bin/env python3
"""
Simple Agent Manager: run each agent's continuous self-learning loop in background.

Behavior:
- Scans `agents/` for agent folders containing `AGENT.md`.
- For each agent, periodically fetches recent screening results (from OpenSearch or Postgres),
  appends a short summary to a repo-scoped memory file under `memories/repo/` and updates
  the agent's `AGENT.md` with a last-updated timestamp.
- Commits the memory and AGENT.md changes to git locally.

This is intentionally lightweight and deterministic (no heavy ML). Replace the
`learn_from_batch` placeholder with real training logic as needed.
"""
import os
import time
import threading
import logging
import subprocess
from pathlib import Path
import json
import datetime

try:
    import requests
except Exception:
    requests = None

try:
    import psycopg2
except Exception:
    psycopg2 = None

ROOT = Path(__file__).resolve().parents[2]
AGENTS_DIR = ROOT / 'agents'
MEMORIES_DIR = ROOT / 'memories' / 'repo'
MEMORIES_DIR.mkdir(parents=True, exist_ok=True)

OPENSEARCH_URL = os.environ.get('OPENSEARCH_URL', 'http://localhost:9200')
POSTGRES_DSN = os.environ.get('POSTGRES_DSN', 'host=localhost dbname=hsfs user=hsfs password=hsfs_pw')

SLEEP_INTERVAL = int(os.environ.get('AGENT_LEARN_INTERVAL', '30'))

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')


def list_agents():
    if not AGENTS_DIR.exists():
        return []
    agents = [p for p in AGENTS_DIR.iterdir() if p.is_dir() and (p / 'AGENT.md').exists()]
    return agents


def fetch_recent_results_from_opensearch(limit=20):
    if requests is None:
        return []
    idx = 'hsfs-stage0-screening-results'
    url = f"{OPENSEARCH_URL}/{idx}/_search?size={limit}&sort=ts:desc"
    try:
        r = requests.get(url, timeout=5)
        r.raise_for_status()
        data = r.json()
        hits = data.get('hits', {}).get('hits', [])
        return [h.get('_source') for h in hits]
    except Exception:
        logging.exception('OpenSearch query failed')
        return []


def fetch_recent_results_from_postgres(limit=20):
    if psycopg2 is None:
        return []
    try:
        conn = psycopg2.connect(POSTGRES_DSN)
        cur = conn.cursor()
        cur.execute("SELECT event, flagged, reason, created_at FROM hsfs_screening_results ORDER BY created_at DESC LIMIT %s", (limit,))
        rows = cur.fetchall()
        cur.close()
        conn.close()
        results = []
        for r in rows:
            results.append({'event': r[0], 'flagged': r[1], 'reason': r[2], 'created_at': r[3].isoformat() if r[3] else None})
        return results
    except Exception:
        logging.exception('Postgres query failed')
        return []


def learn_from_batch(agent_path, batch):
    """Placeholder learning function. Replace with real model updates.
    For now it summarizes the batch and returns a short note.
    """
    n = len(batch)
    ts = datetime.datetime.utcnow().isoformat() + 'Z'
    summary = {
        'learned_at': ts,
        'count': n,
        'examples': batch[:3]
    }
    return summary


def update_agent_memory(agent_id, summary):
    mem_file = MEMORIES_DIR / f'agent-{agent_id}.md'
    txt = f"- {summary['learned_at']}: learned {summary['count']} items\n"
    txt += "  - examples: " + json.dumps(summary['examples'], default=str) + "\n\n"
    with open(mem_file, 'a') as f:
        f.write(txt)
    return mem_file


def touch_agent_manifest(agent_path):
    ag_md = agent_path / 'AGENT.md'
    now = datetime.datetime.utcnow().isoformat() + 'Z'
    # Append or update Last-Updated field
    content = ag_md.read_text()
    if 'Last-Updated:' in content:
        lines = content.splitlines()
        out = []
        updated = False
        for L in lines:
            if L.startswith('Last-Updated:'):
                out.append(f'Last-Updated: {now}')
                updated = True
            else:
                out.append(L)
        if not updated:
            out.append(f'Last-Updated: {now}')
        ag_md.write_text('\n'.join(out) + '\n')
    else:
        with open(ag_md, 'a') as f:
            f.write(f'\nLast-Updated: {now}\n')
    return ag_md


def git_commit(files, message):
    try:
        index_lock = ROOT / '.git' / 'index.lock'
        # If a stale index.lock exists, and is older than 5s, remove it to allow commits.
        try:
            if index_lock.exists():
                age = time.time() - index_lock.stat().st_mtime
                if age > 5:
                    logging.warning('Removing stale git index.lock (age=%.1fs)', age)
                    index_lock.unlink()
        except Exception:
            logging.exception('Could not inspect/remove index.lock')

        cmd = ['git', 'add'] + [str(f) for f in files]
        subprocess.run(cmd, cwd=str(ROOT), check=False)
        subprocess.run(['git', 'commit', '-m', message], cwd=str(ROOT), check=False)
    except Exception:
        logging.exception('Git commit failed')


def agent_loop(agent_path: Path):
    agent_id = agent_path.name
    logging.info('Starting agent loop for %s', agent_id)
    while True:
        # Try OpenSearch first, then Postgres
        batch = fetch_recent_results_from_opensearch() if requests else []
        if not batch:
            batch = fetch_recent_results_from_postgres()

        if batch:
            summary = learn_from_batch(agent_path, batch)
            mem_file = update_agent_memory(agent_id, summary)
            ag_md = touch_agent_manifest(agent_path)
            git_commit([mem_file, ag_md], f'agent({agent_id}): self-learning update {summary["learned_at"]}')
            logging.info('Agent %s learned %d items', agent_id, summary['count'])
        else:
            logging.info('Agent %s: no data to learn from', agent_id)

        time.sleep(SLEEP_INTERVAL)


def main():
    agents = list_agents()
    if not agents:
        logging.warning('No agents found in agents/ - exiting')
        return
    threads = []
    for a in agents:
        t = threading.Thread(target=agent_loop, args=(a,), daemon=True)
        t.start()
        threads.append(t)

    # Keep main thread alive
    try:
        while True:
            time.sleep(60)
    except KeyboardInterrupt:
        logging.info('Agent manager stopping')


if __name__ == '__main__':
    main()
