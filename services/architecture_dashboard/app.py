from http.server import SimpleHTTPRequestHandler, HTTPServer
from pathlib import Path
import os

PORT = int(os.environ.get('ARCH_DASHBOARD_PORT', '8080'))
ROOT = Path(__file__).resolve().parent
os.chdir(ROOT)

class Handler(SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        print(f'[architecture-dashboard] {self.address_string()} - {format % args}')


def run_server():
    server = HTTPServer(('0.0.0.0', PORT), Handler)
    print(f'Serving Architecture Dashboard at http://0.0.0.0:{PORT}/')
    server.serve_forever()


if __name__ == '__main__':
    run_server()
