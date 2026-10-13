// CEB Planner: drives the one-question-per-screen flow and renders the personalized plan.
(function () {
  // ---- Config -------------------------------------------------------------
  // Where finished plans are POSTed as JSON (Formspree, HubSpot, Zapier webhook, etc.).
  // Leave empty during development; leads are then only logged to the console.
  const LEAD_ENDPOINT = "";
  const IMG = "https://img1.wsimg.com/isteam/ip/b19749ae-46c7-4c3e-a02a-fe9f0df82299/";
  const MACHINE_PAGES = {
    "AECT Impact 2001A": { page: "impact-2001a.html", img: IMG + "e48a0068-88d7-476c-a776-9f0a846ac278.jpg/:/rs=w:800", rate: "300 blocks/hr" },
    "AECT 2500HD": { page: "2500hd.html", img: IMG + "bf5b7c80-8d03-46af-8d3b-ffebd057b135.jpg/:/rs=w:800", rate: "480 blocks/hr" },
    "AECT 3500": { page: "3500.html", img: IMG + "62570b0a-3778-44b5-b0fb-e9200ed393c6.jpg/:/rs=w:800", rate: "480 blocks/hr" },
    "AECT BP714": { page: "bp714.html", img: IMG + "889d4a57-f36f-4da9-8b17-e691db617e06.png/:/rs=w:800", rate: "240 blocks/hr" },
  };
  // Rough share of interior CEB wall vs. exterior perimeter, by project type.
  const INTERIOR_RATIO = { home: 0.6, barn: 0.15, commercial: 0.4, outdoor: 0, business: 0.6 };
  const PROJECT_LABEL = { home: "home", barn: "barn or shop", commercial: "commercial building", outdoor: "outdoor project", business: "multi-building project" };
  const STORE_KEY = "aect-plan-v1";

  const { calculate, OPTIONS } = window.AECTCalc;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const steps = $$(".q");
  const nextBtn = $("#next");
  const backBtn = $("#back");
  const progress = $("#progress");

  const state = {
    project: null, state: null, sizeMode: "sqft", sqft: "", extFt: "", intFt: "",
    height: null, width: null, extType: null, intType: "Un-stabilized",
    labor: null, crew: "5", rate: 18, earth: 15, cement: 350, pallets: 0.15, incid: 0.12,
    timeline: null, soil: null, name: "", email: "", phone: "",
  };
  try { Object.assign(state, JSON.parse(localStorage.getItem(STORE_KEY) || "{}")); } catch (e) {}
  const save = () => { try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) {} };

  const params = new URLSearchParams(location.search);
  if (params.get("project")) state.project = params.get("project");

  // ---- Populate dynamic controls ------------------------------------------
  const stateSel = $("#state");
  OPTIONS.state.forEach((s) => stateSel.add(new Option(s, s)));

  function renderHeightChips() {
    const outdoor = state.project === "outdoor";
    const heights = outdoor ? [3, 4, 6, 8] : [8, 9, 10, 11, 12, 13, 14];
    $("#heightChips").innerHTML = heights
      .map((h) => `<button type="button" class="chip" role="radio" data-name="height" data-value="${h}">${h} ft</button>`)
      .join("");
  }

  // ---- Generic choice handling ----------------------------------------------
  function syncChoices() {
    $$("[data-name][data-value]").forEach((b) => {
      b.setAttribute("aria-checked", String(String(state[b.dataset.name]) === b.dataset.value));
    });
    stateSel.value = state.state && state.state !== "intl" ? state.state : "";
    ["sqft", "extFt", "intFt", "name", "email", "phone"].forEach((id) => { if ($("#" + id)) $("#" + id).value = state[id] || ""; });
    $("#rate").value = state.rate; $("#earth").value = state.earth; $("#cement").value = state.cement;
    $("#pallets").value = state.pallets; $("#incid").value = state.incid;
    $("#rateOut").textContent = `$${state.rate}/hr`;
    $("#earthOut").textContent = state.earth == 0 ? "$0 · free" : `$${state.earth}/yd³`;
    $("#cementOut").textContent = `$${state.cement}/yd³`;
    $("#laborDetail").hidden = state.labor !== "hired";
    const anyStab = state.extType?.startsWith("8%") || state.intType?.startsWith("8%");
    $("#cementWrap").hidden = !anyStab;
    $$(".tab").forEach((t) => t.setAttribute("aria-selected", String(t.dataset.mode === state.sizeMode)));
    $$("[data-panel]").forEach((p) => (p.hidden = p.dataset.panel !== state.sizeMode));
    applyOutdoorText();
    renderEstimate();
    updateNext();
  }

  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-name][data-value]");
    if (!b) return;
    state[b.dataset.name] = b.dataset.value;
    if (b.dataset.name === "project") renderHeightChips();
    save(); syncChoices();
    const step = b.closest(".q");
    // Auto-advance on single-question screens, like the best quiz funnels.
    if (step && step.hasAttribute("data-auto") && valid(step.dataset.step)) setTimeout(() => go(1), 220);
  });

  stateSel.addEventListener("change", () => { state.state = stateSel.value || null; save(); syncChoices(); });
  $$(".tab").forEach((t) => t.addEventListener("click", () => { state.sizeMode = t.dataset.mode; save(); syncChoices(); }));
  ["sqft", "extFt", "intFt", "name", "email", "phone"].forEach((id) => {
    $("#" + id).addEventListener("input", (e) => { state[id] = e.target.value.trim(); save(); renderEstimate(); updateNext(); });
  });
  [["rate", "rate"], ["earth", "earth"], ["cement", "cement"], ["pallets", "pallets"], ["incid", "incid"]].forEach(([id, key]) => {
    $("#" + id).addEventListener("input", (e) => { state[key] = parseFloat(e.target.value) || 0; save(); syncChoices(); });
  });

  function applyOutdoorText() {
    const outdoor = state.project === "outdoor";
    $$("[data-text-outdoor]").forEach((el) => {
      if (!el.dataset.textDefault) el.dataset.textDefault = el.textContent;
      el.textContent = outdoor ? el.dataset.textOutdoor : el.dataset.textDefault;
    });
    $$("[data-hide-outdoor]").forEach((el) => (el.hidden = outdoor));
    if (outdoor && state.sizeMode !== "linear") { state.sizeMode = "linear"; $$("[data-panel]").forEach((p) => (p.hidden = p.dataset.panel !== "linear")); }
  }

  // Estimate wall lengths from footprint: assume a 1.5:1 rectangle.
  function wallsFromSqft(sqft) {
    const a = Math.sqrt(sqft / 1.5);
    const ext = Math.round(5 * a);
    const int = Math.round(ext * (INTERIOR_RATIO[state.project] ?? 0.5));
    return { ext, int };
  }
  function walls() {
    if (state.sizeMode === "sqft" && state.project !== "outdoor") {
      const s = parseFloat(state.sqft) || 0;
      return s > 0 ? wallsFromSqft(s) : { ext: 0, int: 0 };
    }
    return { ext: parseFloat(state.extFt) || 0, int: state.project === "outdoor" ? 0 : parseFloat(state.intFt) || 0 };
  }
  function renderEstimate() {
    const el = $("#sizeEstimate");
    const s = parseFloat(state.sqft) || 0;
    if (state.sizeMode !== "sqft" || s <= 0) { el.hidden = true; return; }
    const w = wallsFromSqft(s);
    el.hidden = false;
    el.innerHTML = `That's roughly <b>${w.ext.toLocaleString()} ft of exterior wall</b>${w.int ? ` and <b>${w.int.toLocaleString()} ft of interior wall</b>` : ""}. Know the exact lengths? <a href="#" data-switch-linear>Enter them instead</a>.`;
    el.querySelector("[data-switch-linear]").onclick = (e) => {
      e.preventDefault(); state.sizeMode = "linear"; state.extFt = String(w.ext); state.intFt = String(w.int); save(); syncChoices();
    };
  }

  // ---- Validation & navigation ----------------------------------------------
  const emailOk = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
  function valid(step) {
    switch (step) {
      case "project": return !!state.project;
      case "location": return !!state.state;
      case "size": return walls().ext > 0;
      case "height": return !!state.height;
      case "width": return !!state.width;
      case "type": return !!state.extType && (state.project === "outdoor" || !!state.intType);
      case "labor": return state.labor === "volunteer" || (state.labor === "hired" && !!state.crew);
      case "costs": return true;
      case "contact": return !!state.name && emailOk(state.email);
      default: return true;
    }
  }

  let current = 0;
  function show(i) {
    current = Math.max(0, Math.min(steps.length - 1, i));
    steps.forEach((s, k) => s.classList.toggle("is-active", k === current));
    const id = steps[current].dataset.step;
    progress.style.width = `${Math.round((current / (steps.length - 1)) * 100)}%`;
    backBtn.classList.toggle("is-visible", current > 0);
    $("#actions").hidden = id === "results";
    nextBtn.innerHTML = id === "contact" ? 'See my plan <span class="arrow">→</span>' : 'Continue <span class="arrow">→</span>';
    if (id === "results") renderResults();
    updateNext();
    window.scrollTo({ top: 0 });
    const h = steps[current].querySelector("h1");
    if (h) { h.setAttribute("tabindex", "-1"); h.focus({ preventScroll: true }); }
    history.replaceState(null, "", `#${id}`);
  }
  function go(d) {
    if (d > 0 && !valid(steps[current].dataset.step)) return;
    if (d > 0 && steps[current].dataset.step === "contact") submitLead();
    show(current + d);
  }
  function updateNext() {
    const id = steps[current]?.dataset.step;
    // The contact step stays clickable so we can show field errors.
    nextBtn.disabled = id !== "contact" && !valid(id);
  }
  nextBtn.addEventListener("click", () => {
    if (steps[current].dataset.step === "contact") {
      $("#f-name").classList.toggle("has-error", !state.name);
      $("#f-email").classList.toggle("has-error", !emailOk(state.email));
    }
    go(1);
  });
  backBtn.addEventListener("click", () => show(current - 1));
  document.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && e.target.tagName === "INPUT") { e.preventDefault(); nextBtn.click(); }
  });

  // ---- Calculation ------------------------------------------------------------
  function inputs() {
    const w = walls();
    const h = parseFloat(state.height) || 0;
    const intType = state.intType === "none" ? null : state.intType;
    return {
      externalLinearFt: w.ext,
      wallWidthIn: parseFloat(state.width),
      wallHeightFt: h,
      internalLinearFt: intType ? w.int : 0,
      internalWallHeightFt: intType ? h : 0,
      externalBlockType: state.extType,
      internalBlockType: intType,
      earthCostPerYd: state.earth,
      cementCostPerYd: state.cement,
      crewSize: parseFloat(state.crew) || 5,
      laborRate: state.labor === "hired" ? state.rate : 0,
      incidentalsPerBlock: state.incid,
      palletsPerBlock: state.pallets,
      state: state.state === "intl" ? null : state.state,
    };
  }

  const money = (n) => "$" + Math.round(n).toLocaleString();
  const money2 = (n) => "$" + n.toFixed(2);
  const int = (n) => Math.round(n).toLocaleString();
  const up = (n) => Math.ceil(n).toLocaleString();

  function submitLead() {
    const r = calculate(inputs());
    const payload = {
      submittedAt: new Date().toISOString(), source: "aect-ceb-planner",
      contact: { name: state.name, email: state.email, phone: state.phone },
      qualify: { project: state.project, timeline: state.timeline, soilTested: state.soil, state: state.state },
      answers: inputs(),
      plan: {
        totalBlocks: Math.round(r.totalBlocks), blockSize: r.blockSize, machine: r.machine,
        makeOwnTotal: Math.round(r.produceTotal + r.machineCost), rentTotal: Math.round(r.rentalTotal), buyTotal: Math.round(r.purchaseTotal),
      },
    };
    if (!LEAD_ENDPOINT) { console.info("[planner] lead (no endpoint configured):", payload); return; }
    fetch(LEAD_ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(payload) })
      .catch((err) => console.warn("[planner] lead submit failed", err));
  }

  function renderResults() {
    const i = inputs();
    const r = calculate(i);
    const intl = state.state === "intl";
    const m = MACHINE_PAGES[r.machine] || {};
    const own = r.produceTotal + r.machineCost;
    const options = [
      { key: "own", total: own },
      ...(intl ? [] : [{ key: "rent", total: r.rentalTotal }, { key: "buy", total: r.purchaseTotal }]),
    ];
    const best = options.reduce((a, b) => (b.total < a.total ? b : a)).key;
    // Blocks at which owning a machine beats buying blocks outright.
    const saving = r.purchaseCostPerBlock - r.produceCostPerBlock;
    const breakeven = !intl && saving > 0 ? r.machineCost / saving : 0;
    const buildings = breakeven && r.totalBlocks ? breakeven / r.totalBlocks : 0;
    const stab = (t) => (t && t.startsWith("8%") ? "stabilized" : "un-stabilized");
    const name = state.name ? state.name.split(" ")[0] : "Your";
    const possessive = state.name ? `${name}'s` : "Your";

    const verdict = {
      own: `Owning a machine is your lowest-cost path. At this volume the machine pays for itself, and you keep an asset that can make a million more blocks.`,
      rent: `Renting AECT's plant with an operator is your lowest-cost path. You get a trained operator and a full batch plant without buying equipment.`,
      buy: `For a project this size, buying finished blocks is your lowest-cost path.${buildings > 1 ? ` A machine starts paying for itself after about ${int(breakeven)} blocks, roughly ${buildings.toFixed(1)}× this project.` : ""}`,
    }[best];

    const timelineNext = {
      "0-6": "quote", "6-12": "consult", "12+": "consult", research: "learn",
    }[state.timeline] || "consult";

    const nextCards = {
      quote: `<div class="next-step ${timelineNext === "quote" ? "is-primary" : ""}"><h3>Request a formal quote</h3><p>Ready to move? We'll confirm pricing, delivery and training dates using this plan.</p><a class="btn" href="contact.html?topic=quote">Request my quote</a></div>`,
      consult: `<div class="next-step ${timelineNext === "consult" ? "is-primary" : ""}"><h3>Talk it through with Ryan</h3><p>30-minute video call with AECT's president. Bring this plan; he'll pressure-test it with you. $75.</p><a class="btn" href="contact.html#consult">Book a consult</a></div>`,
      learn: `<div class="next-step ${timelineNext === "learn" ? "is-primary" : ""}"><h3>${state.soil === "yes" ? "Learn the build process" : "Test your soil first"}</h3><p>${state.soil === "yes" ? "Watch how CEB walls go up, from first course to plaster." : "The #1 thing to know before anything else. Our Small Block Press makes test blocks at real machine pressure."}</p><a class="btn" href="${state.soil === "yes" ? "learn.html#videos" : "small-block-press.html"}">${state.soil === "yes" ? "Watch the videos" : "Soil testing"}</a></div>`,
    };
    const order = [timelineNext, ...["quote", "consult", "learn"].filter((k) => k !== timelineNext)];

    $("#results").innerHTML = `
      <div class="results-hero">
        <div class="q-step">Your CEB plan is ready</div>
        <h1>${possessive} ${PROJECT_LABEL[state.project] || "build"} plan</h1>
        <p>${int(i.externalLinearFt)} ft of ${state.width}" exterior wall at ${state.height} ft${i.internalLinearFt ? `, plus ${int(i.internalLinearFt)} ft of interior wall` : ""}${intl ? "" : ` in ${state.state}`}. ${stab(state.extType)[0].toUpperCase() + stab(state.extType).slice(1)} exterior blocks.</p>
      </div>

      <div class="summary-grid">
        <div><b>${int(r.totalBlocks)}</b><span>total blocks (${r.blockSize}${r.internalBlockSize && r.internalBlocks ? ` + ${r.internalBlockSize} interior` : ""})</span></div>
        <div><b>${int(r.earthYd)} yd³</b><span>earth needed</span></div>
        <div><b>${r.cementYd ? int(r.cementYd) + " yd³" : "None"}</b><span>cement or lime</span></div>
        <div><b>${up(r.palletsNeeded)}</b><span>pallets</span></div>
        <div><b>${intl ? "—" : up(r.truckloads)}</b><span>truckloads if delivered</span></div>
        <div><b>${int(r._intermediate.productionHours)} hrs</b><span>machine run time</span></div>
      </div>

      <div class="res-section">
        <span class="eyebrow">Compare your options</span>
        <h2>What it costs to get ${int(r.totalBlocks)} blocks</h2>
        <p class="q-help" style="margin-bottom:8px">${verdict}</p>
        <div class="options3">
          <div class="opt ${best === "own" ? "is-best" : ""}">${best === "own" ? '<span class="flag">Best value</span>' : ""}
            <h3>Buy a machine</h3><div class="sub">Make your own blocks</div>
            <div class="big">${money(own)}</div><div class="per">${money2(r.produceCostPerBlock)}/block to produce, plus the machine</div>
            <ul>
              <li><span>${r.machine.replace("AECT ", "")} machine</span><span>${money(r.machineCost)}</span></li>
              <li><span>Materials</span><span>${money(r.materialCost)}</span></li>
              <li><span>Labor</span><span>${r.laborCost ? money(r.laborCost) : "Volunteer"}</span></li>
              <li><span>Pallets & consumables</span><span>${money(r.incidentalCost)}</span></li>
            </ul>
            <a class="btn ${best === "own" ? "" : "btn--outline"}" href="${m.page || "machines.html"}">See the ${r.machine.replace("AECT ", "")}</a>
          </div>
          ${intl ? "" : `
          <div class="opt ${best === "rent" ? "is-best" : ""}">${best === "rent" ? '<span class="flag">Best value</span>' : ""}
            <h3>Rent AECT's plant</h3><div class="sub">We bring the equipment and an operator</div>
            <div class="big">${money(r.rentalTotal)}</div><div class="per">${money2(r.rentalCostPerBlock)}/block, all in</div>
            <ul>
              <li><span>Mobilization & setup</span><span>${money(r.mobilizationCost)}</span></li>
              <li><span>Machinery rental ($1/block)</span><span>${money(r.rentalMachineryCost)}</span></li>
              <li><span>Your materials, crew, consumables</span><span>${money(r.rentalMaterialLaborIncidental)}</span></li>
            </ul>
            <a class="btn ${best === "rent" ? "" : "btn--outline"}" href="rent.html">How rental works</a>
          </div>
          <div class="opt ${best === "buy" ? "is-best" : ""}">${best === "buy" ? '<span class="flag">Best value</span>' : ""}
            <h3>Buy blocks</h3><div class="sub">Cement-stabilized, delivered</div>
            <div class="big">${money(r.purchaseTotal)}</div><div class="per">${money2(r.purchaseCostPerBlock)}/block, delivered</div>
            <ul>
              <li><span>${int(r.totalBlocks)} blocks × ${money2(r.blockPrice)}</span><span>${money(r.purchaseCost)}</span></li>
              <li><span>Delivery (${up(r.truckloads)} trucks × ${money(r.deliveryCostPerTruck)})</span><span>${money(r.deliveryCost)}</span></li>
              <li><span>Pallet deposit</span><span>$15/pallet</span></li>
            </ul>
            <a class="btn ${best === "buy" ? "" : "btn--outline"}" href="blocks.html">Block options</a>
          </div>`}
        </div>
      </div>

      <div class="res-section">
        <span class="eyebrow">Recommended machine</span>
        <h2>Your blocks are made on the ${r.machine.replace("AECT ", "")}</h2>
        <div class="machine-rec">
          ${m.img ? `<img src="${m.img}" alt="${r.machine}">` : ""}
          <div>
            <h3>${r.machine}</h3>
            <div class="price">${money(r.machineCost)}</div>
            <p class="fine" style="margin-bottom:12px">${m.rate || ""} · Makes your ${r.blockSize} blocks. Includes a week of on-site training, 1-year warranty and lifetime support.</p>
            <p>${r.machine === "AECT 2500HD" ? "Over 30,000 blocks, the 2500HD's tractor-loaded hopper and 480 blocks/hr save you weeks of production." : r.machine === "AECT Impact 2001A" ? "Light enough to tow behind any vehicle and perfect for one to five houses." : r.machine === "AECT BP714" ? "Interlocking, holey blocks you can reinforce with rebar and grout, ideal where codes require it." : "The Cadillac of CEB machines. Some 3500s in the field have made three million blocks."} To run any machine at full speed, plan on a <a href="mega-mixer.html">Mega Mixer</a> or another way to mix soil, stabilizer and water consistently.</p>
            <a class="btn btn--outline" href="${m.page || "machines.html"}">Full specs and video</a>
          </div>
        </div>
      </div>

      <div class="res-section">
        <span class="eyebrow">Your next step</span>
        <h2>Where to go from here</h2>
        <div class="next-steps">${order.map((k) => nextCards[k]).join("")}</div>
      </div>

      <div class="res-section assumptions">
        <b>How we calculated this.</b> Estimates use AECT's production model and are for planning only, not a quote.
        <ul>
          ${state.sizeMode === "sqft" && state.project !== "outdoor" ? `<li>Wall lengths estimated from ${int(parseFloat(state.sqft))} sq ft, assuming a rectangular single-story footprint.</li>` : ""}
          <li>Wall volume is reduced by 20% (exterior) and 15% (interior) to allow for doors, windows and mortar joints.</li>
          <li>Labor assumes your machine averages 20% of its rated speed across loading, mixing, stacking and breaks.</li>
          <li>Machine prices are FOB San Antonio, TX. Shipping and loading are extra. Prices change with 30 days' notice.</li>
          <li>Rental assumes you provide labor, tractor, forklift, earth, stabilizer, water, fuel, power, pallets, wrap and lodging for AECT staff.</li>
          ${intl ? "<li>International shipping and rental are quoted separately.</li>" : ""}
        </ul>
      </div>

      <div class="results-actions">
        <button class="btn btn--outline" type="button" onclick="window.print()">Print or save as PDF</button>
        <a class="btn btn--outline" href="mailto:?subject=${encodeURIComponent("My CEB build plan")}&body=${encodeURIComponent(`CEB plan from AECT:\n\n${int(r.totalBlocks)} blocks (${r.blockSize})\nEarth: ${int(r.earthYd)} yd3, cement: ${int(r.cementYd)} yd3\nMachine: ${r.machine} (${money(r.machineCost)})\n\nMake your own: ${money(own)}\n${intl ? "" : `Rent AECT plant: ${money(r.rentalTotal)}\nBuy blocks delivered: ${money(r.purchaseTotal)}\n`}\nRun your own: ${location.origin}${location.pathname}`)}">Email to my builder</a>
        <button class="btn btn--outline" type="button" id="restart">Change my answers</button>
      </div>`;
    $("#restart").onclick = () => show(0);
  }

  // ---- Boot -----------------------------------------------------------------
  renderHeightChips();
  syncChoices();
  // Coming from the home page with a project picked? Skip straight to question 2.
  const startAt = params.get("project") ? 1 : 0;
  show(startAt);
})();
