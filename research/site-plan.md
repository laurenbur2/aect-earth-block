# AECT Earth Block: redesign plan

## The problem
The current site has 25 pages under one "More" menu. Prospects can't find answers, so they call and email AECT with the same questions (Will my dirt work? How many blocks? Which machine? What will it cost?). That eats Ryan's time.

## The fix: answer first, contact second
Modeled on The Farmer's Dog: the home page leads into a short, one-question-per-screen quiz that ends in a personalized plan. Visitors get their real numbers before they ever contact AECT, and AECT gets a qualified lead with project details attached.

### Navigation (3 items + 1 button)
`Machines` · `Blocks` · `Rent Equipment` · **[Plan my build]**
Everything else (FAQ, build videos, about, press, projects, consulting, contact) lives in the footer and is linked from planner results.

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
1. What are you building? (home / barn / commercial / outdoor / multi-building or business). **Asked on the home page**, so one click puts the visitor into the quiz.
2. State (drives delivery and rental mobilization), or outside the US
3. Size: square footage (we estimate wall lengths) or exact linear feet
4. Wall height
5. Wall thickness, which sets block size and machine (plain-English cards)
6. Weather exposure → stabilized vs un-stabilized (exterior + interior)
7. Labor: volunteer or hired crew (crew size, wage)
8. Local material costs (sensible defaults)
9. Timeline, soil tested?, name, email, phone (optional) → **lead captured here**
10. **Results:** block count, earth/cement yd³, pallets, trucks, run hours; cost to buy a machine vs rent vs buy blocks with "best value" flagged and break-even math; recommended machine; next step chosen by timeline (quote / $75 consult / soil testing); print or email the plan.

The math is a faithful port of AECT's 2022 spreadsheet (`research/calculator-logic.md`, `research/calculator.js`), verified against the live sheet. The only change: machine prices updated to what the site shows today.

## Questions for AECT before launch
1. **Machine prices in the calculator are stale.** The spreadsheet says Impact $39k, 2500HD $79k, BP714 $59k. The site says $59k, $89k, $69,625. We used the site prices. Confirm.
2. **Does AECT sell blocks directly?** The calculator prices "buy CEBs from AECT, shipped" ($2.75–$3.50/block), but the Purchase CEBs page sends people to partners. Which is it?
3. **Free delivery or FOB?** The home page says machines include free delivery; every product page says FOB San Antonio, shipping not included.
4. **Rental details:** confirm the $20k/$25k/$30k mobilization tiers and $1/block, which block sizes are available to rent, and minimum order.
5. **Spreadsheet quirks to fix or keep** (see `calculator-logic.md`): "8% stabilized" actually uses 5% cement; pallets are computed from cubic yards, not blocks; rental still charges the customer's own labor; labor assumes 20% of rated machine speed.
6. **Lead destination:** where should planner leads go (email inbox, HubSpot, Google Sheet)? We need this to connect `LEAD_ENDPOINT`.
7. **Booking:** keep GoDaddy's $75 consult booking, or move to Calendly/Cal.com? (We have no direct booking URL outside GoDaddy.)
8. **Phone number:** older pages list 210-400-9831. Should it be public? (Hiding it supports the funnel goal.)
9. **Media:** original high-res photos (the GoDaddy CDN copies are small; the Mega Mixer image is 346px wide) and a 15–30 s raw landscape clip for the hero. Today we loop YouTube video `78pPHrg9bQw`.
10. **Logo:** vector logo file. The prototype uses a placeholder block mark.
11. **Inventory:** do they want an "Available now" section for used/new units in stock (the home page currently lists a BP714 and sold units)?
12. **Domain/hosting:** who controls aectearthblock.com DNS? GoDaddy Website Builder can't host this; we'll deploy to GitHub Pages, Netlify or Vercel and point the domain.

## Phase 2 ideas
- Self-hosted hero MP4 (faster, no YouTube branding)
- Lead → auto-emailed PDF plan
- Soil-test guide page (jar test walkthrough) as a second lead magnet
- Customer project stories with block counts and costs
- Spanish version (Mexico/Latin America partners)
