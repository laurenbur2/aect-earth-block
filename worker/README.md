# AECT lead backend (Cloudflare Worker + D1)

Every planner submission and contact request becomes a **lead** on a private dashboard at `/admin/`. The board is the funnel: the first two columns and the last one sort new leads by how serious they are, the rest are moved by AECT as they work the lead.

| Stage | Who lands here automatically | Team action |
|---|---|---|
| Wants us to reach out | Clicked "Yes, have someone reach out" on their results, or sent the contact form | Email them within 2 business days (overdue after 2 days) |
| Ready to build | Quiz: "Ready to build", hasn't answered "still interested?" | Email them (overdue after 3 days) |
| Not ready yet | Quiz: "Planning to build", "I have land" or "Just curious", or clicked "Not right now" | No outreach; they have their plan by email |
| In conversation | Moved by AECT | Send a quote when ready |
| Quote sent | Moved by AECT | Follow up (overdue after 7 days) |
| Won / Lost | Moved by AECT | |

"Still interested?" decides it: yes moves a lead to Wants us to reach out, no moves it to Not ready yet. Otherwise the site only moves a lead *up* (Not ready yet → Ready to build → Wants us to reach out), and it never moves a lead once it's In conversation or later. A person who comes back is updated on the same card, not duplicated. **How leads are sorted** on the dashboard shows these rules to the team.

Each lead shows their answers, plan numbers, whether they said yes to being contacted, their message, a timeline of every email sent (click **View email** to see exactly what they got), stage changes, and notes from the team.

## How it fits together
```
site (planner, contact form, reach-out page) ──POST /api/submit──> Worker (worker/src/index.js)
                                                   ├─ saves leads + lead_events (Cloudflare D1)
                                                   ├─ emails the visitor (Resend): their plan, or an auto-reply
                                                   └─ emails AECT a new-lead alert
https://<worker>/admin/  (dashboard, same Worker) ──email sign-in link──> /api/leads …
```
- `site/admin/pipeline.js`: stages, starting-stage rules and every email template. The dashboard and the Worker both import it, so edit wording here and redeploy.
- `worker/src/index.js`: the API, email sending, sign-in links and sessions.
- `worker/schema.sql`: the two tables.
- `worker/wrangler.toml`: Worker settings. Secrets (Resend key, admin emails) are set with `wrangler secret put`, never in the repo.

The Worker also serves the whole static site, so the real dashboard is at `https://aect-leads.<your-subdomain>.workers.dev/admin/`. The copy on GitHub Pages (or the local preview) has no Worker behind it, so it runs on sample leads (the **Demo data** badge; click it to reset). **Email previews** shows every template with sample data.

**Cost:** Cloudflare's free plan (100,000 requests a day, 5 GB of D1) and Resend's free plan (3,000 emails a month). Nothing pauses when it's idle.

**Dashboard sign-in:** enter your email on `/admin/`; if it's in `ADMIN_EMAILS`, the Worker emails a link (valid 15 minutes) that signs you in for 30 days. To add someone, update the `ADMIN_EMAILS` secret.

Setup and the test script: [TESTING.md](TESTING.md).

## Notes
- Spam: both forms have a hidden "website" field; submissions that fill it are dropped silently. If spam becomes a problem, add Cloudflare Turnstile.
- If Resend is down or not configured, the lead is still saved and the timeline shows the email as "not sent" or "failed".
- `SITE_URL` in `pipeline.js` is the GitHub Pages address for now. Change it to `https://aectearthblock.com/` at launch.
- The $75 call with Ryan is booked on the old GoDaddy site until it moves to Calendly before launch; see "Calendly" in the main README.
