// server.js
const express = require("express");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const {
  computeLabeledSessionSummaries,
  computeLabelsSummary,
  buildInsightsInput
} = require("./analytics/pipeline");
const { generateInsights } = require("./insights/generator");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "5mb" }));
app.use(express.static(path.join(__dirname, "public")));

// pages
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));
app.get("/detail", (req, res) => res.sendFile(path.join(__dirname, "public", "detail.html")));
app.get("/checkout", (req, res) => res.sendFile(path.join(__dirname, "public", "checkout.html")));
app.get("/editor", (req, res) => res.sendFile(path.join(__dirname, "public", "editor.html")));
app.get("/dashboard", (req, res) => res.sendFile(path.join(__dirname, "public", "dashboard.html")));

// data dir
const DATA_DIR = path.join(__dirname, "data");
const EVENTS_FILE = path.join(DATA_DIR, "events.jsonl");
const EXP_FILE = path.join(DATA_DIR, "experiments.json");

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(EXP_FILE)) fs.writeFileSync(EXP_FILE, JSON.stringify({ experiments: [] }, null, 2), "utf8");

// ---------- utils ----------
function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); }
  catch { return null; }
}
function writeJson(file, obj) {
  fs.writeFileSync(file, JSON.stringify(obj, null, 2), "utf8");
}
function now() { return Date.now(); }
function rid() { return crypto.randomBytes(8).toString("hex"); }
function safeParseJsonLine(line) {
  try { return JSON.parse(line); } catch { return null; }
}

function toNum(x) {
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}

function toInt(x) {
  const n = Math.trunc(Number(x));
  return Number.isFinite(n) ? n : null;
}

// ---------- collect endpoint ----------
app.post("/collect", (req, res) => {
  const payload = req.body;
  const events = Array.isArray(payload?.events) ? payload.events : [];
  if (events.length === 0) return res.status(400).json({ ok: false, reason: "no events" });

  const received_at = Date.now();
  const request_id = rid();

  const lines = events.map((e) =>
    JSON.stringify({ ...e, received_at, request_id })
  );

  fs.appendFileSync(EVENTS_FILE, lines.join("\n") + "\n", "utf8");
  console.log("✅ collect:", events[events.length - 1]?.event_name, "count=", events.length);

  return res.json({ ok: true, received: events.length });
});

// ---------- Experiment API (MVP) ----------
// experiment = { id, site_id, key, status:"draft"|"running"|"paused", url_prefix, traffic, variants, goals, updated_at, published_at, version }

function loadDb() {
  return readJson(EXP_FILE) || { experiments: [] };
}
function saveDb(db) {
  writeJson(EXP_FILE, db);
}

app.post("/api/experiments/real-apply", (req, res) => {
  const {
    site_id = "ab-sample",
    key,
    url_prefix,
    traffic = { A: 50, B: 50 },
    goals = ["checkout_complete"],
    variants
  } = req.body || {};

  if (!key || !url_prefix || !variants || !variants.A || !variants.B) {
    return res.status(400).json({ ok: false, reason: "missing key/url_prefix/variants" });
  }

  const db = loadDb();
  const idx = db.experiments.findIndex((x) => x.site_id === site_id && x.key === key);

  const base = {
    id: idx >= 0 ? db.experiments[idx].id : rid(),
    site_id,
    key,
    url_prefix,
    traffic,
    goals,
    variants,
    status: "running",
    updated_at: now(),
    published_at: now(),
    version: idx >= 0 ? (db.experiments[idx].version || 0) + 1 : 1
  };

  if (idx >= 0) db.experiments[idx] = base;
  else db.experiments.push(base);

  saveDb(db);
  return res.json({ ok: true, experiment: base });
});

// list
app.get("/api/experiments", (req, res) => {
  const site_id = req.query.site_id || "ab-sample";
  const db = loadDb();
  const list = db.experiments
    .filter((x) => x.site_id === site_id)
    .sort((a, b) => (b.updated_at || 0) - (a.updated_at || 0));
  return res.json({ ok: true, experiments: list });
});

// update status
app.patch("/api/experiments/:id", (req, res) => {
  const { id } = req.params;
  const { status } = req.body || {};
  if (!["running", "paused"].includes(status)) {
    return res.status(400).json({ ok: false, reason: "status must be running|paused" });
  }

  const db = loadDb();
  const idx = db.experiments.findIndex((x) => x.id === id);
  if (idx < 0) return res.status(404).json({ ok: false, reason: "not found" });

  db.experiments[idx].status = status;
  db.experiments[idx].updated_at = now();
  saveDb(db);

  return res.json({ ok: true, experiment: db.experiments[idx] });
});

// delete
app.delete("/api/experiments/:id", (req, res) => {
  const { id } = req.params;
  const db = loadDb();
  const before = db.experiments.length;
  db.experiments = db.experiments.filter((x) => x.id !== id);
  if (db.experiments.length === before) return res.status(404).json({ ok: false, reason: "not found" });
  saveDb(db);
  return res.json({ ok: true });
});

// SDK config: running only + URL prefix match
app.get("/api/config", (req, res) => {
  const site_id = req.query.site_id || "ab-sample";
  const url = String(req.query.url || "");
  const pathname = (() => {
    try { return new URL(url).pathname; } catch { return url || "/"; }
  })();

  const db = loadDb();
  const running = db.experiments
    .filter((x) => x.site_id === site_id && x.status === "running")
    .filter((x) => pathname.startsWith(x.url_prefix))
    .map((x) => ({
      key: x.key,
      url_prefix: x.url_prefix,
      traffic: x.traffic,
      goals: x.goals,
      variants: x.variants,
      version: x.version,
      published_at: x.published_at
    }));

  return res.json({ ok: true, site_id, pathname, experiments: running });
});

// ---------- Metrics (events.jsonl 기반) ----------
/**
 * GET /api/metrics?site_id=ab-sample&key=exp_checkout_cta_v1
 * returns A/B metrics:
 * - sessions, users, page_views, clicks, conversions(goal), cvr, bounce_rate
 * - top_clicked_elements
 *
 * MVP: events.jsonl 전체를 읽어서 집계(데이터 커지면 스트리밍/DB로 이동 권장)
 */
app.get("/api/metrics", (req, res) => {
  const site_id = req.query.site_id || "ab-sample";
  const key = String(req.query.key || "");
  if (!key) return res.status(400).json({ ok: false, reason: "missing key" });

  const db = loadDb();
  const exp = db.experiments.find((x) => x.site_id === site_id && x.key === key);
  if (!exp) return res.status(404).json({ ok: false, reason: "experiment not found" });

  const goals = Array.isArray(exp.goals) && exp.goals.length ? exp.goals : ["checkout_complete"];

  const lines = fs.existsSync(EVENTS_FILE) ? fs.readFileSync(EVENTS_FILE, "utf8").split("\n") : [];
  const events = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    const e = safeParseJsonLine(line);
    if (!e) continue;
    if (e.site_id !== site_id) continue;

    // experiments 메타 안에 해당 key가 있는 이벤트만
    const exps = Array.isArray(e.experiments) ? e.experiments : [];
    const hit = exps.find((x) => x && x.key === key);
    if (!hit) continue;

    events.push({
      event_name: e.event_name,
      anon_user_id: e.anon_user_id,
      session_id: e.session_id,
      path: e.path,
      props: e.props || {},
      exp_variant: hit.variant || "A"
    });
  }

  function initVariant() {
    return {
      users: new Set(),
      sessions: new Set(),
      page_views: 0,
      clicks: 0,
      conversions: 0,
      // session -> {pageViews, totalEvents}
      sessionStats: new Map(),
      // element_id -> count
      clickElements: new Map()
    };
  }

  const byV = { A: initVariant(), B: initVariant() };

  for (const e of events) {
    const v = e.exp_variant === "B" ? "B" : "A";
    const b = byV[v];

    if (e.anon_user_id) b.users.add(e.anon_user_id);
    if (e.session_id) b.sessions.add(e.session_id);

    const sid = e.session_id || "no_session";
    if (!b.sessionStats.has(sid)) b.sessionStats.set(sid, { pageViews: 0, totalEvents: 0 });
    const st = b.sessionStats.get(sid);
    st.totalEvents++;

    if (e.event_name === "page_view") {
      b.page_views++;
      st.pageViews++;
    }

    if (e.event_name === "click") {
      b.clicks++;
      const elid = e.props?.element_id || "(no_element_id)";
      b.clickElements.set(elid, (b.clickElements.get(elid) || 0) + 1);
    }

    if (goals.includes(e.event_name)) {
      b.conversions++;
    }
  }

  function finalize(bucket) {
    const sessions = bucket.sessions.size;
    const users = bucket.users.size;

    // bounce: session에서 page_view 1회이고 totalEvents 1(=page_view만)인 경우
    let bounces = 0;
    for (const st of bucket.sessionStats.values()) {
      if (st.pageViews === 1 && st.totalEvents === 1) bounces++;
    }
    const bounce_rate = sessions > 0 ? bounces / sessions : 0;

    const cvr = sessions > 0 ? bucket.conversions / sessions : 0;
    const ctr = bucket.page_views > 0 ? bucket.clicks / bucket.page_views : 0;

    // top clicked
    const top_clicked_elements = Array.from(bucket.clickElements.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([element_id, count]) => ({ element_id, count }));

    return {
      users,
      sessions,
      page_views: bucket.page_views,
      clicks: bucket.clicks,
      conversions: bucket.conversions,
      cvr,
      ctr,
      bounce_rate,
      top_clicked_elements
    };
  }

  const out = {
    ok: true,
    site_id,
    key,
    goals,
    experiment: {
      id: exp.id,
      status: exp.status,
      url_prefix: exp.url_prefix,
      version: exp.version,
      published_at: exp.published_at
    },
    A: finalize(byV.A),
    B: finalize(byV.B),
    totals: { events: events.length }
  };

  return res.json(out);
});

// ---------- Sessions / Labels / Insights (UX-Stream v1) ----------
// NOTE: 현재는 JSONL 기반 MVP. (대용량에서는 range query/DB/streaming 권장)

app.get("/api/sessions", async (req, res) => {
  const site_id = String(req.query.site_id || "ab-sample");
  const from_ts = toNum(req.query.from_ts);
  const to_ts = toNum(req.query.to_ts);
  const limit_sessions = Math.max(1, Math.min(200, toInt(req.query.limit) ?? 50));
  const limit_events = Math.max(100, Math.min(200_000, toInt(req.query.limit_events) ?? 50_000));

  try {
    const labeled = await computeLabeledSessionSummaries(EVENTS_FILE, {
      site_id,
      from_ts,
      to_ts,
      limit_events,
      session_ttl_ms: 30 * 60 * 1000
    });

    const sessions = labeled
      .slice(0, limit_sessions)
      .map((x) => ({
        summary: x.summary,
        label: x.label
      }));

    return res.json({ ok: true, site_id, from_ts, to_ts, sessions });
  } catch (e) {
    return res.status(500).json({ ok: false, reason: String(e) });
  }
});

app.get("/api/labels/summary", async (req, res) => {
  const site_id = String(req.query.site_id || "ab-sample");
  const from_ts = toNum(req.query.from_ts);
  const to_ts = toNum(req.query.to_ts);
  const limit_events = Math.max(100, Math.min(200_000, toInt(req.query.limit_events) ?? 100_000));

  try {
    const labeled = await computeLabeledSessionSummaries(EVENTS_FILE, {
      site_id,
      from_ts,
      to_ts,
      limit_events,
      session_ttl_ms: 30 * 60 * 1000
    });

    const summary = computeLabelsSummary(labeled);
    return res.json({ ok: true, site_id, from_ts, to_ts, summary });
  } catch (e) {
    return res.status(500).json({ ok: false, reason: String(e) });
  }
});

app.get("/api/insights", async (req, res) => {
  const site_id = String(req.query.site_id || "ab-sample");
  const from_ts = toNum(req.query.from_ts);
  const to_ts = toNum(req.query.to_ts);
  const limit_events = Math.max(100, Math.min(200_000, toInt(req.query.limit_events) ?? 150_000));
  const reps = Math.max(1, Math.min(5, toInt(req.query.reps) ?? 3));
  const provider = typeof req.query.provider === "string" ? req.query.provider : undefined;
  const model = typeof req.query.model === "string" ? req.query.model : undefined;
  const include_prompt = String(req.query.include_prompt || "") === "1";

  try {
    const labeled = await computeLabeledSessionSummaries(EVENTS_FILE, {
      site_id,
      from_ts,
      to_ts,
      limit_events,
      session_ttl_ms: 30 * 60 * 1000
    });

    const input = buildInsightsInput(site_id, labeled, { perLabelRepresentatives: reps });
    const result = await generateInsights(input, { provider, model });
    return res.json({
      ok: true,
      provider: result.provider,
      model: result.model,
      fallback_reason: result.fallbackReason || null,
      input,
      output: result.output,
      prompt: include_prompt ? result.prompt : undefined
    });
  } catch (e) {
    return res.status(500).json({ ok: false, reason: String(e) });
  }
});

app.listen(PORT, () => {
  console.log(`✅ AB Sample running: http://localhost:${PORT}`);
  console.log(`📦 collecting events to: ${EVENTS_FILE}`);
  console.log(`🧪 experiments file: ${EXP_FILE}`);
  console.log(`📊 dashboard: http://localhost:${PORT}/dashboard`);
  console.log(`🧩 sessions api: http://localhost:${PORT}/api/sessions`);
  console.log(`🏷️  labels summary: http://localhost:${PORT}/api/labels/summary`);
  console.log(`💡 insights: http://localhost:${PORT}/api/insights`);
});
