# AECT lead backend

Every planner submission and contact request becomes a **lead** on a private dashboard at `/admin/`. The board is the funnel: the first four columns sort new leads by how serious they are, the rest are moved by AECT as they work the lead.

| Stage | Who lands here automatically | Team action |
|---|---|---|
| Wants a call | Clicked "Yes, have someone reach out" on their results, or sent the contact form | Call within 2 business days (overdue after 2 days) |
| Ready to build | Quiz: "Ready to build", hasn't answered "still interested?" | Reach out (overdue after 3 days) |
| Planning | Quiz: "Planning to build" or "I have land", or was Ready but clicked "Not right now" | Check in later |
| Just curious | Quiz or contact form: "Just curious" | Email only, no calls |
| In conversation | Moved by AECT | Send a quote when ready |
| Quote sent | Moved by AECT | Follow up (overdue after 7 days) |
| Won / Lost | Moved by AECT | |

The site only ever moves a lead *up* (Just curious → Planning → Ready to build → Wants a call), and never moves a lead once it's In conversation or later. A person who comes back is updated on the same card, not duplicated. **How leads are sorted** on the dashboard shows these rules to the team.

Each lead shows their answers, plan numbers, whether they said yes to a call, their message, a timeline of every email sent (click **View email** to see exactly what they got), stage changes, and notes from the team.

## How it fits together
```
plan.js / contact.js ──POST──> submit-lead (Supabase Edge Function)
                                 ├─ saves to leads + lead_events (Postgres)
                                 ├─ emails the visitor (Resend): their plan, or an auto-reply
                                 └─ emails AECT a new-lead alert
site/admin/ (dashboard) ──signed in as an AECT admin──> reads/updates leads
```
- `site/admin/pipeline.js`: the stages, starting-stage rules and all email templates. Used by the dashboard and the function, so edit wording here.
- `backend/supabase/migrations/`: tables, security rules (only signed-in admins can read leads) and the stage-change log.
- `backend/supabase/functions/submit-lead/`: the function the site posts to.

Until Supabase is connected, `/admin/` runs on sample leads stored in your browser (the **Demo data** badge; click it to reset). **Email previews** shows every template with sample data.

## Setup (about 30 minutes)
1. **Supabase**: create a project at supabase.com (free tier is plenty). Under Authentication > Providers, keep Email on and turn **off** "Allow new users to sign up".
2. **Resend**: create an account at resend.com, verify AECT's sending domain (adds DNS records), and create an API key.
3. Link and deploy from the repo root:
   ```bash
   cd backend && supabase login && supabase link --project-ref YOUR_REF && cd ..
   ```
   ```bash
   supabase secrets set --workdir backend RESEND_API_KEY=re_xxx EMAIL_FROM="AECT Earth Block <plans@aectearthblock.com>" NOTIFY_EMAIL=info@AECTearthblock.com ALLOWED_ORIGINS=https://aectearthblock.com,https://laurenbur2.github.io DASHBOARD_URL=https://aectearthblock.com/admin/
   ```
   ```bash
   tools/deploy_backend.sh
   ```
4. **Add the team**: in Supabase, Authentication > Users > Invite each person, then in the SQL editor:
   ```sql
   insert into admin_users (email) values ('ryan@aectearthblock.com'), ('lburandt2@gmail.com');
   ```
   Under Authentication > URL Configuration, add the dashboard URL (e.g. `https://aectearthblock.com/admin/`) to the redirect URLs.
5. **Connect the site**:
   - `site/admin/config.js`: paste the project URL and anon key (Project Settings > API).
   - `site/assets/js/plan.js` `LEAD_ENDPOINT` and `site/assets/js/contact.js` `CONTACT_ENDPOINT`: `https://YOUR_REF.supabase.co/functions/v1/submit-lead`
   - Run `python3 tools/bust_cache.py`, commit and push.
6. Test: run the planner with your own email, check the inbox, then open `/admin/`.

After changing an email template in `pipeline.js`, rerun `tools/deploy_backend.sh` so the function sends the new version.

## Notes
- Spam: both forms have a hidden "website" field; submissions that fill it are dropped silently. If spam becomes a problem, add Cloudflare Turnstile.
- If Resend is down or not configured, the lead is still saved and the timeline shows the email as "not sent" or "failed".
- `SITE_URL` in `pipeline.js` is the GitHub Pages address for now. Change it to `https://aectearthblock.com/` at launch so email links and the logo point at the real site.
