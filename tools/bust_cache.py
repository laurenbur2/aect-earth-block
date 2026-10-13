#!/usr/bin/env python3
"""Stamp ?v=<hash> on local CSS/JS links in every page so browsers fetch fresh copies after edits.
Run after changing anything in site/assets/:  python3 tools/bust_cache.py
"""
import hashlib, pathlib, re

SITE = pathlib.Path(__file__).resolve().parent.parent / "site"

def ver(rel):
    f = SITE / rel
    return hashlib.md5(f.read_bytes()).hexdigest()[:8] if f.exists() else None

pat = re.compile(r'((?:href|src)=")(assets/(?:css|js)/[\w.-]+\.(?:css|js))(\?v=[0-9a-f]+)?(")')
for page in SITE.glob("*.html"):
    s = page.read_text()
    out = pat.sub(lambda m: f'{m.group(1)}{m.group(2)}?v={ver(m.group(2))}{m.group(4)}' if ver(m.group(2)) else m.group(0), s)
    if out != s:
        page.write_text(out)
print("cache-busted", len(list(SITE.glob("*.html"))), "pages")
