# Launch: moving aectearthblock.com to the new site

The new site and the lead dashboard already run on one Cloudflare Worker (`aect-leads`). Launch means pointing aectearthblock.com at that Worker. When it's done:

- **Website:** https://aectearthblock.com/
- **Lead dashboard:** https://aectearthblock.com/admin/ (sign-in for anyone in the `ADMIN_EMAILS` secret: Lauren, Nicole, Ryan)
- **Public email:** info@AECTearthblock.com, which is already on every page and in the emails. It stays on Outlook / Microsoft 365, untouched.

GoDaddy stays the **registrar**: AECT keeps owning and renewing the domain there. Only the domain's DNS moves to Cloudflare (free), because a Worker can only use a custom domain whose DNS Cloudflare runs.

## Why email is safe
Email and the website use different DNS records. Outlook uses the **MX**, **autodiscover** and **TXT (SPF)** records, plus DKIM `selector1`/`selector2` CNAMEs if they're set up. The website uses the **A/CNAME** records for `@` and `www`. We copy the Outlook records over exactly and replace only the website ones.

## 1. Before the switch
- [x] **Images:** all 40 photos saved in `site/assets/img/photos/` (no GoDaddy CDN links left).
- [x] **Press archive:** now a "More coverage" list on `about.html#more-press`.
- [ ] **Privacy policy:** draft at `site/privacy.html`, linked from every footer. AECT must review and approve it. (The old site's Privacy and Terms pages were empty, so the Terms link is gone.)
- [ ] **Book a call (on hold):** no Calendly yet, so `BOOK_CALL_URL` is empty in `main.js` and `pipeline.js`. "Book a call" links go to the consult request on the contact form, and emails say "Request a call". Once Calendly exists, paste its link into both files ([README.md](README.md#calendly-the-75-call-with-ryan)).
- [ ] **Old URLs:** list the old site's pages (e.g. `/ceb-calculator`) and decide which should redirect to new pages, so Google links and bookmarks don't 404.

## 2. Move DNS to Cloudflare (Lauren, about 30 minutes plus waiting)
1. **Write down the current records.** GoDaddy → My Products → aectearthblock.com → **DNS**. Screenshot the whole list, especially MX, TXT and CNAME.
2. **Turn off DNSSEC** in GoDaddy if it's on (same DNS page). Otherwise the switch can break resolution.
3. **Add the site to Cloudflare.** dash.cloudflare.com → **Add a domain** → `aectearthblock.com` → **Free** plan. Cloudflare imports the existing records.
4. **Check Cloudflare's list against your screenshot.** Every MX, TXT and email CNAME must be there with the same value. Mail records must be **DNS only** (grey cloud), never proxied (orange). Typical Microsoft 365 records:
   - MX `@` → `aectearthblock-com.mail.protection.outlook.com` (priority 0)
   - TXT `@` → `v=spf1 include:spf.protection.outlook.com -all`
   - CNAME `autodiscover` → `autodiscover.outlook.com`
   - TXT `@` → `MS=ms…` (Microsoft's verification record)
5. **Delete the old website records** for `@` and `www` (the A/CNAME records pointing to GoDaddy). Step 4 of section 3 adds the new ones.
6. **Switch nameservers.** GoDaddy → aectearthblock.com → DNS → **Nameservers** → **Change** → "I'll use my own" → enter Cloudflare's two nameservers. GoDaddy may warn the website will disconnect; that's expected.
7. **Wait for Cloudflare to say "Active"** (usually under an hour, at most 24). Then email info@AECTearthblock.com from a Gmail account and confirm it arrives in Outlook.

## 3. Point the domain at the Worker (Claude)
1. Add the domains to `worker/wrangler.toml`:
   ```toml
   routes = [
     { pattern = "aectearthblock.com", custom_domain = true },
     { pattern = "www.aectearthblock.com", custom_domain = true },
   ]
   ```
2. In `site/admin/pipeline.js`, set `SITE_URL = "https://aectearthblock.com/"`.
3. Optional: change the form endpoints in `plan.js`, `contact.js` and `reach-out.js` from `aect-leads.casadanovavida.workers.dev` to `aectearthblock.com`. The workers.dev address keeps working either way, and `ALLOWED_ORIGINS` already includes the real domain.
4. Deploy: `cd worker && npx wrangler deploy`. Cloudflare creates the DNS records and the HTTPS certificate.
5. Redirect `www` to the bare domain with a Cloudflare **Redirect Rule** (Rules → Redirect Rules → "Redirect from WWW to root" template).

## 4. Send lead emails from the AECT domain (Lauren + Claude)
1. resend.com → **Domains** → Add `aectearthblock.com`. Resend lists DKIM/SPF records, which go on a `send.` subdomain and don't touch Outlook's.
2. Add those records in Cloudflare DNS (DNS only, grey cloud) and click **Verify** in Resend.
3. In `worker/wrangler.toml`, set `EMAIL_FROM = "AECT Earth Block <plans@aectearthblock.com>"` and redeploy. Replies still go to info@AECTearthblock.com.

## 5. Test, then cancel the GoDaddy site
- [ ] aectearthblock.com and www both load the new site over HTTPS
- [ ] Planner, contact and reach-out forms each create a lead on `/admin/`
- [ ] Lauren, Nicole and Ryan can each sign in at `/admin/`
- [ ] Lead and sign-in emails arrive from `@aectearthblock.com` and aren't in spam
- [ ] Email to info@AECTearthblock.com still reaches Outlook, and Outlook can still send
- [ ] Book a call goes to the consult request (or Calendly, once set up); Privacy loads; no broken images
- [ ] Only then: cancel GoDaddy's **Websites + Marketing** plan. Keep the **domain** and **Microsoft 365** subscriptions.
