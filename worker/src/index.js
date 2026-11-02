// AECT lead backend on Cloudflare Workers + D1 (free plan; nothing to pause).
//
//   POST /api/submit            the planner, contact form and reach-out page post here (public)
//   POST /api/login             email an admin a sign-in link (only addresses in ADMIN_EMAILS)
//   GET  /api/auth?t=...        the sign-in link: sets a session cookie, opens the dashboard
//   POST /api/logout
//   GET  /api/me                who is signed in (the dashboard uses it to pick live vs demo mode)
//   GET  /api/leads             the board
//   GET  /api/leads/:id/events  a lead's timeline
//   PATCH  /api/leads/:id       { stage }
//   POST   /api/leads/:id/notes { body }
//   DELETE /api/leads/:id
// Everything else is the static site (../site), so the dashboard is at /admin/ on the same origin.
//
// Secrets (`npx wrangler secret put NAME`): RESEND_API_KEY, LINK_SECRET.
// Vars (wrangler.toml): EMAIL_FROM, NOTIFY_EMAIL, ADMIN_EMAILS, ALLOWED_ORIGINS.
import {
  customerEmail, initialStage, interestStage, internalEmail, mergeStage, normalize, SITE_URL,
} from "../../site/admin/pipeline.js";

const now = () => new Date().toISOString();
const list = (v) => String(v || "").split(",").map((s) => s.trim()).filter(Boolean);
const emailOk = (v) => typeof v === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", ...headers } });

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    if (!url.pathname.startsWith("/api/")) return env.ASSETS.fetch(req);
    try {
      if (url.pathname === "/api/submit") return await submit(req, env);
      if (url.pathname === "/api/login" && req.method === "POST") return await login(req, env, url);
      if (url.pathname === "/api/auth") return await auth(env, url);
      if (url.pathname === "/api/logout") return json({ ok: true }, 200, { "Set-Cookie": cookie("", 0) });

      const me = await session(req, env);
      if (!me) return json({ error: "Not signed in" }, 401);
      if (url.pathname === "/api/me") return json({ email: me });
      if (url.pathname === "/api/leads" && req.method === "GET") return json(await leads(env));
      const m = url.pathname.match(/^\/api\/leads\/([\w-]+)(\/events|\/notes)?$/);
      if (m) return await leadRoute(req, env, me, m[1], m[2]);
      return json({ error: "Not found" }, 404);
    } catch (e) {
      console.error(e);
      return json({ error: "Server error" }, 500);
    }
  },
};

// ---- Database helpers ----------------------------------------------------------------------------
const parseLead = (r) => r && { ...r, wants_contact: r.wants_contact === null ? null : !!r.wants_contact,
  summary: JSON.parse(r.summary || "{}"), raw: JSON.parse(r.raw || "{}") };
const parseEvent = (e) => ({ ...e, meta: JSON.parse(e.meta || "{}") });

async function leads(env) {
  const { results } = await env.DB.prepare("SELECT * FROM leads ORDER BY updated_at DESC").all();
  return results.map(parseLead);
}
const getLead = async (env, id) => parseLead(await env.DB.prepare("SELECT * FROM leads WHERE id = ?").bind(id).first());

function addEvent(env, leadId, e) {
  return env.DB.prepare("INSERT INTO lead_events (lead_id, created_at, kind, title, body, meta, author) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .bind(leadId, now(), e.kind, e.title ?? null, e.body ?? null, JSON.stringify(e.meta || {}), e.author || "system").run();
}

/** Updates a lead; a stage change also stamps stage_changed_at and logs it on the timeline. */
async function updateLead(env, lead, fields, author = "system") {
  const t = now();
  const next = { ...fields, updated_at: t };
  if (fields.stage && fields.stage !== lead.stage) next.stage_changed_at = t;
  const cols = Object.keys(next);
  const vals = cols.map((c) => (c === "summary" || c === "raw" ? JSON.stringify(next[c]) : c === "wants_contact" ? (next[c] === null ? null : next[c] ? 1 : 0) : next[c]));
  await env.DB.prepare(`UPDATE leads SET ${cols.map((c) => `${c} = ?`).join(", ")} WHERE id = ?`).bind(...vals, lead.id).run();
  if (fields.stage && fields.stage !== lead.stage) {
    await addEvent(env, lead.id, { kind: "stage", title: "Stage changed", meta: { from: lead.stage, to: fields.stage }, author });
  }
  return getLead(env, lead.id);
}

// ---- Email ---------------------------------------------------------------------------------------
async function send(env, to, subject, html, replyTo) {
  if (!env.RESEND_API_KEY || !to.length) return { status: "not sent", error: env.RESEND_API_KEY ? "no recipient" : "RESEND_API_KEY not set" };
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: env.EMAIL_FROM, to, subject, html, ...(replyTo ? { reply_to: replyTo } : {}) }),
  });
  const body = await res.json().catch(() => ({}));
  return res.ok ? { status: "sent", id: body.id } : { status: "failed", error: body.message || res.statusText };
}
const dashboardLink = (env, req, id) => `${new URL(req.url).origin}/admin/${id ? `#lead=${id}` : ""}`;

// ---- Signing (reach-out links, sign-in links, sessions) ------------------------------------------
async function hmac(env, text) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(env.LINK_SECRET || ""), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(text)));
  return [...mac.slice(0, 16)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
// "Have a team member reach out" in the plan email -> reach-out.html?l=<id>&s=<sig>
const reachUrl = async (env, id) => `${SITE_URL}reach-out.html?l=${id}&s=${await hmac(env, `reach:${id}`)}`;

async function token(env, purpose, email, seconds) {
  const exp = Math.floor(Date.now() / 1000) + seconds;
  const body = `${purpose}|${email}|${exp}`;
  return btoa(`${body}|${await hmac(env, body)}`).replace(/=+$/, "");
}
async function readToken(env, purpose, t) {
  try {
    const [p, email, exp, sig] = atob(t).split("|");
    if (p !== purpose || +exp < Date.now() / 1000 || sig !== await hmac(env, `${p}|${email}|${exp}`)) return null;
    return email;
  } catch { return null; }
}
const cookie = (value, maxAge) => `aect_session=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
async function session(req, env) {
  const t = (req.headers.get("Cookie") || "").match(/aect_session=([^;]+)/)?.[1];
  const email = t && await readToken(env, "session", t);
  return email && list(env.ADMIN_EMAILS).map((e) => e.toLowerCase()).includes(email) ? email : null;
}

// ---- Dashboard sign-in ---------------------------------------------------------------------------
async function login(req, env, url) {
  const { email = "" } = await req.json().catch(() => ({}));
  const e = String(email).trim().toLowerCase();
  // Same answer either way, so the form doesn't reveal who is an admin.
  if (list(env.ADMIN_EMAILS).map((a) => a.toLowerCase()).includes(e)) {
    const link = `${url.origin}/api/auth?t=${await token(env, "login", e, 15 * 60)}`;
    await send(env, [e], "Your AECT Leads sign-in link",
      `<p style="font:16px/1.5 Helvetica,Arial,sans-serif">Click to sign in to AECT Leads. The link works for 15 minutes.</p>
       <p><a href="${link}" style="font:700 16px Helvetica,Arial,sans-serif;background:#45536c;color:#fff;padding:12px 22px;border-radius:999px;text-decoration:none;display:inline-block">Sign in to AECT Leads</a></p>
       <p style="font:13px Helvetica,Arial,sans-serif;color:#5d6574">Didn't ask for this? You can ignore it.</p>`);
  }
  return json({ ok: true });
}
async function auth(env, url) {
  const email = await readToken(env, "login", url.searchParams.get("t") || "");
  if (!email) return new Response("This sign-in link has expired. Request a new one from the dashboard.", { status: 400 });
  return new Response(null, { status: 302, headers: { Location: "/admin/", "Set-Cookie": cookie(await token(env, "session", email, 30 * 86400), 30 * 86400) } });
}

// ---- Dashboard API ---------------------------------------------------------------------------------
async function leadRoute(req, env, me, id, sub) {
  const lead = await getLead(env, id);
  if (!lead) return json({ error: "No lead" }, 404);
  if (sub === "/events") {
    const { results } = await env.DB.prepare("SELECT * FROM lead_events WHERE lead_id = ? ORDER BY created_at, id").bind(id).all();
    return json(results.map(parseEvent));
  }
  if (sub === "/notes" && req.method === "POST") {
    const { body = "" } = await req.json();
    if (!String(body).trim()) return json({ error: "Empty note" }, 400);
    await addEvent(env, id, { kind: "note", body: String(body).slice(0, 5000), author: me });
    await env.DB.prepare("UPDATE leads SET updated_at = ? WHERE id = ?").bind(now(), id).run();
    return json({ ok: true });
  }
  if (!sub && req.method === "PATCH") {
    const { stage } = await req.json();
    return json(await updateLead(env, lead, { stage }, me));
  }
  if (!sub && req.method === "DELETE") {
    await env.DB.batch([env.DB.prepare("DELETE FROM lead_events WHERE lead_id = ?").bind(id), env.DB.prepare("DELETE FROM leads WHERE id = ?").bind(id)]);
    return json({ ok: true });
  }
  return json({ error: "Not found" }, 404);
}

// ---- Public: the site's forms ----------------------------------------------------------------------
function cors(req, env) {
  const origin = req.headers.get("Origin");
  const allowed = list(env.ALLOWED_ORIGINS);
  return {
    "Access-Control-Allow-Origin": origin && (allowed.includes(origin) || origin === new URL(req.url).origin) ? origin : allowed[0] || "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type, accept",
    Vary: "Origin",
  };
}

async function submit(req, env) {
  const headers = cors(req, env);
  if (req.method === "OPTIONS") return new Response(null, { headers });
  if (req.method !== "POST") return json({ error: "POST only" }, 405, headers);
  const payload = await req.json().catch(() => null);
  if (!payload) return json({ error: "Bad JSON" }, 400, headers);
  // Honeypot: the forms have a hidden "website" field that people never fill in. Pretend success.
  if (payload.website) return json({ ok: true }, 200, headers);

  // "Are you still interested?" on the planner results.
  if (payload.source === "aect-ceb-planner-interest") {
    const email = String(payload.email || "").toLowerCase();
    const lead = parseLead(await env.DB.prepare("SELECT * FROM leads WHERE email = ? COLLATE NOCASE ORDER BY created_at DESC LIMIT 1").bind(email).first());
    if (!lead) return json({ error: "No lead" }, 404, headers);
    await interest(env, req, lead, payload.interested === true, "planner");
    return json({ ok: true }, 200, headers);
  }
  // "Have a team member reach out" clicked in the plan email.
  if (payload.source === "aect-email-interest") {
    const id = String(payload.lead || "");
    if (!id || payload.sig !== await hmac(env, `reach:${id}`)) return json({ error: "Bad link" }, 403, headers);
    const lead = await getLead(env, id);
    if (!lead) return json({ error: "No lead" }, 404, headers);
    if (lead.wants_contact !== true) await interest(env, req, lead, true, "email"); // clicking twice does nothing new
    return json({ ok: true }, 200, headers);
  }

  let lead;
  try { lead = normalize(payload); } catch (e) { return json({ error: e.message }, 400, headers); }
  if (!emailOk(lead.email)) return json({ error: "Invalid email" }, 400, headers);
  lead.email = lead.email.toLowerCase();
  const stage = initialStage(lead);

  // One card per person: if they already have an open lead, update it instead of adding a duplicate.
  const existing = parseLead(await env.DB.prepare(
    "SELECT * FROM leads WHERE email = ? COLLATE NOCASE AND stage NOT IN ('won', 'lost') ORDER BY created_at DESC LIMIT 1").bind(lead.email).first());
  let row;
  if (existing) {
    row = await updateLead(env, existing, {
      name: lead.name || existing.name, state: lead.state || existing.state, project: lead.project || existing.project,
      intent: lead.intent || existing.intent, timeline: lead.timeline || existing.timeline, path: lead.path || existing.path,
      summary: { ...existing.summary, ...lead.summary }, raw: payload,
      stage: mergeStage(existing.stage, stage), // only ever up, never down
    });
    await addEvent(env, row.id, { kind: "resubmitted", title: lead.source === "planner" ? "Ran the planner again" : "Sent the contact form", meta: { payload } });
  } else {
    const id = crypto.randomUUID(), t = now();
    await env.DB.prepare(`INSERT INTO leads (id, created_at, updated_at, stage_changed_at, source, stage, path, name, email, state, project, intent, timeline, summary, raw)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(id, t, t, t, lead.source, stage, lead.path, lead.name, lead.email, lead.state, lead.project, lead.intent, lead.timeline,
        JSON.stringify(lead.summary), JSON.stringify(payload)).run();
    row = await getLead(env, id);
    await addEvent(env, id, { kind: "created", title: lead.source === "planner" ? "Finished the planner" : "Sent the contact form", meta: { payload } });
  }

  // Emails go out after the lead is saved, so a mail outage never loses a lead.
  const notify = list(env.NOTIFY_EMAIL);
  const mine = customerEmail({ ...lead, summary: row.summary, reachUrl: await reachUrl(env, row.id) });
  const alert = internalEmail(row, row.stage, dashboardLink(env, req, row.id));
  const [r1, r2] = await Promise.all([send(env, [lead.email], mine.subject, mine.html, notify[0]), send(env, notify, alert.subject, alert.html, lead.email)]);
  await addEvent(env, row.id, { kind: "email", title: mine.subject, body: mine.html, meta: { to: lead.email, subject: mine.subject, audience: "customer", ...r1 } });
  await addEvent(env, row.id, { kind: "email", title: alert.subject, body: alert.html, meta: { to: notify.join(", "), subject: alert.subject, audience: "aect", ...r2 } });
  return json({ ok: true }, 200, headers);
}

/** Records a yes/no to "a team member reaching out" and, on yes, alerts AECT right away. */
async function interest(env, req, lead, yes, via) {
  await addEvent(env, lead.id, { kind: "interest", title: !yes ? "Not interested right now"
    : via === "email" ? "Clicked \"Have a team member reach out\" in their plan email" : "Still interested: wants a team member to reach out" });
  const row = await updateLead(env, lead, { wants_contact: yes, stage: interestStage(lead.stage, yes) });
  if (!yes) return;
  const notify = list(env.NOTIFY_EMAIL);
  const alert = internalEmail(row, row.stage, dashboardLink(env, req, row.id));
  const subject = `Wants us to reach out: ${row.name || row.email}`;
  const r = await send(env, notify, subject, alert.html, row.email);
  await addEvent(env, row.id, { kind: "email", title: subject, body: alert.html, meta: { to: notify.join(", "), subject, audience: "aect", ...r } });
}
