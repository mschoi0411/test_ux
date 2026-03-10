const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const { computeLabeledSessionSummaries } = require("../analytics/pipeline");

test("rules labeler assigns expected labels for fixture sessions", async () => {
  const fixture = path.join(__dirname, "..", "eval", "sample-events.jsonl");
  const expectedPath = path.join(__dirname, "..", "eval", "expected-labels.json");
  const expected = require(expectedPath);

  const labeled = await computeLabeledSessionSummaries(fixture, {
    site_id: "ab-sample",
    session_ttl_ms: 30 * 60 * 1000
  });

  const bySid = new Map();
  for (const x of labeled) {
    const sid = x.summary?.session_id;
    if (sid) bySid.set(sid, x.label?.label);
  }

  for (const [sid, expLabel] of Object.entries(expected)) {
    assert.equal(bySid.get(sid), expLabel, `session ${sid} label mismatch`);
  }
});
