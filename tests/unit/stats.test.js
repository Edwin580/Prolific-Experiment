const test = require("node:test");
const assert = require("node:assert/strict");
const S = require("../../site/stats.js");

const close = (a, b, tol) => assert.ok(Math.abs(a - b) < tol, `${a} not within ${tol} of ${b}`);

test("normal CDF matches known values", () => {
  close(S.normCdf(0), 0.5, 1e-7);
  close(S.normCdf(1.959964), 0.975, 1e-6);
  close(S.normCdf(-1), 0.158655, 1e-6);
});

test("two sided t p values match tables", () => {
  close(S.tTwoSided(2.228, 10), 0.05, 1e-3);
  close(S.tTwoSided(2.045, 29), 0.05, 1e-3);
  close(S.tTwoSided(0, 5), 1, 1e-9);
  close(S.tTwoSided(-2.228, 10), 0.05, 1e-3);
});

test("one sample t test", () => {
  const r = S.oneSampleT([1, 2, 3, 4, 5]);
  assert.equal(r.mean, 3);
  assert.equal(r.df, 4);
  close(r.t, 3 / Math.sqrt(2.5 / 5), 1e-12);
});

test("the seeded generator is reproducible", () => {
  const a = S.rng(42), b = S.rng(42);
  for (let i = 0; i < 100; i++) assert.equal(a(), b());
});

test("with no effect about 5% of simulated studies are significant", () => {
  const rand = S.rng(7);
  const p = { effect: 0, spread: 0.1, n: 40, trials: 24 };
  let sig = 0;
  for (let i = 0; i < 2000; i++) if (S.simulateStudy(rand, p).p < 0.05) sig++;
  close(sig / 2000, 0.05, 0.015);
});

test("simulated power agrees with the analytic approximation", () => {
  const rand = S.rng(11);
  const p = { effect: 0.06, spread: 0.1, n: 60, trials: 24 };
  let sig = 0;
  for (let i = 0; i < 2000; i++) if (S.simulateStudy(rand, p).p < 0.05) sig++;
  close(sig / 2000, S.analyticPower(p), 0.05);
});
