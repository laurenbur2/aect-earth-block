#!/usr/bin/env python3
"""Build the blog: site/blog/index.html, one page per post (site/blog/<slug>.html), and site/sitemap.xml.

Posts live in blog-src/<slug>.html: a JSON header in an HTML comment (title, date, image, description),
then the post body as plain HTML (<p>, <h2>, <figure>, <div class="video-thumb" data-yt="ID">).
Images go in site/assets/img/blog/. To add a post, copy an existing file, edit it, then run from the repo root:
    python3 tools/build_blog.py
Header and footer are copied from site/index.html (cache-busted first), so every page stays in sync.
"""
import html
import json
import pathlib
import re
import subprocess
import sys

REPO = pathlib.Path(__file__).resolve().parent.parent
SITE = REPO / "site"
SRC = REPO / "blog-src"
DOMAIN = "https://aectearthblock.com/"

# Every public page, for the sitemap (Google Search Console). Blog posts are added automatically.
PAGES = ["", "machines", "impact-2001a", "2500hd", "3500", "bp714", "mega-mixer", "small-block-press", "block-cutter",
         "blocks", "rent", "plan", "learn", "about", "contact", "blog/", "privacy"]


def load_posts():
    posts = []
    for f in sorted(SRC.glob("*.html")):
        m = re.match(r"\s*<!--(.*?)-->\s*(.*)", f.read_text(), re.S)
        meta = json.loads(m.group(1))
        posts.append({**meta, "slug": f.stem, "body": m.group(2).strip()})
    return sorted(posts, key=lambda p: p["date"], reverse=True)


def shell():
    """Header and footer from index.html, with relative links made to work one folder down (site/blog/)."""
    s = (SITE / "index.html").read_text()
    head, rest = s.split("<main>", 1)
    _, foot = rest.split("</main>", 1)
    fix = lambda t: re.sub(r'((?:href|src)=")(?!https?:|mailto:|tel:|#|/|data:)', r"\1../", t)
    head = fix(head[head.index("<header"):]).replace(' aria-current="page"', "")
    return fix(s[:s.index("</head>")]), head, fix(foot)


def page(head_html, header, footer, title, desc, body, canonical, image=None, extra_head=""):
    h = re.sub(r"<title>.*?</title>", f"<title>{html.escape(title)}</title>", head_html, flags=re.S)
    h = re.sub(r'<meta name="description" content="[^"]*">', f'<meta name="description" content="{html.escape(desc)}">', h)
    og = (f'  <link rel="canonical" href="{canonical}">\n'
          f'  <meta property="og:title" content="{html.escape(title)}">\n'
          f'  <meta property="og:description" content="{html.escape(desc)}">\n'
          + (f'  <meta property="og:image" content="{DOMAIN}assets/img/blog/{image}">\n' if image else "") + extra_head)
    return f"{h}{og}</head>\n<body>\n\n{header}<main>\n{body}\n</main>{footer}"


def nice_date(d):
    y, m, day = d.split("-")
    return f"{['January','February','March','April','May','June','July','August','September','October','November','December'][int(m)-1]} {int(day)}, {y}"


def main():
    subprocess.run([sys.executable, str(REPO / "tools/bust_cache.py")], check=True, stdout=subprocess.DEVNULL)
    posts = load_posts()
    head_html, header, footer = shell()
    out = SITE / "blog"
    out.mkdir(exist_ok=True)
    for old in out.glob("*.html"):
        old.unlink()

    for i, p in enumerate(posts):
        more = [q for q in posts if q is not p][:3]
        cards = "\n".join(card(q, "") for q in more)
        ld = json.dumps({"@context": "https://schema.org", "@type": "BlogPosting", "headline": p["title"],
                         "datePublished": p["date"], "image": f"{DOMAIN}assets/img/blog/{p['image']}",
                         "author": {"@type": "Organization", "name": "AECT Earth Block"},
                         "publisher": {"@type": "Organization", "name": "AECT Earth Block"},
                         "mainEntityOfPage": f"{DOMAIN}blog/{p['slug']}"})
        body = f'''  <section class="page-hero page-hero--short" style="background-image:url('../assets/img/blog/{p["image"]}')">
    <div class="wrap">
      <a class="eyebrow" href="./" style="color:var(--logo-cream);text-decoration:none">← AECT blog</a>
      <h1 class="post-title">{html.escape(p["title"])}</h1>
      <p class="lede">{nice_date(p["date"])}</p>
    </div>
  </section>

  <section class="section">
    <article class="wrap prose post">
{p["body"]}
    </article>
  </section>

  <section class="section section--sand">
    <div class="wrap">
      <div class="post-cta">
        <div><h2>Planning a CEB build?</h2><p>Answer a few questions and get your block count, machine options and costs.</p></div>
        <a class="btn btn--lg" href="../plan.html">Plan my build <span class="arrow">→</span></a>
      </div>
      <h3 style="margin-top:48px">More from the blog</h3>
      <div class="post-grid">
{cards}
      </div>
    </div>
  </section>'''
        (out / f"{p['slug']}.html").write_text(page(head_html, header, footer, f"{p['title']} | AECT Blog", p["description"],
                                                    body, f"{DOMAIN}blog/{p['slug']}", p["image"],
                                                    f'  <script type="application/ld+json">{ld}</script>\n'))

    cards = "\n".join(card(p, "") for p in posts)
    body = f'''  <section class="page-hero page-hero--short" style="background-image:url('../assets/img/photos/line-of-blocks-0001.jpg')">
    <div class="wrap">
      <span class="eyebrow" style="color:var(--logo-cream)">Blog</span>
      <h1>From the block yard</h1>
      <p class="lede">Builds, machines and lessons from 35 years of making compressed earth blocks.</p>
    </div>
  </section>

  <section class="section">
    <div class="wrap">
      <div class="post-grid">
{cards}
      </div>
    </div>
  </section>'''
    (out / "index.html").write_text(page(head_html, header, footer, "Blog | AECT Earth Block",
                                         "Compressed earth block builds, machines and lessons from AECT in San Antonio, Texas.",
                                         body, f"{DOMAIN}blog/"))

    urls = [f"{DOMAIN}{p}" for p in PAGES] + [f"{DOMAIN}blog/{p['slug']}" for p in posts]
    (SITE / "sitemap.xml").write_text('<?xml version="1.0" encoding="UTF-8"?>\n'
        "<!-- Generated by tools/build_blog.py. Add new pages to PAGES there. -->\n"
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        + "\n".join(f"  <url><loc>{u}</loc></url>" for u in urls) + "\n</urlset>\n")
    print(f"built {len(posts)} posts, blog index and sitemap ({len(urls)} URLs)")


def card(p, prefix):
    return (f'        <a class="post-card" href="{prefix}{p["slug"]}.html"><img src="../assets/img/blog/{p["image"]}" alt="" loading="lazy">'
            f'<div><span class="press-src">{nice_date(p["date"])}</span><h4>{html.escape(p["title"])}</h4>'
            f'<p>{html.escape(p["description"])}</p></div></a>')


if __name__ == "__main__":
    main()
