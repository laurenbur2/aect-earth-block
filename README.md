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
- Set `LEAD_ENDPOINT` in `site/assets/js/plan.js` and `CONTACT_ENDPOINT` in `site/assets/js/contact.js` (same service). Contact requests require a topic; there is intentionally no "other" option.
- Confirm prices and open questions in `research/site-plan.md`.
- Logo: `site/assets/img/logo-*.png` are generated from AECT's original (`logo-original.png`) by `python3 tools/make_logos.py site/assets/img/logo-original.png`. Swap in a vector/high-res original when AECT provides one and rerun.
- Replace hotlinked GoDaddy CDN images with originals in `site/assets/img/`.
- Header and footer are duplicated in each page. Edit `index.html` first, then copy the changes to the other pages.

## Deploy
Any static host works. Netlify or Vercel: set the publish directory to `site`. GitHub Pages only serves from the repo root or `/docs`, so use a Pages Actions workflow that uploads `site/`. Then point the domain's DNS at the host.
