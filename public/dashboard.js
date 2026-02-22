// public/dashboard.js
(function () {
  const expTbody = document.getElementById("expTbody");
  const refreshBtn = document.getElementById("refreshBtn");

  const metricsCard = document.getElementById("metricsCard");
  const metricKeyEl = document.getElementById("metricKey");

  const cvrA = document.getElementById("cvrA");
  const cvrB = document.getElementById("cvrB");
  const ctrA = document.getElementById("ctrA");
  const ctrB = document.getElementById("ctrB");
  const brA = document.getElementById("brA");
  const brB = document.getElementById("brB");
  const countsBox = document.getElementById("countsBox");
  const topA = document.getElementById("topA");
  const topB = document.getElementById("topB");

  function fmtPct(x) {
    if (typeof x !== "number" || !isFinite(x)) return "—";
    return (x * 100).toFixed(2) + "%";
  }
  function fmtDate(ts) {
    if (!ts) return "—";
    const d = new Date(ts);
    return d.toLocaleString();
  }

  async function fetchExperiments() {
    const r = await fetch("/api/experiments?site_id=ab-sample");
    const j = await r.json();
    if (!j?.ok) throw new Error("experiments fetch failed");
    return j.experiments || [];
  }

  async function setStatus(id, status) {
    const r = await fetch(`/api/experiments/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status })
    });
    const j = await r.json();
    if (!j?.ok) throw new Error(j?.reason || "status update failed");
    return j.experiment;
  }

  async function deleteExp(id) {
    const r = await fetch(`/api/experiments/${encodeURIComponent(id)}`, { method: "DELETE" });
    const j = await r.json();
    if (!j?.ok) throw new Error(j?.reason || "delete failed");
  }

  async function fetchMetrics(key) {
    const r = await fetch(`/api/metrics?site_id=ab-sample&key=${encodeURIComponent(key)}`);
    const j = await r.json();
    if (!j?.ok) throw new Error(j?.reason || "metrics failed");
    return j;
  }

  function renderTop(list) {
    if (!Array.isArray(list) || list.length === 0) return "—";
    return list.map((x) => `${String(x.element_id).padEnd(18)}  ${x.count}`).join("\n");
  }

  async function showMetrics(key) {
    metricsCard.style.display = "block";
    metricKeyEl.textContent = key;

    // loading
    cvrA.textContent = cvrB.textContent = "…";
    ctrA.textContent = ctrB.textContent = "…";
    brA.textContent = brB.textContent = "…";
    countsBox.textContent = "loading…";
    topA.textContent = topB.textContent = "…";

    const m = await fetchMetrics(key);

    cvrA.textContent = fmtPct(m.A.cvr);
    cvrB.textContent = fmtPct(m.B.cvr);
    ctrA.textContent = fmtPct(m.A.ctr);
    ctrB.textContent = fmtPct(m.B.ctr);
    brA.textContent = fmtPct(m.A.bounce_rate);
    brB.textContent = fmtPct(m.B.bounce_rate);

    countsBox.textContent =
`A: users=${m.A.users}, sessions=${m.A.sessions}, pv=${m.A.page_views}, clicks=${m.A.clicks}, conv=${m.A.conversions}
B: users=${m.B.users}, sessions=${m.B.sessions}, pv=${m.B.page_views}, clicks=${m.B.clicks}, conv=${m.B.conversions}
events=${m.totals.events}  goals=${(m.goals||[]).join(", ")}`;

    topA.textContent = renderTop(m.A.top_clicked_elements);
    topB.textContent = renderTop(m.B.top_clicked_elements);
  }

  function badge(status) {
    const cls = status === "running" ? "running" : "paused";
    return `<span class="badge ${cls}">${status}</span>`;
  }

  function rowHtml(exp) {
    const status = exp.status || "paused";
    const key = exp.key || "(no key)";
    const urlPrefix = exp.url_prefix || "/";
    const version = exp.version || 0;

    const btnToggle = status === "running"
      ? `<button class="btn danger" data-act="pause" data-id="${exp.id}">Pause</button>`
      : `<button class="btn good" data-act="run" data-id="${exp.id}">Run</button>`;

    return `
      <tr>
        <td class="mono">${key}</td>
        <td>${badge(status)}</td>
        <td class="mono">${urlPrefix}</td>
        <td class="mono">v${version}</td>
        <td>${fmtDate(exp.updated_at)}</td>
        <td>
          <div style="display:flex; gap:8px; flex-wrap:wrap;">
            <button class="btn" data-act="metrics" data-key="${key}">Metrics</button>
            ${btnToggle}
            <a class="btn" href="/editor" target="_blank" rel="noopener">Open Editor</a>
            <button class="btn danger" data-act="del" data-id="${exp.id}">Delete</button>
          </div>
        </td>
      </tr>
    `;
  }

  async function render() {
    const exps = await fetchExperiments();
    expTbody.innerHTML = exps.length ? exps.map(rowHtml).join("") : `
      <tr><td colspan="6" class="muted">실험이 없습니다. /editor에서 Real 적용을 눌러 생성하세요.</td></tr>
    `;
  }

  expTbody.addEventListener("click", async (e) => {
    const btn = e.target.closest("button[data-act]");
    if (!btn) return;

    const act = btn.dataset.act;

    try {
      if (act === "metrics") {
        await showMetrics(btn.dataset.key);
      } else if (act === "pause") {
        await setStatus(btn.dataset.id, "paused");
        await render();
      } else if (act === "run") {
        await setStatus(btn.dataset.id, "running");
        await render();
      } else if (act === "del") {
        if (!confirm("정말 삭제할까요?")) return;
        await deleteExp(btn.dataset.id);
        await render();
      }
    } catch (err) {
      alert(String(err));
    }
  });

  refreshBtn.addEventListener("click", () => render());

  render().catch((e) => alert(String(e)));
})();