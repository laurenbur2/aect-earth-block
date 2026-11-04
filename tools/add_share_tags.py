#!/usr/bin/env python3
"""Add link-preview tags (Open Graph / Twitter) to every page, so texts, email and social posts show the AECT logo,
the page title and description. Each page gets a block between SHARE markers, rebuilt from its own <title>,
meta description and address; tags a page already sets itself (a blog post's og:image) are left alone.
tools/build_blog.py runs this; after tools/build_machines.py or a header change, run from the repo root:
    python3 tools/add_share_tags.py
"""
import html
import pathlib
import re

SITE = pathlib.Path(__file__).resolve().parent.parent / "site"
DOMAIN = "https://aectearthblock.com/"
IMAGE = DOMAIN + "assets/img/share-logo.jpg"  # 1200x630, the logo full bleed
START, END = "  <!-- SHARE -->\n", "  <!-- /SHARE -->\n"
BLOCK = re.compile(re.escape(START) + r".*?" + re.escape(END), re.S)


def address(page):
    rel = page.relative_to(SITE).as_posix()
    rel = rel[:-len("index.html")] if rel.endswith("index.html") else rel[:-len(".html")]
    return DOMAIN + rel


def tags(s, page):
    title = html.unescape(re.search(r"<title>(.*?)</title>", s, re.S).group(1).strip())
    desc = re.search(r'<meta name="description" content="([^"]*)"', s)
    desc = html.unescape(desc.group(1)) if desc else "Compressed earth block machines, kits, blocks and rentals from AECT in San Antonio, Texas, since 1989."
    want = [("property", "og:type", "website"), ("property", "og:site_name", "AECT Earth Block"),
            ("property", "og:title", title), ("property", "og:description", desc), ("property", "og:url", address(page)),
            ("property", "og:image", IMAGE), ("property", "og:image:width", "1200"), ("property", "og:image:height", "630"),
            ("property", "og:image:alt", "AECT, Advanced Earthen Construction Technologies, est. 1989"),
            ("name", "twitter:card", "summary_large_image")]
    has = set(re.findall(r'<meta (?:property|name)="([^"]+)"', s))
    if "og:image" in has:  # the page brings its own picture; keep its size and alt too
        has |= {"og:image:width", "og:image:height", "og:image:alt"}
    lines = [f'  <meta {k}="{n}" content="{html.escape(v)}">\n' for k, n, v in want if n not in has]
    return START + "".join(lines) + END


def main():
    pages = [p for p in SITE.glob("*.html") if p.name != "404.html"] + list((SITE / "blog").glob("*.html")) + [SITE / "admin/index.html"]
    for p in pages:
        s = BLOCK.sub("", p.read_text())
        p.write_text(s.replace("</head>", tags(s, p) + "</head>", 1))
    print(f"share tags on {len(pages)} pages")


if __name__ == "__main__":
    main()
