#!/usr/bin/env python3
"""Dev server for drawai.

Plain `http.server` lets the browser cache ES modules by URL, so editing
src/*.js and reloading can still run the previous build (and a removed
export shows up as a phantom SyntaxError). Everything is served
no-store here — this is a scratch drawing tool, not a CDN.
"""
import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def log_message(self, fmt, *args):
        pass


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8137
    root = sys.argv[2] if len(sys.argv) > 2 else "."
    handler = partial(NoCacheHandler, directory=root)
    print(f"drawai on http://localhost:{port}")
    ThreadingHTTPServer(("", port), handler).serve_forever()
