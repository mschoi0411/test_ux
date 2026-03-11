// scripts/simulate.js
// Simple traffic simulator: generate persona events and POST to /collect

const {
  listPersonas,
  samplePersonaId,
  makeBase,
  generateSessionEvents
} = require("../personas");

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
  const availablePersonaIds = listPersonas().map((persona) => persona.id);

  let sent = 0;
  const t0 = now();

  for (let u = 0; u < users; u++) {
    const anon_user_id = `sim_u_${u}`;
    for (let s = 0; s < sessionsPerUser; s++) {
      const session_id = `sim_s_${u}_${s}_${t0}`;
      const personaId = samplePersonaId();
      if (!availablePersonaIds.includes(personaId)) {
        throw new Error(`invalid sampled persona: ${String(personaId)}`);
      }

      const base = makeBase({ site_id, anon_user_id, session_id, base_url: `${baseUrl.replace(/\/$/, "")}/` });
      const events = generateSessionEvents({
        personaId,
        base,
        startTs: t0 + (u * 1000) + (s * 100)
      });
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
