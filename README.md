# AECT Earth Block website

Redesign of [aectearthblock.com](https://aectearthblock.com) for Advanced Earthen Construction Technologies (San Antonio, TX). The site is built around one funnel: a step-by-step **CEB planner** that gives visitors their block count, materials and costs before they contact AECT.

Plain HTML, CSS and JS. No build step, no dependencies.

## Run locally
```bash
python3 tools/serve.py
```
Then open http://localhost:4173. This server disables browser caching so edits show up on a normal refresh. After editing CSS/JS, run `python3 tools/bust_cache.py` so deployed pages also pick up fresh files. The hero video needs `http://`; it won't play from a `file://` URL.

## Structure
```
site/
  index.html        Home: hero video, planner entry, 3 paths, CEB 101, FAQ preview
  plan.html         The CEB planner (funnel)
  machines.html     Shop-style grid of all machines and equipment
  <machine>.html    One product page per machine (generated, see below)
  blocks.html       Block sizes, stabilized vs un-stabilized, buying blocks
  rent.html         Equipment rental with operator + consulting
  learn.html        Full FAQ + build videos
  about.html        Story, press, projects
  contact.html      Consult booking + quote form
  admin/            Private lead dashboard (stages, emails sent, notes); see worker/README.md
  assets/css/       styles.css (site), plan.css (planner)
  assets/js/        main.js (shared), calculator.js (CEB math), plan.js (planner flow)
research/
  content-inventory.md   Everything pulled from the current site
  site-plan.md           IA, funnel design, open questions for AECT
  calculator-logic.md    Reverse-engineered spreadsheet formulas + test cases
  calculator.js          Faithful port of the original spreadsheet (2022 prices)
  raw/                   Raw text and image lists for every current page
```

## Machine pages
The 7 product pages (`impact-2001a.html`, `2500hd.html`, `3500.html`, `bp714.html`, `mega-mixer.html`, `small-block-press.html`, `block-cutter.html`) and the product cards on `machines.html` are generated from the data in `tools/build_machines.py`. To change a price, spec or photo, edit that file and run:
```bash
python3 tools/build_machines.py
```

## Before launch
- Connect the lead backend (Cloudflare Worker + D1 + Resend, all free): see [worker/README.md](worker/README.md) and [worker/TESTING.md](worker/TESTING.md). It sets `LEAD_ENDPOINT` in `plan.js`, `CONTACT_ENDPOINT` in `contact.js` and `ENDPOINT` in `reach-out.js`. Contact requests require a topic; there is intentionally no "other" option.
- Confirm prices and open questions in `research/site-plan.md`.
- Logo: `site/assets/img/logo-*.png` are generated from AECT's original (`logo-original.png`) by `python3 tools/make_logos.py site/assets/img/logo-original.png`. Swap in a vector/high-res original when AECT provides one and rerun.
- Replace hotlinked GoDaddy CDN images with originals in `site/assets/img/`.
- Header and footer are duplicated in each page. Edit `index.html` first, then copy the changes to the other pages.
- Link previews (logo, title, description when a page is texted or shared): `python3 tools/add_share_tags.py` after changing a page title or running `build_machines.py`. `build_blog.py` runs it for you.
- Redirects: old-site addresses are in `site/_redirects`. After editing it, run `python3 tools/build_redirect_pages.py` (makes them work on GitHub Pages too).
- Blog: posts are in `blog-src/` (one HTML file each, details at the top of `tools/build_blog.py`). After adding or editing a post, or changing the header/footer, run `python3 tools/build_blog.py` to rebuild `site/blog/` and `sitemap.xml`.
- "Book a call" (the $200, 60-minute video call with Ryan) opens his Google Calendar booking page (below).

## Booking a call (the $200 call with Ryan)
Set up 2026-11-11 as a Google Calendar **appointment schedule** in ryan@aectearthblock.com: "AECT Consultation", 60 minutes, $200 paid at booking through Stripe (connected under Texaterra LLC), Google Meet, Mon–Fri 10am–2pm Eastern, cancel 24 hours ahead for a refund.

- Booking link: https://calendar.app.google/gYZce9sKyBLcg89b7
- It's set in two places: `site/assets/js/main.js` → `BOOK_CALL_URL` (every link marked `data-book-call` on the website) and `site/admin/pipeline.js` → `BOOK_CALL_URL` + `CONSULT` (price and length in the emails). After changing `pipeline.js`, redeploy the Worker (`cd worker && npx wrangler deploy`).
- Change hours, price or description in Google Calendar (Ryan's account, the appointment schedule's **Edit**); the link stays the same. If the price or length changes, update `CONSULT` and the copy on `contact.html`, `rent.html`, `reach-out.html` and `learn.html`.
- Where it shows: low-key on purpose, so people still use the planner first. Bottom of every customer email; contact form ("Video call with Ryan" topic); rental page price list; reach-out page; FAQ page.

## Deploy
The Worker in `worker/` serves the whole site and the dashboard. Moving aectearthblock.com onto it (DNS to Cloudflare, keeping AECT's Google email working) is step by step in [LAUNCH.md](LAUNCH.md).
