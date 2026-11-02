-- AECT lead pipeline: every planner submission and contact request becomes a lead that moves
-- through stages on the admin dashboard (site/admin/). Each lead has a timeline of events:
-- when it came in, every email we sent (full HTML, so the dashboard can show it), stage changes and notes.

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  source text not null check (source in ('planner', 'contact')),
  stage text not null default 'inquiring'
    check (stage in ('inquiring', 'unsure', 'ready', 'quoted', 'won', 'lost')),
  -- What they're after: kit | rent | blocks | consulting | consult | tools
  path text,
  name text,
  email text not null,
  state text,
  project text,   -- home | barn | commercial | outdoor | business (planner only)
  intent text,    -- own | rent | buy | unsure (planner only)
  timeline text,  -- 0-6 | 6-12 | 12+ | research
  summary jsonb not null default '{}'::jsonb, -- plan numbers, or the contact request fields
  raw jsonb not null                           -- the exact payload the site sent
);
create index leads_stage_idx on public.leads (stage, updated_at desc);
create index leads_email_idx on public.leads (lower(email));

create table public.lead_events (
  id bigint generated always as identity primary key,
  lead_id uuid not null references public.leads (id) on delete cascade,
  created_at timestamptz not null default now(),
  kind text not null check (kind in ('created', 'resubmitted', 'email', 'stage', 'note')),
  title text,
  body text,                 -- email HTML, or note text
  meta jsonb not null default '{}'::jsonb, -- e.g. {to, subject, status} for emails, {from, to} for stages
  author text                -- admin email, or 'system'
);
create index lead_events_lead_idx on public.lead_events (lead_id, created_at);

-- Who can sign in to the dashboard. Add AECT staff here:
--   insert into public.admin_users (email) values ('ryan@aectearthblock.com');
create table public.admin_users (email text primary key);

create function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admin_users where email = lower(auth.jwt() ->> 'email'));
$$;

-- Keep updated_at fresh and log every stage change on the lead's timeline.
create function public.leads_touch() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.updated_at := now();
  if new.stage is distinct from old.stage then
    insert into public.lead_events (lead_id, kind, title, meta, author)
    values (new.id, 'stage', 'Stage changed', jsonb_build_object('from', old.stage, 'to', new.stage),
            coalesce(auth.jwt() ->> 'email', 'system'));
  end if;
  return new;
end;
$$;
create trigger leads_touch before update on public.leads
for each row execute function public.leads_touch();

-- Row-level security: the public site never reads or writes these tables directly. Leads are
-- inserted by the submit-lead Edge Function with the service role key; only admins can read and edit.
alter table public.leads enable row level security;
alter table public.lead_events enable row level security;
alter table public.admin_users enable row level security;

create policy "admins read leads" on public.leads for select to authenticated using (public.is_admin());
create policy "admins update leads" on public.leads for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins delete leads" on public.leads for delete to authenticated using (public.is_admin());
create policy "admins read events" on public.lead_events for select to authenticated using (public.is_admin());
create policy "admins add notes" on public.lead_events for insert to authenticated
  with check (public.is_admin() and kind = 'note');
create policy "admins see admins" on public.admin_users for select to authenticated using (public.is_admin());
