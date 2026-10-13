# AECT Earth Block: redesign plan

## The problem
The current site has 25 pages under one "More" menu. Prospects can't find answers, so they call and email AECT with the same questions (Will my dirt work? How many blocks? Which machine? What will it cost?). That eats Ryan's time.

## Client goals (from the kickoff call, 2026-10-13)
- Too many inbound questions. Wants automatic replies and an initial screening form.
- **Block calculator is the most important piece.** Every plan must capture the person's name and email.
- Bring in more **rental** business. Screen with "Do you have a project?" and "Are you interested in buying or renting?"
- **Sell kits, not one-off machines.** A kit = machine + soil analysis + training. Messaging: "Kits starting at…"
- **Drive sales for the Impact 2001A and the 3500.** The 2500HD can stay on the site, but nothing should funnel people to it.
- **Terra Madre Brick Co.** (https://terramadrebrickco.com/, contact@terramadrebrickco.com, +1 682-553-3476) is the client's brick company and sells all finished blocks. AECT = machines, kits, training, rental. Their site is currently a single quote form and will be redesigned later.

## The fix: answer first, contact second
Modeled on The Farmer's Dog: the home page leads into a short, one-question-per-screen quiz that ends in a personalized plan. Visitors get their real numbers before they ever contact AECT, and AECT gets a qualified lead with project details attached.

### Navigation (4 items + 1 button)
`Machines` · `Blocks` · `Rent Equipment` · `About` · **[Plan my build]**
FAQ, build videos, consulting and contact live in the footer. The $75 consult is not promoted on the home page; the only goal there is starting the planner.

### Brand
Colors come from the AECT logo: navy #45536C, cream #FBF8CC, globe green #ADBB89.

### Pages
| Page | Purpose | Replaces |
|---|---|---|
| `index.html` | Hero video, planner entry (Q1 on the home page), 3 paths, CEB 101, benefits, how it works, top-6 FAQ | Home |
| `plan.html` | **The funnel.** 8 questions + contact, then a personalized plan | CEB Calculator (spreadsheet embed) |
| `machines.html` | Comparison table + full spec/price/video for every machine | Purchase a CEB Machine, Impact, 2500HD, 3500, BP714, Mega Mixer, Small Block Press, Block Cutter, Hand-made, Catalog |
| `blocks.html` | Sizes, stabilized vs un-stabilized, uses, pricing, partners | Purchase CEBs, part of FAQs |
| `rent.html` | Batch-plant rental with operator, pricing, what you provide, consulting rates | AECT Consulting (rental is new) |
| `learn.html` | Full FAQ + build videos | FAQs, Building With CEBs |
| `about.html` | Story, Ryan, press, projects | About, History, On TV, In the News, Barn Build, Customer Projects |
| `contact.html` | Planner → $75 consult → quote form, in that order | Contact Us |
| *(deleted)* | | Shop ("coming soon"), Blog (move to a later phase if they post) |

### The planner funnel
Farmer's Dog pattern: one tap per question (photo or icon answers, auto-advance), the visitor's name used throughout, a "building your plan" moment, then **email required to see the plan**.
1. What are you building? (photo cards; also on the home page, so one click starts the quiz)
2. First name
3. State, or outside the US
4. Size (quick-pick chips or custom)
5. Wall height (3 options)
6. Wall type (4 visual block options), which sets block size and machine
7. Rain exposure (2 photos) → stabilized or not
8. Dirt source: own land or delivered
9. Labor: family and friends or hired crew
10. Timeline (lead qualification)
11. "Building your plan…" animation
12. **Email gate** with a blurred preview of their real numbers → **lead captured here**
13. **Results:** block count, machine, earth, cement, pallets; cheapest of make, rent or buy (breakdowns tucked away); recommended machine; one CTA: get an official quote.

The math is a faithful port of AECT's 2022 spreadsheet (`research/calculator-logic.md`, `research/calculator.js`), verified against the live sheet. The only change: machine prices updated to what the site shows today.

## Questions for AECT before launch
0. **New from the kickoff notes:** (a) What does a kit cost? We show "Kits from" the machine price. Is soil analysis extra? (b) Terra Madre's block prices and service area (we still show the 2022 calculator's planning prices). (c) Which tool should send the automatic replies (see README)?
1. **Machine prices in the calculator are stale.** The spreadsheet says Impact $39k, 2500HD $79k, BP714 $59k. The site says $59k, $89k, $69,625. We used the site prices. Confirm.
2. **Does AECT sell blocks directly?** The calculator prices "buy CEBs from AECT, shipped" ($2.75–$3.50/block), but the Purchase CEBs page sends people to partners. Which is it?
3. **Free delivery or FOB?** The home page says machines include free delivery; every product page says FOB San Antonio, shipping not included.
4. **Rental details:** confirm the $20k/$25k/$30k mobilization tiers and $1/block, which block sizes are available to rent, and minimum order.
5. **Spreadsheet quirks to fix or keep** (see `calculator-logic.md`): "8% stabilized" actually uses 5% cement; pallets are computed from cubic yards, not blocks; rental still charges the customer's own labor; labor assumes 20% of rated machine speed.
6. **Lead destination:** where should planner leads go (email inbox, HubSpot, Google Sheet)? We need this to connect `LEAD_ENDPOINT`.
7. **Booking:** keep GoDaddy's $75 consult booking, or move to Calendly/Cal.com? (We have no direct booking URL outside GoDaddy.)
8. **Phone number:** older pages list 210-400-9831. Should it be public? (Hiding it supports the funnel goal.)
9. **Media:** original high-res photos (the GoDaddy CDN copies are small; the Mega Mixer image is 346px wide) and a 15–30 s raw landscape clip for the hero. Today we loop YouTube video `78pPHrg9bQw`.
10. **Logo:** the site now uses AECT's real logo, taken from their current site (810×450 PNG). Ask for a vector (SVG/AI/EPS) or high-res original so it stays crisp on retina screens.
11. **Inventory:** do they want an "Available now" section for used/new units in stock (the home page currently lists a BP714 and sold units)?
12. **Domain/hosting:** who controls aectearthblock.com DNS? GoDaddy Website Builder can't host this; we'll deploy to GitHub Pages, Netlify or Vercel and point the domain.

## Phase 2 ideas
- Self-hosted hero MP4 (faster, no YouTube branding)
- Lead → auto-emailed PDF plan
- Soil-test guide page (jar test walkthrough) as a second lead magnet
- Customer project stories with block counts and costs
- Spanish version (Mexico/Latin America partners)
