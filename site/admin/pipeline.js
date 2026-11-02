// Shared by the admin dashboard (browser) and the submit-lead Edge Function (Deno), so the stage
// a lead lands in and the emails it gets are defined in one place. No dependencies.
// tools/deploy_backend.sh copies this file into backend/supabase/functions/_shared/ before deploying.

// Public site address, used for links and the logo in emails. Change to https://aectearthblock.com/ at launch.
export const SITE_URL = "https://laurenbur2.github.io/aect-earth-block/";
export const AECT_EMAIL = "info@AECTearthblock.com";

// The funnel, in board order. The first four sort new leads by how serious they are (set automatically
// from the quiz and contact form); the rest are moved by AECT as they work the lead.
// `todo` is what the team should do; `due` (days) flags a card as overdue when it sits longer.
export const STAGES = [
  { id: "reach", label: "Wants us to reach out", hint: "Said yes to \"still interested?\" or sent the contact form", todo: "Email them within 2 business days", due: 2 },
  { id: "ready", label: "Ready to build", hint: "Starting within 6 months, hasn't answered \"still interested?\"", todo: "Email them", due: 3 },
  { id: "later", label: "Not ready yet", hint: "Building 6+ months out, just curious, or said \"not right now\"", todo: "No outreach; they have their plan by email" },
  { id: "talking", label: "In conversation", hint: "We've reached out and are talking", todo: "Send a quote when ready" },
  { id: "quoted", label: "Quote sent", hint: "Official quote sent", todo: "Follow up", due: 7 },
  { id: "won", label: "Won", hint: "Bought a kit, booked a rental or ordered blocks" },
  { id: "lost", label: "Lost", hint: "Not a fit, went elsewhere or went quiet" },
];

// How serious each stage is, for automatic moves. The site only ever moves a lead *up* this list,
// and never touches a lead AECT is already working (In conversation and later).
const HEAT = { later: 0, ready: 1, reach: 2, talking: 3, quoted: 4, won: 5, lost: 5 };
const WORKING = HEAT.talking;

export const PATHS = {
  kit: "Kit", rent: "Rental", blocks: "Blocks", consulting: "On-site consulting",
  consult: "Video consult", tools: "Tools & parts",
};
export const PROJECTS = { home: "Home", barn: "Barn or shop", commercial: "Commercial", outdoor: "Outdoor living", business: "Several buildings" };
export const INTENTS = { own: "Buy a kit", rent: "Rent equipment", buy: "Buy blocks", unsure: "Not sure yet" };
export const TIMELINES = { "0-6": "Ready to build (within 6 months)", "6-12": "Planning to build (6 to 12 months)", "12+": "Has land (a year or more out)", research: "Just curious" };

// Contact form "Where are you in your project?" answers -> planner timeline codes.
const STATUS_TO_TIMELINE = {
  "Ready to build: starting within 6 months": "0-6", "Planning to build: 6 to 12 months out": "6-12",
  "I have land: building in a year or more": "12+", "Just curious: researching for now": "research",
};
const TOPIC_TO_PATH = { kit: "kit", rental: "rent", blocks: "blocks", consulting: "consulting", consult: "consult", tools: "tools" };
const INTENT_TO_PATH = { own: "kit", rent: "rent", buy: "blocks" };

const clean = (v, max = 2000) => (typeof v === "string" ? v.trim().slice(0, max) : v ?? null);

/** Turns a site payload (planner or contact form) into a leads row, minus stage. Throws on bad input. */
export function normalize(p) {
  if (!p || typeof p !== "object") throw new Error("Invalid payload");
  if (p.source === "aect-ceb-planner") {
    const q = p.qualify || {}, plan = p.plan || {};
    return {
      source: "planner",
      path: INTENT_TO_PATH[q.intent] || INTENT_TO_PATH[plan.best] || "kit",
      name: clean(p.contact?.name, 120), email: clean(p.contact?.email, 200),
      state: clean(q.state === "intl" ? "Outside the US" : q.state, 60),
      project: clean(q.project, 30), intent: clean(q.intent, 30), timeline: clean(q.timeline, 30),
      summary: { ...plan, size: clean(q.size, 20), dirt: q.dirt, labor: q.labor, answers: p.answers || {} },
    };
  }
  if (p.source === "aect-contact-form") {
    return {
      source: "contact",
      path: TOPIC_TO_PATH[p.topic] || null,
      name: clean(p.name, 120), email: clean(p.email, 200), state: clean(p.state, 60),
      project: null, intent: null, timeline: STATUS_TO_TIMELINE[p.status] || null,
      // Hidden fields for other topics still post their defaults, so keep only the ones for this topic.
      summary: {
        topic: p.topic, kit: p.topic === "kit" ? clean(p.kit, 80) : null, product: p.topic === "tools" ? clean(p.product, 80) : null,
        blockType: p.topic === "blocks" ? clean(p.blockType, 40) : null,
        blocks: ["kit", "rental", "blocks"].includes(p.topic) ? clean(p.blocks, 20) : null, message: clean(p.message, 5000),
      },
    };
  }
  throw new Error("Unknown source");
}

/** Which stage a brand-new lead starts in, from "Where are you in your project?". */
export function initialStage(lead) {
  if (lead.timeline === "research") return "later";
  if (lead.source === "contact") return "reach"; // they asked us to reply
  return lead.timeline === "0-6" ? "ready" : "later";
}

/** Stage for a returning lead (planner again, or the contact form after the planner): only ever up. */
export function mergeStage(current, proposed) {
  if (HEAT[current] >= WORKING) return current;
  return HEAT[proposed] > HEAT[current] ? proposed : current;
}

/**
 * Stage after "Are you still interested?" on the planner results. Yes: Wants us to reach out.
 * No: Not ready yet (they weren't truly ready).
 * Leads AECT is already working are never moved.
 */
export function interestStage(stage, interested) {
  if (HEAT[stage] >= WORKING) return stage;
  return interested ? "reach" : "later";
}

/** True when a lead has sat in a stage with a deadline (e.g. Wants us to reach out) longer than it should. */
export function isOverdue(lead, now = Date.now()) {
  const due = STAGES.find((s) => s.id === lead.stage)?.due;
  return !!due && now - new Date(lead.stage_changed_at || lead.created_at) > due * 864e5;
}

// ---- Emails ------------------------------------------------------------------------------
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const money = (n) => "$" + Math.round(+n || 0).toLocaleString("en-US");
const int = (n) => Math.round(+n || 0).toLocaleString("en-US");
const short = (m) => String(m || "").replace("AECT ", "");
const firstName = (n) => String(n || "").trim().split(/\s+/)[0];

const NAVY = "#232c3c", BRAND = "#45536c", CREAM = "#fbfaf5", SAND = "#f1efe3", MUTED = "#5d6574", LINE = "#e1ded2";
const FONT = "font-family:Helvetica,Arial,sans-serif;";

function button(href, label) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0 8px"><tr><td style="background:${BRAND};border-radius:999px">
    <a href="${esc(href)}" style="${FONT}display:inline-block;padding:14px 26px;color:#fff;font-weight:700;font-size:15px;text-decoration:none;letter-spacing:.02em">${esc(label)}</a></td></tr></table>`;
}

function layout(preheader, inner) {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:${SAND}">
<span style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${SAND}"><tr><td align="center" style="padding:24px 12px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border-radius:14px;overflow:hidden">
    <tr><td style="background:${NAVY};padding:20px 28px"><img src="${SITE_URL}assets/img/logo-badge.png" width="120" alt="AECT" style="display:block;border:0"></td></tr>
    <tr><td style="${FONT}padding:28px;color:#1b2230;font-size:16px;line-height:1.55">${inner}</td></tr>
    <tr><td style="${FONT}padding:20px 28px;background:${CREAM};color:${MUTED};font-size:12px;line-height:1.5;border-top:1px solid ${LINE}">
      Advanced Earthen Construction Technologies · 10608 Cassiano Rd., San Antonio, TX<br>
      Questions? Reply to this email or write <a href="mailto:${AECT_EMAIL}" style="color:${BRAND}">${AECT_EMAIL}</a>.
    </td></tr>
  </table>
</td></tr></table></body></html>`;
}

/** Email sent to a visitor after they finish the planner: a copy of their plan and the next step. */
export function planEmail(lead) {
  const s = lead.summary || {};
  const n = firstName(lead.name);
  const intl = lead.state === "Outside the US";
  const kit = `${short(s.machine)} Kit`;
  const options = [
    { key: "own", label: `Buy the ${kit}`, sub: "Machine, soil analysis and training", total: s.makeOwnTotal },
    ...(intl ? [] : [
      { key: "rent", label: "Rent our plant", sub: "We bring it, with an operator", total: s.rentTotal },
      { key: "buy", label: "Buy finished blocks", sub: "Made on AECT machines, delivered", total: s.buyTotal },
    ]),
  ];
  const best = s.best || options.reduce((a, b) => (b.total < a.total ? b : a)).key;
  const rows = options.map((o) => `
    <tr><td style="padding:12px 14px;border-top:1px solid ${LINE}">
      <b>${esc(o.label)}</b>${o.key === best ? ` <span style="background:${BRAND};color:#fff;font-size:11px;font-weight:700;border-radius:999px;padding:2px 8px;letter-spacing:.04em">BEST VALUE</span>` : ""}
      <div style="color:${MUTED};font-size:13px">${esc(o.sub)}</div></td>
      <td align="right" style="padding:12px 14px;border-top:1px solid ${LINE};font-weight:700;font-size:17px;white-space:nowrap">${money(o.total)}</td></tr>`).join("");
  const cta = lead.path === "blocks"
    ? `<p style="margin:22px 0 0">Want a quote for your ${int(s.totalBlocks)} blocks, delivered? <b>Reply to this email</b> and our team will put one together.</p>`
    : button(`${SITE_URL}contact.html?topic=${lead.path === "rent" ? "rental" : "quote"}&machine=${encodeURIComponent(kit)}`, "Get my official quote")
      + `<p style="color:${MUTED};font-size:14px;margin:0">Send us your plan and we'll reply with an official quote, usually within 2 business days.</p>`;
  const html = layout(`About ${int(s.totalBlocks)} blocks. Here are your numbers.`, `
    <p style="margin:0 0 6px;color:${MUTED};font-size:13px;letter-spacing:.08em;text-transform:uppercase;font-weight:700">${n ? esc(n) + "'s" : "Your"} CEB plan</p>
    <h1 style="${FONT}margin:0 0 4px;font-size:28px;line-height:1.2;color:${NAVY}">You'll need about ${int(s.totalBlocks)} blocks</h1>
    <p style="margin:0 0 20px;color:${MUTED}">${esc(PROJECTS[lead.project] || "Your project")}${s.size ? ` · ${esc(int(s.size))} ${lead.project === "outdoor" ? "ft of wall" : "sq ft"}` : ""}${lead.state && !intl ? ` · ${esc(lead.state)}` : ""} · ${esc(s.blockSize || "")} blocks</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${CREAM};border-radius:10px;margin-bottom:22px"><tr>
      <td style="padding:14px"><div style="font-weight:700;font-size:18px">${esc(kit)}</div><div style="color:${MUTED};font-size:12px">recommended kit</div></td>
      <td style="padding:14px"><div style="font-weight:700;font-size:18px">${int(s.earthYd)} yd³</div><div style="color:${MUTED};font-size:12px">of earth</div></td>
    </tr></table>
    <h2 style="${FONT}font-size:19px;margin:0 0 8px;color:${NAVY}">Your three ways to get blocks</h2>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${LINE};border-radius:10px;border-collapse:separate">${rows}</table>
    ${cta}
    <p style="color:${MUTED};font-size:13px;margin:22px 0 0">Estimates are for planning only, not a quote. Kit prices are FOB San Antonio, TX; shipping extra.</p>`);
  return { subject: `${n ? n + ", your" : "Your"} CEB plan: about ${int(s.totalBlocks)} blocks`, html };
}

const CONTACT_REPLY = {
  kit: ["We got your kit quote request", "Ryan and the team will put together an official quote for your kit and reply within 2 business days."],
  blocks: ["We got your block quote request", "We'll price your blocks, delivered to your site, and reply with a quote within 2 business days."],
  rent: ["We got your rental request", "We'll look at your location and block count and reply with a rental estimate within 2 business days."],
  consulting: ["We got your consulting request", "We'll reply within 2 business days to talk through your site and dates."],
  consult: ["We got your video consult request", "We'll reply within 2 business days with times for your 30-minute call with Ryan Runge."],
  tools: ["We got your order request", "We'll confirm availability, shipping and payment within 2 business days."],
};

/** Automatic reply to a contact form request. */
export function contactEmail(lead) {
  const [subject, line] = CONTACT_REPLY[lead.path] || ["We got your message", "We'll reply within 2 business days."];
  const s = lead.summary || {};
  const n = firstName(lead.name);
  const details = [
    ["Kit", s.kit], ["Product", s.product], ["Block type", s.blockType], ["Estimated blocks", s.blocks && int(s.blocks)], ["Location", lead.state],
    ["Project", TIMELINES[lead.timeline]],
  ].filter(([, v]) => v);
  const html = layout(line, `
    <h1 style="${FONT}margin:0 0 12px;font-size:26px;line-height:1.2;color:${NAVY}">Thanks${n ? ", " + esc(n) : ""}. ${esc(subject.replace(/^We got/, "We've got"))}.</h1>
    <p style="margin:0 0 18px">${esc(line)}</p>
    ${details.length ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${CREAM};border-radius:10px">${details.map(([k, v]) => `<tr><td style="padding:8px 14px;color:${MUTED};font-size:14px">${esc(k)}</td><td style="padding:8px 14px;font-size:14px;font-weight:600">${esc(v)}</td></tr>`).join("")}</table>` : ""}
    ${s.message ? `<p style="margin:18px 0 4px;color:${MUTED};font-size:13px">Your message</p><p style="margin:0;white-space:pre-wrap;border-left:3px solid ${LINE};padding-left:12px">${esc(s.message)}</p>` : ""}
    <p style="margin:22px 0 0">In the meantime, our <a href="${SITE_URL}learn.html" style="color:${BRAND}">FAQ</a> answers the most common questions about soil, cost and building with CEBs.</p>`);
  return { subject: `${subject}, ${n || "thanks"}`.replace(/, thanks$/, ""), html };
}

/** The email the visitor gets for this lead. */
export function customerEmail(lead) {
  return lead.source === "planner" ? planEmail(lead) : contactEmail(lead);
}

/** Heads-up to AECT's inbox when a lead comes in. */
export function internalEmail(lead, stage, dashboardUrl) {
  const s = lead.summary || {};
  const rows = [
    ["Name", lead.name], ["Email", lead.email], ["Wants", PATHS[lead.path]],
    ["Wants us to reach out", lead.wants_contact === true ? "Yes" : lead.wants_contact === false ? "Not right now" : null], ["Stage", STAGES.find((x) => x.id === stage)?.label],
    ["Location", lead.state], ["Project", PROJECTS[lead.project]], ["Timeline", TIMELINES[lead.timeline]],
    ["Blocks", s.totalBlocks ? int(s.totalBlocks) : s.blocks], ["Machine", s.machine && short(s.machine)],
    ["Kit / product", s.kit || s.product], ["Block type", s.blockType], ["Message", s.message],
  ].filter(([, v]) => v);
  const html = layout("New lead", `
    <h1 style="${FONT}margin:0 0 14px;font-size:22px;color:${NAVY}">New ${lead.source === "planner" ? "planner" : "contact form"} lead</h1>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows.map(([k, v]) => `<tr><td style="padding:6px 0;color:${MUTED};font-size:14px;width:120px;vertical-align:top">${esc(k)}</td><td style="padding:6px 0;font-size:14px;white-space:pre-wrap">${esc(v)}</td></tr>`).join("")}</table>
    ${button(dashboardUrl || SITE_URL + "admin/", "Open in the dashboard")}`);
  return { subject: `New lead: ${lead.name || lead.email} · ${PATHS[lead.path] || lead.source}`, html };
}
