#!/usr/bin/env python3
"""Dev server for drawai.

Plain `http.server` lets the browser cache ES modules by URL, so editing
src/*.js and reloading can still run the previous build (and a removed
export shows up as a phantom SyntaxError). Everything is served
no-store here — this is a scratch drawing tool, not a CDN.

It also mimics Vercel's `cleanUrls` (see vercel.json): `/photo` serves
photo.html, and `/photo.html` redirects to `/photo`. Production does
this and dev must agree, or a link that works on one 404s on the other.
"""
import os
import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlsplit, urlunsplit


class NoCacheHandler(SimpleHTTPRequestHandler):
    def send_head(self):
        # cleanUrls: the extensionless path is the canonical one.
        parts = urlsplit(self.path)
        if parts.path.endswith(".html"):
            clean = parts.path[: -len(".html")]
            if clean.endswith("/index"):
                clean = clean[: -len("index")]
            self.send_response(308)
            self.send_header("Location", urlunsplit(parts._replace(path=clean)))
            self.end_headers()
            return None
        return super().send_head()

    def translate_path(self, path):
        # ...and the extensionless path is served by the .html file.
        fs = super().translate_path(path)
        if not os.path.exists(fs) and os.path.isfile(fs + ".html"):
            return fs + ".html"
        return fs

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
