// analytics/pipeline.js

const { readEventsJsonl } = require("./events");
const { buildSessions } = require("./sessionize");
const { summarizeSession } = require("./sessionSummary");
const { labelSessionSummary } = require("./labeler");

function pickRepresentatives(labeledSessions, perLabel, sortBy) {
  const n = typeof perLabel === "number" ? perLabel : 3;
  const sorter = sortBy || ((a, b) => (b.label?.confidence || 0) - (a.label?.confidence || 0));

  const byLabel = new Map();
  for (const x of labeledSessions || []) {
    const lab = x?.label?.label || "unknown";
    if (!byLabel.has(lab)) byLabel.set(lab, []);
    byLabel.get(lab).push(x);
  }

  const out = new Map();
  for (const [lab, list] of byLabel.entries()) {
    const sorted = list.slice().sort(sorter);
    out.set(lab, sorted.slice(0, n));
  }
  return out;
}

async function computeSessionsFromJsonl(filePath, opts) {
  const {
    site_id,
    from_ts,
    to_ts,
    limit_events,
    session_ttl_ms
  } = opts || {};

  const events = await readEventsJsonl(filePath, {
    siteId: site_id,
    fromTs: from_ts,
    toTs: to_ts,
    limit: limit_events
  });

  const sessions = buildSessions(events, { sessionTtlMs: session_ttl_ms });
  return sessions;
}

async function computeSessionSummaries(filePath, opts) {
  const sessions = await computeSessionsFromJsonl(filePath, opts);
  return sessions.map((s) => summarizeSession(s)).filter(Boolean);
}

async function computeLabeledSessionSummaries(filePath, opts) {
  const summaries = await computeSessionSummaries(filePath, opts);
  return summaries.map((s) => ({
    summary: s,
    label: labelSessionSummary(s)
  }));
}

function computeLabelsSummary(labeledSessions) {
  const list = Array.isArray(labeledSessions) ? labeledSessions : [];
  const total = list.length || 1;

  const by = new Map();
  for (const x of list) {
    const lab = x?.label?.label || "unknown";
    if (!by.has(lab)) by.set(lab, []);
    by.get(lab).push(x);
  }

  const out = [];
  for (const [label, items] of by.entries()) {
    const sessions = items.length;
    const share = sessions / total;
    const avg = (arr) => {
      const nums = arr.filter((n) => typeof n === "number" && isFinite(n));
      if (nums.length === 0) return 0;
      return nums.reduce((a, b) => a + b, 0) / nums.length;
    };

    const avg_duration_ms = avg(items.map((x) => x.summary?.duration_ms));
    const avg_depth = avg(items.map((x) => x.summary?.depth));
    const checkout_complete_rate = avg(items.map((x) => (x.summary?.checkout_complete ? 1 : 0)));

    out.push({
      label,
      sessions,
      share,
      metrics: {
        avg_duration_ms,
        avg_depth,
        checkout_complete_rate
      }
    });
  }

  out.sort((a, b) => b.sessions - a.sessions);
  return out;
}

function buildInsightsInput(site_id, labeledSessions, opts) {
  const { perLabelRepresentatives = 3 } = opts || {};
  const labelsSummary = computeLabelsSummary(labeledSessions);
  const reps = pickRepresentatives(labeledSessions, perLabelRepresentatives);

  const labels = labelsSummary.map((x) => {
    const list = reps.get(x.label) || [];
    return {
      label: x.label,
      sessions: x.sessions,
      share: x.share,
      representatives: list.map((y) => ({
        session_id: y.summary?.session_id,
        anon_user_id: y.summary?.anon_user_id,
        summary: y.summary,
        evidence: y.label?.evidence || []
      }))
    };
  });

  return {
    site_id,
    generated_at: Date.now(),
    labels
  };
}

module.exports = {
  computeSessionsFromJsonl,
  computeSessionSummaries,
  computeLabeledSessionSummaries,
  computeLabelsSummary,
  buildInsightsInput
};
