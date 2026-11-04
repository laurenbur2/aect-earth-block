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
- Redirects: old-site addresses are in `site/_redirects`. After editing it, run `python3 tools/build_redirect_pages.py` (makes them work on GitHub Pages too).
- Blog: posts are in `blog-src/` (one HTML file each, details at the top of `tools/build_blog.py`). After adding or editing a post, or changing the header/footer, run `python3 tools/build_blog.py` to rebuild `site/blog/` and `sitemap.xml`.
- The $75 call with Ryan is on hold until AECT sets up Calendly (below). Until then, "Book a call" goes to the consult request on the contact form.

## Calendly (the $75 call with Ryan)
On hold: `BOOK_CALL_URL` is empty, so "Book a call" goes to the consult request on the contact form and the team schedules the call by email. (The old GoDaddy Online Appointments page goes away with the old site.) To turn on real booking:

1. **Account:** AECT signs up at calendly.com with Ryan's calendar (Google or Outlook) connected. Collecting payment needs a paid plan (Standard or higher); check current pricing.
2. **Payments:** Integrations > Stripe (or PayPal). Connect AECT's Stripe account so the $75 is paid at booking.
3. **Event type:** "CEB consultation: video call with Ryan Runge", 30 minutes, $75.
   - Location: Zoom or Google Meet (link added automatically).
   - Hours to match today: Mon–Fri, 9:00 AM–2:00 PM Mountain, 30-minute slots. Add a 15-minute buffer and at least 24 hours' notice.
   - Description: "Our president, Ryan Runge, will answer your questions about compressed earth blocks: soil, machines, cost and design."
   - Booking questions: phone (optional); "What are you building, and where?"; "Your block count from the planner, if you have one".
4. **Link:** copy the event's link (e.g. `https://calendly.com/aect/ceb-consultation`) and paste it in two places:
   - `site/assets/js/main.js` → `BOOK_CALL_URL` (every "Book a call" on the website)
   - `site/admin/pipeline.js` → `BOOK_CALL_URL` (the emails), then redeploy the Worker (`cd worker && npx wrangler deploy`)
5. **Test:** book a call end to end with a real card and refund it, then check the confirmation email and calendar invite.
6. **Optional, later:** a Calendly webhook can add bookings to the lead dashboard as "Booked a call" (needs a Calendly plan with webhooks).

## Deploy
The Worker in `worker/` serves the whole site and the dashboard. Moving aectearthblock.com onto it (DNS to Cloudflare, keeping AECT's Google email working) is step by step in [LAUNCH.md](LAUNCH.md).
