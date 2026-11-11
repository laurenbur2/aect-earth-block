# Launch: moving aectearthblock.com to the new site

The new site and the lead dashboard already run on one Cloudflare Worker (`aect-leads`). Launch means pointing aectearthblock.com at that Worker. When it's done:

- **Website:** https://aectearthblock.com/
- **Lead dashboard:** https://aectearthblock.com/admin/ (sign-in for anyone in the `ADMIN_EMAILS` secret: lburandt2@gmail.com, nicole@rancherogroup.co, ryan@aectearthblock.com, info@aectearthblock.com)
- **Public email:** info@AECTearthblock.com, which is already on every page and in the emails. It stays on Google Workspace (Gmail), untouched. (Checked 2026-11-04: the domain's mail records point to Google, not Microsoft.)

GoDaddy stays the **registrar**: AECT keeps owning and renewing the domain there. Only the domain's DNS moves to Cloudflare (free), because a Worker can only use a custom domain whose DNS Cloudflare runs.

## Why email is safe
Email and the website use different DNS records. AECT's email (Google Workspace) uses the **MX**, **SPF**, **DKIM** and **DMARC** records below. The website uses the **A/CNAME** records for `@` and `www`. We copy the email records exactly and replace only the website ones.

### AECT's records today (looked up 2026-11-04, still on GoDaddy DNS)
Keep all of these. Every one must be **DNS only** (grey cloud) in Cloudflare.

| Type | Name | Value |
|---|---|---|
| MX | `@` | `aspmx.l.google.com` (priority 1) |
| MX | `@` | `alt1.aspmx.l.google.com` (5) |
| MX | `@` | `alt2.aspmx.l.google.com` (5) |
| MX | `@` | `alt3.aspmx.l.google.com` (10) |
| MX | `@` | `alt4.aspmx.l.google.com` (10) |
| TXT | `@` | `v=spf1 include:_spf.google.com ~all` (**write it this way.** GoDaddy's version points at a GoDaddy-only helper record, `dc-aa8e722993._spfm`, that resolves to the same thing) |
| TXT | `google._domainkey` | the long `v=DKIM1;k=rsa;p=MIIB…` key (Google's email signature). Copy it exactly from GoDaddy. Cloudflare's scan often misses it. |
| TXT | `_dmarc` | `v=DMARC1; p=none; rua=mailto:dmarc_rua@onsecureserver.net` |
| TXT | `@` | four `google-site-verification=…` records (they prove ownership in Google Search Console, so keep them) |
| TXT | `@` | `NETORGFT3223083.onmicrosoft.com` (old Microsoft verification; harmless, keep) |

Delete these (old GoDaddy website): A `@` → `13.248.243.5` and `76.223.105.230`, CNAME `www` → `@`, CNAME `ftp` → `@`, and any `_domainconnect` record.

## 1. Before the switch
- [x] **Content:** Ryan confirmed the prices and details on the site.
- [ ] **Contact form test:** send one request on the live site and check it shows up in `/admin/` and the emails arrive (the planner is already tested).
- [x] **Images:** all 40 photos saved in `site/assets/img/photos/` (no GoDaddy CDN links left).
- [x] **Blog:** all 15 old posts (text, 112 photos, videos) moved to `/blog/`; old post addresses forward to them.
- [x] **Press archive:** now a "More coverage" list on `about.html#more-press`.
- [ ] **Privacy policy:** draft at `site/privacy.html`, linked from every footer. AECT must review and approve it. (The old site's Privacy and Terms pages were empty, so the Terms link is gone.)
- [x] **Book a call:** $200, 60-minute call with Ryan on his Google Calendar booking page (paid through Stripe), set in `main.js` and `pipeline.js` ([README.md](README.md#booking-a-call-the-200-call-with-ryan)). Test one real booking and refund it.
- [x] **Old URLs:** all 44 old addresses (pages, blog posts, shop, booking) forward to the closest new page via `site/_redirects` (301s, so Google moves its listings). Add a line there if an old link turns up later.

## 2. Point the domain at the site: DONE 2026-11-04
Hosting is GitHub Pages (repo `laurenbur2/aect-earth-block`, custom domain `aectearthblock.com`, HTTPS enforced). DNS stays at GoDaddy:
- A `@` → `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153` (replaced "WebsiteBuilder Site")
- CNAME `www` → `laurenbur2.github.io` (GitHub forwards www to the bare domain)
- All email records unchanged.

The lead backend stays on the Cloudflare Worker (`aect-leads.casadanovavida.workers.dev`): forms post to it, and `aectearthblock.com/admin/` forwards to its dashboard. Old addresses forward via pages generated from `site/_redirects` (`tools/build_redirect_pages.py`). `SITE_URL` in `pipeline.js` is `https://aectearthblock.com/`.

To undo: put the GoDaddy A record back to the Website Builder site (Website → Manage → connect domain) and remove the custom domain in GitHub → Settings → Pages.

## 4. Send lead emails from the AECT domain (Lauren + Claude)
1. resend.com → **Domains** → Add `aectearthblock.com`. Resend lists DKIM/SPF records, which go on a `send.` subdomain and don't touch Google's.
2. Add those records in GoDaddy DNS and click **Verify** in Resend.
3. In `worker/wrangler.toml`, set `EMAIL_FROM = "AECT Earth Block <plans@aectearthblock.com>"` and redeploy. Replies still go to info@AECTearthblock.com.

## 5. Test, then cancel the GoDaddy site
- [ ] aectearthblock.com and www both load the new site over HTTPS
- [ ] Planner, contact and reach-out forms each create a lead on `/admin/`
- [ ] Lauren, Nicole and Ryan can each sign in at `/admin/`
- [ ] Lead and sign-in emails arrive from `@aectearthblock.com` and aren't in spam
- [ ] Email to info@AECTearthblock.com still arrives, and info@ can still send
- [ ] Book a call opens Ryan's Google Calendar booking page; Privacy loads; no broken images
- [ ] Old links forward: try `aectearthblock.com/faqs` and `/3500-series`
- [ ] Only then: cancel GoDaddy's **Websites + Marketing** plan. Keep the **domain** registration. (Email is billed by Google, not GoDaddy; check GoDaddy for an unused Microsoft 365 plan before canceling anything.)

## 6. Google Search Console (Lauren, after launch)
Redirects already tell Google where every old page went, so nothing has to be removed by hand. Search Console lets you confirm it and speed it up.

1. **Add the site:** search.google.com/search-console → Add property → **Domain** → `aectearthblock.com`. AECT already has Google verification TXT records, so it may already be verified. If not, Google gives you a TXT record; add it in GoDaddy DNS. If AECT already has a property for the old site, keep it, since its history carries over.
2. **Submit the sitemap:** Sitemaps → enter `sitemap.xml` → Submit. It lists every page and blog post (rebuilt by `tools/build_blog.py`). Remove the old GoDaddy sitemaps if they're listed there.
3. **Watch it settle:** over 2 to 8 weeks the old addresses drop out of results and the new ones replace them. Pages → "Page with redirect" is expected for old addresses; anything under "Not found (404)" means an old link is missing from `_redirects`.
4. **Removals tool:** only for a page that must vanish from Google right away (it hides it for about 6 months). Not needed for normal redirected pages.
5. **Optional:** link Google Business Profile and any Google Ads to the new pages.
