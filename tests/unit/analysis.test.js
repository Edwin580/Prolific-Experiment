const test = require("node:test");
const assert = require("node:assert/strict");
const A = require("../../src/analysis.js");

const opts = { min_valid_rt_ms: 150, max_valid_rt_ms: 3000 };
const row = (o) => ({ task: "test", response: "brighter", rt: 500, is_repeat: false, repeat_pressed: false, ...o });

test("probit matches known quantiles", () => {
  assert.ok(Math.abs(A.probit(0.5)) < 1e-9);
  assert.ok(Math.abs(A.probit(0.975) - 1.959964) < 1e-5);
  assert.ok(Math.abs(A.probit(0.01) + 2.326348) < 1e-5);
  assert.ok(Math.abs(A.probit(0.2) + A.probit(0.8)) < 1e-9);
  assert.throws(() => A.probit(0));
});

test("dPrime is finite at perfect performance (log-linear correction)", () => {
  const d = A.dPrime(6, 0, 0, 74);
  assert.ok(Number.isFinite(d) && d > 3);
  assert.ok(Math.abs(A.dPrime(5, 5, 5, 5)) < 1e-9);
});

test("summarize: brightness proportions, valence effect and RT exclusions", () => {
  const rows = [
    row({ category: "positive", response: "brighter" }),
    row({ category: "positive", response: "brighter" }),
    row({ category: "positive", response: "darker" }),
    row({ category: "positive", response: "darker", rt: 90 }), // anticipation → excluded
    row({ category: "negative", response: "darker" }),
    row({ category: "negative", response: "brighter" }),
    row({ category: "neutral", response: null, rt: null }), // no response → excluded
    { task: "practice", correct: true },
    { task: "practice", correct: false },
  ];
  const s = A.summarize(rows, opts);
  assert.equal(s.by_category.positive.n, 4);
  assert.equal(s.by_category.positive.n_valid, 3);
  assert.equal(s.by_category.positive.p_brighter, 2 / 3);
  assert.equal(s.by_category.negative.p_brighter, 0.5);
  assert.equal(s.by_category.neutral.p_brighter, null);
  assert.ok(Math.abs(s.valence_effect - (2 / 3 - 0.5)) < 1e-12);
  assert.equal(s.excluded_trials, 2);
  assert.equal(s.practice_accuracy, 0.5);
});

test("summarize: cover task hits and false alarms", () => {
  const rows = [
    row({ category: "positive", is_repeat: true, repeat_pressed: true }),
    row({ category: "neutral", is_repeat: true, repeat_pressed: false }),
    row({ category: "neutral", repeat_pressed: true }),
    row({ category: "negative" }),
  ];
  const { cover } = A.summarize(rows, opts);
  assert.equal(cover.targets, 2);
  assert.equal(cover.hits, 1);
  assert.equal(cover.false_alarms, 1);
  assert.equal(cover.hit_rate, 0.5);
  assert.equal(cover.false_alarm_rate, 0.5);
  assert.ok(Math.abs(cover.d_prime) < 1e-9);
});

test("summarize: valence rating confusion matrix and agreement", () => {
  const rows = [
    { task: "valence", category: "positive", rating: "positive" },
    { task: "valence", category: "positive", rating: "neutral" },
    { task: "valence", category: "negative", rating: "negative" },
    { task: "valence", category: "neutral", rating: null },
  ];
  const v = A.summarize(rows, opts).valence_ratings;
  assert.equal(v.n, 3);
  assert.equal(v.agreement, 2 / 3);
  assert.equal(v.confusion.positive.neutral, 1);
  assert.equal(v.confusion.negative.negative, 1);
});

test("summarize handles an empty data set", () => {
  const s = A.summarize([], opts);
  assert.equal(s.valence_effect, null);
  assert.equal(s.cover.d_prime, null);
  assert.equal(s.practice_accuracy, null);
});
