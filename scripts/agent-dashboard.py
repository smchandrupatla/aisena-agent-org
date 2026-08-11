#!/usr/bin/env python3
"""
Simple supervisor dashboard that serves agent metrics from `memories/repo/agent_metrics.json`.
"""
import json
from http.server import HTTPServer, BaseHTTPRequestHandler
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
METRICS_FILE = ROOT / 'memories' / 'repo' / 'agent_metrics.json'


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/' or self.path.startswith('/dashboard'):
            data = {}
            if METRICS_FILE.exists():
                data = json.loads(METRICS_FILE.read_text())
            html = ['<html><head><title>Agent Dashboard</title></head><body>']
            html.append('<h1>Agent Dashboard</h1>')
            html.append('<table border="1"><tr><th>Agent</th><th>Last Learned</th><th>Count</th><th>Model</th><th>Accuracy</th></tr>')
            for k,v in sorted(data.items()):
                html.append(f"<tr><td>{k}</td><td>{v.get('learned_at','-')}</td><td>{v.get('count','-')}</td><td>{v.get('model','-')}</td><td>{v.get('accuracy','-')}</td></tr>")
            html.append('</table>')
            html.append('</body></html>')
            body = '\n'.join(html).encode('utf-8')
            self.send_response(200)
            self.send_header('Content-Type','text/html')
            self.send_header('Content-Length',str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        else:
            self.send_response(404)
            self.end_headers()


def run(port=8080):
    server = HTTPServer(('0.0.0.0', port), Handler)
    print(f'Serving dashboard http://0.0.0.0:{port}')
    server.serve_forever()


if __name__ == '__main__':
    run()
