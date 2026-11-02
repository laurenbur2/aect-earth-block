// AECT lead dashboard: a board of leads by stage, a detail drawer with the lead's answers, plan
// numbers, every email we sent them and notes. Talks to Supabase when config.js is filled in;
// otherwise runs on sample leads kept in this browser (demo mode).
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";
import {
  STAGES, PATHS, PROJECTS, INTENTS, TIMELINES, normalize, initialStage, interestStage, isOverdue, customerEmail, internalEmail, planEmail, contactEmail,
} from "./pipeline.js";

const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const int = (n) => Math.round(+n || 0).toLocaleString("en-US");
const money = (n) => "$" + int(n);
const short = (m) => String(m || "").replace("AECT ", "");
const stageLabel = (id) => STAGES.find((s) => s.id === id)?.label || id;
function ago(iso) {
  const m = Math.round((Date.now() - new Date(iso)) / 60000);
  if (m < 60) return m <= 1 ? "just now" : `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hr ago`;
  const d = Math.round(h / 24);
  return d < 30 ? `${d} day${d > 1 ? "s" : ""} ago` : new Date(iso).toLocaleDateString();
}
const when = (iso) => new Date(iso).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

// ---- Data: Supabase ------------------------------------------------------------------------
async function supabaseApi() {
  const { createClient } = await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm");
  const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const must = ({ data, error }) => { if (error) throw error; return data; };
  return {
    demo: false,
    async session() { return (await sb.auth.getSession()).data.session; },
    async signIn(email) {
      const { error } = await sb.auth.signInWithOtp({ email, options: { shouldCreateUser: false, emailRedirectTo: location.href.split("#")[0] } });
      if (error) throw error;
    },
    async signOut() { await sb.auth.signOut(); },
    async isAdmin(email) { return (must(await sb.from("admin_users").select("email").eq("email", email.toLowerCase()))).length > 0; },
    async list() { return must(await sb.from("leads").select("*").order("updated_at", { ascending: false })); },
    async events(id) { return must(await sb.from("lead_events").select("*").eq("lead_id", id).order("created_at")); },
    async setStage(id, stage) { must(await sb.from("leads").update({ stage }).eq("id", id)); }, // trigger logs the change
    async addNote(id, body, author) { must(await sb.from("lead_events").insert({ lead_id: id, kind: "note", body, author })); },
    async remove(id) { must(await sb.from("leads").delete().eq("id", id)); },
  };
}

// ---- Data: demo (sample leads in localStorage) ------------------------------------------------
const DEMO_KEY = "aect-admin-demo-v9";
const day = 864e5;
const DEMO_SEED = [
  { days: 0.1, stage: null, interested: true, p: { source: "aect-ceb-planner", contact: { name: "Sam Ortiz", email: "sam.ortiz@example.com" },
    qualify: { project: "home", intent: "own", timeline: "0-6", state: "Texas", dirt: "own", labor: "volunteer", size: "1800" },
    plan: { totalBlocks: 9850, blockSize: '10" x 14"', machine: "AECT 3500", earthYd: 152, makeOwnTotal: 171200, rentTotal: 52900, buyTotal: 41800, best: "buy" } } },
  { days: 0.6, stage: null, interested: false, p: { source: "aect-ceb-planner", contact: { name: "Priya Shah", email: "priya@example.com" },
    qualify: { project: "outdoor", intent: "unsure", timeline: "research", state: "Colorado", dirt: "delivered", labor: "volunteer", size: "100" },
    plan: { totalBlocks: 1240, blockSize: '6" x 12"', machine: "AECT Impact 2001A", earthYd: 14, makeOwnTotal: 66100, rentTotal: 28600, buyTotal: 6900, best: "buy" } } },
  { days: 1.2, stage: "talking", note: "Called Mike. Wants the 3500 kit by March; sending a quote Friday.", p: { source: "aect-contact-form", topic: "kit", name: "Mike Delgado", email: "mdelgado@example.com", state: "Arizona",
    status: "Planning to build: 6 to 12 months out", kit: "3500 kit", blocks: "14000", message: "Planning a 2,400 sq ft home outside Tucson. Can the 3500 kit ship by March? Also curious about financing." } },
  { days: 2.5, stage: null, p: { source: "aect-ceb-planner", contact: { name: "Hannah Brooks", email: "hbrooks@example.com" },
    qualify: { project: "barn", intent: "rent", timeline: "6-12", state: "Oklahoma", dirt: "own", labor: "hired", size: "2500" },
    plan: { totalBlocks: 8200, blockSize: '10" x 14"', machine: "AECT 3500", earthYd: 127, makeOwnTotal: 176400, rentTotal: 41300, buyTotal: 36400, best: "buy" } } },
  { days: 4, stage: "quoted", note: "Sent rental quote for 18k blocks, mobilization $20k. Following up Friday.", p: { source: "aect-contact-form", topic: "rental", name: "Jordan Lee",
    email: "jordan.lee@example.com", state: "Arkansas", status: "Ready to build: starting within 6 months", blocks: "18000", message: "We have the land and a crew of 5 ready to go in spring." } },
  { days: 9, stage: "won", note: "Bought the 3500 kit. Training week booked for Jan 12.", p: { source: "aect-ceb-planner", contact: { name: "Dana Greene", email: "greene.family@example.com" },
    qualify: { project: "business", intent: "own", timeline: "0-6", state: "Texas", dirt: "own", labor: "hired", size: "3500" },
    plan: { totalBlocks: 21400, blockSize: '10" x 14"', machine: "AECT 3500", earthYd: 331, makeOwnTotal: 198700, rentTotal: 96800, buyTotal: 92000, best: "own" } } },
  { days: 6, stage: null, p: { source: "aect-contact-form", topic: "consult", name: "Alex Kim", email: "alexkim@example.com", state: "Oregon",
    status: "Just curious: researching for now", message: "Want to talk through whether my clay-heavy soil will work." } },
  { days: 3.2, stage: null, p: { source: "aect-contact-form", topic: "blocks", name: "Rosa Martinez", email: "rosa.m@example.com", state: "Texas",
    status: "Ready to build: starting within 6 months", blockType: "Stabilized (recommended)", blocks: "4200", kit: "Impact 2001A kit", product: "Small Block Press",
    message: "Outdoor kitchen and garden walls near Fredericksburg. Need delivery by April." } },
  { days: 14, stage: "lost", note: "Went with a used machine from a local seller.", p: { source: "aect-contact-form", topic: "tools", name: "Chris Hall", email: "chall@example.com",
    state: "Kansas", status: "Ready to build: starting within 6 months", product: "Block Cutter", message: "Price for a block cutter shipped to Wichita?" } },
  { days: 1.5, stage: null, p: { source: "aect-ceb-planner", contact: { name: "Marcus Webb", email: "mwebb@example.com" },
    qualify: { project: "home", intent: "own", timeline: "0-6", state: "New Mexico", dirt: "own", labor: "hired", size: "2200" },
    plan: { totalBlocks: 11900, blockSize: '6" x 12"', machine: "AECT Impact 2001A", earthYd: 128, makeOwnTotal: 112400, rentTotal: 51200, buyTotal: 49800, best: "buy" } } },
];
function demoSeed() {
  const leads = [], events = [];
  DEMO_SEED.forEach(({ days, stage, note, interested, p }, i) => {
    const t = Date.now() - days * day;
    const lead = normalize(p);
    const row = { id: `demo-${i + 1}`, created_at: new Date(t).toISOString(), updated_at: new Date(t + 36e5).toISOString(), stage_changed_at: new Date(t).toISOString(), ...lead, stage: initialStage(lead), raw: p };
    const ev = (o, dt = 0) => events.push({ id: events.length + 1, lead_id: row.id, created_at: new Date(t + dt).toISOString(), author: "system", meta: {}, ...o });
    ev({ kind: "created", title: lead.source === "planner" ? "Finished the planner" : "Sent the contact form", meta: { payload: p } });
    const mine = customerEmail(row), alert = internalEmail(row, row.stage);
    ev({ kind: "email", title: mine.subject, body: mine.html, meta: { to: row.email, subject: mine.subject, audience: "customer", status: "sent" } }, 5000);
    ev({ kind: "email", title: alert.subject, body: alert.html, meta: { to: "info@AECTearthblock.com", subject: alert.subject, audience: "aect", status: "sent" } }, 5000);
    if (interested !== undefined) {
      ev({ kind: "interest", title: interested ? "Still interested: wants a team member to reach out" : "Not interested right now" }, 60000);
      row.wants_contact = interested;
      const to = interestStage(row.stage, interested);
      if (to !== row.stage) { ev({ kind: "stage", title: "Stage changed", meta: { from: row.stage, to }, author: "system" }, 61000); row.stage = to; row.stage_changed_at = new Date(t + 61000).toISOString(); }
    }
    if (stage) {
      ev({ kind: "stage", title: "Stage changed", meta: { from: row.stage, to: stage }, author: "ryan@aectearthblock.com" }, 2 * day / 3);
      row.stage = stage; row.stage_changed_at = new Date(t + 2 * day / 3).toISOString();
    }
    if (note) ev({ kind: "note", body: note, author: "ryan@aectearthblock.com" }, day / 2);
    leads.push(row);
  });
  return { leads, events };
}
function demoApi() {
  let db;
  try { db = JSON.parse(localStorage.getItem(DEMO_KEY)); } catch (e) {}
  if (!db?.leads) db = demoSeed();
  const save = () => { try { localStorage.setItem(DEMO_KEY, JSON.stringify(db)); } catch (e) {} };
  const now = () => new Date().toISOString();
  return {
    demo: true,
    async list() { return db.leads.map((l) => ({ ...l })).sort((a, b) => b.updated_at.localeCompare(a.updated_at)); },
    async events(id) { return db.events.filter((e) => e.lead_id === id).sort((a, b) => a.created_at.localeCompare(b.created_at)); },
    async setStage(id, stage) {
      const l = db.leads.find((x) => x.id === id);
      if (!l || l.stage === stage) return;
      db.events.push({ id: Date.now(), lead_id: id, created_at: now(), kind: "stage", title: "Stage changed", meta: { from: l.stage, to: stage }, author: "you (demo)" });
      Object.assign(l, { stage, updated_at: now(), stage_changed_at: now() });
      save();
    },
    async addNote(id, body) {
      db.events.push({ id: Date.now(), lead_id: id, created_at: now(), kind: "note", body, meta: {}, author: "you (demo)" });
      const l = db.leads.find((x) => x.id === id); if (l) l.updated_at = now();
      save();
    },
    async remove(id) { db.leads = db.leads.filter((l) => l.id !== id); db.events = db.events.filter((e) => e.lead_id !== id); save(); },
    reset() { db = demoSeed(); save(); },
  };
}

// ---- UI ---------------------------------------------------------------------------------------
let api, me = "", leads = [], openId = null;
const board = $("#board"), drawer = $("#drawer"), scrim = $("#scrim");

Object.entries(PATHS).forEach(([k, v]) => $("#pathFilter").add(new Option(v, k)));

function filtered() {
  const q = $("#search").value.trim().toLowerCase();
  const path = $("#pathFilter").value;
  return leads.filter((l) => (!path || l.path === path)
    && (!q || [l.name, l.email, l.state, PATHS[l.path], l.summary?.message].some((v) => String(v || "").toLowerCase().includes(q))));
}

function cardHtml(l) {
  const s = l.summary || {};
  const blocks = s.totalBlocks || s.blocks;
  const what = l.source === "planner"
    ? `${PROJECTS[l.project] || "Project"}${blocks ? ` · ${int(blocks)} blocks` : ""}`
    : `${s.kit || s.product || "Contact form"}${blocks ? ` · ${int(blocks)} blocks` : ""}`;
  const late = isOverdue(l);
  return `<button class="card${late ? " is-late" : ""}" draggable="true" data-id="${esc(l.id)}" aria-label="Open ${esc(l.name || l.email)}">
    <span class="card-top"><b>${esc(l.name || l.email)}</b><span class="path path--${esc(l.path)}">${esc(PATHS[l.path] || l.source)}</span></span>
    <span class="card-what">${esc(what)}</span>
    <span class="card-meta">${esc(l.state || "")}${l.timeline ? ` · ${esc(TIMELINES[l.timeline])}` : ""}</span>
    <span class="tags">${late ? `<span class="chip chip--late">Overdue · ${ago(l.stage_changed_at || l.created_at).replace(" ago", "")}</span>` : ""}${l.wants_contact === true ? `<span class="chip chip--yes">Said yes</span>` : l.wants_contact === false ? `<span class="chip">Said not right now</span>` : ""}</span>
    <span class="card-foot"><span>${l.source === "planner" ? "Planner" : "Contact form"}</span><span>${ago(l.created_at)}</span></span>
  </button>`;
}

function render() {
  const list = filtered();
  board.innerHTML = STAGES.map((st) => {
    let inStage = list.filter((l) => l.stage === st.id);
    // Stages with a deadline show the longest-waiting lead first.
    if (st.due) inStage = inStage.sort((a, b) => (a.stage_changed_at || a.created_at).localeCompare(b.stage_changed_at || b.created_at));
    const late = inStage.filter((l) => isOverdue(l)).length;
    return `<section class="col col--${st.id}" data-stage="${st.id}">
      <header class="col-head"><h2>${st.label}</h2><span class="count${late ? " count--late" : ""}" title="${late ? `${late} overdue` : ""}">${inStage.length}</span></header>
      <p class="col-hint">${esc(st.hint)}</p>
      ${st.todo ? `<p class="col-todo">→ ${esc(st.todo)}</p>` : ""}
      <div class="col-cards">${inStage.map(cardHtml).join("") || `<p class="empty">No leads</p>`}</div>
    </section>`;
  }).join("");
}

async function load() {
  leads = await api.list();
  render();
  if (openId) openLead(openId, false);
}

// Drag a card to another column to change its stage.
board.addEventListener("dragstart", (e) => {
  const c = e.target.closest(".card"); if (!c) return;
  e.dataTransfer.setData("text/plain", c.dataset.id); e.dataTransfer.effectAllowed = "move"; c.classList.add("is-dragging");
});
board.addEventListener("dragend", (e) => e.target.closest?.(".card")?.classList.remove("is-dragging"));
board.addEventListener("dragover", (e) => {
  const col = e.target.closest(".col"); if (!col) return;
  e.preventDefault(); board.querySelectorAll(".col").forEach((c) => c.classList.toggle("is-over", c === col));
});
board.addEventListener("dragleave", (e) => { if (!board.contains(e.relatedTarget)) board.querySelectorAll(".is-over").forEach((c) => c.classList.remove("is-over")); });
board.addEventListener("drop", async (e) => {
  const col = e.target.closest(".col"); if (!col) return;
  e.preventDefault(); col.classList.remove("is-over");
  await moveLead(e.dataTransfer.getData("text/plain"), col.dataset.stage);
});
board.addEventListener("click", (e) => { const c = e.target.closest(".card"); if (c) openLead(c.dataset.id); });

async function moveLead(id, stage) {
  const l = leads.find((x) => x.id === id);
  if (!l || l.stage === stage) return;
  const prev = l.stage;
  l.stage = stage; render(); // optimistic
  try { await api.setStage(id, stage); await load(); }
  catch (err) { l.stage = prev; render(); alert("Couldn't change the stage: " + err.message); }
}

// ---- Detail drawer -------------------------------------------------------------------------------
const EVENT_ICON = { created: "★", resubmitted: "↺", interest: "?", email: "✉", stage: "→", note: "✎" };

function facts(l) {
  const s = l.summary || {};
  const rows = [
    ["Wants", PATHS[l.path]], ["Wants us to reach out", l.wants_contact === true ? "Yes" : l.wants_contact === false ? "Not right now" : l.source === "planner" ? "Didn't answer" : null],
    ["Location", l.state], ["Project", PROJECTS[l.project]], ["Size", s.size && `${int(s.size)} ${l.project === "outdoor" ? "ft of wall" : "sq ft"}`],
    ["Buy or rent", INTENTS[l.intent]], ["Timeline", TIMELINES[l.timeline]],
    ["Dirt", s.dirt && (s.dirt === "own" ? "From their land" : "Delivered")], ["Labor", s.labor && (s.labor === "hired" ? "Hired crew" : "Volunteers")],
    ["Kit", s.kit], ["Product", s.product], ["Block type", s.blockType], ["Est. blocks", !s.totalBlocks && s.blocks && int(s.blocks)],
  ].filter(([, v]) => v);
  return `<dl class="facts">${rows.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join("")}</dl>`;
}

function planBlock(s) {
  if (!s.totalBlocks) return "";
  const opt = (k, label, v) => v ? `<div class="po ${s.best === k ? "is-best" : ""}"><span>${label}${s.best === k ? " <em>best</em>" : ""}</span><b>${money(v)}</b></div>` : "";
  return `<div class="plan">
    <div class="plan-big"><b>${int(s.totalBlocks)}</b> blocks · ${esc(s.blockSize || "")} · ${esc(short(s.machine))}${s.earthYd ? ` · ${int(s.earthYd)} yd³ earth` : ""}</div>
    <div class="plan-opts">${opt("own", "Make own (kit)", s.makeOwnTotal)}${opt("rent", "Rent", s.rentTotal)}${opt("buy", "Buy blocks", s.buyTotal)}</div>
  </div>`;
}

function eventHtml(e) {
  const m = e.meta || {};
  let body = "";
  if (e.kind === "email") {
    const bad = m.status && m.status !== "sent";
    body = `<div class="ev-title">${m.audience === "aect" ? "Alert to AECT" : "Email to client"}: ${esc(m.subject || e.title)}</div>
      <div class="ev-sub">To ${esc(m.to)} · <span class="${bad ? "warn" : "ok"}">${esc(m.status || "sent")}${m.error ? ` (${esc(m.error)})` : ""}</span></div>
      <button class="link" type="button" data-email="${e.id}">View email</button>`;
  } else if (e.kind === "stage") {
    body = `<div class="ev-title">Moved from <b>${esc(stageLabel(m.from))}</b> to <b>${esc(stageLabel(m.to))}</b></div>`;
  } else if (e.kind === "note") {
    body = `<div class="ev-note">${esc(e.body)}</div>`;
  } else {
    body = `<div class="ev-title">${esc(e.title)}</div>`;
  }
  return `<li class="ev ev--${e.kind}"><span class="ev-ico" aria-hidden="true">${EVENT_ICON[e.kind] || "•"}</span>
    <div class="ev-body">${body}<div class="ev-when">${when(e.created_at)}${e.author && e.author !== "system" ? ` · ${esc(e.author)}` : ""}</div></div></li>`;
}

let currentEvents = [];
async function openLead(id, scroll = true) {
  const l = leads.find((x) => x.id === id);
  if (!l) return closeLead();
  openId = id;
  history.replaceState(null, "", `#lead=${id}`);
  currentEvents = await api.events(id);
  const s = l.summary || {};
  $("#drawerBody").innerHTML = `
    <div class="d-head">
      <div><h2>${esc(l.name || "No name")}</h2><a href="mailto:${esc(l.email)}">${esc(l.email)}</a></div>
      <button class="btn-plain" type="button" id="closeDrawer" aria-label="Close">✕</button>
    </div>
    <label class="d-stage"><span>Stage</span>
      <select id="stageSel">${STAGES.map((st) => `<option value="${st.id}" ${st.id === l.stage ? "selected" : ""}>${st.label}</option>`).join("")}</select>
    </label>
    ${(() => { const st = STAGES.find((x) => x.id === l.stage); return st?.todo ? `<p class="d-todo${isOverdue(l) ? " is-late" : ""}">Next: ${esc(st.todo)}${isOverdue(l) ? ` · overdue, in this stage since ${when(l.stage_changed_at || l.created_at)}` : ""}</p>` : ""; })()}
    <p class="d-src">${l.source === "planner" ? "Came in through the planner" : "Came in through the contact form"} · ${when(l.created_at)}</p>
    ${facts(l)}
    ${planBlock(s)}
    ${s.message ? `<div class="d-msg"><span>Their message</span><p>${esc(s.message)}</p></div>` : ""}
    <h3 class="d-h">Activity</h3>
    <ol class="timeline">${currentEvents.map(eventHtml).join("")}</ol>
    <form class="note-form" id="noteForm">
      <textarea id="noteText" rows="3" placeholder="Add a note: called, sent quote, follow up Friday…" required></textarea>
      <button class="btn" type="submit">Add note</button>
    </form>
    <details class="d-raw"><summary>Everything they submitted</summary><pre>${esc(JSON.stringify(l.raw, null, 2))}</pre></details>
    <button class="link danger" type="button" id="deleteLead">Delete this lead (spam or test)</button>`;
  drawer.hidden = false; scrim.hidden = false;
  if (scroll) drawer.scrollTop = 0;
  $("#closeDrawer").onclick = closeLead;
  $("#stageSel").onchange = (e) => moveLead(id, e.target.value);
  $("#noteForm").onsubmit = async (e) => {
    e.preventDefault();
    const text = $("#noteText").value.trim(); if (!text) return;
    try { await api.addNote(id, text, me); await load(); } catch (err) { alert("Couldn't save the note: " + err.message); }
  };
  $("#deleteLead").onclick = async () => {
    if (!confirm(`Delete ${l.name || l.email} and their history? This can't be undone.`)) return;
    await api.remove(id); closeLead(); load();
  };
  $("#drawerBody").querySelectorAll("[data-email]").forEach((b) => (b.onclick = () => {
    const ev = currentEvents.find((x) => String(x.id) === b.dataset.email);
    showEmail([{ label: "", subject: ev.meta?.subject || ev.title, meta: `To ${ev.meta?.to || ""} · ${when(ev.created_at)}`, html: ev.body }]);
  }));
}
function closeLead() {
  openId = null; drawer.hidden = true; scrim.hidden = true;
  history.replaceState(null, "", location.pathname + location.search);
}
scrim.onclick = closeLead;
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("#emailModal").open && openId) closeLead(); });

// ---- Email viewer -----------------------------------------------------------------------------
const modal = $("#emailModal");
modal.addEventListener("click", (e) => { if (e.target === modal || e.target.closest("[data-close]")) modal.close(); });
function showEmail(list) {
  const tabs = $("#emailTabs");
  const pick = (i) => {
    $("#emailSubject").textContent = list[i].subject;
    $("#emailMeta").textContent = list[i].meta;
    $("#emailFrame").srcdoc = list[i].html || "<p style='font-family:sans-serif;padding:20px'>No content saved for this email.</p>";
    tabs.querySelectorAll("button").forEach((b, k) => b.setAttribute("aria-pressed", String(k === i)));
  };
  tabs.hidden = list.length < 2;
  tabs.innerHTML = list.map((t, i) => `<button type="button" data-i="${i}">${esc(t.label)}</button>`).join("");
  tabs.querySelectorAll("button").forEach((b) => (b.onclick = () => pick(+b.dataset.i)));
  pick(0);
  modal.showModal();
}

// How new leads are sorted, for the team.
$("#rulesBtn").onclick = () => {
  const row = (a, b) => `<tr><td>${a}</td><td><b>${b}</b></td></tr>`;
  const html = `<!doctype html><html><body style="font:15px/1.55 Helvetica,Arial,sans-serif;color:#1b2230;padding:24px 28px;background:#fff;margin:0">
    <p style="margin-top:0">New leads are sorted automatically from the quiz and contact form. After that, drag cards as you work them.
    The site only ever moves a lead <b>up</b>, and never moves a lead once it's In conversation or later.</p>
    <table cellpadding="8" style="border-collapse:collapse;width:100%">
      <tr style="background:#f1efe3"><th align="left">When someone…</th><th align="left">They go to</th></tr>
      ${row("Finishes the quiz: <i>Ready to build</i>", "Ready to build")}
      ${row("Finishes the quiz: <i>Planning to build</i>, <i>I have land</i> or <i>Just curious</i>", "Not ready yet")}
      ${row("Clicks <i>Yes, have someone reach out</i> on their results", "Wants us to reach out")}
      ${row("Clicks <i>Not right now</i> on their results", "Not ready yet")}
      ${row("Sends the contact form", "Wants us to reach out (Not ready yet if they picked <i>Just curious</i>)")}
    </table>
    <p><b>What to do</b></p>
    <ul style="padding-left:20px">${STAGES.filter((s) => s.todo).map((s) => `<li><b>${s.label}:</b> ${s.todo}${s.due ? ` (marked overdue after ${s.due} days)` : ""}</li>`).join("")}</ul>
  </body></html>`;
  showEmail([{ subject: "How leads are sorted", meta: "The rules behind the board", html }]);
};

// Every template with sample data, so AECT can review the wording before going live.
$("#emailsBtn").onclick = () => {
  const sample = (p) => { const l = normalize(p); return { ...l, stage: initialStage(l) }; };
  const planLead = sample(DEMO_SEED[0].p), kitLead = sample(DEMO_SEED[2].p), rentLead = sample(DEMO_SEED[4].p);
  const consult = sample(DEMO_SEED[6].p), blocksLead = sample(DEMO_SEED[1].p);
  const t = (label, who, { subject, html }) => ({ label, subject, html, meta: who });
  showEmail([
    t("Planner: their plan", "Sent to the client when they finish the planner", planEmail(planLead)),
    t("Planner: buying blocks", "Planner email when buying blocks is their path", planEmail(blocksLead)),
    t("Kit quote reply", "Auto-reply to a kit quote request", contactEmail(kitLead)),
    t("Rental reply", "Auto-reply to a rental request", contactEmail(rentLead)),
    t("Block quote reply", "Auto-reply to a block quote request", contactEmail(sample(DEMO_SEED.find((d) => d.p.topic === "blocks").p))),
    t("Consult reply", "Auto-reply to a video consult request", contactEmail(consult)),
    t("Alert to AECT", "Sent to AECT's inbox for every new lead", internalEmail(planLead, planLead.stage)),
  ]);
};

// ---- Boot -----------------------------------------------------------------------------------
$("#search").addEventListener("input", render);
$("#pathFilter").addEventListener("change", render);
$("#refreshBtn").onclick = () => load();
window.addEventListener("focus", () => { if (api && !$("#tools").hidden) load(); });

async function showApp() {
  $("#signin").hidden = true; $("#tools").hidden = false; board.hidden = false;
  const m = location.hash.match(/lead=([\w-]+)/);
  if (m) openId = m[1];
  await load();
}

(async function boot() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    api = demoApi();
    $("#demoBadge").hidden = false;
    $("#demoBadge").onclick = () => { if (confirm("Reset the sample leads?")) { api.reset(); closeLead(); load(); } };
    return showApp();
  }
  api = await supabaseApi();
  const session = await api.session();
  if (!session) {
    $("#signin").hidden = false;
    $("#signinForm").onsubmit = async (e) => {
      e.preventDefault();
      const msg = $("#signinMsg");
      try { await api.signIn($("#signinEmail").value.trim()); msg.textContent = "Check your email for the sign-in link."; }
      catch (err) { msg.textContent = "That email isn't set up for the dashboard. Ask Lauren to add you."; }
    };
    return;
  }
  me = session.user.email;
  if (!(await api.isAdmin(me))) {
    $("#signin").hidden = false;
    $("#signinForm").innerHTML = `<h2>No access</h2><p>${esc(me)} isn't on the AECT admin list.</p><button class="btn" type="button" id="so">Sign out</button>`;
    $("#so").onclick = async () => { await api.signOut(); location.reload(); };
    return;
  }
  $("#signOutBtn").hidden = false;
  $("#signOutBtn").onclick = async () => { await api.signOut(); location.reload(); };
  showApp();
})();
