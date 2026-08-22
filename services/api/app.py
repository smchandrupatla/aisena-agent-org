#!/usr/bin/env python3
import json
import os
import re
import ssl
import subprocess
from base64 import b64encode
from datetime import datetime, timezone
from pathlib import Path
from urllib import error as urlerror
from urllib import parse as urlparse
from urllib import request as urlrequest

from flask import Flask, jsonify, request, send_from_directory, send_from_directory, send_from_directory

try:
    import psycopg2
    from psycopg2 import sql
except Exception:  # pragma: no cover - DB is optional in tests
    psycopg2 = None
    sql = None

app = Flask(__name__)

DSN = os.environ.get('POSTGRES_DSN', "host=localhost dbname=aisena user=aisena password=aisena_pw")
SENSITIVE_COLUMN_PATTERN = re.compile(r"(?:password|passwd|secret|token|api_key|credential|salt)", re.IGNORECASE)
SPLUNK_API_URL = os.environ.get("SPLUNK_API_URL", "https://splunk:8089").rstrip("/")
SPLUNK_USERNAME = os.environ.get("SPLUNK_USERNAME", "admin")
SPLUNK_PASSWORD = os.environ.get("SPLUNK_PASSWORD", "")
SPLUNK_INDEX = os.environ.get("SPLUNK_HEC_INDEX", "main")
DYNATRACE_API_URL = os.environ.get("DYNATRACE_API_URL", "").rstrip("/")
DYNATRACE_API_TOKEN = os.environ.get("DYNATRACE_API_TOKEN", "")
ROOT = Path(__file__).resolve().parents[2]
STATE_PATH = ROOT / "project" / "agent_transcripts.json"
STATUS_PATH = ROOT / "project" / "agent_status.json"
LEARNING_SCRIPT = ROOT / "scripts" / "agents" / "record_agent_learning.py"
SYNC_SCRIPT = ROOT / "services" / "capabilities_site" / "sync_self_learning.py"
ALLOWED_TOOLS = [
    "read_file",
    "grep_search",
    "list_dir",
    "run_in_terminal",
    "write_file",
    "copy_file",
    "fetch_web",
]


@app.after_request
def add_cors_headers(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type"
    return response


def utc_now_iso():
    return datetime.now(timezone.utc).isoformat()


TASK_COLUMNS = [
    "id", "title", "description", "owner", "status", "priority", "dependency",
    "next_checkpoint", "tags", "comments", "activity_log", "app_label",
    "created_at", "updated_at",
]


def _task_row_to_dict(row):
    return dict(zip(TASK_COLUMNS, row))


def load_tasks():
    """Load all tasks from the aisena_tasks table (Postgres), newest first."""
    if psycopg2 is None:
        return []
    conn = psycopg2.connect(DSN)
    try:
        cur = conn.cursor()
        cur.execute(
            f"SELECT {', '.join(TASK_COLUMNS)} FROM aisena_tasks ORDER BY created_at DESC"
        )
        rows = cur.fetchall()
        cur.close()
    finally:
        conn.close()
    tasks = [_task_row_to_dict(row) for row in rows]
    for task in tasks:
        for key in ("created_at", "updated_at"):
            if task.get(key) is not None:
                task[key] = task[key].isoformat()
    return tasks


def save_tasks(tasks):
    """Replace the full contents of aisena_tasks with the given task list.

    The FK on `dependency` is DEFERRABLE INITIALLY DEFERRED so a full
    delete+insert can happen in one transaction regardless of ordering.
    """
    if psycopg2 is None:
        return
    conn = psycopg2.connect(DSN)
    try:
        cur = conn.cursor()
        cur.execute("SET CONSTRAINTS ALL DEFERRED")
        cur.execute("DELETE FROM aisena_tasks")
        for task in tasks:
            cur.execute(
                """
                INSERT INTO aisena_tasks
                    (id, title, description, owner, status, priority, dependency,
                     next_checkpoint, tags, comments, activity_log, app_label,
                     created_at, updated_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    task.get("id"),
                    task.get("title"),
                    task.get("description"),
                    task.get("owner"),
                    task.get("status") or "Backlog",
                    task.get("priority") or "Medium",
                    task.get("dependency"),
                    task.get("next_checkpoint"),
                    json.dumps(task.get("tags") or []),
                    json.dumps(task.get("comments") or []),
                    json.dumps(task.get("activity_log") or []),
                    task.get("app_label"),
                    task.get("created_at") or utc_now_iso(),
                    task.get("updated_at") or utc_now_iso(),
                ),
            )
        conn.commit()
        cur.close()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def next_task_id(tasks):
    numbers = [int(t["id"].replace("TASK-", "")) for t in tasks if t["id"].startswith("TASK-")]
    next_num = max(numbers) + 1 if numbers else 1
    return f"TASK-{str(next_num).zfill(4)}"


def get_task_by_id(tasks, task_id):
    return next((t for t in tasks if t["id"] == task_id), None)


def load_json(path, default):
    if not path.exists():
        return default
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return default


def save_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2), encoding="utf-8")


def load_issues():
    return load_json(ROOT / "project" / "issues.json", [])


def save_issues(issues):
    save_json(ROOT / "project" / "issues.json", issues)


def find_issue(issues, issue_id):
    return next((i for i in issues if i["id"] == issue_id), None)


def generate_issue_id(issues):
    numbers = [int(i["id"].replace("ISSUE-", "")) for i in issues if i["id"].startswith("ISSUE-")]
    next_num = max(numbers) + 1 if numbers else 1
    return f"ISSUE-{str(next_num).zfill(4)}"


def add_comment(issue_id, comment):
    issues = load_issues()
    issue = find_issue(issues, issue_id)
    if not issue:
        return None
    # Initialize comments array if it doesn't exist
    if "comments" not in issue:
        issue["comments"] = []
    # Add comment with timestamp
    comment_entry = {
        "author": comment.get("author", "User"),
        "text": comment.get("text", ""),
        "timestamp": comment.get("timestamp", utc_now_iso()),
    }
    issue["comments"].append(comment_entry)
    save_issues(issues)
    return issue


def add_activity_log(issue_id, entry):
    issues = load_issues()
    issue = find_issue(issues, issue_id)
    if not issue:
        return None
    # Initialize activity_log array if it doesn't exist
    if "activity_log" not in issue:
        issue["activity_log"] = []
    issue["activity_log"].append(entry)
    save_issues(issues)
    return issue


def load_issues():
    issues_path = ROOT / "project" / "issues.json"
    if not issues_path.exists():
        return []
    try:
        return json.loads(issues_path.read_text(encoding="utf-8"))
    except Exception:
        return []


def save_issues(issues):
    issues_path = ROOT / "project" / "issues.json"
    save_json(issues_path, issues)


def find_issue(issues, issue_id):
    return next((i for i in issues if i["id"] == issue_id), None)


def generate_issue_id(issues):
    numbers = [int(i["id"].replace("ISSUE-", "")) for i in issues if i["id"].startswith("ISSUE-")]
    next_num = max(numbers) + 1 if numbers else 1
    return f"ISSUE-{str(next_num).zfill(4)}"


def fetch_results(limit=50):
    if psycopg2 is None:
        return []
    conn = psycopg2.connect(DSN)
    cur = conn.cursor()
    cur.execute(
        "SELECT id, event, flagged, reason, created_at FROM aisena_screening_results ORDER BY created_at DESC LIMIT %s",
        (limit,),
    )
    rows = cur.fetchall()
    cur.close()
    conn.close()
    results = []
    for r in rows:
        results.append(
            {
                "id": r[0],
                "event": r[1],
                "flagged": r[2],
                "reason": r[3],
                "created_at": r[4].isoformat() if r[4] else None,
            }
        )
    return results


AGENT_COLUMNS = [
    "id", "key", "folder", "name", "agent_group", "focus", "prompt", "agent_file",
    "run_command", "run_command_fallback", "has_dedicated_runner", "content",
    "created_at", "updated_at",
]

# Maps the JSON/API field name to its aisena_agents column for editable fields.
AGENT_EDITABLE_FIELDS = {
    "name": "name",
    "group": "agent_group",
    "focus": "focus",
    "prompt": "prompt",
    "runCommand": "run_command",
    "runCommandFallback": "run_command_fallback",
    "content": "content",
}


def _agent_row_to_dict(row):
    d = dict(zip(AGENT_COLUMNS, row))
    return {
        "id": d["id"],
        "key": d["key"],
        "folder": d["folder"],
        "name": d["name"],
        "group": d["agent_group"],
        "focus": d["focus"],
        "prompt": d["prompt"],
        "agentFile": d["agent_file"],
        "runCommand": d["run_command"],
        "runCommandFallback": d["run_command_fallback"],
        "hasDedicatedRunner": bool(d["has_dedicated_runner"]),
        "content": d["content"],
        "created_at": d["created_at"].isoformat() if d["created_at"] else None,
        "updated_at": d["updated_at"].isoformat() if d["updated_at"] else None,
    }


def load_agent_catalog():
    """Load the full agent directory from the aisena_agents table."""
    if psycopg2 is None:
        return []
    conn = psycopg2.connect(DSN)
    try:
        cur = conn.cursor()
        cur.execute(f"SELECT {', '.join(AGENT_COLUMNS)} FROM aisena_agents ORDER BY id")
        rows = cur.fetchall()
        cur.close()
    finally:
        conn.close()
    return [_agent_row_to_dict(row) for row in rows]


def next_agent_id(agents):
    numbers = [int(a["id"]) for a in agents if str(a.get("id") or "").isdigit()]
    next_num = max(numbers) + 1 if numbers else 0
    return str(next_num).zfill(2)


def create_agent(data):
    if psycopg2 is None:
        return None
    agents = load_agent_catalog()
    agent_id = data.get("id") or next_agent_id(agents)
    key = normalize_agent_key(data.get("key") or data.get("name") or agent_id)
    folder = data.get("folder") or f"{agent_id}-{key}"
    conn = psycopg2.connect(DSN)
    try:
        cur = conn.cursor()
        cur.execute(
            """
            INSERT INTO aisena_agents
                (id, key, folder, name, agent_group, focus, prompt, agent_file,
                 run_command, run_command_fallback, has_dedicated_runner, content)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (
                agent_id,
                key,
                folder,
                data.get("name") or key,
                data.get("group") or "Expanded Delivery",
                data.get("focus") or "",
                data.get("prompt") or "",
                f"agents/{folder}/AGENT.md",
                data.get("runCommand") or f"scripts/agents/run-agent.sh {folder}",
                data.get("runCommandFallback") or f"scripts/agents/run-agent.sh {folder}",
                bool(data.get("hasDedicatedRunner")),
                data.get("content") or "",
            ),
        )
        conn.commit()
        cur.close()
    finally:
        conn.close()
    return get_agent_by_id(agent_id)


def get_agent_by_id(agent_id):
    return next((a for a in load_agent_catalog() if a.get("id") == agent_id), None)


def update_agent(agent_id, data):
    if psycopg2 is None:
        return None
    sets = []
    values = []
    for json_key, column in AGENT_EDITABLE_FIELDS.items():
        if json_key in data:
            sets.append(f"{column} = %s")
            values.append(data[json_key])
    if not sets:
        return get_agent_by_id(agent_id)
    sets.append("updated_at = now()")
    values.append(agent_id)
    conn = psycopg2.connect(DSN)
    try:
        cur = conn.cursor()
        cur.execute(f"UPDATE aisena_agents SET {', '.join(sets)} WHERE id = %s", values)
        conn.commit()
        cur.close()
    finally:
        conn.close()
    return get_agent_by_id(agent_id)


def delete_agent(agent_id):
    if psycopg2 is None:
        return
    conn = psycopg2.connect(DSN)
    try:
        cur = conn.cursor()
        cur.execute("DELETE FROM aisena_agents WHERE id = %s", (agent_id,))
        conn.commit()
        cur.close()
    finally:
        conn.close()


def normalize_agent_key(agent_key):
    return (agent_key or "").strip().lower().replace("_", "-")


def find_agent(agent_reference):
    catalog = load_agent_catalog()
    ref = normalize_agent_key(str(agent_reference or ""))
    for agent in catalog:
        keys = [
            normalize_agent_key(agent.get("key")),
            normalize_agent_key(agent.get("id")),
            normalize_agent_key(agent.get("folder")),
            normalize_agent_key(agent.get("name")),
        ]
        if ref in keys:
            return agent
    return None


def get_agent_prompt(agent):
    content = agent.get("content")
    if content:
        return content
    agent_file = ROOT / (agent.get("agentFile") or "")
    if not agent_file.exists():
        return "You are a helpful delivery agent. Keep answers concise and aligned to the project context."
    return agent_file.read_text(encoding="utf-8")


def fallback_agent_response(agent, user_message, peer_review=False):
    """Provide a useful local response when the optional Copilot CLI is unavailable."""
    role = agent.get("name", "Selected agent")
    focus = agent.get("focus", "the requested delivery work")
    message = (user_message or "").strip()
    lowered = message.lower()
    if peer_review:
        verdict = "AMBER"
        if any(term in lowered for term in ("security", "secret", "production", "legal", "user data")):
            verdict = "RED"
        elif any(term in lowered for term in ("test", "validated", "rollback", "monitor")):
            verdict = "GREEN"
        return (
            f"{role} local cross-check: {verdict}.\n"
            f"Review focus: {focus}.\n"
            "Action items: confirm the owner and acceptance criteria; identify dependencies and rollback steps; "
            "run a focused test before approval. The Copilot CLI is unavailable, so this is a local rule-based review."
        )

    if any(term in lowered for term in ("top 3", "next 3", "next actions", "what should", "priority")):
        answer = "1. Confirm the outcome and acceptance criteria. 2. Identify the highest-risk dependency. 3. Define the next testable delivery slice."
    elif "summar" in lowered:
        answer = f"Focus on {focus}; capture the current decision, risks, owner, and next checkpoint."
    elif "risk" in lowered or "block" in lowered:
        answer = "Check production impact, data exposure, security controls, dependencies, and rollback readiness before proceeding."
    else:
        answer = f"I can help with {focus}. Start by stating the desired outcome, constraints, and evidence needed for the next decision."
    return f"{role} local assistant: {answer} The Copilot CLI is unavailable, so this response uses the local delivery fallback."


def redact_secrets(text):
    if not isinstance(text, str):
        return ""
    patterns = [
        r"(?i)(ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_\-]{20,}|AKIA[0-9A-Z]{16}|sk-[A-Za-z0-9]{20,}|xox[baprs]-[A-Za-z0-9-]+|-----BEGIN [A-Z ]*PRIVATE KEY-----)",
        r"(?i)(password|secret|token|api[_-]?key)\s*[:=]\s*['\"][^'\"]+['\"]",
    ]
    redacted = text
    for pattern in patterns:
        redacted = re.sub(pattern, "[REDACTED]", redacted)
    return redacted


def load_transcript(agent_key):
    state = load_json(STATE_PATH, {})
    if not isinstance(state, dict):
        state = {}
    transcript = state.get(agent_key, [])
    return transcript if isinstance(transcript, list) else []


def save_transcript(agent_key, transcript):
    state = load_json(STATE_PATH, {})
    if not isinstance(state, dict):
        state = {}
    state[agent_key] = transcript
    save_json(STATE_PATH, state)


def set_agent_status(agent_key, status, message):
    status_state = load_json(STATUS_PATH, {})
    if not isinstance(status_state, dict):
        status_state = {}
    status_state[agent_key] = {
        "status": status,
        "message": message,
        "updated_at": utc_now_iso(),
    }
    save_json(STATUS_PATH, status_state)


def get_agent_status(agent_key):
    status_state = load_json(STATUS_PATH, {})
    if not isinstance(status_state, dict):
        return {"status": "ready", "message": "Ready"}
    entry = status_state.get(agent_key, {})
    return {
        "status": entry.get("status", "ready"),
        "message": entry.get("message", "Ready"),
        "updated_at": entry.get("updated_at", utc_now_iso()),
    }


def build_agent_prompt(agent, user_message, history):
    system_prompt = get_agent_prompt(agent)
    trimmed_history = history[-8:]
    history_block = "\n".join(
        f"{item.get('role', 'user').capitalize()}: {item.get('text', '')}" for item in trimmed_history
    )
    return f"""You are {agent.get('name', 'Agent')}.

Core responsibilities:
- Stay aligned to the AGENT.md instructions below.
- Be concise, actionable, and practical.
- Never reveal secrets, tokens, private keys, credentials, or raw environment values.
- Use only the allowed tool actions when the request requires an operational check.
- If the user asks for secrets or credentials, refuse and recommend a safe alternative.

Allowed tools: {', '.join(ALLOWED_TOOLS)}

AGENT.md:
{system_prompt}

Recent transcript:
{history_block}

Latest user request:
{redact_secrets(user_message)}

Reply in plain text, no markdown fences, and keep it focused.
"""


def run_copilot_message(agent, user_message, history, peer_review=False):
    prompt = build_agent_prompt(agent, user_message, history)
    try:
        proc = subprocess.run(
            [
                "copilot",
                "-p",
                prompt,
                "--allow-all",
                "--allow-all-paths",
                "--allow-all-tools",
                "--output-format",
                "text",
            ],
            cwd=str(ROOT),
            text=True,
            capture_output=True,
            timeout=120,
        )
    except FileNotFoundError:
        return fallback_agent_response(agent, user_message, peer_review=peer_review)
    except subprocess.TimeoutExpired:
        return "The agent runtime timed out. Please rephrase the request in a shorter, more specific ask."

    if proc.returncode != 0:
        return fallback_agent_response(agent, user_message, peer_review=peer_review)
    output = proc.stdout.strip() or proc.stderr.strip()
    if not output:
        output = "I cannot complete this request right now. Please try a more specific prompt."
    return redact_secrets(output)


def enforce_guardrails(agent_key, user_message, tool_actions):
    safe_message = redact_secrets(user_message or "")
    secret_like = bool(re.search(r"(?i)(password|secret|token|api[_-]?key|private key)", safe_message))
    if secret_like:
        return False, "I cannot expose or process secrets. Use a secure vault or environment variable instead."

    disallowed = [tool for tool in (tool_actions or []) if tool not in ALLOWED_TOOLS]
    if disallowed:
        return False, f"Tool action not allowed: {', '.join(disallowed)}. Allowed tools are: {', '.join(ALLOWED_TOOLS)}."
    return True, "ok"


@app.route('/health')
def health():
    return jsonify({"ok": True, "service": "agent-runtime"})


@app.route('/results')
def results():
    return jsonify(fetch_results())


@app.route('/self-learning/trigger', methods=['POST', 'OPTIONS'])
def trigger_self_learning():
    if request.method == 'OPTIONS':
        return ('', 204)

    payload = request.get_json(silent=True) or {}
    required = ["agent", "learning", "context", "evidence"]
    missing = [field for field in required if not payload.get(field)]
    if missing:
        return jsonify({"error": f"Missing fields: {', '.join(missing)}"}), 400

    cmd = [
        "python3",
        str(LEARNING_SCRIPT),
        "--agent",
        payload["agent"],
        "--learning",
        payload["learning"],
        "--context",
        payload["context"],
        "--evidence",
        payload["evidence"],
    ]

    run = subprocess.run(cmd, cwd=str(ROOT), text=True, capture_output=True)
    if run.returncode != 0:
        return jsonify({
            "error": "record_agent_learning failed",
            "stdout": run.stdout,
            "stderr": run.stderr,
        }), 500

    sync_run = subprocess.run(["python3", str(SYNC_SCRIPT)], cwd=str(ROOT), text=True, capture_output=True)
    if sync_run.returncode != 0:
        return jsonify({
            "error": "sync_self_learning failed",
            "stdout": sync_run.stdout,
            "stderr": sync_run.stderr,
        }), 500

    return jsonify({
        "ok": True,
        "message": "Self-learning recorded and synced",
        "sync_output": sync_run.stdout.strip(),
    })


@app.route('/api/agents', methods=['GET'])
def get_agents():
    catalog = load_agent_catalog()
    enriched = []
    for agent in catalog:
        key = agent.get("key")
        status = get_agent_status(key)
        enriched.append({
            **agent,
            "status": status.get("status", "ready"),
            "statusMessage": status.get("message", "Ready"),
        })
    return jsonify({"agents": enriched, "generated_at": utc_now_iso()})


@app.route('/api/agents', methods=['POST'])
def create_agent_endpoint():
    data = request.get_json(silent=True) or {}
    name = (data.get('name') or '').strip()
    if not name:
        return jsonify({"error": "Name is required"}), 400
    if find_agent(data.get('key') or name) is not None:
        return jsonify({"error": "An agent with this key already exists"}), 409
    agent = create_agent(data)
    return jsonify({"agent": agent}), 201


@app.route('/api/agents/<agent_key>', methods=['GET'])
def get_agent_detail(agent_key):
    agent = find_agent(agent_key)
    if agent is None:
        return jsonify({"error": "Unknown agent"}), 404
    return jsonify({"agent": agent})


@app.route('/api/agents/<agent_key>', methods=['PUT'])
def update_agent_endpoint(agent_key):
    agent = find_agent(agent_key)
    if agent is None:
        return jsonify({"error": "Unknown agent"}), 404
    data = request.get_json(silent=True) or {}
    updated = update_agent(agent["id"], data)
    return jsonify({"agent": updated})


@app.route('/api/agents/<agent_key>', methods=['DELETE'])
def delete_agent_endpoint(agent_key):
    agent = find_agent(agent_key)
    if agent is None:
        return jsonify({"error": "Unknown agent"}), 404
    delete_agent(agent["id"])
    return jsonify({"message": "Agent deleted"}), 200


@app.route('/api/agents/<agent_key>/message', methods=['POST', 'OPTIONS'])
def send_agent_message(agent_key):
    if request.method == 'OPTIONS':
        return ('', 204)

    payload = request.get_json(silent=True) or {}
    message = payload.get("message") or payload.get("prompt") or ""
    tool_actions = payload.get("tool_actions") or []
    if not isinstance(tool_actions, list):
        tool_actions = [str(tool_actions)]

    if not message.strip():
        return jsonify({"error": "A message is required."}), 400

    agent = find_agent(agent_key)
    if agent is None:
        return jsonify({"error": f"Unknown agent: {agent_key}"}), 404

    allowed, guardrail_response = enforce_guardrails(agent_key, message, tool_actions)
    if not allowed:
        set_agent_status(agent.get("key"), "blocked", guardrail_response)
        return jsonify({"reply": guardrail_response, "status": "blocked", "status_message": guardrail_response}), 200

    set_agent_status(agent.get("key"), "busy", "Generating response...")
    transcript = load_transcript(agent.get("key"))
    user_entry = {"role": "user", "text": redact_secrets(message), "timestamp": utc_now_iso()}
    transcript.append(user_entry)

    response_text = run_copilot_message(agent, message, transcript)
    assistant_entry = {
        "role": "assistant",
        "text": response_text,
        "tool_actions": tool_actions,
        "timestamp": utc_now_iso(),
    }
    transcript.append(assistant_entry)
    transcript = transcript[-12:]
    save_transcript(agent.get("key"), transcript)
    set_agent_status(agent.get("key"), "ready", "Ready for the next prompt")

    return jsonify({
        "reply": response_text,
        "status": "ready",
        "status_message": "Ready for the next prompt",
        "tool_log": tool_actions,
        "transcript_length": len(transcript),
    })


@app.route('/api/agents/cross-check', methods=['POST', 'OPTIONS'])
def agent_cross_check():
    if request.method == 'OPTIONS':
        return ('', 204)

    payload = request.get_json(silent=True) or {}
    primary_agent_ref = payload.get("primary_agent") or "implementation-manager"
    peer_agent_ref = payload.get("peer_agent") or "security-engineer"
    turn_cap = max(1, min(int(payload.get("turn_cap", 2) or 2), 4))
    prompt = payload.get("prompt") or "Review this plan for risks and clear next actions."

    primary_agent = find_agent(primary_agent_ref)
    peer_agent = find_agent(peer_agent_ref)
    if primary_agent is None or peer_agent is None:
        return jsonify({"error": "Both primary and peer agents must be valid."}), 400

    turns = []
    for turn in range(turn_cap):
        primary_message = prompt if turn == 0 else f"Review your own answer and tighten the plan for clarity and delivery confidence."
        primary_reply = run_copilot_message(primary_agent, primary_message, load_transcript(primary_agent.get("key")))
        turns.append({
            "speaker": primary_agent.get("name"),
            "turn": turn + 1,
            "reply": primary_reply,
        })

        peer_message = (
            f"Review this proposal from {primary_agent.get('name')}:\n{primary_reply}\n\n"
            "Compare it against your domain expertise and provide a red/amber/green verdict with action items."
        )
        peer_reply = run_copilot_message(peer_agent, peer_message, load_transcript(peer_agent.get("key")), peer_review=True)
        turns.append({
            "speaker": peer_agent.get("name"),
            "turn": turn + 1,
            "reply": peer_reply,
        })

    summary = (
        f"Cross-check summary between {primary_agent.get('name')} and {peer_agent.get('name')} "
        f"with a turn cap of {turn_cap}.\n"
        + "\n".join(
            f"{item['speaker']} (turn {item['turn']}): {item['reply']}" for item in turns
        )
    )
    return jsonify({
        "primary_agent": primary_agent.get("key"),
        "peer_agent": peer_agent.get("key"),
        "turn_cap": turn_cap,
        "summary": summary,
        "turns": turns,
    })


@app.route('/api/agents/<agent_key>/status', methods=['GET'])
def agent_status(agent_key):
    agent = find_agent(agent_key)
    if agent is None:
        return jsonify({"error": "Unknown agent"}), 404
    status = get_agent_status(agent.get("key"))
    return jsonify({"agent": agent.get("key"), **status})


@app.route('/kafka-messages')
def kafka_messages():
    results = fetch_results(limit=50)
    messages = []
    for r in results:
        messages.append({
            "content": r["event"],
            "timestamp": r["created_at"],
            "topic": "aisena-screening-results"
        })
    return jsonify({"messages": messages})


@app.route('/db-tables')
def db_tables():
    if psycopg2 is None:
        return jsonify({"error": "Database driver not available"}), 500
    conn = psycopg2.connect(DSN)
    cur = conn.cursor()
    cur.execute("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;")
    tables = [row[0] for row in cur.fetchall()]
    cur.close()
    conn.close()
    return jsonify({
        "tables": tables,
        "aisena_tables": [name for name in tables if name.startswith("aisena_")],
        "application_tables": [name for name in tables if not name.startswith("aisena_")],
    })


@app.route('/db-tables/<table_name>')
def db_table_contents(table_name):
    if psycopg2 is None or sql is None:
        return jsonify({"error": "Database driver not available"}), 500

    limit = min(max(request.args.get("limit", 100, type=int), 1), 200)
    conn = psycopg2.connect(DSN)
    cur = conn.cursor()
    cur.execute(
        "SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = %s",
        (table_name,),
    )
    if cur.fetchone() is None:
        cur.close()
        conn.close()
        return jsonify({"error": "Table not found"}), 404

    cur.execute(sql.SQL("SELECT * FROM {} LIMIT %s").format(sql.Identifier(table_name)), (limit,))
    columns = [description[0] for description in cur.description]
    rows = []
    for row in cur.fetchall():
        rendered_row = []
        for column, value in zip(columns, row):
            if SENSITIVE_COLUMN_PATTERN.search(column):
                rendered_row.append("[REDACTED]")
            else:
                rendered_row.append(value if isinstance(value, (str, int, float, bool, type(None))) else str(value))
        rows.append(rendered_row)
    cur.close()
    conn.close()
    return jsonify({"table": table_name, "columns": columns, "rows": rows, "limit": limit})


def external_request(url, headers=None, data=None, insecure=False):
    request_headers = {"Accept": "application/json", **(headers or {})}
    request_data = urlparse.urlencode(data).encode("utf-8") if data is not None else None
    context = ssl._create_unverified_context() if insecure else None
    req = urlrequest.Request(url, data=request_data, headers=request_headers)
    with urlrequest.urlopen(req, timeout=15, context=context) as response:
        return response.read().decode("utf-8")


def integration_error(provider, error):
    if isinstance(error, urlerror.HTTPError):
        detail = f"{provider} returned HTTP {error.code}."
    elif isinstance(error, urlerror.URLError):
        detail = f"{provider} could not be reached."
    else:
        detail = f"{provider} request failed."
    return jsonify({"provider": provider.lower(), "status": "unavailable", "message": detail, "events": []})


@app.route('/observability/splunk')
def splunk_observability():
    if not SPLUNK_PASSWORD:
        return jsonify({
            "provider": "splunk",
            "status": "not_configured",
            "message": "Set SPLUNK_PASSWORD and start the enterprise-observability profile.",
            "events": [],
        })

    limit = min(max(request.args.get("limit", 50, type=int), 1), 100)
    query = request.args.get("query", "service.namespace=aisena").strip() or "service.namespace=aisena"
    search = f'search index="{SPLUNK_INDEX}" {query}'
    credentials = b64encode(f"{SPLUNK_USERNAME}:{SPLUNK_PASSWORD}".encode("utf-8")).decode("ascii")
    try:
        payload = external_request(
            f"{SPLUNK_API_URL}/services/search/jobs/export",
            headers={"Authorization": f"Basic {credentials}"},
            data={
                "search": search,
                "earliest_time": "-24h",
                "latest_time": "now",
                "output_mode": "json",
                "count": limit,
            },
            insecure=True,
        )
        events = []
        for line in payload.splitlines():
            if not line.strip():
                continue
            item = json.loads(line)
            result = item.get("result", {})
            events.append({
                "timestamp": result.get("_time"),
                "source": result.get("source") or result.get("host") or "splunk",
                "service": result.get("service.name") or result.get("service") or "aisena",
                "message": result.get("_raw") or result.get("message") or json.dumps(result),
            })
            if len(events) >= limit:
                break
        return jsonify({"provider": "splunk", "status": "connected", "query": query, "events": events})
    except (ValueError, urlerror.URLError, urlerror.HTTPError, TimeoutError) as error:
        return integration_error("Splunk", error)


@app.route('/observability/dynatrace')
def dynatrace_observability():
    if not DYNATRACE_API_URL or not DYNATRACE_API_TOKEN:
        return jsonify({
            "provider": "dynatrace",
            "status": "not_configured",
            "message": "Set DYNATRACE_API_URL and a token with logs.read scope.",
            "events": [],
        })

    limit = min(max(request.args.get("limit", 50, type=int), 1), 100)
    query = request.args.get("query", 'service.namespace="aisena"').strip() or 'service.namespace="aisena"'
    params = urlparse.urlencode({"query": query, "from": "now-24h", "pageSize": limit})
    try:
        payload = json.loads(external_request(
            f"{DYNATRACE_API_URL}/api/v2/logs/search?{params}",
            headers={"Authorization": f"Api-Token {DYNATRACE_API_TOKEN}"},
        ))
        records = payload.get("results") or payload.get("logs") or []
        events = []
        for result in records[:limit]:
            content = result.get("content") or result.get("message") or result
            events.append({
                "timestamp": result.get("timestamp") or result.get("@timestamp"),
                "source": result.get("host.name") or result.get("source") or "dynatrace",
                "service": result.get("service.name") or result.get("service.namespace") or "aisena",
                "message": content if isinstance(content, str) else json.dumps(content),
            })
        return jsonify({"provider": "dynatrace", "status": "connected", "query": query, "events": events})
    except (ValueError, urlerror.URLError, urlerror.HTTPError, TimeoutError) as error:
        return integration_error("Dynatrace", error)


# Test Dashboard API endpoints (test plans + test runs)
TEST_PLANS_PATH = ROOT / "project" / "test_plans.json"
TEST_RUNS_PATH = ROOT / "project" / "test_runs.json"
TEST_PLAN_STATUSES = ["Draft", "Active", "Completed"]
TEST_RUN_STATUSES = ["passed", "failed", "error", "running", "not_run"]


def load_test_plans():
    return load_json(TEST_PLANS_PATH, [])


def save_test_plans(plans):
    save_json(TEST_PLANS_PATH, plans)


def load_test_runs():
    return load_json(TEST_RUNS_PATH, [])


def save_test_runs(runs):
    save_json(TEST_RUNS_PATH, runs)


def next_test_plan_id(plans):
    numbers = [int(p["id"].replace("PLAN-", "")) for p in plans if p["id"].startswith("PLAN-")]
    return f"PLAN-{str((max(numbers) + 1) if numbers else 1).zfill(4)}"


def next_test_run_id(runs):
    numbers = [int(r["id"].replace("RUN-", "")) for r in runs if r["id"].startswith("RUN-")]
    return f"RUN-{str((max(numbers) + 1) if numbers else 1).zfill(4)}"


def find_test_plan(plans, plan_id):
    return next((p for p in plans if p["id"] == plan_id), None)


def test_run_summary(run):
    total = run.get("total")
    passed = run.get("passed")
    if not total:
        return None
    return round((passed or 0) / total * 100, 1)


@app.route('/api/test-plans', methods=['GET'])
def get_test_plans():
    plans = load_test_plans()
    runs = load_test_runs()
    enriched = []
    for plan in plans:
        plan_runs = [r for r in runs if r.get("plan_id") == plan["id"]]
        latest_run = plan_runs[-1] if plan_runs else None
        enriched.append({
            **plan,
            "run_count": len(plan_runs),
            "latest_run": latest_run,
            "pass_rate": test_run_summary(latest_run) if latest_run else None,
        })
    return jsonify({"plans": enriched})


@app.route('/api/test-plans', methods=['POST'])
def create_test_plan():
    data = request.get_json(silent=True) or {}
    title = (data.get('title') or '').strip()
    if not title:
        return jsonify({"error": "Title is required"}), 400
    status = data.get('status') if data.get('status') in TEST_PLAN_STATUSES else 'Draft'
    suites = data.get('suites') if isinstance(data.get('suites'), list) else []

    plans = load_test_plans()
    now = utc_now_iso()
    new_plan = {
        "id": next_test_plan_id(plans),
        "title": title,
        "description": data.get('description') or '',
        "owner": (data.get('owner') or '').strip(),
        "status": status,
        "suites": suites,
        "created_at": now,
        "updated_at": now,
    }
    plans.append(new_plan)
    save_test_plans(plans)
    return jsonify({"plan": new_plan}), 201


@app.route('/api/test-plans/<plan_id>', methods=['PUT'])
def update_test_plan(plan_id):
    data = request.get_json(silent=True) or {}
    plans = load_test_plans()
    plan = find_test_plan(plans, plan_id)
    if not plan:
        return jsonify({"error": "Test plan not found"}), 404

    if 'title' in data and str(data['title']).strip():
        plan['title'] = data['title'].strip()
    if 'description' in data:
        plan['description'] = data['description'] or ''
    if 'owner' in data:
        plan['owner'] = data['owner'] or ''
    if 'status' in data and data['status'] in TEST_PLAN_STATUSES:
        plan['status'] = data['status']
    if 'suites' in data and isinstance(data['suites'], list):
        plan['suites'] = data['suites']
    plan['updated_at'] = utc_now_iso()

    save_test_plans(plans)
    return jsonify({"plan": plan})


@app.route('/api/test-runs', methods=['GET'])
def get_test_runs():
    runs = load_test_runs()
    suite = request.args.get('suite')
    plan_id = request.args.get('plan_id')
    if suite:
        runs = [r for r in runs if r.get('suite') == suite]
    if plan_id:
        runs = [r for r in runs if r.get('plan_id') == plan_id]
    limit = request.args.get('limit', type=int)
    runs = sorted(runs, key=lambda r: r.get('started_at') or '', reverse=True)
    if limit:
        runs = runs[:limit]
    return jsonify({"runs": runs})


@app.route('/api/test-runs/<run_id>', methods=['GET'])
def get_test_run(run_id):
    runs = load_test_runs()
    run = next((r for r in runs if r["id"] == run_id), None)
    if not run:
        return jsonify({"error": "Test run not found"}), 404
    return jsonify({"run": run})


@app.route('/api/test-runs', methods=['POST'])
def create_test_run():
    data = request.get_json(silent=True) or {}
    suite = (data.get('suite') or '').strip()
    if not suite:
        return jsonify({"error": "Suite is required"}), 400
    status = data.get('status') if data.get('status') in TEST_RUN_STATUSES else 'running'

    runs = load_test_runs()
    new_run = {
        "id": next_test_run_id(runs),
        "plan_id": data.get('plan_id'),
        "suite": suite,
        "status": status,
        "started_at": data.get('started_at') or utc_now_iso(),
        "finished_at": data.get('finished_at'),
        "duration_seconds": data.get('duration_seconds'),
        "total": data.get('total'),
        "passed": data.get('passed'),
        "failed": data.get('failed'),
        "skipped": data.get('skipped'),
        "triggered_by": data.get('triggered_by') or 'manual',
        "environment": data.get('environment') or '',
        "notes": data.get('notes') or '',
        "cases": data.get('cases') if isinstance(data.get('cases'), list) else [],
    }
    runs.append(new_run)
    save_test_runs(runs)
    return jsonify({"run": new_run}), 201


@app.route('/api/test-summary', methods=['GET'])
def get_test_summary():
    plans = load_test_plans()
    runs = load_test_runs()
    latest_by_suite = {}
    for run in sorted(runs, key=lambda r: r.get('started_at') or ''):
        latest_by_suite[run['suite']] = run

    executed = [r for r in latest_by_suite.values() if r['status'] != 'not_run']
    passing = [r for r in executed if r['status'] == 'passed']
    total_cases = sum(r.get('total') or 0 for r in executed)
    passed_cases = sum(r.get('passed') or 0 for r in executed)

    return jsonify({
        "plan_count": len(plans),
        "suite_count": len(latest_by_suite),
        "executed_suite_count": len(executed),
        "passing_suite_count": len(passing),
        "overall_case_pass_rate": round(passed_cases / total_cases * 100, 1) if total_cases else None,
        "suites": [
            {
                "suite": suite,
                "status": run['status'],
                "pass_rate": test_run_summary(run),
                "last_run_id": run['id'],
                "last_run_at": run.get('started_at'),
            }
            for suite, run in latest_by_suite.items()
        ],
    })


@app.route('/test-dashboard')
def test_dashboard_page():
    return send_from_directory('.', 'test-dashboard.html')


# Task API endpoints
TASK_STATUSES = ["Backlog", "Planned", "In Progress", "Blocked", "In Review", "Done"]
TASK_PRIORITIES = ["Low", "Medium", "High", "Critical"]
TASK_EDITABLE_FIELDS = [
    "title", "description", "owner", "status", "priority",
    "dependency", "next_checkpoint", "tags", "app_label",
]


def add_task_activity(task, actor, action, details):
    task.setdefault("activity_log", []).append({
        "timestamp": utc_now_iso(),
        "actor": actor,
        "action": action,
        "details": details,
    })


@app.route('/api/tasks', methods=['GET'])
def get_tasks():
    app_label = request.args.get('app_label')
    tasks = load_tasks()
    if app_label:
        tasks = [t for t in tasks if (t.get('app_label') or '') == app_label]
    return jsonify({"tasks": tasks})


@app.route('/api/tasks', methods=['POST'])
def create_task():
    data = request.get_json(silent=True) or {}
    title = (data.get('title') or '').strip()
    if not title:
        return jsonify({"error": "Title is required"}), 400

    tasks = load_tasks()
    now = utc_now_iso()
    status = data.get('status') if data.get('status') in TASK_STATUSES else 'Backlog'
    priority = data.get('priority') if data.get('priority') in TASK_PRIORITIES else 'Medium'
    tags = data.get('tags') if isinstance(data.get('tags'), list) else []
    actor = data.get('actor') or 'user'

    new_task = {
        "id": next_task_id(tasks),
        "title": title,
        "description": data.get('description') or '',
        "owner": (data.get('owner') or data.get('assignee') or '').strip(),
        "status": status,
        "priority": priority,
        "dependency": data.get('dependency') or None,
        "next_checkpoint": data.get('next_checkpoint') or '',
        "tags": tags,
        "app_label": data.get('app_label') or None,
        "created_at": now,
        "updated_at": now,
        "comments": [],
        "activity_log": [],
    }
    add_task_activity(new_task, actor, "created", f"Task created with status {status}")
    tasks.insert(0, new_task)
    save_tasks(tasks)
    return jsonify({"task": new_task}), 201


@app.route('/api/tasks/<task_id>', methods=['GET'])
def get_task(task_id):
    task = get_task_by_id(load_tasks(), task_id)
    if not task:
        return jsonify({"error": "Task not found"}), 404
    return jsonify({"task": task})


@app.route('/api/tasks/<task_id>', methods=['PUT'])
def update_task(task_id):
    data = request.get_json(silent=True) or {}
    tasks = load_tasks()
    task = get_task_by_id(tasks, task_id)
    if not task:
        return jsonify({"error": "Task not found"}), 404

    actor = data.get('actor') or 'user'
    changed = False
    for field in TASK_EDITABLE_FIELDS:
        if field not in data:
            continue
        new_value = data[field]
        if field == 'status' and new_value not in TASK_STATUSES:
            continue
        if field == 'priority' and new_value not in TASK_PRIORITIES:
            continue
        if field == 'tags' and not isinstance(new_value, list):
            continue
        old_value = task.get(field)
        if old_value == new_value:
            continue
        task[field] = new_value
        changed = True
        add_task_activity(task, actor, f"{field}_changed", f"{field} changed from '{old_value}' to '{new_value}'")

    if changed:
        task['updated_at'] = utc_now_iso()
    save_tasks(tasks)
    return jsonify({"task": task})


@app.route('/api/tasks/<task_id>', methods=['DELETE'])
def delete_task(task_id):
    tasks = load_tasks()
    task = get_task_by_id(tasks, task_id)
    if not task:
        return jsonify({"error": "Task not found"}), 404
    tasks = [t for t in tasks if t["id"] != task_id]
    save_tasks(tasks)
    return jsonify({"message": "Task deleted"}), 200


@app.route('/api/tasks/<task_id>/comments', methods=['POST'])
def add_task_comment(task_id):
    data = request.get_json(silent=True) or {}
    text = (data.get('text') or '').strip()
    if not text:
        return jsonify({"error": "Comment text is required"}), 400

    tasks = load_tasks()
    task = get_task_by_id(tasks, task_id)
    if not task:
        return jsonify({"error": "Task not found"}), 404

    author = data.get('author') or 'User'
    task.setdefault('comments', []).append({
        "author": author,
        "text": text,
        "timestamp": utc_now_iso(),
    })
    add_task_activity(task, author, "comment_added", f"{author} added a comment")
    task['updated_at'] = utc_now_iso()
    save_tasks(tasks)
    return jsonify({"task": task}), 201


# Issue API endpoints
ISSUE_SEVERITIES = ['Low', 'Medium', 'High', 'Critical']
ISSUE_STATUSES = ['Open', 'Triaged', 'Mitigating', 'Monitoring', 'Verifying', 'Resolved']

def issue_activity(issue, actor, action, details):
    issue.setdefault('activity_log', []).append({
        'actor': actor or 'system',
        'action': action,
        'details': details,
        'timestamp': utc_now_iso(),
    })

def issue_escalation_required(data):
    text = ' '.join(str(data.get(key, '')) for key in ('title', 'description', 'mitigation')).lower()
    return bool(data.get('escalation_flag')) or any(term in text for term in ('production', 'legal', 'pricing', 'user data', 'userdata'))

@app.route('/api/issues', methods=['GET'])
def get_issues():
    app_label = request.args.get('app_label')
    issues = load_issues()
    if app_label:
        issues = [i for i in issues if (i.get('app_label') or '') == app_label]
    return jsonify(issues)


@app.route('/api/issues', methods=['POST'])
def create_issue():
    data = request.get_json() or {}
    title = (data.get('title') or '').strip()
    severity = data.get('severity', 'Medium')
    owner = data.get('owner', 'Implementation Manager')
    mitigation = data.get('mitigation', '') or ''
    
    if not title:
        return jsonify({'error': 'Title is required'}), 400
    
    if severity not in ISSUE_SEVERITIES:
        return jsonify({'error': 'Invalid severity'}), 400
    if data.get('status') and data['status'] not in ISSUE_STATUSES:
        return jsonify({'error': 'Invalid status'}), 400
    issues = load_issues()
    issue_id = generate_issue_id(issues)
    timestamp = utc_now_iso()
    new_issue = {
        'id': issue_id,
        'title': title,
        'description': data.get('description', '') or '',
        'severity': severity,
        'owner': owner,
        'status': 'Open',
        'mitigation': mitigation,
        'escalation_flag': issue_escalation_required(data),
        'related_task': data.get('related_task') or None,
        'app_label': data.get('app_label') or None,
        'created_at': timestamp,
        'updated_at': timestamp,
        'comments': [],
        'activity_log': [],
    }
    issue_activity(new_issue, data.get('actor', 'user'), 'created', f'{title} reported')
    issues.insert(0, new_issue)  # Insert at beginning
    save_issues(issues)
    return jsonify({'issue': new_issue}), 201


@app.route('/api/issues/<issue_id>', methods=['GET'])
def get_issue(issue_id):
    issues = load_issues()
    issue = find_issue(issues, issue_id)
    if not issue:
        return jsonify({'error': 'Issue not found'}), 404
    return jsonify(issue)


@app.route('/api/issues/<issue_id>', methods=['PUT'])
def update_issue(issue_id):
    data = request.get_json() or {}
    issues = load_issues()
    issue = find_issue(issues, issue_id)
    if not issue:
        return jsonify({'error': 'Issue not found'}), 404
    
    changes = []
    if 'title' in data:
        if not str(data['title']).strip():
            return jsonify({'error': 'Title is required'}), 400
        if issue['title'] != data['title']:
            changes.append(('title_changed', f"Title changed from '{issue['title']}' to '{data['title']}'"))
        issue['title'] = data['title']
    if 'severity' in data:
        if data['severity'] not in ISSUE_SEVERITIES:
            return jsonify({'error': 'Invalid severity'}), 400
        if issue['severity'] != data['severity']:
            changes.append(('severity_changed', f"Severity changed from {issue['severity']} to {data['severity']}"))
        issue['severity'] = data['severity']
    if 'owner' in data:
        if issue['owner'] != data['owner']:
            changes.append(('owner_reassigned', f"Owner changed from {issue['owner']} to {data['owner']}"))
        issue['owner'] = data['owner']
    if 'mitigation' in data:
        if issue['mitigation'] != data['mitigation']:
            changes.append(('mitigation_updated', 'Mitigation plan updated'))
        issue['mitigation'] = data['mitigation']
    if 'description' in data:
        issue['description'] = data['description'] or ''
    if 'status' in data:
        if data['status'] not in ISSUE_STATUSES:
            return jsonify({'error': 'Invalid status'}), 400
        if issue['status'] != data['status']:
            changes.append(('status_changed', f"Status changed from {issue['status']} to {data['status']}"))
        issue['status'] = data['status']
    if 'related_task' in data:
        issue['related_task'] = data['related_task'] or None
    if 'app_label' in data:
        issue['app_label'] = data['app_label'] or None
    if any(key in data for key in ('title', 'description', 'mitigation')):
        issue['escalation_flag'] = issue_escalation_required(issue | data)
    for action, details in changes:
        issue_activity(issue, data.get('actor', 'user'), action, details)
    issue['updated_at'] = utc_now_iso()
    
    save_issues(issues)
    return jsonify({'issue': issue})

@app.route('/api/issues/<issue_id>/comments', methods=['POST'])
def add_issue_comment(issue_id):
    data = request.get_json() or {}
    text = (data.get('text') or '').strip()
    if not text:
        return jsonify({'error': 'Comment text is required'}), 400
    issues = load_issues()
    issue = find_issue(issues, issue_id)
    if not issue:
        return jsonify({'error': 'Issue not found'}), 404
    author = data.get('author') or 'User'
    issue.setdefault('comments', []).append({'author': author, 'text': text, 'timestamp': utc_now_iso()})
    issue_activity(issue, author, 'comment_added', f'{author} added a comment')
    issue['updated_at'] = utc_now_iso()
    save_issues(issues)
    return jsonify({'issue': issue}), 201

@app.route('/postgres-viewer')
def postgres_viewer():
    return send_from_directory('.', 'postgres-viewer.html')

@app.route('/kafka-viewer')
def kafka_viewer():
    return send_from_directory('.', 'kafka-viewer.html')

@app.route('/')
def root():
    return send_from_directory('.', 'index.html')


@app.route('/api/issues/<issue_id>', methods=['DELETE'])
def delete_issue(issue_id):
    issues = load_issues()
    issue = find_issue(issues, issue_id)
    if not issue:
        return jsonify({'error': 'Issue not found'}), 404
    
    issues.remove(issue)
    save_issues(issues)
    return jsonify({'message': 'Issue deleted'}), 200


@app.route('/api/app-labels', methods=['GET'])
def get_app_labels():
    """Return the distinct set of app_label values across tasks and issues."""
    labels = set()
    if psycopg2 is not None:
        conn = psycopg2.connect(DSN)
        try:
            cur = conn.cursor()
            cur.execute("SELECT DISTINCT app_label FROM aisena_tasks WHERE app_label IS NOT NULL ORDER BY app_label")
            labels.update(row[0] for row in cur.fetchall())
            cur.execute("SELECT DISTINCT app_label FROM aisena_issues WHERE app_label IS NOT NULL ORDER BY app_label")
            labels.update(row[0] for row in cur.fetchall())
            cur.close()
        finally:
            conn.close()
    # Also include labels from the orchestrator app registry
    apps_path = ROOT / "project" / "orchestrator" / "apps.json"
    if apps_path.exists():
        try:
            apps = json.loads(apps_path.read_text(encoding="utf-8"))
            for app in apps:
                if app.get("name"):
                    labels.add(app["name"])
        except Exception:
            pass
    return jsonify({"app_labels": sorted(labels)})


@app.route('/app-dashboard')
def app_dashboard_page():
    return send_from_directory('.', 'app-dashboard.html')


# ── Deliberation API endpoints ──────────────────────────────────────────

_AGENTS_MANAGER = ROOT / "agents" / "manager"
import sys as _sys
if str(_AGENTS_MANAGER) not in _sys.path:
    _sys.path.insert(0, str(_AGENTS_MANAGER))

try:
    from deliberation import deliberate, get_deliberation, list_deliberations, \
        start_execution, advance_phase, update_task_status
    DELIBERATION_AVAILABLE = True
except ImportError:
    DELIBERATION_AVAILABLE = False


@app.route('/api/deliberations', methods=['POST'])
def create_deliberation():
    """Start a multi-agent deliberation on a project specification."""
    if not DELIBERATION_AVAILABLE:
        return jsonify({"error": "Deliberation service unavailable"}), 503
    payload = request.get_json(silent=True) or {}
    if not payload.get("name"):
        return jsonify({"error": "Project name is required"}), 400
    try:
        result = deliberate(payload)
        return jsonify(result), 201
    except Exception as e:
        return jsonify({"error": f"Deliberation failed: {str(e)}"}), 500


@app.route('/api/deliberations', methods=['GET'])
def get_deliberations():
    """List recent deliberations."""
    if not DELIBERATION_AVAILABLE:
        return jsonify({"error": "Deliberation service unavailable"}), 503
    return jsonify({"deliberations": list_deliberations()})


@app.route('/api/deliberations/<deliberation_id>', methods=['GET'])
def get_deliberation_endpoint(deliberation_id):
    """Get a specific deliberation by ID."""
    if not DELIBERATION_AVAILABLE:
        return jsonify({"error": "Deliberation service unavailable"}), 503
    d = get_deliberation(deliberation_id)
    if not d:
        return jsonify({"error": "Deliberation not found"}), 404
    return jsonify(d)


@app.route('/api/deliberations/<deliberation_id>/execute', methods=['POST'])
def execute_deliberation(deliberation_id):
    """Start executing the plan from a deliberation."""
    if not DELIBERATION_AVAILABLE:
        return jsonify({"error": "Deliberation service unavailable"}), 503
    d = start_execution(deliberation_id)
    if not d:
        return jsonify({"error": "Deliberation not found"}), 404
    return jsonify(d)


@app.route('/api/deliberations/<deliberation_id>/advance', methods=['POST'])
def advance_deliberation(deliberation_id):
    """Advance to the next execution phase."""
    if not DELIBERATION_AVAILABLE:
        return jsonify({"error": "Deliberation service unavailable"}), 503
    d = advance_phase(deliberation_id)
    if not d:
        return jsonify({"error": "Deliberation not found"}), 404
    return jsonify(d)


@app.route('/api/deliberations/<deliberation_id>/tasks/<task_id>', methods=['PUT'])
def update_task_endpoint(deliberation_id, task_id):
    """Update a task status within a deliberation."""
    if not DELIBERATION_AVAILABLE:
        return jsonify({"error": "Deliberation service unavailable"}), 503
    data = request.get_json(silent=True) or {}
    new_status = data.get("status")
    if not new_status:
        return jsonify({"error": "Status is required"}), 400
    d = update_task_status(deliberation_id, task_id, new_status)
    if not d:
        return jsonify({"error": "Deliberation not found"}), 404
    return jsonify(d)


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
