const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const { computeLabeledSessionSummaries, buildInsightsInput } = require("../analytics/pipeline");
const { generateInsights } = require("../insights/generator");

test("generateInsights returns fallback insight output matching labeled data", async () => {
  const fixture = path.join(__dirname, "..", "eval", "sample-events.jsonl");
  const labeled = await computeLabeledSessionSummaries(fixture, {
    site_id: "ab-sample",
    session_ttl_ms: 30 * 60 * 1000
  });

  const input = buildInsightsInput("ab-sample", labeled, { perLabelRepresentatives: 2 });
  const result = await generateInsights(input, { provider: "fallback" });

  assert.equal(result.provider, "fallback");
  assert.equal(result.output.site_id, "ab-sample");
  assert.equal(Array.isArray(result.output.insights), true);
  assert.equal(result.output.insights.length > 0, true);

  for (const insight of result.output.insights) {
    assert.equal(typeof insight.label, "string");
    assert.equal(typeof insight.where, "string");
    assert.equal(Array.isArray(insight.possible_causes), true);
    assert.equal(Array.isArray(insight.validation_methods), true);
    assert.equal(Array.isArray(insight.recommended_experiments), true);
  }
});
