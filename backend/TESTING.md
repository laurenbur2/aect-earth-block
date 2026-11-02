# Testing the funnel and emails

Goal: real leads flowing from the live test site (laurenbur2.github.io) into the dashboard, with real emails, before AECT's domain is involved. Steps marked **You** need your accounts; the rest Claude can run.

## 1. Accounts (You, ~15 min)

**Supabase** (database, server function, dashboard logins)
1. Sign up at supabase.com and create a project named `aect-leads` (free plan, a US region). Save the database password somewhere safe.
2. Authentication > Sign In / Providers: keep **Email** on, turn **off** "Allow new users to sign up".
3. Authentication > URL Configuration: Site URL `https://laurenbur2.github.io/aect-earth-block/admin/`; add redirect URLs `https://laurenbur2.github.io/aect-earth-block/admin/` and `http://localhost:4173/admin/`.
4. Note the **project ref** (the code in the project's URL, `supabase.com/dashboard/project/<ref>`) and, from Project Settings > API, the **Project URL** and **anon public key**. These three are safe to share in chat.

**Resend** (sends the emails)
1. Sign up at resend.com **with the email address you'll test with**.
2. API Keys > Create, with "Sending access". Don't paste it in chat; it goes in a file in step 2.
3. For testing, emails come from `onboarding@resend.dev` and **Resend only delivers them to your own sign-up address**. That's fine for testing. Sending to real customers needs AECT's domain verified (step 6).

**Supabase CLI on this Mac.** It's signed in to an account Supabase reports as "banned", so sign in fresh. In Terminal:
```bash
supabase logout
```
```bash
supabase login
```

## 2. Secrets (You, 2 min)
Create `backend/supabase/.env.local` (it's git-ignored, never published) with:
```
RESEND_API_KEY=re_your_key_here
EMAIL_FROM=AECT Earth Block <onboarding@resend.dev>
NOTIFY_EMAIL=you@yourresendsignup.com
ALLOWED_ORIGINS=https://laurenbur2.github.io,http://localhost:4173
DASHBOARD_URL=https://laurenbur2.github.io/aect-earth-block/admin/
LINK_SECRET=any-long-random-string
```
`NOTIFY_EMAIL` is where "new lead" alerts go; during testing it's your Resend address too.

## 3. Deploy (Claude)
```bash
cd backend && supabase link --project-ref YOUR_REF && supabase secrets set --env-file supabase/.env.local && cd .. && tools/deploy_backend.sh
```
This creates the tables and deploys the `submit-lead` function. `supabase link` asks for the database password.

## 4. Connect the site (Claude)
Paste the Project URL and anon key into `site/admin/config.js`, set the function URL (`https://YOUR_REF.supabase.co/functions/v1/submit-lead`) in `plan.js`, `contact.js` and `reach-out.js`, bust the cache, push.

## 5. Dashboard login (You, 2 min)
1. Supabase > Authentication > Users > **Invite user** with your email.
2. SQL Editor, run: `insert into admin_users (email) values ('you@example.com');`
3. Open `/admin/`, enter your email, click the link in your inbox.

## 6. Test script
Use your Resend sign-up email for every test. One person = one card, so **delete the card in the dashboard between tests** ("Delete this lead"), or the next test updates the same card.

| # | Do this | Expect |
|---|---|---|
| 1 | Planner: Ready to build, finish, click **Yes** on the results | Plan email; "New lead" alert; "Wants us to reach out" alert. Card in **Wants us to reach out**, tagged "Said yes" |
| 2 | Planner: Ready to build, don't answer, then click **Have a team member reach out** in the plan email | "You're on our list" page; card moves Ready to build → Wants us to reach out; alert email |
| 3 | Planner: Just curious, click **Not right now** | Card in **Not ready yet**, "Said not right now"; no extra alert |
| 4 | Contact form: Kit quote | Kit auto-reply; card in Wants us to reach out |
| 5 | Contact form: Buying blocks (block type + count) | Block quote auto-reply; card shows block type and count |
| 6 | Contact form: Video consult, "Just curious" | Consult auto-reply; card in Not ready yet |
| 7 | Planner (Planning to build), then the contact form with the same email | One card, moved up to Wants us to reach out, both submissions in its activity |
| 8 | Dashboard: drag a card, add a note, open **View email** | Stage change and note in activity; the email shown matches your inbox |

Check every email on at least **Gmail (web + phone)** and **Apple Mail**, and Outlook if AECT uses it: logo, layout on phone, every button and product link, "Book a call".

## 7. Going live with real customers (after testing)
1. In Resend > Domains, add `aectearthblock.com` and add the DNS records it shows at AECT's DNS host (GoDaddy today). Needs AECT's login.
2. Change `EMAIL_FROM` to e.g. `AECT Earth Block <plans@aectearthblock.com>`, `NOTIFY_EMAIL` to AECT's inbox, add AECT staff to `admin_users`, rerun step 3.
