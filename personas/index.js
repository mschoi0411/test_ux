const catalog = require("./catalog.json");

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function listPersonas() {
  return catalog.personas.map((persona) => clone(persona));
}

function getPersona(personaId) {
  return catalog.personas.find((persona) => persona.id === personaId) || null;
}

function normalizeWeight(value) {
  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? num : 0;
}

function samplePersonaId(rng) {
  const random = typeof rng === "function" ? rng : Math.random;
  const personas = catalog.personas;
  const totalWeight = personas.reduce((sum, persona) => sum + normalizeWeight(persona.weight), 0);
  if (totalWeight <= 0) return personas[0]?.id || null;

  let cursor = random() * totalWeight;
  for (const persona of personas) {
    cursor -= normalizeWeight(persona.weight);
    if (cursor <= 0) return persona.id;
  }

  return personas[personas.length - 1]?.id || null;
}

function makeBase(identity) {
  const defaults = catalog.defaults || {};
  const baseUrl = String(identity?.base_url || defaults.base_url || "http://localhost:3000/");

  return {
    schema_version: 1,
    app_id: defaults.app_id || "ux-stream-sim",
    site_id: String(identity?.site_id || defaults.site_id || "ab-sample"),
    anon_user_id: String(identity?.anon_user_id || ""),
    session_id: String(identity?.session_id || ""),
    url: baseUrl,
    referrer: null,
    user_agent: String(identity?.user_agent || "ux-stream-sim"),
    lang: defaults.lang || "ko-KR",
    screen: clone(defaults.screen || { w: 1920, h: 1080 }),
    viewport: clone(defaults.viewport || { w: 1200, h: 800 })
  };
}

function generateSessionEvents(input) {
  const persona = getPersona(input?.personaId);
  if (!persona) {
    throw new Error(`unknown persona: ${String(input?.personaId || "")}`);
  }

  const random = typeof input?.rng === "function" ? input.rng : Math.random;
  const base = input?.base || makeBase(input || {});
  const startTs = typeof input?.startTs === "number" ? input.startTs : Date.now();

  let ts = startTs;
  const events = [];
  for (const step of persona.timeline || []) {
    const afterMs = Number(step.after_ms);
    ts += Number.isFinite(afterMs) ? afterMs : 0;

    const probability = Number(step.probability);
    if (Number.isFinite(probability) && probability >= 0 && probability < 1 && random() > probability) {
      continue;
    }

    events.push({
      ...base,
      event_name: String(step.event_name || ""),
      ts,
      path: String(step.path || "/"),
      props: clone(step.props || {})
    });
  }

  return events;
}

module.exports = {
  catalog,
  listPersonas,
  getPersona,
  samplePersonaId,
  makeBase,
  generateSessionEvents
};
