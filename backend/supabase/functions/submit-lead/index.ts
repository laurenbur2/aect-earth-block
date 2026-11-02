// submit-lead: the planner (plan.js) and contact form (contact.js) POST here.
// Saves or updates the lead, emails the visitor (their plan, or an auto-reply), emails AECT a
// heads-up, and logs both emails on the lead's timeline so the dashboard can show exactly what was sent.
//
// Env (set with `supabase secrets set`):
//   RESEND_API_KEY   Resend API key. Without it, emails are logged as "not sent" and nothing is mailed.
//   EMAIL_FROM       e.g. "AECT Earth Block <plans@aectearthblock.com>" (domain must be verified in Resend)
//   NOTIFY_EMAIL     AECT inbox(es) for new-lead alerts, comma separated
//   ALLOWED_ORIGINS  comma separated, e.g. "https://aectearthblock.com,https://laurenbur2.github.io"
//   DASHBOARD_URL    link used in the alert email, e.g. "https://aectearthblock.com/admin/"
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase.
import { createClient } from "npm:@supabase/supabase-js@2";
import { customerEmail, initialStage, interestStage, internalEmail, mergeStage, normalize } from "../_shared/pipeline.js";

const env = (k: string) => Deno.env.get(k) ?? "";
const db = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });
const allowed = env("ALLOWED_ORIGINS").split(",").map((s) => s.trim()).filter(Boolean);
const emailOk = (v: unknown) => typeof v === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);

function cors(origin: string | null) {
  const ok = origin && (allowed.length === 0 || allowed.includes(origin));
  return {
    "Access-Control-Allow-Origin": ok ? origin : allowed[0] ?? "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type, accept",
    Vary: "Origin",
  };
}

async function send(to: string[], subject: string, html: string, replyTo?: string) {
  const key = env("RESEND_API_KEY");
  if (!key || !to.length) return { status: "not sent", error: key ? "no recipient" : "RESEND_API_KEY not set" };
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: env("EMAIL_FROM"), to, subject, html, ...(replyTo ? { reply_to: replyTo } : {}) }),
  });
  const body = await res.json().catch(() => ({}));
  return res.ok ? { status: "sent", id: body.id } : { status: "failed", error: body.message || res.statusText };
}

Deno.serve(async (req) => {
  const headers = { ...cors(req.headers.get("origin")), "Content-Type": "application/json" };
  if (req.method === "OPTIONS") return new Response(null, { headers });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "POST only" }), { status: 405, headers });

  let payload: Record<string, unknown>;
  try { payload = await req.json(); } catch { return new Response(JSON.stringify({ error: "Bad JSON" }), { status: 400, headers }); }
  // Honeypot: the forms have a hidden "website" field that people never fill in. Pretend success.
  if (payload.website) return new Response(JSON.stringify({ ok: true }), { headers });

  // "Are you still interested?" on the planner results: update the lead they just created.
  if (payload.source === "aect-ceb-planner-interest") return interest(payload, headers);

  let lead;
  try { lead = normalize(payload); } catch (e) { return new Response(JSON.stringify({ error: String(e.message) }), { status: 400, headers }); }
  if (!emailOk(lead.email)) return new Response(JSON.stringify({ error: "Invalid email" }), { status: 400, headers });
  lead.email = lead.email.toLowerCase();
  const stage = initialStage(lead);

  // One card per person: if they already have an open lead, update it instead of adding a duplicate.
  const { data: existing } = await db.from("leads").select("*").ilike("email", lead.email)
    .not("stage", "in", "(won,lost)").order("created_at", { ascending: false }).limit(1).maybeSingle();

  let row;
  if (existing) {
    const { data, error } = await db.from("leads").update({
      name: lead.name || existing.name, state: lead.state || existing.state,
      project: lead.project || existing.project, intent: lead.intent || existing.intent,
      timeline: lead.timeline || existing.timeline, path: lead.path || existing.path,
      summary: { ...existing.summary, ...lead.summary },
      raw: payload,
      // Only ever move a returning lead up (e.g. Just curious -> Wants a call), never down.
      stage: mergeStage(existing.stage, stage),
    }).eq("id", existing.id).select().single();
    if (error) return new Response(JSON.stringify({ error: "Save failed" }), { status: 500, headers });
    row = data;
    await db.from("lead_events").insert({
      lead_id: row.id, kind: "resubmitted", author: "system",
      title: lead.source === "planner" ? "Ran the planner again" : "Sent the contact form", meta: { payload },
    });
  } else {
    const { data, error } = await db.from("leads").insert({ ...lead, stage, raw: payload }).select().single();
    if (error) return new Response(JSON.stringify({ error: "Save failed" }), { status: 500, headers });
    row = data;
    await db.from("lead_events").insert({
      lead_id: row.id, kind: "created", author: "system",
      title: lead.source === "planner" ? "Finished the planner" : "Sent the contact form", meta: { payload },
    });
  }

  // Emails go out after the lead is saved, so a mail outage never loses a lead.
  const mine = customerEmail({ ...lead, summary: row.summary });
  const notify = env("NOTIFY_EMAIL").split(",").map((s) => s.trim()).filter(Boolean);
  const alert = internalEmail(row, row.stage, env("DASHBOARD_URL") ? `${env("DASHBOARD_URL")}#lead=${row.id}` : undefined);
  const [r1, r2] = await Promise.all([
    send([lead.email], mine.subject, mine.html, notify[0]),
    send(notify, alert.subject, alert.html, lead.email),
  ]);
  await db.from("lead_events").insert([
    { lead_id: row.id, kind: "email", author: "system", title: mine.subject, body: mine.html, meta: { to: lead.email, subject: mine.subject, audience: "customer", ...r1 } },
    { lead_id: row.id, kind: "email", author: "system", title: alert.subject, body: alert.html, meta: { to: notify.join(", "), subject: alert.subject, audience: "aect", ...r2 } },
  ]);

  return new Response(JSON.stringify({ ok: true }), { headers });
});

async function interest(payload: Record<string, unknown>, headers: Record<string, string>) {
  const email = String(payload.email || "").toLowerCase();
  if (!emailOk(email)) return new Response(JSON.stringify({ error: "Invalid email" }), { status: 400, headers });
  const yes = payload.interested === true;
  const { data: lead } = await db.from("leads").select("*").ilike("email", email)
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!lead) return new Response(JSON.stringify({ error: "No lead" }), { status: 404, headers });
  const { data: row } = await db.from("leads").update({ wants_contact: yes, stage: interestStage(lead.stage, yes) })
    .eq("id", lead.id).select().single();
  await db.from("lead_events").insert({
    lead_id: lead.id, kind: "interest", author: "system",
    title: yes ? "Still interested: wants a team member to reach out" : "Not interested right now",
  });
  if (yes && row) { // a hot lead: tell AECT right away
    const notify = env("NOTIFY_EMAIL").split(",").map((s) => s.trim()).filter(Boolean);
    const alert = internalEmail(row, row.stage, env("DASHBOARD_URL") ? `${env("DASHBOARD_URL")}#lead=${row.id}` : undefined);
    const subject = `Wants a call: ${row.name || row.email}`;
    const r = await send(notify, subject, alert.html, row.email);
    await db.from("lead_events").insert({ lead_id: row.id, kind: "email", author: "system", title: subject, body: alert.html,
      meta: { to: notify.join(", "), subject, audience: "aect", ...r } });
  }
  return new Response(JSON.stringify({ ok: true }), { headers });
}
