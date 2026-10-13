#!/usr/bin/env python3
"""Local preview server for site/ with caching disabled, so edits show up on a normal refresh.
Usage: python3 tools/serve.py [port]   (default 4173)
"""
import functools, http.server, pathlib, sys

class NoCache(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, max-age=0")
        super().end_headers()

port = int(sys.argv[1]) if len(sys.argv) > 1 else 4173
root = pathlib.Path(__file__).resolve().parent.parent / "site"
handler = functools.partial(NoCache, directory=str(root))
print(f"Serving {root} at http://localhost:{port}")
http.server.ThreadingHTTPServer(("", port), handler).serve_forever()
