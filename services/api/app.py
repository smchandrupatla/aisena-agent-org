#!/usr/bin/env python3
import json
import os
import re
import subprocess
from datetime import datetime, timezone
from pathlib import Path

from flask import Flask, jsonify, request

try:
    import psycopg2
except Exception:  # pragma: no cover - DB is optional in tests
    psycopg2 = None

app = Flask(__name__)

DSN = os.environ.get('POSTGRES_DSN', "host=localhost dbname=aisena user=aisena password=aisena_pw")
ROOT = Path(__file__).resolve().parents[2]
CATALOG_PATH = ROOT / "services" / "capabilities_site" / "agents.json"
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


def load_agent_catalog():
    if not CATALOG_PATH.exists():
        return []
    data = load_json(CATALOG_PATH, [])
    return data if isinstance(data, list) else []


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
    agent_file = ROOT / (agent.get("agentFile") or "")
    if not agent_file.exists():
        return "You are a helpful delivery agent. Keep answers concise and aligned to the project context."
    return agent_file.read_text(encoding="utf-8")


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


def run_copilot_message(agent, user_message, history):
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
        return "The Copilot CLI is not available in this environment. Use the fallback guidance for the selected agent."
    except subprocess.TimeoutExpired:
        return "The agent runtime timed out. Please rephrase the request in a shorter, more specific ask."

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
            f"Compare the {primary_agent.get('name')} output against your domain expertise and provide a red/amber/green verdict with action items."
        )
        peer_reply = run_copilot_message(peer_agent, peer_message, load_transcript(peer_agent.get("key")))
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


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
