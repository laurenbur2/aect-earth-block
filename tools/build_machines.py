#!/usr/bin/env python3
"""Generate one product page per machine (site/<slug>.html) plus the product grid in machines.html.

Edit the MACHINES data below, then run from the repo root:
    python3 tools/build_machines.py
Header and footer are copied from site/index.html so every page stays in sync.
"""
import html
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent.parent / "site"
IMG = "https://img1.wsimg.com/isteam/ip/b19749ae-46c7-4c3e-a02a-fe9f0df82299/"

MACHINES_RAW = [
    {
        "slug": "impact-2001a", "name": "Impact 2001A", "group": "kit",
        "badge": "Best for 1 to 5 homes", "kit_price": "Kits from $59,000",
        "img": "e48a0068-88d7-476c-a776-9f0a846ac278.jpg", "video": "xWIc9XZthN0",
        "short": "Our lightest, most affordable machine. Tows behind any vehicle. Perfect for 1 to 5 houses.",
        "best_for": "1 to 5 houses and first-time block producers",
        "intro": "Our smallest, least expensive CEB machine, and it's fully automated. Fed by a small hopper you can load with shovels, buckets or a power conveyor. Light enough to tow behind any vehicle. Perfect if you need to build one to five houses.",
        "stats": [("300", "blocks/hr"), ('6"×12"', "block"), ("1,640 lb", "towable")],
        "price": "$59,000",
        "specs": [
            ("Output", "300 blocks per hour"),
            ("Block", '6" × 12", thickness adjustable 2" to 4.5"'),
            ("Engine", "7.0 HP Yanmar diesel"),
            ("Hopper", "8 to 9 blocks"),
            ("Weight", "1,640 lb (744 kg)"),
            ("Size", "8'6\" L × 5'8\" W × 4'3\" H · ~6\" road clearance"),
        ],
        "prices": [
            ("Impact 2001A kit: machine, soil analysis & on-site training", "From $59,000"),
            ("Holey block plate set", "$4,000"),
            ('4"×12" veneer block plate set', "$4,000"),
            ("Spare parts package", "$7,640"),
        ],
        "cta": "quote",
    },
    {
        "slug": "2500hd", "name": "2500HD", "group": "equipment",
        "badge": "Same block · 60% faster",
        "img": "bf5b7c80-8d03-46af-8d3b-ffebd057b135.jpg", "video": "-tpm1_4PtUE",
        "short": "The Impact's 6\"×12\" block at 480 an hour, with a tractor-loaded one-yard hopper. Available as a kit on request.",
        "best_for": 'Tens of thousands of 6"×12" blocks, fast',
        "intro": "The same 6\"×12\" block as the Impact, at 480 blocks an hour, with a one-yard hopper you load with a tractor. If you like 6\"×12\" blocks and need to make tens of thousands of them fast and without much effort, this is your machine.",
        "stats": [("480", "blocks/hr"), ('6"×12"', "block"), ("1 yd³", "hopper")],
        "price": "$89,000",
        "specs": [
            ("Output", "480 blocks per hour"),
            ("Block", '6" × 12", thickness adjustable 2" to 4.5"'),
            ("Engine", "22 HP 3-cylinder water-cooled Yanmar diesel"),
            ("Hopper", "1 yd³ · 85 to 105 blocks"),
            ("Weight", "4,000 lb (1,814 kg)"),
            ("Size", "11'1\" L × 6'9\" W × 7'1\" H (9'1\" hopper open) · ~12\" clearance"),
        ],
        "prices": [("2500HD CEB machine", "$89,000"), ("Spare parts package", "$9,554")],
        "cta": "quote",
    },
    {
        "slug": "3500", "name": "3500", "group": "kit",
        "badge": "Flagship · High volume", "kit_price": "Kits from $149,000",
        "img": "62570b0a-3778-44b5-b0fb-e9200ed393c6.jpg", "video": "IcNAe3-oyAg",
        "short": "The Cadillac of CEB machines. Big 10\"×14\" blocks at 480 an hour. Built for millions of blocks.",
        "best_for": "Big blocks, high volume and block businesses",
        "intro": "The Cadillac of CEB machines. Big, fast, versatile and built to last. There are 3500s in the field today that have made one, two, even three million blocks. If you need lots of big CEBs fast and with ease, this is it.",
        "stats": [("480", "blocks/hr"), ('10"×14"', "block"), ("47.5 HP", "diesel")],
        "price": "$149,000",
        "specs": [
            ("Output", "480 blocks per hour"),
            ("Block", '10" × 14" standard, thickness 2" to 4.5". Optional 7"×14" or 8"×14" plates'),
            ("Engine", "47.5 HP water-cooled Yanmar diesel"),
            ("Hopper", "1 yd³"),
            ("Weight", "5,200 lb (2,359 kg)"),
            ("Size", "13'8\" L × 7'5\" W × 6'10\" H (8'11\" hopper open) · ~12\" clearance"),
        ],
        "prices": [
            ("3500 kit: machine, soil analysis & on-site training", "From $149,000"),
            ('Optional 7"×14" or 8"×14" plate set', "$4,920"),
            ("Spare parts package", "$11,251"),
        ],
        "cta": "quote",
    },
    {
        "slug": "bp714", "name": "BP714", "group": "equipment",
        "badge": "Interlocking · Reinforceable", "badge_class": "badge--sage",
        "img": "889d4a57-f36f-4da9-8b17-e691db617e06.png", "img_contain": True, "video": None,
        "short": "Interlocking, holey 7\"×14\" blocks you can reinforce with rebar. Built for strict building codes.",
        "best_for": "Codes requiring reinforced, interlocking block (e.g. California)",
        "intro": "Some projects and jurisdictions (California, for example) call for interlocking, holey blocks you can run rebar and grout through. The BP714 makes exactly that, with a dual-stage compression chamber for consistent size and strength.",
        "stats": [("240", "blocks/hr"), ('7"×14"', "interlocking"), ("4 power", "options")],
        "price": "From $69,625",
        "specs": [
            ("Output", "Up to 240 blocks per hour"),
            ("Block", '7" W × 14" L × 4" H interlocking hollow, 22 to 25 lb'),
            ("Power", "Diesel, gas, electric or PTO"),
            ("Hopper", "30 gal (4 ft³) · ~14 blocks"),
            ("Weight", "2,400 lb (1,089 kg) · 3,000 lb shipping"),
            ("Size", '100" L × 80" H × 41" W · travel height 6.83 ft'),
        ],
        "prices": [
            ("BP714 · manual controls", "$69,625"),
            ("BP714A · automatic", "$77,000"),
            ("BP714AM · automatic, trailer mounted", "$82,000"),
            ("Flat-top insert (top course)", "$198"),
            ("U-block insert (bond beam)", "$884"),
            ("Spare parts: Basic / Standard / Premium", "$1,588 / $3,696 / $4,411"),
        ],
        "cta": "quote",
    },
    {
        "slug": "mega-mixer", "name": "Mega Mixer", "group": "equipment",
        "badge": "Mixing",
        "img": "724c7f3b-2407-4a3c-8d28-62d7f128d388.jpg", "video": "v4zIhBTSKoU",
        "short": "Mixes 10 cubic yards an hour so your machine runs at full speed. Feeds up to four machines.",
        "best_for": "Getting full output from any AECT machine",
        "intro": "Great blocks need the right clay, sand, stabilizer and moisture, mixed the same way every time. The Mega Mixer has a large earth hopper, a separate stabilizer hopper, a heavy-duty auger and a water rail to dial in moisture. A power conveyor carries the mix straight into your machine.",
        "stats": [("10 yd³", "per hour"), ("2", "hoppers"), ("47.5 HP", "diesel")],
        "price": "$149,000",
        "specs": [
            ("Output", "Up to 10 yd³ of material per hour: enough to feed one 3500, three Impacts, two 2500s or four BP714s"),
            ("Engine", "47.5 HP water-cooled Yanmar diesel"),
            ("Hoppers", "Earth 1 yd³ · stabilizer 10 ft³"),
            ("Trough", "Rubber, with bolt-on replaceable paddles"),
            ("Weight", "5,000 lb (2,268 kg)"),
            ("Size", "14'6\" L × 7'2\" W × 6'3\" H (8'0\" hopper open) · ~12\" clearance"),
        ],
        "prices": [("Mega Mixer", "$149,000"), ("Spare parts package", "$5,785")],
        "cta": "quote",
    },
    {
        "slug": "small-block-press", "name": "Small Block Press", "group": "equipment",
        "badge": "Start here · Soil testing", "badge_class": "badge--sage",
        "img": "thumbnail_IMG_3282.jpg", "video": "2J7JJIW0Fcw",
        "short": "Test your dirt before you buy anything else. Makes quarter-scale blocks at real machine pressure.",
        "best_for": "Testing whether your soil makes good blocks",
        "intro": "Find out if your dirt will make good blocks before you buy anything else. The Small Block Press tests soil at the same pressures and moisture ranges as our full-size machines, producing a quarter-scale version of a 10\"×14\"×4\" block. Use it in the lab or the field. AECT is the only company in the world that makes one.",
        "stats": [("1,000–6,000", "PSI"), ("¼ scale", "test block"), ("Lab or field", "use")],
        "price": "$3,100",
        "specs": [("Pressure", "1,000 to 6,000 PSI"), ("Test block", '2.5" × 3.5" × 1"')],
        "prices": [("Small Block Press", "$3,100")],
        "cta": "order",
    },
    {
        "slug": "block-cutter", "name": "Block Cutter", "group": "equipment",
        "badge": "Tool",
        "img": "b0e339a7-ce82-4760-82cd-22a39e9e3a02.JPG", "video": None,
        "short": "Clean, straight cuts in seconds. No electricity, no blades.",
        "best_for": "Cutting un-stabilized or uncured blocks on site",
        "intro": "Straight cuts in seconds on un-stabilized blocks (or stabilized blocks before they cure). No electricity, no expensive blades. Simple, fast and repeatable. AECT is the only company in the world that makes one.",
        "stats": [("Seconds", "per cut"), ("No power", "needed"), ("No blades", "to replace")],
        "price": "$795",
        "specs": [("Cuts", "Un-stabilized blocks, or stabilized blocks before curing"), ("Power", "None, fully manual")],
        "prices": [("Earth Block Cutter", "$795")],
        "cta": "order",
    },
]

ORDER = ["impact-2001a", "3500", "2500hd", "bp714", "mega-mixer", "small-block-press", "block-cutter"]
MACHINES = sorted(MACHINES_RAW, key=lambda m: ORDER.index(m["slug"]))
# What every kit includes (AECT sells kits, not one-off machines).
KIT_ITEMS = [
    ("Machine", "Your AECT {name}, hand-built and tested in San Antonio"),
    ("Soil analysis", "We test your site's dirt and dial in the right mix"),
    ("On-site training", "A full week, one-on-one, with AECT President Ryan Runge"),
    ("Support", "1-year warranty and lifetime support"),
]

e = html.escape


def img_url(m, w):
    return f"{IMG}{m['img']}/:/rs=w:{w}"


def card(m, big=False):
    stats = "".join(f"<li><b>{e(v)}</b> {e(l)}</li>" for v, l in m["stats"][:2])
    contain = ' style="object-fit:contain;background:#fff"' if m.get("img_contain") else ""
    kit = m["group"] == "kit"
    title = f"{m['name']} Kit" if kit else m["name"]
    includes = ('<ul class="kit-includes"><li>Machine</li><li>Soil analysis</li><li>On-site training</li></ul>' if kit else "")
    price = m.get("kit_price") if kit else m["price"]
    return f"""        <a class="product-card{' product-card--kit' if big else ''} reveal" href="{m['slug']}.html">
          <div class="product-img"><img src="{img_url(m, 1100 if big else 900)}" alt="AECT {e(m['name'])}" loading="lazy"{contain}></div>
          <div class="product-body">
            <span class="badge {m.get('badge_class', '')}">{e(m['badge'])}</span>
            <h3>{e(title)}</h3>
            <p>{e(m['short'])}</p>
            {includes}<ul class="product-stats">{stats}</ul>
            <div class="product-foot"><span class="product-price">{e(price)}</span><span class="product-link">{'View kit' if kit else 'View details'} <span class="arrow">→</span></span></div>
          </div>
        </a>"""


def page(m, head, footer):
    kit = m["group"] == "kit"
    display = f"{m['name']} Kit" if kit else m["name"]
    title = f"AECT {display} | Specs, Pricing & Video | AECT Earth Block"
    desc = f"AECT {m['name']}: {m['short']} Specs, pricing and video."
    h = re.sub(r"<title>.*?</title>", f"<title>{e(title)}</title>", head)
    h = re.sub(r'<meta name="description" content="[^"]*">', f'<meta name="description" content="{e(desc)}">', h)
    h = h.replace('<a href="machines.html">', '<a href="machines.html" aria-current="page">', 1)
    h = h.replace('<header class="site-header">', '<header class="site-header site-header--solid">')
    contain = ' style="object-fit:contain;background:#fff"' if m.get("img_contain") else ""
    stats = "".join(f"<div><b>{e(v)}</b><span>{e(l)}</span></div>" for v, l in m["stats"])
    specs = "".join(f"<dt>{e(k)}</dt><dd>{e(v)}</dd>" for k, v in m["specs"])
    main_cls = ' class="main"'
    prices = "".join(
        f'<li{main_cls if i == 0 else ""}><span>{e(k)}</span><b>{e(v)}</b></li>' for i, (k, v) in enumerate(m["prices"])
    )
    q = (display).replace(" ", "%20")
    primary = (f'<a class="btn btn--lg" href="contact.html?topic=quote&machine={q}">Request a quote</a>'
               if m["cta"] == "quote" else f'<a class="btn btn--lg" href="contact.html?topic=order&machine={q}">Order one</a>')
    video = (f'<a class="video-thumb" href="https://youtu.be/{m["video"]}" data-yt="{m["video"]}" aria-label="AECT {e(m["name"])} in action"></a>'
             if m.get("video") else "")
    if kit:
        rows = "".join(f'<li><span class="kit-n">{i+1}</span><div><b>{e(a)}</b><span>{e(b.format(name=m["name"]))}</span></div></li>' for i, (a, b) in enumerate(KIT_ITEMS))
        included = f"""
          <div class="kit-box"><h3>What's in the kit</h3><ul class="kit-list">{rows}</ul></div>"""
    else:
        included = """
          <ul class="product-included">
            <li>1 week of on-site training</li><li>1-year warranty</li><li>Lifetime support</li><li>Built in San Antonio, TX</li>
          </ul>"""
    # Cross-sell: everything points back to the two featured kits first.
    kits = [o for o in MACHINES if o["group"] == "kit" and o["slug"] != m["slug"]]
    rest = [o for o in MACHINES if o["slug"] != m["slug"] and o not in kits and o["slug"] in ("mega-mixer", "small-block-press")]
    others = (kits + rest)[:3]
    return f"""{h}<main class="product-page">
  <div class="wrap">
    <nav class="breadcrumb" aria-label="Breadcrumb"><a href="machines.html">Machines</a> <span>/</span> {e(display)}</nav>
    <section class="product-hero">
      <div class="product-media">
        <img src="{img_url(m, 1400)}" alt="AECT {e(m['name'])}"{contain}>
        {video}
      </div>
      <div class="product-info">
        <span class="badge {m.get('badge_class', '')}">{e(m['badge'])}</span>
        <h1>{e(display)}</h1>
        <p class="product-best">Best for: {e(m['best_for'])}</p>
        <p class="lede">{e(m['intro'])}</p>
        <div class="product-statbar">{stats}</div>
        <div class="product-buy">
          <div class="product-price-lg">{e(m.get("kit_price") if kit else m["price"])}</div>
          <p class="fine">FOB San Antonio, TX. Shipping and loading not included.</p>
          <div class="btn-row">{primary}<a class="btn btn--outline btn--lg" href="plan.html">Will it fit my project?</a></div>
        </div>{included}
      </div>
    </section>

    <section class="product-details">
      <div>
        <h2>Specifications</h2>
        <dl class="specs">{specs}</dl>
      </div>
      <div>
        <h2>{"Kit pricing & options" if kit else "Pricing & options"}</h2>
        <ul class="price-list">{prices}</ul>
        <p class="fine">All prices USD, FOB San Antonio, TX. Prices may change with 30 days' notice due to steel, oil and transportation costs.</p>
      </div>
    </section>
  </div>

  <section class="section section--sand">
    <div class="wrap">
      <span class="eyebrow">Keep shopping</span>
      <h2>{"Compare kits and add-ons" if kit else "Most customers choose a complete kit"}</h2>
      <div class="product-grid product-grid--3">
{chr(10).join(card(o) for o in others)}
      </div>
    </div>
  </section>

  <section class="section cta-band">
    <div class="wrap">
      <h2>Is the {e(display)} right for your build?</h2>
      <p>The planner matches your block size and volume to the right machine, and shows whether buying even makes sense versus renting or buying blocks.</p>
      <div class="btn-row" style="justify-content:center"><a class="btn btn--lg" href="plan.html">Plan my build <span class="arrow">→</span></a></div>
    </div>
  </section>
</main>

{footer}<script src="assets/js/main.js"></script>
</body>
</html>
"""


def main():
    idx = (ROOT / "index.html").read_text()
    head = idx[: idx.index("<main>")]
    footer = idx[idx.index('<footer class="site-footer">'): idx.index('<script src="assets/js/main.js')]
    for m in MACHINES:
        (ROOT / f"{m['slug']}.html").write_text(page(m, head, footer))

    # Refresh the product grids on machines.html between the GENERATED markers.
    mp = ROOT / "machines.html"
    s = mp.read_text()
    for group in ("kit", "equipment"):
        cards = "\n".join(card(m, big=(group == "kit")) for m in MACHINES if m["group"] == group)
        s = re.sub(
            rf"(<!-- GENERATED:{group} -->).*?(\n\s*<!-- /GENERATED:{group} -->)",
            lambda mm: mm.group(1) + "\n" + cards + mm.group(2), s, flags=re.S)
    mp.write_text(s)
    print(f"Wrote {len(MACHINES)} product pages and refreshed machines.html")


if __name__ == "__main__":
    main()
