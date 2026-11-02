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
  admin/            Private lead dashboard (stages, emails sent, notes); see backend/README.md
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
- Connect the lead backend (Supabase + Resend): see [backend/README.md](backend/README.md). It sets `LEAD_ENDPOINT` in `plan.js`, `CONTACT_ENDPOINT` in `contact.js` and the dashboard at `site/admin/`. Contact requests require a topic; there is intentionally no "other" option.
- Confirm prices and open questions in `research/site-plan.md`.
- Logo: `site/assets/img/logo-*.png` are generated from AECT's original (`logo-original.png`) by `python3 tools/make_logos.py site/assets/img/logo-original.png`. Swap in a vector/high-res original when AECT provides one and rerun.
- Replace hotlinked GoDaddy CDN images with originals in `site/assets/img/`.
- Header and footer are duplicated in each page. Edit `index.html` first, then copy the changes to the other pages.
- Move the $75 call with Ryan to Calendly (below) **before** the domain switches, or every "Book a call" button breaks.

## Calendly (the $75 call with Ryan)
Today "Book a call" opens GoDaddy Online Appointments on the old site (`aectearthblock.com/ola/services/compressed-earth-block-ceb-consultation`). That page disappears when aectearthblock.com points at the new site, so set up Calendly first:

1. **Account:** AECT signs up at calendly.com with Ryan's calendar (Google or Outlook) connected. Collecting payment needs a paid plan (Standard or higher); check current pricing.
2. **Payments:** Integrations > Stripe (or PayPal). Connect AECT's Stripe account so the $75 is paid at booking.
3. **Event type:** "CEB consultation: video call with Ryan Runge", 30 minutes, $75.
   - Location: Zoom or Google Meet (link added automatically).
   - Hours to match today: Mon–Fri, 9:00 AM–2:00 PM Mountain, 30-minute slots. Add a 15-minute buffer and at least 24 hours' notice.
   - Description: "Our president, Ryan Runge, will answer your questions about compressed earth blocks: soil, machines, cost and design."
   - Booking questions: phone (optional); "What are you building, and where?"; "Your block count from the planner, if you have one".
4. **Link:** copy the event's link (e.g. `https://calendly.com/aect/ceb-consultation`) and paste it in two places:
   - `site/assets/js/main.js` → `BOOK_CALL_URL` (every "Book a call" on the website)
   - `site/admin/pipeline.js` → `BOOK_CALL_URL` (the emails), then rerun `tools/deploy_backend.sh`
5. **Test:** book a call end to end with a real card and refund it, then check the confirmation email and calendar invite.
6. **Optional, later:** a Calendly webhook can add bookings to the lead dashboard as "Booked a call" (needs a Calendly plan with webhooks).

## Deploy
Any static host works. Netlify or Vercel: set the publish directory to `site`. GitHub Pages only serves from the repo root or `/docs`, so use a Pages Actions workflow that uploads `site/`. Then point the domain's DNS at the host.
