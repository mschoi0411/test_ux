const test = require("node:test");
const assert = require("node:assert/strict");

const { listPersonas, makeBase, generateSessionEvents } = require("../personas");

test("persona catalog exposes weighted personas", () => {
  const personas = listPersonas();
  assert.equal(personas.length, 5);
  for (const persona of personas) {
    assert.equal(typeof persona.id, "string");
    assert.equal(Array.isArray(persona.timeline), true);
    assert.equal(persona.timeline.length > 0, true);
  }
});

test("generateSessionEvents builds timestamped events for a persona", () => {
  const base = makeBase({
    site_id: "ab-sample",
    anon_user_id: "u_test",
    session_id: "s_test"
  });

  const events = generateSessionEvents({
    personaId: "checkout_abandoner",
    base,
    startTs: 1000,
    rng: () => 0.1
  });

  assert.equal(events.length, 3);
  assert.equal(events[0].event_name, "page_view");
  assert.equal(events[0].path, "/checkout");
  assert.equal(events[2].props.reason, "beforeunload");
  assert.equal(events[2].ts > events[0].ts, true);
});
