#!/usr/bin/env python3
import json
from http.server import HTTPServer, BaseHTTPRequestHandler
import psycopg2
from urllib.parse import urlparse

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


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == '/results':
            data = fetch_results()
            body = json.dumps(data).encode('utf-8')
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        else:
            self.send_response(404)
            self.end_headers()


def run(port=5000):
    server = HTTPServer(('0.0.0.0', port), Handler)
    print(f'Serving on http://0.0.0.0:{port}')
    server.serve_forever()


if __name__ == '__main__':
    run()
