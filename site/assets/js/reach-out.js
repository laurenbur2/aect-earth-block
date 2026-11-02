// "Have a team member reach out" from the plan email lands here with ?l=<lead id>&s=<signature>.
// We tell the lead backend, which moves the lead to "Wants us to reach out" and alerts AECT.
(function () {
  // Same submit-lead function as plan.js LEAD_ENDPOINT. Leave empty during development.
  const ENDPOINT = "";
  const p = new URLSearchParams(location.search);
  const lead = p.get("l"), sig = p.get("s");
  if (!lead || !sig) return; // opened directly: the thank-you message still shows
  const payload = { source: "aect-email-interest", lead, sig, submittedAt: new Date().toISOString() };
  if (!ENDPOINT) { console.info("[reach-out] sent (no endpoint configured):", payload); return; }
  fetch(ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(payload) })
    .then((r) => { if (!r.ok) throw new Error(r.status); })
    .catch(() => {
      document.getElementById("reachTitle").textContent = "We couldn't save that just now";
      document.getElementById("reachText").innerHTML = 'Please email <a href="mailto:info@AECTearthblock.com">info@AECTearthblock.com</a> and we\'ll reach out.';
    });
})();
