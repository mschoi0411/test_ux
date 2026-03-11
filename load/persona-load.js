import http from "k6/http";
import exec from "k6/execution";
import { check, sleep } from "k6";

const catalog = JSON.parse(open("../personas/catalog.json"));
const personas = Array.isArray(catalog.personas) ? catalog.personas : [];

const BASE_URL = (__ENV.K6_BASE_URL || catalog.defaults?.base_url || "http://localhost:3000").replace(/\/$/, "");
const ENDPOINT = `${BASE_URL}${__ENV.K6_ENDPOINT_PATH || "/collect"}`;
const SITE_ID = __ENV.K6_SITE_ID || catalog.defaults?.site_id || "ab-sample";
const BASE_RATE = Math.max(1, Number(__ENV.K6_BASE_RATE || 12));
const PRE_ALLOCATED_VUS = Math.max(1, Number(__ENV.K6_PRE_ALLOCATED_VUS || 24));
const MAX_VUS = Math.max(PRE_ALLOCATED_VUS, Number(__ENV.K6_MAX_VUS || 120));
const RAMP_UP = __ENV.K6_RAMP_UP || "30s";
const STEADY = __ENV.K6_STEADY || "1m";
const RAMP_DOWN = __ENV.K6_RAMP_DOWN || "30s";
const SESSION_PAUSE_MS = Math.max(0, Number(__ENV.K6_SESSION_PAUSE_MS || 500));

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function buildBase(identity) {
  return {
    schema_version: 1,
    app_id: catalog.defaults?.app_id || "ux-stream-sim",
    site_id: SITE_ID,
    anon_user_id: identity.anon_user_id,
    session_id: identity.session_id,
    url: `${BASE_URL}/`,
    referrer: null,
    user_agent: `k6-persona/${identity.persona_id}`,
    lang: catalog.defaults?.lang || "ko-KR",
    screen: clone(catalog.defaults?.screen || { w: 1920, h: 1080 }),
    viewport: clone(catalog.defaults?.viewport || { w: 1200, h: 800 })
  };
}

function generateEvents(persona, startTs) {
  let ts = startTs;
  const base = buildBase({
    anon_user_id: `k6_u_${exec.vu.idInTest}_${exec.scenario.iterationInTest}`,
    session_id: `k6_s_${persona.id}_${exec.vu.idInTest}_${exec.scenario.iterationInTest}`,
    persona_id: persona.id
  });

  const events = [];
  for (const step of persona.timeline || []) {
    const afterMs = Number(step.after_ms);
    ts += Number.isFinite(afterMs) ? afterMs : 0;

    const probability = Number(step.probability);
    if (Number.isFinite(probability) && probability >= 0 && probability < 1 && Math.random() > probability) {
      continue;
    }

    events.push({
      ...base,
      event_name: String(step.event_name || ""),
      ts,
      path: String(step.path || "/"),
      props: clone(step.props || {}),
      persona_id: persona.id
    });
  }

  return events;
}

function weightedTarget(weight) {
  return Math.max(1, Math.round(BASE_RATE * weight));
}

function preAllocatedFor(weight) {
  return Math.max(1, Math.round(PRE_ALLOCATED_VUS * weight));
}

function maxVusFor(weight) {
  return Math.max(preAllocatedFor(weight), Math.round(MAX_VUS * weight));
}

const scenarios = {};
for (const persona of personas) {
  const weight = Number(persona.weight) || 0;
  scenarios[persona.id] = {
    executor: "ramping-arrival-rate",
    exec: "runPersonaScenario",
    timeUnit: "1s",
    startRate: 1,
    preAllocatedVUs: preAllocatedFor(weight),
    maxVUs: maxVusFor(weight),
    stages: [
      { target: weightedTarget(weight), duration: RAMP_UP },
      { target: weightedTarget(weight), duration: STEADY },
      { target: 0, duration: RAMP_DOWN }
    ],
    tags: {
      persona: persona.id,
      kind: "collect"
    }
  };
}

export const options = {
  scenarios,
  thresholds: {
    "http_req_failed{kind:collect}": ["rate<0.05"],
    "http_req_duration{kind:collect}": ["p(95)<1500"]
  }
};

export function runPersonaScenario() {
  const persona = personas.find((item) => item.id === exec.scenario.name);
  if (!persona) {
    throw new Error(`unknown scenario persona: ${exec.scenario.name}`);
  }

  const response = http.post(
    ENDPOINT,
    JSON.stringify({ events: generateEvents(persona, Date.now()) }),
    {
      headers: { "content-type": "application/json" },
      tags: { persona: persona.id, kind: "collect" },
      timeout: "30s"
    }
  );

  check(response, {
    "collect returns 200": (res) => res.status === 200,
    "collect acknowledges events": (res) => {
      try {
        const body = JSON.parse(res.body || "{}");
        return body.ok === true && Number(body.received) > 0;
      } catch {
        return false;
      }
    }
  });

  sleep(SESSION_PAUSE_MS / 1000);
}

export function handleSummary(data) {
  return {
    "load/k6-summary.json": JSON.stringify(
      {
        generated_at: Date.now(),
        endpoint: ENDPOINT,
        site_id: SITE_ID,
        scenarios: Object.keys(scenarios),
        metrics: data.metrics
      },
      null,
      2
    )
  };
}
