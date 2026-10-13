// CEB Planner: a Farmer's Dog-style funnel. One tap per question, personalized with the visitor's
// name, then an email gate before the plan is revealed (the email is the lead).
(function () {
  // ---- Config -------------------------------------------------------------
  // Where captured leads are POSTed as JSON (Formspree, HubSpot, Zapier/Make webhook, etc.).
  // Leave empty during development; leads are then only logged to the console.
  const LEAD_ENDPOINT = "";
  const TERRA_MADRE = "https://terramadrebrickco.com/"; // AECT's brick company: sells finished blocks
  const IMG = "https://img1.wsimg.com/isteam/ip/b19749ae-46c7-4c3e-a02a-fe9f0df82299/";
  const MACHINE_PAGES = {
    "AECT Impact 2001A": { page: "impact-2001a.html", img: IMG + "e48a0068-88d7-476c-a776-9f0a846ac278.jpg/:/rs=w:800", rate: "300 blocks/hr" },
    "AECT 2500HD": { page: "2500hd.html", img: IMG + "bf5b7c80-8d03-46af-8d3b-ffebd057b135.jpg/:/rs=w:800", rate: "480 blocks/hr" },
    "AECT 3500": { page: "3500.html", img: IMG + "62570b0a-3778-44b5-b0fb-e9200ed393c6.jpg/:/rs=w:800", rate: "480 blocks/hr" },
    "AECT BP714": { page: "bp714.html", img: IMG + "889d4a57-f36f-4da9-8b17-e691db617e06.png/:/rs=w:800", rate: "240 blocks/hr" },
  };
  // Defaults for questions we no longer ask (kept simple on purpose).
  const DEFAULTS = { crew: 5, rate: 18, cement: 350, earthDelivered: 15, pallets: 0.15, incid: 0.12 };
  // Rough share of interior CEB wall vs. exterior perimeter, by project type.
  const INTERIOR_RATIO = { home: 0.6, barn: 0.15, commercial: 0.4, outdoor: 0, business: 0.6 };
  const PROJECT_LABEL = { home: "home", barn: "barn or shop", commercial: "commercial building", outdoor: "outdoor project", business: "project" };
  const SIZE_CHIPS = {
    sqft: [[1000, "1,000"], [1500, "1,500"], [2000, "2,000"], [2500, "2,500"], [3500, "3,500+"]],
    outdoor: [[25, "25 ft"], [50, "50 ft"], [100, "100 ft"], [200, "200 ft"]],
  };
  const HEIGHTS = {
    building: [[8, "8 ft", "Standard"], [10, "10 ft", "Tall"], [12, "12 ft", "Extra tall"]],
    outdoor: [[3, "3 ft", "Bench or border"], [4, "4 ft", "Garden wall"], [6, "6 ft", "Privacy wall"]],
  };
  const STORE_KEY = "aect-plan-v3";

  const { calculate, OPTIONS } = window.AECTCalc;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const steps = $$(".q");
  const nextBtn = $("#next");
  const backBtn = $("#back");
  const progress = $("#progress");

  const state = { project: null, name: "", state: null, size: "", height: null, width: null, extType: null, dirt: null, labor: null, intent: null, timeline: null, email: "" };
  try { Object.assign(state, JSON.parse(localStorage.getItem(STORE_KEY) || "{}")); } catch (e) {}
  const save = () => { try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) {} };
  const params = new URLSearchParams(location.search);
  if (params.get("project")) state.project = params.get("project");
  const outdoor = () => state.project === "outdoor";
  const firstName = () => (state.name || "").trim().split(/\s+/)[0];

  // ---- Build dynamic controls -------------------------------------------------
  const stateSel = $("#state");
  OPTIONS.state.forEach((s) => stateSel.add(new Option(s, s)));

  function renderDynamic() {
    const chips = outdoor() ? SIZE_CHIPS.outdoor : SIZE_CHIPS.sqft;
    $("#sizeChips").innerHTML = chips
      .map(([v, l]) => `<button type="button" class="chip" role="radio" data-name="size" data-value="${v}">${l}${outdoor() ? "" : "<small>sq ft</small>"}</button>`).join("");
    $("#sizeUnit").textContent = outdoor() ? "linear ft" : "sq ft";
    const hs = outdoor() ? HEIGHTS.outdoor : HEIGHTS.building;
    $("#heightChoices").innerHTML = hs
      .map(([v, l, d], i) => `<button type="button" class="icon-choice" role="radio" data-name="height" data-value="${v}"><span class="wall-ico" style="height:${28 + i * 16}px"></span><b>${l}</b><small>${d}</small></button>`).join("");
  }

  // Fill {name} / {project} templates, with outdoor-specific copy where provided.
  function applyTemplates() {
    $$("[data-tpl]").forEach((el) => {
      const tpl = (outdoor() && el.dataset.tplOutdoor) || el.dataset.tpl;
      const n = firstName();
      if (tpl.includes("{name}") && !n) {
        el.textContent = tpl.replace(/,? ?\{name\}[,.!]? ?/, "").replace(/^\s*Nice to meet you\.?\s*/, "").replace(/^./, (c) => c.toUpperCase());
        return;
      }
      el.textContent = tpl.replace("{name}", n).replace("{project}", PROJECT_LABEL[state.project] || "build");
    });
  }

  function sync() {
    $$("[data-name][data-value]").forEach((b) => b.setAttribute("aria-checked", String(String(state[b.dataset.name]) === b.dataset.value)));
    stateSel.value = state.state && state.state !== "intl" ? state.state : "";
    $("#name").value = state.name || "";
    $("#email").value = state.email || "";
    const chipVals = (outdoor() ? SIZE_CHIPS.outdoor : SIZE_CHIPS.sqft).map(([v]) => String(v));
    $("#sizeCustom").value = state.size && !chipVals.includes(String(state.size)) ? state.size : "";
    applyTemplates();
    updateNext();
  }

  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-name][data-value]");
    if (!b) return;
    state[b.dataset.name] = b.dataset.value;
    if (b.dataset.name === "project") { state.size = ""; state.height = null; renderDynamic(); }
    save(); sync();
    const step = b.closest(".q").dataset.step;
    // One tap answers the question, like the best quiz funnels.
    if (b.closest("[data-auto]") || step === "location" || step === "size") setTimeout(() => go(1), 260);
  });
  stateSel.addEventListener("change", () => { state.state = stateSel.value || null; save(); sync(); if (state.state) setTimeout(() => go(1), 200); });
  $("#name").addEventListener("input", (e) => { state.name = e.target.value; save(); applyTemplates(); updateNext(); });
  $("#sizeCustom").addEventListener("input", (e) => { state.size = e.target.value; save(); $$("#sizeChips .chip").forEach((c) => c.setAttribute("aria-checked", "false")); updateNext(); });
  $("#email").addEventListener("input", (e) => { state.email = e.target.value.trim(); save(); $("#f-email").classList.remove("has-error"); });

  // ---- Navigation ---------------------------------------------------------------
  const emailOk = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v || "");
  function valid(step) {
    switch (step) {
      case "project": return !!state.project;
      case "name": return firstName().length > 0;
      case "location": return !!state.state;
      case "size": return parseFloat(state.size) > 0;
      case "height": return !!state.height;
      case "width": return !!state.width;
      case "type": return !!state.extType;
      case "dirt": return !!state.dirt;
      case "labor": return !!state.labor;
      case "intent": return !!state.intent;
      case "timeline": return !!state.timeline;
      default: return true;
    }
  }
  const QUESTION_STEPS = steps.filter((s) => !["building", "gate", "results"].includes(s.dataset.step)).length;

  let current = 0;
  function show(i) {
    current = Math.max(0, Math.min(steps.length - 1, i));
    const id = steps[current].dataset.step;
    steps.forEach((s, k) => s.classList.toggle("is-active", k === current));
    progress.style.width = `${Math.min(100, Math.round((current / QUESTION_STEPS) * 100))}%`;
    backBtn.classList.toggle("is-visible", current > 0 && !["building", "results"].includes(id));
    // Single-tap screens don't need a Continue button; text inputs do.
    $("#actions").hidden = !["name", "size"].includes(id);
    updateNext();
    window.scrollTo({ top: 0 });
    const h = steps[current].querySelector("h1");
    if (h) { h.setAttribute("tabindex", "-1"); h.focus({ preventScroll: true }); }
    if (id === "name") setTimeout(() => $("#name").focus(), 50);
    if (id === "building") runBuilding();
    if (id === "gate") { renderPreview(); setTimeout(() => $("#email").focus(), 50); }
    if (id === "results") renderResults();
    history.replaceState(null, "", `#${id}`);
  }
  function go(d) {
    if (d > 0 && !valid(steps[current].dataset.step)) return;
    show(current + d);
  }
  function updateNext() { nextBtn.disabled = !valid(steps[current]?.dataset.step); }
  nextBtn.addEventListener("click", () => go(1));
  backBtn.addEventListener("click", () => {
    let i = current - 1;
    if (steps[i]?.dataset.step === "building") i -= 1; // never land back on the loading screen
    show(i);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" || e.target.tagName !== "INPUT") return;
    e.preventDefault();
    if (e.target.id === "email") $("#reveal").click(); else nextBtn.click();
  });

  // "Building your plan" moment: ticks each line, then moves to the email gate.
  function runBuilding() {
    const items = $$("#buildList li");
    items.forEach((li) => li.classList.remove("is-done"));
    items.forEach((li, k) => setTimeout(() => li.classList.add("is-done"), 450 + k * 450));
    setTimeout(() => { if (steps[current].dataset.step === "building") show(current + 1); }, 450 + items.length * 450 + 300);
  }

  // ---- Calculation ----------------------------------------------------------------
  function walls() {
    const n = parseFloat(state.size) || 0;
    if (outdoor()) return { ext: n, int: 0 };
    const a = Math.sqrt(n / 1.5); // assume a 1.5:1 rectangular footprint
    const ext = Math.round(5 * a);
    return { ext, int: Math.round(ext * (INTERIOR_RATIO[state.project] ?? 0.5)) };
  }
  function inputs() {
    const w = walls();
    const h = parseFloat(state.height) || 0;
    return {
      externalLinearFt: w.ext, wallWidthIn: parseFloat(state.width), wallHeightFt: h,
      internalLinearFt: w.int, internalWallHeightFt: w.int ? Math.min(h, 10) : 0,
      externalBlockType: state.extType, internalBlockType: w.int ? "Un-stabilized" : null,
      earthCostPerYd: state.dirt === "own" ? 0 : DEFAULTS.earthDelivered, cementCostPerYd: DEFAULTS.cement,
      crewSize: DEFAULTS.crew, laborRate: state.labor === "hired" ? DEFAULTS.rate : 0,
      incidentalsPerBlock: DEFAULTS.incid, palletsPerBlock: DEFAULTS.pallets,
      state: state.state === "intl" ? null : state.state,
    };
  }
  const money = (n) => "$" + Math.round(n).toLocaleString();
  const money2 = (n) => "$" + n.toFixed(2);
  const int = (n) => Math.round(n).toLocaleString();
  const up = (n) => Math.ceil(n).toLocaleString();
  const short = (m) => (m || "").replace("AECT ", "");

  function plan() {
    const i = inputs();
    const r = calculate(i);
    const intl = state.state === "intl";
    const own = r.produceTotal + r.machineCost;
    const options = [{ key: "own", total: own }, ...(intl ? [] : [{ key: "rent", total: r.rentalTotal }, { key: "buy", total: r.purchaseTotal }])];
    const best = options.reduce((a, b) => (b.total < a.total ? b : a)).key;
    return { i, r, intl, own, best };
  }

  // Blurred teaser behind the email gate, built from the real numbers.
  function renderPreview() {
    const { r } = plan();
    $("#gatePreview").innerHTML = `
      <div class="pv-big">${int(r.totalBlocks)}</div><div class="pv-label">blocks</div>
      <div class="pv-row"><span>Machine</span><b>${short(r.machine)}</b></div>
      <div class="pv-row"><span>Earth</span><b>${int(r.earthYd)} yd³</b></div>
      <div class="pv-row"><span>Make your own</span><b>${money(r.produceTotal + r.machineCost)}</b></div>
      <div class="pv-row"><span>Buy delivered</span><b>${money(r.purchaseTotal)}</b></div>`;
  }

  $("#reveal").addEventListener("click", () => {
    if (!emailOk(state.email)) { $("#f-email").classList.add("has-error"); $("#email").focus(); return; }
    submitLead();
    show(current + 1);
  });

  function submitLead() {
    const { i, r, own } = plan();
    const payload = {
      submittedAt: new Date().toISOString(), source: "aect-ceb-planner",
      contact: { name: firstName(), email: state.email },
      qualify: { project: state.project, intent: state.intent, timeline: state.timeline, state: state.state, dirt: state.dirt, labor: state.labor },
      answers: i,
      plan: { totalBlocks: Math.round(r.totalBlocks), blockSize: r.blockSize, machine: r.machine, makeOwnTotal: Math.round(own), rentTotal: Math.round(r.rentalTotal), buyTotal: Math.round(r.purchaseTotal) },
    };
    if (!LEAD_ENDPOINT) { console.info("[planner] lead captured (no endpoint configured):", payload); return; }
    fetch(LEAD_ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(payload) })
      .catch((err) => console.warn("[planner] lead submit failed", err));
  }

  function renderResults() {
    const { i, r, intl, own, best } = plan();
    const m = MACHINE_PAGES[r.machine] || {};
    const n = firstName();
    const kitName = `${short(r.machine)} Kit`;
    const pick = state.intent && state.intent !== "unsure" && !(intl && state.intent !== "own") ? state.intent : null;
    const saving = r.purchaseCostPerBlock - r.produceCostPerBlock;
    const breakeven = !intl && saving > 0 ? r.machineCost / saving : 0;
    const multiple = breakeven && r.totalBlocks ? breakeven / r.totalBlocks : 0;
    const LABEL = { own: "a machine kit", rent: "renting our plant", buy: "buying finished blocks" };
    const TOTAL = { own, rent: r.rentalTotal, buy: r.purchaseTotal };
    const why = {
      own: "At this volume a kit pays for itself, and you keep the machine for future builds.",
      rent: "You get our full plant and an operator without buying equipment.",
      buy: multiple > 1 ? `A kit pays off at about ${int(breakeven)} blocks, roughly ${multiple.toFixed(1)}× this project.` : "No equipment to buy, store or learn.",
    }[best];
    const heading = pick && pick !== best
      ? `You asked about ${LABEL[pick]}: ${money(TOTAL[pick])}`
      : `Your best option: ${LABEL[best]}`;
    const sub = pick && pick !== best
      ? `For this project, ${LABEL[best]} comes in lower at ${money(TOTAL[best])}. ${why}`
      : why;

    const card = (key, title, sub, total, per, rows, href, cta) => `
      <div class="opt ${best === key ? "is-best" : ""} ${pick === key ? "is-pick" : ""}">${best === key ? '<span class="flag">Best value</span>' : pick === key ? '<span class="flag flag--pick">Your pick</span>' : ""}
        <h3>${title}</h3><div class="sub">${sub}</div>
        <div class="big">${money(total)}</div><div class="per">${per}</div>
        <details class="breakdown"><summary>See breakdown</summary><ul>${rows.map(([a, b]) => `<li><span>${a}</span><span>${b}</span></li>`).join("")}</ul></details>
        <a class="btn ${best === key || pick === key ? "" : "btn--outline"}" href="${href}"${/^https?:/.test(href) ? ' target="_blank" rel="noopener"' : ""}>${cta}</a>
      </div>`;
    const cards = {
      own: card("own", `Buy the ${kitName}`, "Machine, soil analysis & training", own, `Includes the machine (${money(r.machineCost)})`,
        [[`${short(r.machine)} kit`, money(r.machineCost)], ["Materials", money(r.materialCost)], ["Labor", r.laborCost ? money(r.laborCost) : "Volunteer"], ["Pallets & supplies", money(r.incidentalCost)]],
        m.page || "machines.html", `See the ${kitName}`),
      rent: intl ? "" : card("rent", "Rent our plant", "We bring it, with an operator", r.rentalTotal, `${money2(r.rentalCostPerBlock)} per block, all in`,
        [["Setup & delivery", money(r.mobilizationCost)], ["Rental ($1/block)", money(r.rentalMachineryCost)], ["Your materials & crew", money(r.rentalMaterialLaborIncidental)]],
        "rent.html", "How renting works"),
      buy: intl ? "" : card("buy", "Buy blocks", "From Terra Madre Brick Co.", r.purchaseTotal, `${money2(r.purchaseCostPerBlock)} per block, delivered`,
        [[`${int(r.totalBlocks)} × ${money2(r.blockPrice)}`, money(r.purchaseCost)], [`Delivery (${up(r.truckloads)} trucks)`, money(r.deliveryCost)]],
        TERRA_MADRE, "Get a block quote ↗"),
    };
    const order = [pick, best, "own", "rent", "buy"].filter((k, idx, arr) => k && arr.indexOf(k) === idx);
    const fastNote = r.machine === "AECT Impact 2001A" && r.totalBlocks > 30000
      ? `<p class="fine" style="margin-top:10px">Big project? Ask us about the <a href="2500hd.html">2500HD</a>, which makes the same 6"×12" block at 480 an hour.</p>` : "";
    const topic = { own: "quote", rent: "rental", buy: "blocks" }[pick || best];

    $("#results").innerHTML = `
      <div class="results-hero">
        <span class="eyebrow">${n ? `${n}'s` : "Your"} CEB plan</span>
        <h1>You'll need about <span class="hl">${int(r.totalBlocks)}</span> blocks</h1>
        <p>${outdoor() ? `${int(i.externalLinearFt)} ft of ${state.height} ft wall` : `${int(parseFloat(state.size))} sq ft ${PROJECT_LABEL[state.project]}`}${intl ? "" : ` in ${state.state}`} · ${r.blockSize} blocks</p>
      </div>

      <div class="summary-grid summary-grid--4">
        <div><b>${kitName}</b><span>recommended kit</span></div>
        <div><b>${int(r.earthYd)} yd³</b><span>of earth</span></div>
        <div><b>${r.cementYd ? int(r.cementYd) + " yd³" : "None"}</b><span>of cement</span></div>
        <div><b>${up(r.palletsNeeded)}</b><span>pallets</span></div>
      </div>

      <div class="res-section">
        <h2>${heading}</h2>
        <p class="q-help">${sub}</p>
        <div class="options3">${order.map((k) => cards[k]).join("")}</div>
      </div>

      <div class="res-section machine-rec">
        ${m.img ? `<img src="${m.img}" alt="${r.machine}">` : ""}
        <div>
          <span class="eyebrow">Your kit</span>
          <h3>${kitName} · from ${money(r.machineCost)}</h3>
          <ul class="kit-includes"><li>${short(r.machine)} machine</li><li>Soil analysis</li><li>1 week on-site training</li><li>Warranty & lifetime support</li></ul>
          <p>${m.rate || ""}. Makes your ${r.blockSize} blocks.</p>
          <a class="btn btn--outline" href="${m.page || "machines.html"}">View kit</a>
          ${fastNote}
        </div>
      </div>

      <div class="res-section next-cta">
        ${(pick || best) === "buy" ? `
        <h2>Ready to order blocks?</h2>
        <p>Finished blocks are made and sold by our brick company, Terra Madre Brick Co. Send them your block count (${int(r.totalBlocks)}) for a free quote.</p>
        <a class="btn btn--cream btn--lg" href="${TERRA_MADRE}" target="_blank" rel="noopener">Get a block quote from Terra Madre <span class="arrow">↗</span></a>
        <p class="fine" style="margin:14px 0 0;color:#b8c0ce">Thinking about making your own instead? <a href="contact.html?topic=quote&machine=${encodeURIComponent(kitName)}" style="color:var(--logo-cream)">Ask AECT about the ${kitName}</a></p>` : `
        <h2>Ready for real numbers?</h2>
        <p>Send us your plan and we'll reply with an official quote.</p>
        <a class="btn btn--cream btn--lg" href="contact.html?topic=${topic}&machine=${encodeURIComponent(kitName)}">Get my official quote <span class="arrow">→</span></a>`}
      </div>

      <details class="res-section assumptions">
        <summary><b>How we calculated this</b></summary>
        <ul>
          ${outdoor() ? "" : `<li>Wall lengths estimated from ${int(parseFloat(state.size))} sq ft (rectangular, single story), plus un-stabilized interior walls.</li>`}
          <li>${state.labor === "hired" ? `Crew of ${DEFAULTS.crew} at $${DEFAULTS.rate}/hr.` : "Volunteer labor."} ${state.dirt === "own" ? "Free site dirt." : `Earth at $${DEFAULTS.earthDelivered}/yd³.`} Cement at $${DEFAULTS.cement}/yd³.</li>
          <li>Wall volume reduced 20% (exterior) and 15% (interior) for doors, windows and mortar.</li>
          <li>Kit prices FOB San Antonio, TX; shipping extra. Prices change with 30 days' notice.</li>
          <li>Estimates are for planning only, not a quote.</li>
        </ul>
      </details>

      <div class="results-actions">
        <button class="btn btn--outline" type="button" onclick="window.print()">Print or save PDF</button>
        <button class="btn btn--outline" type="button" id="restart">Change my answers</button>
      </div>`;
    $("#restart").onclick = () => show(0);
  }

  // ---- Boot -----------------------------------------------------------------------
  renderDynamic();
  sync();
  show(params.get("project") ? 1 : 0); // coming from the home page picker? skip question 1
})();
