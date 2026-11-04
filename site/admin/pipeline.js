// Shared by the admin dashboard (browser) and the Cloudflare Worker (worker/src/index.js), so the stage
// a lead lands in and the emails it gets are defined in one place. No dependencies.

// Public site address, used for links and the logo in emails. Change to https://aectearthblock.com/ at launch.
export const SITE_URL = "https://laurenbur2.github.io/aect-earth-block/";
export const AECT_EMAIL = "info@AECTearthblock.com";
// Paid video call with Ryan, booked through GoDaddy Online Appointments on AECT's current site.
// TODO at launch: swap for the Calendly link (see README, "Calendly"); the site's copy is in assets/js/main.js.
export const CONSULT = { price: "$75", length: "30-minute", with: "Ryan Runge" };
export const BOOK_CALL_URL = "https://aectearthblock.com/ola/services/compressed-earth-block-ceb-consultation";

// The funnel, in board order. Wants us to reach out, Ready to build and Not ready yet (last, out of the
// way) are set automatically from the quiz and contact form; the rest are moved by AECT as they work the lead.
// `todo` is what the team should do; `due` (days) flags a card as overdue when it sits longer.
export const STAGES = [
  { id: "reach", label: "Wants us to reach out", hint: "Said yes to \"still interested?\" or sent the contact form", todo: "Email them within 2 business days", due: 2 },
  { id: "ready", label: "Ready to build", hint: "Starting within 6 months, hasn't answered \"still interested?\"", todo: "Email them", due: 3 },
  { id: "talking", label: "In conversation", hint: "We've reached out and are talking", todo: "Send a quote when ready" },
  { id: "quoted", label: "Quote sent", hint: "Official quote sent", todo: "Follow up", due: 7 },
  { id: "won", label: "Won", hint: "Bought a kit, booked a rental or ordered blocks" },
  { id: "lost", label: "Lost", hint: "Not a fit, went elsewhere or went quiet" },
  { id: "later", label: "Not ready yet", hint: "Building 6+ months out, just curious, or said \"not right now\"", todo: "No outreach; they have their plan by email" },
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
// Table-based HTML with inline styles so it holds up in Gmail, Apple Mail and Outlook. Photos come from
// AECT's image host, cropped to fit (swap for self-hosted copies at launch, like the rest of the site).
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const money = (n) => "$" + Math.round(+n || 0).toLocaleString("en-US");
const int = (n) => Math.round(+n || 0).toLocaleString("en-US");
const short = (m) => String(m || "").replace("AECT ", "");
const firstName = (n) => String(n || "").trim().split(/\s+/)[0];

// blue is the logo's background, so the logo always blends into the header and footer; navy is for text only.
const C = { navy: "#232c3c", blue: "#45536c", blueLine: "#5a6884", soft: "#d3d9e3", brand: "#45536c", cream: "#fbfaf5", sand: "#f1efe3", line: "#e1ded2",
  ink: "#1b2230", muted: "#5d6574", accent: "#c4561c", logoCream: "#fbf8cc", green: "#adbb89" };
const HEAD = "font-family:'Barlow Semi Condensed','Arial Narrow',Arial,sans-serif;";
const BODY = "font-family:Helvetica,Arial,sans-serif;";
const IMG = `${SITE_URL}assets/img/photos/email/`;
// Pre-cropped copies (w x h) saved from the old GoDaddy site; `file` is the name in assets/img/photos/.
const photo = (file, w, h) => `${IMG}${file.replace(/\.jpg$/, "")}-${w}x${h}.jpg`;
const url = (path) => SITE_URL + path;

// What the emails can show and link to. `machine` matches the planner's machine names.
const PRODUCTS = {
  impact: { name: "Impact 2001A Kit", machine: "AECT Impact 2001A", price: "From $59,000", page: "impact-2001a.html", img: "e48a0068-88d7-476c-a776-9f0a846ac278.jpg",
    blurb: "Our most affordable kit. Fully automated, 300 blocks an hour, and light enough to tow." },
  k3500: { name: "3500 Kit", machine: "AECT 3500", price: "From $149,000", page: "3500.html", img: "62570b0a-3778-44b5-b0fb-e9200ed393c6.jpg",
    blurb: "Big, fast and built to last. 480 blocks an hour of our standard 10\"×14\" block." },
  bp714: { name: "BP714 Kit", machine: "AECT BP714", price: "From $69,625", page: "bp714.html", img: "889d4a57-f36f-4da9-8b17-e691db617e06.jpg",
    blurb: "Interlocking, holey blocks you can run rebar and grout through. Required in some jurisdictions." },
  hd2500: { name: "2500HD Kit", machine: "AECT 2500HD", price: "From $89,000", page: "2500hd.html", img: "bf5b7c80-8d03-46af-8d3b-ffebd057b135.jpg",
    blurb: "The 6\"×12\" block at 480 an hour, with a one-yard hopper you load by tractor." },
  rent: { name: "Rent our plant", price: "$1 per block + setup", page: "rent.html", img: "block-plant-2.jpg",
    blurb: "We bring the full plant and an operator to your land and train your crew." },
  blocks: { name: "Finished blocks", price: "From $2.75 a block", page: "blocks.html", img: "3-pallet-of-blocks.jpg",
    blurb: "Made on AECT machines, palletized and delivered to your site, ready to lay." },
};
const productFor = (machine) => Object.values(PRODUCTS).find((p) => p.machine === machine);
const MORE_LINKS = [["Small Block Press", "small-block-press.html"], ["Mega Mixer", "mega-mixer.html"], ["Block Cutter", "block-cutter.html"], ["All machines", "machines.html"]];

// ---- Building blocks ----
const eyebrow = (t, color = C.accent) => `<div style="${HEAD}font-size:13px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:${color};margin:0 0 10px">${esc(t)}</div>`;
const h1 = (t) => `<h1 style="${HEAD}margin:0 0 12px;font-size:36px;line-height:1.05;font-weight:800;color:${C.navy}">${t}</h1>`;
const h2 = (t) => `<h2 style="${HEAD}margin:0 0 14px;font-size:24px;line-height:1.15;font-weight:800;color:${C.navy}">${esc(t)}</h2>`;
const para = (t, extra = "") => `<p style="${BODY}margin:0 0 16px;font-size:16px;line-height:1.6;color:${C.ink};${extra}">${t}</p>`;
const spacer = (h) => `<div style="height:${h}px;line-height:${h}px;font-size:1px">&nbsp;</div>`;
const rule = () => `<div style="border-top:1px solid ${C.line};margin:32px 0"></div>`;

function button(href, label, color = C.accent) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 4px"><tr><td style="background:${color};border-radius:999px">
    <a href="${esc(href)}" style="${HEAD}display:inline-block;padding:15px 30px;color:#fff;font-weight:700;font-size:16px;letter-spacing:.08em;text-transform:uppercase;text-decoration:none">${esc(label)} &rarr;</a></td></tr></table>`;
}

/** Big numbers in a row, e.g. blocks / kit / earth. */
function stats(items) {
  const w = Math.floor(100 / items.length);
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.blue};border-radius:14px;margin:6px 0 30px"><tr>
    ${items.map(([big, small], i) => `<td class="statcell" width="${w}%" style="padding:20px 18px;${i ? `border-left:1px solid ${C.blueLine};` : ""}vertical-align:top">
      <div class="stat" style="${HEAD}font-size:26px;line-height:1.05;font-weight:800;color:${C.logoCream}">${big}</div>
      <div style="${BODY}font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:${C.soft};margin-top:6px">${esc(small)}</div></td>`).join("")}
  </tr></table>`;
}

/** Label / value rows in a soft card. */
function details(rows) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.cream};border:1px solid ${C.line};border-radius:14px;margin:0 0 24px">
    ${rows.map(([k, v], i) => `<tr><td style="${BODY}padding:13px 20px;font-size:14px;color:${C.muted};${i ? `border-top:1px solid ${C.line};` : ""}width:42%">${esc(k)}</td>
      <td style="${BODY}padding:13px 20px;font-size:15px;font-weight:700;color:${C.ink};${i ? `border-top:1px solid ${C.line};` : ""}">${esc(v)}</td></tr>`).join("")}
  </table>`;
}

/** Numbered "what happens next" steps. */
function steps(list) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 8px">${list.map(([title, text], i) => `
    <tr><td width="44" style="vertical-align:top;padding:0 0 18px">
      <div style="${HEAD}width:32px;height:32px;line-height:32px;border-radius:50%;background:${C.blue};color:${C.logoCream};text-align:center;font-weight:800;font-size:16px">${i + 1}</div></td>
      <td style="vertical-align:top;padding:4px 0 18px"><div style="${HEAD}font-size:18px;font-weight:700;color:${C.navy}">${esc(title)}</div>
      <div style="${BODY}font-size:15px;line-height:1.5;color:${C.muted};margin-top:2px">${esc(text)}</div></td></tr>`).join("")}</table>`;
}

/** One wide product card: photo on the left, details and link on the right. */
function featureCard(p, label) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${C.line};border-radius:16px;overflow:hidden;margin:0 0 30px;background:#fff"><tr>
    <td class="stack" width="44%" style="vertical-align:middle;background:${C.sand}"><a href="${url(p.page)}"><img src="${photo(p.img, 520, 520)}" width="260" alt="${esc(p.name)}" style="display:block;width:100%;height:auto;border:0"></a></td>
    <td class="stack" style="vertical-align:middle;padding:24px 24px">
      ${eyebrow(label)}
      <div style="${HEAD}font-size:26px;font-weight:800;line-height:1.05;color:${C.navy}">${esc(p.name)}</div>
      <div style="${BODY}font-size:15px;font-weight:700;color:${C.ink};margin:6px 0 10px">${esc(p.price)}</div>
      <div style="${BODY}font-size:14px;line-height:1.5;color:${C.muted};margin:0 0 16px">${esc(p.blurb)}</div>
      <a href="${url(p.page)}" style="${HEAD}font-size:15px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:${C.accent};text-decoration:none">View ${esc(p.name)} &rarr;</a>
    </td></tr></table>`;
}

/** Two-by-two grid of product cards, plus text links to the rest of the lineup. */
function showcase(keys, title = "Explore the AECT lineup") {
  const card = (p, right) => p ? `<td class="stack" width="50%" style="vertical-align:top;padding:0 ${right ? 0 : 8}px 16px ${right ? 8 : 0}px">
    <a href="${url(p.page)}" style="text-decoration:none;color:inherit;display:block;border:1px solid ${C.line};border-radius:14px;overflow:hidden;background:#fff">
      <img src="${photo(p.img, 520, 340)}" width="260" alt="${esc(p.name)}" style="display:block;width:100%;height:auto;border:0">
      <div style="padding:16px 18px 18px">
        <div style="${HEAD}font-size:20px;font-weight:800;color:${C.navy}">${esc(p.name)}</div>
        <div style="${BODY}font-size:13px;font-weight:700;color:${C.ink};margin:3px 0 8px">${esc(p.price)}</div>
        <div style="${BODY}font-size:13px;line-height:1.45;color:${C.muted};margin:0 0 12px">${esc(p.blurb)}</div>
        <div style="${HEAD}font-size:14px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:${C.accent}">Learn more &rarr;</div>
      </div></a></td>` : `<td class="stack" width="50%"></td>`;
  let ps = keys.map((k) => PRODUCTS[k]).filter(Boolean);
  if (ps.length > 1 && ps.length % 2) ps = ps.slice(0, -1); // keep the grid even, no lone card
  const rows = [];
  for (let i = 0; i < ps.length; i += 2) rows.push(`<tr>${card(ps[i], false)}${card(ps[i + 1], true)}</tr>`);
  return `${h2(title)}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows.join("")}</table>
    <p style="${BODY}margin:4px 0 0;font-size:14px;color:${C.muted}">Also from AECT: ${MORE_LINKS.map(([t, h]) => `<a href="${url(h)}" style="color:${C.brand};font-weight:700">${t}</a>`).join(" &nbsp;·&nbsp; ")}</p>`;
}

function layout({ preheader, body, audience = "customer" }) {
  const nav = [["Machines", "machines.html"], ["Blocks", "blocks.html"], ["Rent", "rent.html"], ["FAQ", "learn.html"]];
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light">
<link href="https://fonts.googleapis.com/css2?family=Barlow+Semi+Condensed:wght@700;800&display=swap" rel="stylesheet">
<style>
  @media (max-width: 620px) {
    .wrap { width: 100% !important; border-radius: 0 !important; }
    .pad { padding-left: 22px !important; padding-right: 22px !important; }
    .stack { display: block !important; width: 100% !important; box-sizing: border-box; }
    .stack + .stack { border-left: 0 !important; }
    h1 { font-size: 30px !important; }
    .stat { font-size: 19px !important; white-space: nowrap; }
    .statcell { padding: 16px 10px 16px 14px !important; }
  }
</style></head>
<body style="margin:0;padding:0;background:${C.sand}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.sand}"><tr><td align="center" style="padding:28px 12px">
  <table role="presentation" class="wrap" width="620" cellpadding="0" cellspacing="0" style="width:620px;max-width:620px;background:#fff;border-radius:18px;overflow:hidden">
    <tr><td style="background:${C.blue};padding:18px 32px" class="pad">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
        <td><a href="${SITE_URL}"><img src="${SITE_URL}assets/img/logo-badge.png" width="104" alt="AECT Earth Block" style="display:block;border:0"></a></td>
        <td align="right" style="${HEAD}font-size:12px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:${C.green}">${audience === "aect" ? "Lead alert" : "Est. 1989 · San Antonio, TX"}</td>
      </tr></table></td></tr>
    <tr><td class="pad" style="padding:40px 44px 44px">${body}</td></tr>
    ${audience === "aect" ? "" : `<tr><td style="background:${C.blue};padding:32px 44px" class="pad">
      <div style="${HEAD}font-size:22px;font-weight:800;color:${C.logoCream};margin:0 0 6px">Building the world's best CEB machines since 1989.</div>
      <div style="${BODY}font-size:14px;line-height:1.6;color:${C.soft};margin:0 0 18px">Questions? Just reply to this email, or write <a href="mailto:${AECT_EMAIL}" style="color:${C.logoCream}">${AECT_EMAIL}</a>.</div>
      <div style="${HEAD}font-size:14px;font-weight:700;letter-spacing:.1em;text-transform:uppercase">${nav.map(([t, h]) => `<a href="${url(h)}" style="color:#fff;text-decoration:none">${t}</a>`).join(`<span style="color:${C.soft}"> &nbsp;/&nbsp; </span>`)}</div>
      <div style="${BODY}font-size:12px;color:${C.soft};margin-top:20px">Advanced Earthen Construction Technologies · 10608 Cassiano Rd., San Antonio, TX · <i>Semper Terrae</i></div>
    </td></tr>`}
  </table>
</td></tr></table></body></html>`;
}

/**
 * "Have a team member reach out", like the question on the planner results. The link goes to a page
 * that records the yes on their lead; the server adds a signed lead link as lead.reachUrl.
 */
function reachOut(lead) {
  const n = firstName(lead.name);
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.blue};border-radius:16px;margin:4px 0 16px"><tr>
    <td class="pad" style="padding:28px 30px">
      <div style="${HEAD}font-size:24px;font-weight:800;line-height:1.1;color:#fff;margin:0 0 6px">${n ? esc(n) + ", want" : "Want"} a team member to reach out?</div>
      <div style="${BODY}font-size:15px;line-height:1.5;color:${C.soft};margin:0 0 18px">One click and someone from our team will email you within 2 business days to talk through your plan and get you real numbers.</div>
      ${button(lead.reachUrl || url("reach-out.html"), "Have a team member reach out")}
    </td></tr></table>`;
}

/** "Have questions? Book a call", the paid video consult with Ryan. */
function bookCall() {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${C.line};border-radius:16px;margin:0 0 4px"><tr>
    <td class="stack" style="padding:22px 24px;vertical-align:middle">
      <div style="${HEAD}font-size:20px;font-weight:800;color:${C.navy}">Have questions? Book a call.</div>
      <div style="${BODY}font-size:14px;line-height:1.5;color:${C.muted};margin-top:4px">A ${CONSULT.length} video call with ${CONSULT.with}, AECT's president. Soil, machines, cost, design: anything about your build. <b style="color:${C.ink}">${CONSULT.price}</b></div></td>
    <td class="stack" align="right" style="padding:0 24px 22px 24px;vertical-align:middle;white-space:nowrap">
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:22px"><tr><td style="border:2px solid ${C.blue};border-radius:999px">
        <a href="${BOOK_CALL_URL}" style="${HEAD}display:inline-block;padding:12px 22px;color:${C.blue};font-weight:700;font-size:15px;letter-spacing:.08em;text-transform:uppercase;text-decoration:none">Book a call &middot; ${CONSULT.price}</a></td></tr></table></td>
  </tr></table>`;
}

// ---- The emails ----

/** Sent to a visitor when they finish the planner: their plan, their kit, and a way to see everything else. */
export function planEmail(lead) {
  const s = lead.summary || {};
  const n = firstName(lead.name);
  const intl = lead.state === "Outside the US";
  const kit = productFor(s.machine) || PRODUCTS.k3500;
  const options = [
    { key: "own", label: `Buy the ${kit.name}`, sub: "Machine, soil analysis and on-site training", total: s.makeOwnTotal, link: [kit.page, `See the ${kit.name}`] },
    ...(intl ? [] : [
      { key: "rent", label: "Rent our plant", sub: "We bring it, with an operator", total: s.rentTotal, link: ["rent.html", "How renting works"] },
      { key: "buy", label: "Buy finished blocks", sub: "Made on AECT machines, delivered", total: s.buyTotal, link: ["blocks.html", "How buying blocks works"] },
    ]),
  ];
  const best = s.best || options.reduce((a, b) => (b.total < a.total ? b : a)).key;
  const rows = options.map((o, i) => `
    <tr><td style="padding:18px 20px;${i ? `border-top:1px solid ${C.line};` : ""}${o.key === best ? `background:${C.cream};` : ""}">
      ${o.key === best ? `<div style="margin:0 0 6px"><span style="${BODY}display:inline-block;white-space:nowrap;background:${C.accent};color:#fff;font-size:10px;font-weight:700;letter-spacing:.1em;border-radius:999px;padding:3px 9px">BEST VALUE</span></div>` : ""}
      <div style="${HEAD}font-size:19px;font-weight:800;color:${C.navy}">${esc(o.label)}</div>
      <div style="${BODY}color:${C.muted};font-size:13px;margin-top:2px">${esc(o.sub)}</div>
      <a href="${url(o.link[0])}" style="${HEAD}display:inline-block;margin-top:8px;font-size:14px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:${C.accent};text-decoration:none">${esc(o.link[1])} &rarr;</a></td>
      <td align="right" style="${HEAD}padding:18px 20px;${i ? `border-top:1px solid ${C.line};` : ""}${o.key === best ? `background:${C.cream};` : ""}font-weight:800;font-size:24px;color:${C.navy};white-space:nowrap">${money(o.total)}</td></tr>`).join("");
  const feature = lead.path === "blocks" ? featureCard(PRODUCTS.blocks, "Your best fit") : lead.path === "rent" ? featureCard(PRODUCTS.rent, "Your best fit") : featureCard(kit, "Your recommended kit");
  const others = ["impact", "k3500", "rent", "blocks"].filter((k) => PRODUCTS[k] !== kit && !(lead.path === "rent" && k === "rent") && !(lead.path === "blocks" && k === "blocks")).slice(0, lead.path === "kit" ? 2 : 4);
  const body = `
    ${eyebrow(`${n ? n + "'s" : "Your"} CEB plan`)}
    ${h1(`You'll need about ${int(s.totalBlocks)} blocks`)}
    ${para(`${esc(PROJECTS[lead.project] || "Your project")}${s.size ? ` · ${esc(int(s.size))} ${lead.project === "outdoor" ? "ft of wall" : "sq ft"}` : ""}${lead.state && !intl ? ` · ${esc(lead.state)}` : ""} · ${esc(s.blockSize || "")} blocks`, `color:${C.muted}`)}
    ${stats([[int(s.totalBlocks), "blocks"], [esc(kit.name.replace(" Kit", "")), "your machine"], [`${int(s.earthYd)} yd³`, "of earth"]])}
    ${h2("Three ways to get your blocks")}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${C.line};border-radius:14px;overflow:hidden;border-collapse:separate;margin:0 0 14px">${rows}</table>
    ${para("Planning estimates, not a quote. Kit prices FOB San Antonio, TX; shipping extra.", `font-size:12px;color:${C.muted};margin-bottom:26px`)}
    ${reachOut(lead)}
    ${bookCall()}
    ${rule()}
    ${feature}
    ${showcase(others, "Explore more from AECT")}`;
  return { subject: `${n ? n + ", your" : "Your"} CEB plan: about ${int(s.totalBlocks)} blocks`,
    html: layout({ preheader: `About ${int(s.totalBlocks)} blocks, your recommended kit, and three ways to get them.`, body }) };
}

const CONTACT_REPLY = {
  kit: { subject: "We got your kit quote request", line: "Ryan and the team will put together an official quote for your kit.",
    next: [["We review your project", "Block count, location and soil, so we recommend the right kit."], ["You get an official quote", "By email, usually within 2 business days."], ["You pick a training week", "A week on site with our team when your kit arrives."]],
    feature: "k3500", more: ["impact", "k3500", "rent", "blocks"] },
  rent: { subject: "We got your rental request", line: "We'll price your rental from your location and block count.",
    next: [["We review your site", "Location, block count, soil and the equipment you'll need."], ["You get a rental estimate", "By email, usually within 2 business days."], ["We schedule your mobilization", "Our operator brings the plant and trains your crew."]],
    feature: "rent", more: ["blocks", "impact", "k3500"] },
  blocks: { subject: "We got your block quote request", line: "We'll price your blocks, delivered to your site.",
    next: [["We review your order", "Block count, block type and your delivery location."], ["You get a delivered quote", "By email, usually within 2 business days."], ["We schedule delivery", "Palletized blocks, ready to lay."]],
    feature: "blocks", more: ["rent", "impact", "k3500"] },
  consulting: { subject: "We got your consulting request", line: "We'll be in touch about your site and dates.",
    next: [["We review your project", "What you're building and where your crew is today."], ["We email you", "Usually within 2 business days, to plan dates."], ["We come to your site", "Hands-on help from soil prep to the last course of plaster."]],
    more: ["impact", "k3500", "rent", "blocks"] },
  consult: { subject: "We got your video consult request", line: "We'll send times for your 30-minute call with Ryan Runge.",
    next: [["We email you times", "Usually within 2 business days."], ["You pick a time", "A 30-minute video call with Ryan Runge."], ["Bring your questions", "Soil, machines, cost, design: anything about your build."]],
    more: ["impact", "k3500", "rent", "blocks"] },
  tools: { subject: "We got your order request", line: "We'll confirm availability, shipping and payment.",
    next: [["We confirm your order", "Availability and shipping to your location."], ["You get an invoice", "By email, usually within 2 business days."], ["We ship it", "From our shop in San Antonio, TX."]],
    more: ["impact", "k3500", "rent", "blocks"] },
};

/** Automatic reply to a contact form request. */
export function contactEmail(lead) {
  const r = CONTACT_REPLY[lead.path] || CONTACT_REPLY.consult;
  const s = lead.summary || {};
  const n = firstName(lead.name);
  const rows = [
    ["Kit", s.kit], ["Product", s.product], ["Block type", s.blockType], ["Estimated blocks", s.blocks && int(s.blocks)],
    ["Location", lead.state], ["Project", TIMELINES[lead.timeline]],
  ].filter(([, v]) => v);
  const body = `
    ${eyebrow("Request received")}
    ${h1(`Thanks${n ? ", " + esc(n) : ""}. We're on it.`)}
    ${para(`${esc(r.line)} You'll hear from us by email, usually within <b>2 business days</b>.`)}
    ${spacer(6)}
    ${rows.length ? `${eyebrow("Your request", C.muted)}${details(rows)}` : ""}
    ${s.message ? `<div style="border-left:3px solid ${C.accent};padding:4px 0 4px 18px;margin:0 0 30px"><div style="${BODY}font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:${C.muted};margin-bottom:6px">Your message</div><div style="${BODY}font-size:16px;line-height:1.55;color:${C.ink};font-style:italic;white-space:pre-wrap">${esc(s.message)}</div></div>` : ""}
    ${h2("What happens next")}
    ${steps(r.next)}
    ${lead.path === "consult" ? "" : bookCall()}
    ${rule()}
    ${r.feature ? featureCard(PRODUCTS[r.feature], "While you wait") : ""}
    ${showcase(r.more.filter((k) => k !== r.feature), "Explore the AECT lineup")}
    ${spacer(24)}
    ${para(`Have a question before then? Our <a href="${url("learn.html")}" style="color:${C.brand};font-weight:700">FAQ</a> covers soil, cost and building with compressed earth blocks.`, `font-size:15px;color:${C.muted}`)}`;
  return { subject: `${r.subject}${n ? ", " + n : ""}`, html: layout({ preheader: `${r.line} We'll reply within 2 business days.`, body }) };
}

/** The email the visitor gets for this lead. */
export function customerEmail(lead) {
  return lead.source === "planner" ? planEmail(lead) : contactEmail(lead);
}

/** Heads-up to AECT's inbox when a lead comes in. */
export function internalEmail(lead, stage, dashboardUrl) {
  const s = lead.summary || {};
  const st = STAGES.find((x) => x.id === stage);
  const rows = [
    ["Email", lead.email], ["Wants", PATHS[lead.path]],
    ["Wants us to reach out", lead.wants_contact === true ? "Yes" : lead.wants_contact === false ? "Not right now" : null],
    ["Location", lead.state], ["Project", PROJECTS[lead.project]], ["Timeline", TIMELINES[lead.timeline]],
    ["Blocks", s.totalBlocks ? int(s.totalBlocks) : s.blocks && int(s.blocks)], ["Machine", s.machine && short(s.machine)],
    ["Kit / product", s.kit || s.product], ["Block type", s.blockType],
  ].filter(([, v]) => v);
  const body = `
    ${eyebrow(`New ${lead.source === "planner" ? "planner" : "contact form"} lead`)}
    ${h1(esc(lead.name || lead.email))}
    <div style="margin:0 0 24px"><span style="${HEAD}display:inline-block;background:${stage === "reach" ? C.accent : C.blue};color:#fff;font-size:13px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;border-radius:999px;padding:6px 14px">${esc(st?.label || stage)}</span>
      ${st?.todo ? `<span style="${BODY}font-size:14px;color:${C.muted};margin-left:8px">Next: ${esc(st.todo)}</span>` : ""}</div>
    ${details(rows)}
    ${s.message ? `<div style="border-left:3px solid ${C.accent};padding:4px 0 4px 18px;margin:0 0 28px"><div style="${BODY}font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:${C.muted};margin-bottom:6px">Their message</div><div style="${BODY}font-size:15px;line-height:1.55;color:${C.ink};white-space:pre-wrap">${esc(s.message)}</div></div>` : ""}
    <table role="presentation" cellpadding="0" cellspacing="0"><tr>
      <td style="padding-right:10px">${button(dashboardUrl || url("admin/"), "Open in dashboard", C.blue)}</td>
      <td>${button(`mailto:${lead.email}`, `Email ${firstName(lead.name) || "them"}`)}</td></tr></table>`;
  return { subject: `New lead: ${lead.name || lead.email} · ${PATHS[lead.path] || lead.source}`, html: layout({ preheader: `${st?.label || ""} · ${PATHS[lead.path] || ""}`, body, audience: "aect" }) };
}
