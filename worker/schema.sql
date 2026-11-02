-- AECT lead pipeline on Cloudflare D1 (SQLite). Apply with:
--   npx wrangler d1 execute aect-leads --remote --file=schema.sql
-- Every planner submission and contact request is a lead; lead_events is its timeline: when it came in,
-- every email sent (full HTML, so the dashboard can show it), stage changes and notes.

CREATE TABLE IF NOT EXISTS leads (
  id TEXT PRIMARY KEY,                       -- random UUID
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  stage_changed_at TEXT NOT NULL,            -- for "overdue" flags on the dashboard
  source TEXT NOT NULL CHECK (source IN ('planner', 'contact')),
  -- Funnel stages; see STAGES in site/admin/pipeline.js.
  stage TEXT NOT NULL CHECK (stage IN ('reach', 'ready', 'later', 'talking', 'quoted', 'won', 'lost')),
  path TEXT,                                 -- kit | rent | blocks | consulting | consult | tools
  name TEXT,
  email TEXT NOT NULL,
  state TEXT,
  project TEXT,
  intent TEXT,
  timeline TEXT,                             -- 0-6 | 6-12 | 12+ | research
  wants_contact INTEGER,                     -- "still interested?": 1 yes, 0 no, NULL not answered
  summary TEXT NOT NULL DEFAULT '{}',        -- JSON: plan numbers or contact request fields
  raw TEXT NOT NULL                          -- JSON: the exact payload the site sent
);
CREATE INDEX IF NOT EXISTS leads_email_idx ON leads (email COLLATE NOCASE);
CREATE INDEX IF NOT EXISTS leads_stage_idx ON leads (stage, updated_at);

CREATE TABLE IF NOT EXISTS lead_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id TEXT NOT NULL REFERENCES leads (id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('created', 'resubmitted', 'interest', 'email', 'stage', 'note')),
  title TEXT,
  body TEXT,                                 -- email HTML, or note text
  meta TEXT NOT NULL DEFAULT '{}',           -- JSON: {to, subject, status} for emails, {from, to} for stages
  author TEXT                                -- admin email, or 'system'
);
CREATE INDEX IF NOT EXISTS lead_events_lead_idx ON lead_events (lead_id, created_at);
