#!/usr/bin/env python3
import json
from flask import Flask, jsonify
import psycopg2

app = Flask(__name__)

DSN = "host=localhost dbname=hsfs user=hsfs password=hsfs_pw"


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


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
