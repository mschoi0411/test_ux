// analytics/sessionize.js

function sessionKey(e, derivedSessionId) {
  const u = e.anon_user_id || "(no_user)";
  const sid = e.session_id || derivedSessionId || "(no_session)";
  return `${u}|${sid}`;
}

function sortByTs(a, b) {
  return (a.ts || 0) - (b.ts || 0);
}

function buildSessions(events, opts) {
  const { sessionTtlMs = 30 * 60 * 1000 } = opts || {};

  // group by user first for derived session_id
  const byUser = new Map();
  for (const e of events || []) {
    const u = e.anon_user_id || "(no_user)";
    if (!byUser.has(u)) byUser.set(u, []);
    byUser.get(u).push(e);
  }

  const sessions = new Map();

  for (const [userId, list] of byUser.entries()) {
    list.sort(sortByTs);

    let derivedIdx = 0;
    let lastTs = null;
    let currentDerived = null;

    for (const e of list) {
      if (e.session_id) {
        const k = sessionKey(e, null);
        if (!sessions.has(k)) sessions.set(k, []);
        sessions.get(k).push(e);
        lastTs = e.ts;
        continue;
      }

      // derive session based on TTL gap
      if (typeof lastTs !== "number" || (e.ts - lastTs) > sessionTtlMs) {
        derivedIdx++;
        currentDerived = `derived_${userId}_${derivedIdx}`;
      }

      const k = sessionKey(e, currentDerived);
      if (!sessions.has(k)) sessions.set(k, []);
      sessions.get(k).push(e);
      lastTs = e.ts;
    }
  }

  const out = [];
  for (const [k, list] of sessions.entries()) {
    list.sort(sortByTs);
    const [anon_user_id, session_id] = String(k).split("|");
    out.push({
      anon_user_id,
      session_id,
      events: list
    });
  }

  out.sort((a, b) => {
    const ta = a.events[a.events.length - 1]?.ts || 0;
    const tb = b.events[b.events.length - 1]?.ts || 0;
    return tb - ta;
  });

  return out;
}

module.exports = {
  buildSessions
};
