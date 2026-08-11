#!/usr/bin/env python3
import json
import subprocess
from pathlib import Path

from flask import Flask, jsonify, request
import psycopg2

app = Flask(__name__)

DSN = "host=localhost dbname=hsfs user=hsfs password=hsfs_pw"
ROOT = Path(__file__).resolve().parents[2]
LEARNING_SCRIPT = ROOT / "scripts" / "agents" / "record_agent_learning.py"
SYNC_SCRIPT = ROOT / "services" / "capabilities_site" / "sync_self_learning.py"


@app.after_request
def add_cors_headers(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type"
    return response


def fetch_results(limit=50):
    conn = psycopg2.connect(DSN)
    cur = conn.cursor()
    cur.execute("SELECT id, event, flagged, reason, created_at FROM hsfs_screening_results ORDER BY created_at DESC LIMIT %s", (limit,))
    rows = cur.fetchall()
    cur.close()
    conn.close()
    results = []
    for r in rows:
        results.append({
            'id': r[0],
            'event': r[1],
            'flagged': r[2],
            'reason': r[3],
            'created_at': r[4].isoformat() if r[4] else None
        })
    return results


@app.route('/results')
def results():
    return jsonify(fetch_results())


@app.route('/self-learning/trigger', methods=['POST', 'OPTIONS'])
def trigger_self_learning():
    if request.method == 'OPTIONS':
        return ('', 204)

    payload = request.get_json(silent=True) or {}
    required = ['agent', 'learning', 'context', 'evidence']
    missing = [field for field in required if not payload.get(field)]
    if missing:
        return jsonify({'error': f"Missing fields: {', '.join(missing)}"}), 400

    cmd = [
        'python3',
        str(LEARNING_SCRIPT),
        '--agent', payload['agent'],
        '--learning', payload['learning'],
        '--context', payload['context'],
        '--evidence', payload['evidence'],
    ]

    run = subprocess.run(cmd, cwd=str(ROOT), text=True, capture_output=True)
    if run.returncode != 0:
        return jsonify({
            'error': 'record_agent_learning failed',
            'stdout': run.stdout,
            'stderr': run.stderr,
        }), 500

    sync_run = subprocess.run(['python3', str(SYNC_SCRIPT)], cwd=str(ROOT), text=True, capture_output=True)
    if sync_run.returncode != 0:
        return jsonify({
            'error': 'sync_self_learning failed',
            'stdout': sync_run.stdout,
            'stderr': sync_run.stderr,
        }), 500

    return jsonify({
        'ok': True,
        'message': 'Self-learning recorded and synced',
        'sync_output': sync_run.stdout.strip(),
    })


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
