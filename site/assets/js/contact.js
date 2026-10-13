// Contact form: visitors must choose a request type before the rest of the form unlocks.
// This screens out open-ended "just a question" emails and routes each request.
(function () {
  // Where requests are POSTed as JSON (same service as the planner, see plan.js LEAD_ENDPOINT).
  const CONTACT_ENDPOINT = "";
  const form = document.getElementById("contactForm");
  const details = document.getElementById("details");
  const $ = (s) => form.querySelector(s);

  const stateSel = document.getElementById("c-state");
  (window.AECTCalc?.OPTIONS.state || []).forEach((s) => stateSel.add(new Option(s, s), stateSel.options[1]));

  const redirect = document.getElementById("blocksRedirect");
  function applyTopic(topic) {
    // Block orders go to Terra Madre Brick Co., not AECT's inbox.
    const toTM = topic === "blocks";
    redirect.hidden = !toTM;
    details.hidden = toTM;
    details.disabled = !topic || toTM;
    form.classList.toggle("has-topic", !!topic);
    form.querySelectorAll("[data-for]").forEach((el) => (el.hidden = !el.dataset.for.split(" ").includes(topic)));
    document.getElementById("topicError").style.display = "none";
  }
  form.addEventListener("change", (e) => {
    if (e.target.name === "topic") {
      applyTopic(e.target.value);
      if (window.innerWidth < 760) details.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  });
  // Clear an error while the person types or picks, not on blur: clearing on blur shifts the
  // layout mid-click and makes the Send button miss the click.
  form.addEventListener("input", (e) => {
    const f = e.target.closest(".field");
    if (f) f.classList.remove("has-error");
  });

  // Prefill from links like contact.html?topic=rental&machine=3500%20Kit
  const p = new URLSearchParams(location.search);
  const map = { quote: "kit", kit: "kit", rental: "rental", blocks: "blocks", consulting: "consulting", order: "tools", tools: "tools", consult: "consult" };
  const pre = map[p.get("topic")] || (location.hash === "#consult" ? "consult" : null);
  if (pre) { const r = $(`input[name="topic"][value="${pre}"]`); if (r) { r.checked = true; applyTopic(pre); } }
  else applyTopic(null);
  const m = p.get("machine") || "";
  if (/3500/.test(m)) $("#c-kit").value = "3500 kit";
  else if (/2001|Impact/.test(m)) $("#c-kit").value = "Impact 2001A kit";
  if (/Press/.test(m)) $("#c-product").value = "Small Block Press";
  if (/Cutter/.test(m)) $("#c-product").value = "Block Cutter";
  if (/Mixer/.test(m)) $("#c-product").value = "Mega Mixer";

  const emailOk = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const topic = $('input[name="topic"]:checked');
    if (!topic) { document.getElementById("topicError").style.display = "block"; form.querySelector(".topics").scrollIntoView({ behavior: "smooth" }); return; }
    let ok = true;
    details.querySelectorAll("[required]").forEach((el) => {
      const bad = el.type === "email" ? !emailOk(el.value.trim()) : !el.value.trim();
      el.closest(".field").classList.toggle("has-error", bad);
      if (bad) ok = false;
    });
    if (!ok) { details.querySelector(".has-error .input").focus(); return; }
    const data = Object.fromEntries(new FormData(form).entries());
    data.submittedAt = new Date().toISOString();
    data.source = "aect-contact-form";
    if (CONTACT_ENDPOINT) {
      fetch(CONTACT_ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(data) })
        .catch((err) => console.warn("[contact] submit failed", err));
    } else console.info("[contact] request captured (no endpoint configured):", data);
    form.querySelectorAll("fieldset").forEach((f) => (f.hidden = true));
    document.getElementById("sent").hidden = false;
    document.getElementById("sent").scrollIntoView({ behavior: "smooth", block: "center" });
  });
})();
