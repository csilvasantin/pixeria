#!/usr/bin/env python3
"""Loopback-only static review server; local session fixture matches browser tests.
Usage: python3 scripts/next-step-preview.py --port 8481 --session-fixture
No production authentication code or account API is modified.
"""
import argparse
import json
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--port', type=int, default=8481)
parser.add_argument('--session-fixture', action='store_true')
args = parser.parse_args()
root = Path(__file__).resolve().parents[1]

class PreviewHandler(SimpleHTTPRequestHandler):
    def __init__(self, *items, **options):
        super().__init__(*items, directory=str(root), **options)

    def do_GET(self):
        if args.session_fixture and self.path.split('?')[0] == '/auth/session':
            body = json.dumps({'ok': True, 'previewFixture': True}).encode()
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Cache-Control', 'no-store')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        super().do_GET()

print(f'NEXT STEP local preview: http://127.0.0.1:{args.port}', flush=True)
ThreadingHTTPServer(('127.0.0.1', args.port), PreviewHandler).serve_forever()
