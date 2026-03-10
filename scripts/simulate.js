// scripts/simulate.js
// Simple traffic simulator: generate events and POST to /collect

function now() {
  return Date.now();
}

function arg(name, def) {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx >= 0 && process.argv[idx + 1]) return process.argv[idx + 1];
  return def;
}

function intArg(name, def) {
  const v = Number(arg(name, def));
  return Number.isFinite(v) ? Math.trunc(v) : def;
}

function randChoice(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function makeBase({ site_id, anon_user_id, session_id }) {
  return {
    schema_version: 1,
    app_id: "ux-stream-sim",
    site_id,
    anon_user_id,
    session_id,
    url: "http://localhost:3000/",
    referrer: null,
    user_agent: "ux-stream-sim",
    lang: "ko-KR",
    screen: { w: 1920, h: 1080 },
    viewport: { w: 1200, h: 800 }
  };
}

function ev(base, event_name, path, props, ts) {
  return {
    ...base,
    event_name,
    ts: ts ?? now(),
    path,
    props: props || {}
  };
}

function generateSessionEvents(base, persona, t0) {
  const events = [];
  const t = (ms) => t0 + ms;

  if (persona === "ux_friction_dropper") {
    events.push(ev(base, "page_view", "/checkout", { title: "Checkout" }, t(0)));
    events.push(ev(base, "click", "/checkout", { element_id: "pay_btn" }, t(800)));
    events.push(ev(base, "error", "/checkout", { message: "payment failed", code: "E_SIM" }, t(1200)));
    events.push(ev(base, "dwell_time", "/checkout", { dwell_ms: 5000, reason: "pagehide" }, t(5000)));
    return events;
  }

  if (persona === "checkout_abandoner") {
    events.push(ev(base, "page_view", "/checkout", { title: "Checkout" }, t(0)));
    events.push(ev(base, "click", "/checkout", { element_id: "pay_btn" }, t(1500)));
    events.push(ev(base, "dwell_time", "/checkout", { dwell_ms: 65000, reason: "beforeunload" }, t(65000)));
    return events;
  }

  if (persona === "price_sensitive_dropper") {
    events.push(ev(base, "page_view", "/detail", { title: "Detail" }, t(0)));
    events.push(ev(base, "click", "/detail", { element_id: "price_toggle" }, t(1200)));
    events.push(ev(base, "click", "/detail", { element_id: "coupon_open" }, t(2200)));
    events.push(ev(base, "click", "/detail", { element_id: "shipping_fee_info" }, t(4200)));
    events.push(ev(base, "dwell_time", "/detail", { dwell_ms: 20000, reason: "pagehide" }, t(20000)));
    return events;
  }

  if (persona === "over_explorer") {
    const paths = ["/", "/category", "/search", "/detail", "/category", "/detail"];
    paths.forEach((p, i) => events.push(ev(base, "page_view", p, { title: p }, t(i * 15000))));
    events.push(ev(base, "dwell_time", "/detail", { dwell_ms: 120000, reason: "pagehide" }, t(120000)));
    return events;
  }

  // window_shopper
  events.push(ev(base, "page_view", "/", { title: "Home" }, t(0)));
  if (Math.random() < 0.5) events.push(ev(base, "click", "/", { element_id: "open_detail_neo" }, t(2000)));
  events.push(ev(base, "dwell_time", "/", { dwell_ms: 10000, reason: "pagehide" }, t(10000)));
  return events;
}

async function postEvents(endpoint, events) {
  const r = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ events })
  });
  if (!r.ok) {
    const txt = await r.text().catch(() => "");
    throw new Error(`collect failed: ${r.status} ${txt}`);
  }
  return r.json();
}

async function main() {
  const baseUrl = arg("base", "http://localhost:3000");
  const endpoint = arg("endpoint", `${baseUrl.replace(/\/$/, "")}/collect`);
  const site_id = arg("site", "ab-sample");
  const users = Math.max(1, intArg("users", 50));
  const sessionsPerUser = Math.max(1, intArg("sessions", 1));

  const personas = [
    "over_explorer",
    "price_sensitive_dropper",
    "window_shopper",
    "ux_friction_dropper",
    "checkout_abandoner"
  ];

  let sent = 0;
  const t0 = now();

  for (let u = 0; u < users; u++) {
    const anon_user_id = `sim_u_${u}`;
    for (let s = 0; s < sessionsPerUser; s++) {
      const session_id = `sim_s_${u}_${s}_${t0}`;
      const persona = randChoice(personas);
      const base = makeBase({ site_id, anon_user_id, session_id });
      const events = generateSessionEvents(base, persona, t0 + (u * 1000) + (s * 100));
      await postEvents(endpoint, events);
      sent += events.length;
    }
  }

  console.log(`ok: posted events=${sent} to ${endpoint}`);
}

main().catch((e) => {
  console.error(String(e));
  process.exitCode = 1;
});
