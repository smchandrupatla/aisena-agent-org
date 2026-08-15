#!/usr/bin/env python3
"""
Simple Agent Manager: run each agent's continuous self-learning loop in background.

Behavior:
- Scans `agents/` for agent folders containing `AGENT.md`.
- For each agent, periodically fetches recent screening results (from OpenSearch or Postgres),
  appends a short summary to a repo-scoped memory file under `memories/repo/` and updates
  the agent's `AGENT.md` with a last-updated timestamp.
- Commits the memory and AGENT.md changes to git locally.
- Loads docs/AGENTIC_AI_KNOWLEDGE_BASE.md on startup and enriches each agent's memory
  with KB sections relevant to that agent's declared skills (config.json `skills` array).

This is intentionally lightweight and deterministic (no heavy ML). Replace the
`learn_from_batch` placeholder with real training logic as needed.
"""
import os
import time
import threading
import logging
import subprocess
import sys
from pathlib import Path
import json
import datetime
import shutil

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from scripts.agents.daily_self_learning import run_once as run_daily_self_learning
try:
    import joblib
except Exception:
    joblib = None
try:
    from sklearn.linear_model import SGDClassifier
    from sklearn.preprocessing import StandardScaler
    from sklearn.pipeline import make_pipeline
    SKLEARN_AVAILABLE = True
except Exception:
    SKLEARN_AVAILABLE = False

try:
    import requests
except Exception:
    requests = None

try:
    import psycopg2
except Exception:
    psycopg2 = None

AGENTS_DIR = ROOT / 'agents'
MEMORIES_DIR = ROOT / 'memories' / 'repo'
MEMORIES_DIR.mkdir(parents=True, exist_ok=True)
MODELS_DIR = ROOT / 'models'
MODELS_DIR.mkdir(parents=True, exist_ok=True)
METRICS_FILE = ROOT / 'memories' / 'repo' / 'agent_metrics.json'
if not METRICS_FILE.exists():
    METRICS_FILE.write_text('{}')

KB_FILE = ROOT / 'docs' / 'AGENTIC_AI_KNOWLEDGE_BASE.md'


OPENSEARCH_URL = os.environ.get('OPENSEARCH_URL', 'http://opensearch:9200')
POSTGRES_DSN = os.environ.get('POSTGRES_DSN', 'host=postgres dbname=aisena user=aisena password=aisena_pw')

SLEEP_INTERVAL = int(os.environ.get('AGENT_LEARN_INTERVAL', '30'))
AUTO_PUSH = os.environ.get('AGENT_AUTO_PUSH', 'true').lower() in ('1','true','yes')
METRICS_PORT = int(os.environ.get('AGENT_METRICS_PORT', '9500'))
METRICS_PATH = os.environ.get('AGENT_METRICS_PATH', '/metrics')

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')



# ---------------------------------------------------------------------------
# Knowledge Base loader
# ---------------------------------------------------------------------------

def load_knowledge_base() -> dict:
    """Parse docs/AGENTIC_AI_KNOWLEDGE_BASE.md into {section_title: content}.

    Sections are identified by top-level ## headings. Returns {} if the file is
    missing or unreadable.
    """
    if not KB_FILE.exists():
        logging.warning('Knowledge base not found at %s', KB_FILE)
        return {}
    try:
        text = KB_FILE.read_text()
        sections = {}
        current_title = None
        current_lines: list = []
        for line in text.splitlines():
            if line.startswith('## '):
                if current_title is not None:
                    sections[current_title] = '\n'.join(current_lines).strip()
                current_title = line[3:].strip()
                current_lines = []
            else:
                current_lines.append(line)
        if current_title is not None:
            sections[current_title] = '\n'.join(current_lines).strip()
        logging.info('Knowledge base loaded: %d sections', len(sections))
        return sections
    except Exception:
        logging.exception('Failed to load knowledge base')
        return {}


# Skill key -> KB section titles that are relevant to that skill.
_SKILL_KB_MAP: dict = {
    'agent_skills.prompt_engineering':  ['Prompt Starter Patterns', 'Best Practices'],
    'agent_skills.tool_calling':        ['Core Components', 'Key Agent Capabilities'],
    'agent_skills.function_calling':    ['Core Components', 'Key Agent Capabilities'],
    'agent_skills.rag':                 ['Popular Tools & Frameworks', 'Core Components'],
    'agent_skills.memory':              ['Core Components', 'Popular Tools & Frameworks'],
    'agent_skills.multi_agent_systems': ['Types of Agents', 'Agent Loop (Plan -> Reason -> Act)'],
    'llms.openai_gpt':                  ['Popular Tools & Frameworks'],
    'llms.claude':                      ['Popular Tools & Frameworks'],
    'llms.gemini':                      ['Popular Tools & Frameworks'],
    'llms.llama':                       ['Popular Tools & Frameworks'],
    'ai_frameworks.langchain':          ['Popular Tools & Frameworks'],
    'ai_frameworks.langgraph':          ['Popular Tools & Frameworks'],
    'ai_frameworks.llamaindex':         ['Popular Tools & Frameworks'],
    'databases.vector_db_pinecone':     ['Popular Tools & Frameworks'],
    'databases.chromadb':               ['Popular Tools & Frameworks'],
    'databases.faiss':                  ['Popular Tools & Frameworks'],
    'databases.postgresql':             ['Popular Tools & Frameworks'],
    'apis.rest_api':                    ['Key Agent Capabilities'],
    'apis.mcp':                         ['Popular Tools & Frameworks'],
    'deployment.docker':                ['Popular Tools & Frameworks'],
    'deployment.aws':                   ['Popular Tools & Frameworks'],
    'foundations.python':               ['10-Step Agentic AI Development Roadmap'],
    'foundations.git':                  ['Agent Development Checklist'],
}

# KB loaded once at startup; shared read-only across all agent threads.
_KB_SECTIONS: dict = {}


def get_relevant_kb_sections(skills: list, kb: dict) -> list:
    """Return list of (title, excerpt) tuples from KB relevant to the agent's skills.

    Each excerpt is capped at 400 characters to keep memory entries readable.
    """
    if not kb or not skills:
        return []
    wanted: set = set()
    for skill in skills:
        for title in _SKILL_KB_MAP.get(skill, []):
            wanted.add(title)
    results = []
    for title in sorted(wanted):
        content = kb.get(title, '')
        if content:
            excerpt = content[:400] + ('...' if len(content) > 400 else '')
            results.append((title, excerpt))
    return results


def list_agents():
    if not AGENTS_DIR.exists():
        return []
    agents = [p for p in AGENTS_DIR.iterdir() if p.is_dir() and (p / 'AGENT.md').exists()]
    return agents


def fetch_recent_results_from_opensearch(limit=20):
    if requests is None:
        return []
    idx = 'aisena-stage0-screening-results'
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
        cur.execute("SELECT event, flagged, reason, created_at FROM aisena_screening_results ORDER BY created_at DESC LIMIT %s", (limit,))
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
    """Train a simple model using available features in the batch.

    If scikit-learn is available we train a small classifier on 'amount' -> flagged.
    Otherwise we compute a threshold (median of flagged amounts) and store JSON.
    Returns a summary dict with model path and simple accuracy on the batch.
    """
    n = len(batch)
    ts = datetime.datetime.utcnow().isoformat() + 'Z'
    # Extract features: use amount if present
    X = []
    y = []
    for e in batch:
        amt = None
        if isinstance(e, dict):
            amt = e.get('amount') or e.get('transaction_amount')
        if amt is None:
            continue
        try:
            X.append([float(amt)])
            y.append(1 if e.get('flagged') else 0)
        except Exception:
            continue

    model_info = {'learned_at': ts, 'count': n, 'examples': batch[:3]}

    if not X:
        model_info['model'] = None
        model_info['accuracy'] = None
        return model_info

    # Read agent config
    cfg = get_agent_config(agent_path)

    if SKLEARN_AVAILABLE:
        try:
            clf = make_pipeline(StandardScaler(), SGDClassifier(max_iter=1000, tol=1e-3, alpha=float(cfg.get('alpha', 0.0001))))
            clf.fit(X, y)
            preds = clf.predict(X)
            acc = sum(1 for a,b in zip(preds,y) if a==b)/len(y)
            model_path = MODELS_DIR / f'agent-{agent_path.name}-model.joblib'
            joblib.dump(clf, model_path)
            model_info['model'] = str(model_path)
            model_info['accuracy'] = acc
            return model_info
        except Exception:
            logging.exception('sklearn training failed; falling back to threshold')

    # Fallback: compute threshold
    flagged_amounts = [float(e.get('amount')) for e in batch if e.get('flagged') and e.get('amount')]
    if flagged_amounts:
        thresh = float(sorted(flagged_amounts)[max(0, len(flagged_amounts)//2)])
    else:
        thresh = sum(float(e.get('amount')) for e in batch if e.get('amount'))/len(batch)

    model_path = MODELS_DIR / f'agent-{agent_path.name}-model.json'
    model_data = {'type': 'threshold', 'threshold': thresh, 'created_at': ts}
    model_path.write_text(json.dumps(model_data))
    preds = [(1 if float(e.get('amount',0))>thresh else 0) for e in batch]
    ys = [1 if e.get('flagged') else 0 for e in batch]
    acc = sum(1 for a,b in zip(preds,ys) if a==b)/len(ys) if ys else None
    model_info['model'] = str(model_path)
    model_info['accuracy'] = acc
    return model_info


def get_agent_config(agent_path):
    cfg_file = agent_path / 'config.json'
    defaults = {'alpha': 0.0001, 'data_window': 50}
    try:
        if cfg_file.exists():
            return {**defaults, **json.loads(cfg_file.read_text())}
    except Exception:
        logging.exception('Failed to read config for %s', agent_path)
    return defaults


def update_agent_memory(agent_id, summary, kb_sections=None):
    """Append a learning entry to the agent's memory file.

    If kb_sections is provided (list of (title, excerpt) tuples from the knowledge
    base), the relevant KB context is appended so the agent has framework grounding
    alongside its operational data.
    """
    mem_file = MEMORIES_DIR / f'agent-{agent_id}.md'
    txt = f"- {summary['learned_at']}: learned {summary['count']} items\n"
    if 'accuracy' in summary:
        txt += f"  - accuracy: {summary['accuracy']}\n"
    txt += "  - examples: " + json.dumps(summary['examples'], default=str) + "\n"
    if kb_sections:
        txt += "  - kb_context:\n"
        for title, excerpt in kb_sections:
            safe_excerpt = excerpt.replace('\n', ' ')[:200]
            txt += f"    - [{title}]: {safe_excerpt}\n"
    txt += "\n"
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


def emit_metrics(agent_id, summary):
    metrics = {}
    if METRICS_FILE.exists():
        try:
            metrics = json.loads(METRICS_FILE.read_text())
        except Exception:
            logging.exception('Failed to load metrics file')
    metrics[agent_id] = {
        'learned_at': summary['learned_at'],
        'count': summary['count'],
        'accuracy': summary.get('accuracy'),
        'model': summary.get('model')
    }
    METRICS_FILE.write_text(json.dumps(metrics, indent=2))


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
        if AUTO_PUSH:
            try:
                subprocess.run(['git', 'push', 'origin', 'main'], cwd=str(ROOT), check=False)
                logging.info('Auto-pushed commits to origin/main')
            except Exception:
                logging.exception('Auto-push failed')
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

        # Resolve KB sections relevant to this agent once per cycle (cheap read).
        cfg = get_agent_config(agent_path)
        skills = cfg.get('skills', [])
        kb_sections = get_relevant_kb_sections(skills, _KB_SECTIONS) if _KB_SECTIONS else []
        if kb_sections:
            logging.debug('Agent %s: %d KB sections matched from %d skills', agent_id, len(kb_sections), len(skills))

        if batch:
            summary = learn_from_batch(agent_path, batch)
            mem_file = update_agent_memory(agent_id, summary, kb_sections=kb_sections)
            ag_md = touch_agent_manifest(agent_path)
            emit_metrics(agent_id, summary)
            git_commit([mem_file, ag_md, METRICS_FILE], f'agent({agent_id}): self-learning update {summary["learned_at"]}')
            logging.info('Agent %s learned %d items, %d KB sections', agent_id, summary['count'], len(kb_sections))
        else:
            logging.info('Agent %s: no data to learn from', agent_id)

        time.sleep(SLEEP_INTERVAL)


def start_metrics_server():
    from http.server import HTTPServer, BaseHTTPRequestHandler

    class MetricsHandler(BaseHTTPRequestHandler):
        def do_GET(self):
            if self.path == METRICS_PATH:
                output = []
                if METRICS_FILE.exists():
                    try:
                        metrics = json.loads(METRICS_FILE.read_text())
                    except Exception:
                        metrics = {}
                else:
                    metrics = {}
                for agent_id, values in metrics.items():
                    learned_at = values.get('learned_at', '0')
                    output.append(f'agent_last_learn_timestamp{{agent="{agent_id}"}} {int(datetime.datetime.fromisoformat(learned_at.replace("Z","+00:00")).timestamp()) if learned_at != "0" else 0}')
                    output.append(f'agent_learn_count{{agent="{agent_id}"}} {values.get("count", 0)}')
                    if values.get('accuracy') is not None:
                        output.append(f'agent_accuracy{{agent="{agent_id}"}} {values.get("accuracy")}')
                body = '\n'.join(output).encode('utf-8')
                self.send_response(200)
                self.send_header('Content-Type', 'text/plain; version=0.0.4')
                self.send_header('Content-Length', str(len(body)))
                self.end_headers()
                self.wfile.write(body)
            else:
                self.send_response(404)
                self.end_headers()

    httpd = HTTPServer(('0.0.0.0', METRICS_PORT), MetricsHandler)
    logging.info('Starting metrics server on http://0.0.0.0:%d%s', METRICS_PORT, METRICS_PATH)
    httpd.serve_forever()


def daily_self_learning_loop():
    """Run evidence-backed domain research independently of batch learning."""
    interval = int(os.environ.get('AGENT_DAILY_LEARNING_INTERVAL', '86400'))
    while True:
        try:
            report_path = run_daily_self_learning()
            logging.info('Daily self-learning report written to %s', report_path)
        except Exception:
            logging.exception('Daily self-learning cycle failed')
        time.sleep(interval)


def main():
    global _KB_SECTIONS
    _KB_SECTIONS = load_knowledge_base()
    if _KB_SECTIONS:
        logging.info('Agentic AI knowledge base active: %d sections available', len(_KB_SECTIONS))
    else:
        logging.warning('Agentic AI knowledge base unavailable — agents will run without KB context')

    agents = list_agents()
    if not agents:
        logging.warning('No agents found in agents/ - exiting')
        return
    threads = []
    for a in agents:
        t = threading.Thread(target=agent_loop, args=(a,), daemon=True)
        t.start()
        threads.append(t)

    metrics_thread = threading.Thread(target=start_metrics_server, daemon=True)
    metrics_thread.start()
    daily_learning_thread = threading.Thread(target=daily_self_learning_loop, daemon=True)
    daily_learning_thread.start()

    # Keep main thread alive
    try:
        while True:
            time.sleep(60)
    except KeyboardInterrupt:
        logging.info('Agent manager stopping')


if __name__ == '__main__':
    main()
