# Testing the funnel and emails

Goal: real leads flowing from the test site (laurenbur2.github.io) into the dashboard, with real emails, before AECT's domain is involved. Steps marked **You** need your accounts or keys; Claude can run the rest.

## 1. Fix Node on this Mac (You, 2 min)
Cloudflare's `wrangler` tool needs Node, and Homebrew's Node is currently broken (missing `libllhttp`). In Terminal:
```bash
brew reinstall node
```
Check it works:
```bash
node -v
```

## 2. Accounts (You, ~10 min)
**Cloudflare** (free): sign up at dash.cloudflare.com. No domain needed; the Worker gets a free `*.workers.dev` address. When asked, pick a workers.dev subdomain (e.g. `aect`).

**Resend** (free, 3,000 emails/month)
1. Sign up at resend.com **with the email you'll test with**.
2. API Keys > Create, "Sending access". Keep it out of chat; it goes straight into Cloudflare in step 3.
3. While testing, emails come from `onboarding@resend.dev`, and Resend only delivers them to your own sign-up address. Sending to customers needs AECT's domain (step 7).

Then connect this Mac to Cloudflare (opens your browser):
```bash
cd worker && npm install && npx wrangler login
```

## 3. Deploy (Claude, except the Resend key)
Claude runs:
```bash
cd worker && npx wrangler d1 create aect-leads
```
(pastes the printed `database_id` into `wrangler.toml`), then
```bash
npx wrangler d1 execute aect-leads --remote --file=schema.sql
```
and sets `LINK_SECRET`, `NOTIFY_EMAIL` and `ADMIN_EMAILS` (your email) as secrets.

**You** add the Resend key (it prompts; paste the key there, not in chat):
```bash
npx wrangler secret put RESEND_API_KEY
```
Then Claude runs `npx wrangler deploy`, which prints the Worker's address, e.g. `https://aect-leads.aect.workers.dev`.

## 4. Connect the site (Claude)
Set `https://<worker address>/api/submit` as the endpoint in `site/assets/js/plan.js`, `contact.js` and `reach-out.js`, bust the cache, push to GitHub, and redeploy the Worker.

## 5. Sign in to the dashboard (You)
Open `https://<worker address>/admin/`, enter your email, click the link in your inbox. (The GitHub Pages `/admin/` stays a demo.)

## 6. Test script
Use your Resend sign-up email for every test. One person = one card, so **delete the card in the dashboard between tests** ("Delete this lead"), or the next test updates the same card.

| # | Do this (on laurenbur2.github.io) | Expect |
|---|---|---|
| 1 | Planner: Ready to build, finish, click **Yes** on the results | Plan email; "New lead" alert; "Wants us to reach out" alert. Card in **Wants us to reach out**, tagged "Said yes" |
| 2 | Planner: Ready to build, don't answer, then click **Have a team member reach out** in the plan email | "You're on our list" page; card moves Ready to build → Wants us to reach out; alert email |
| 3 | Planner: Just curious, click **Not right now** | Card in **Not ready yet**, "Said not right now"; no extra alert |
| 4 | Contact form: Kit quote | Kit auto-reply; card in Wants us to reach out |
| 5 | Contact form: Buying blocks (block type + count) | Block quote auto-reply; card shows block type and count |
| 6 | Contact form: Video consult, "Just curious" | Consult auto-reply; card in Not ready yet |
| 7 | Planner (Planning to build), then the contact form with the same email | One card, moved up to Wants us to reach out, both submissions in its activity |
| 8 | Dashboard: drag a card, add a note, open **View email** | Stage change and note in activity; the email shown matches your inbox |

Check every email in **Gmail (web + phone)** and **Apple Mail**, and Outlook if AECT uses it: logo, phone layout, every button and product link, "Book a call".

## 7. Going live with real customers (after testing)
1. Resend > Domains: add `aectearthblock.com` and add the DNS records it shows at AECT's DNS host (GoDaddy today). Needs AECT's login.
2. Set `EMAIL_FROM` in `wrangler.toml` to e.g. `AECT Earth Block <plans@aectearthblock.com>`, update the `NOTIFY_EMAIL` and `ADMIN_EMAILS` secrets to AECT's inbox and staff, and redeploy.
3. Optional: give the Worker a custom domain (e.g. `leads.aectearthblock.com`) in Cloudflare, or move the whole site onto it, since the Worker already serves it.
