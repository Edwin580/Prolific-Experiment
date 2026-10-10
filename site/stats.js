/**
 * Statistics for the power simulator on the project page.
 * Pure functions, no DOM, so they run in the browser and in Node tests.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.BPE_STATS = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // Small, fast, seedable PRNG (mulberry32).
  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Box Muller.
  function normal(rand) {
    let u = 0;
    while (u === 0) u = rand();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand());
  }

  function binomial(rand, n, p) {
    let k = 0;
    for (let i = 0; i < n; i++) if (rand() < p) k++;
    return k;
  }

  // Standard normal CDF via erf (Abramowitz and Stegun 7.1.26, error < 1.5e-7).
  function normCdf(x) {
    const t = 1 / (1 + 0.3275911 * Math.abs(x) / Math.SQRT2);
    const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-(x * x) / 2);
    return x >= 0 ? 0.5 * (1 + y) : 0.5 * (1 - y);
  }

  function logGamma(x) {
    const g = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
    let y = x;
    const tmp = x + 5.5 - (x + 0.5) * Math.log(x + 5.5);
    let ser = 1.000000000190015;
    for (const c of g) ser += c / ++y;
    return -tmp + Math.log((2.5066282746310005 * ser) / x);
  }

  // Continued fraction for the regularized incomplete beta (Numerical Recipes, betacf).
  function betacf(a, b, x) {
    const EPS = 3e-14, FPMIN = 1e-300;
    let c = 1, d = 1 - ((a + b) * x) / (a + 1);
    if (Math.abs(d) < FPMIN) d = FPMIN;
    d = 1 / d;
    let h = d;
    for (let m = 1; m <= 200; m++) {
      const m2 = 2 * m;
      let aa = (m * (b - m) * x) / ((a + m2 - 1) * (a + m2));
      d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
      c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
      d = 1 / d; h *= d * c;
      aa = (-(a + m) * (a + b + m) * x) / ((a + m2) * (a + m2 + 1));
      d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
      c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
      d = 1 / d;
      const del = d * c;
      h *= del;
      if (Math.abs(del - 1) < EPS) break;
    }
    return h;
  }

  function incBeta(a, b, x) {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    const bt = Math.exp(logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x));
    return x < (a + 1) / (a + b + 2) ? (bt * betacf(a, b, x)) / a : 1 - (bt * betacf(b, a, 1 - x)) / b;
  }

  /** Two sided p value for Student's t with df degrees of freedom. */
  function tTwoSided(t, df) {
    if (!Number.isFinite(t)) return 0;
    return incBeta(df / 2, 0.5, df / (df + t * t));
  }

  function oneSampleT(xs) {
    const n = xs.length;
    const m = xs.reduce((a, b) => a + b, 0) / n;
    const v = xs.reduce((a, x) => a + (x - m) ** 2, 0) / (n - 1);
    const t = v === 0 ? (m === 0 ? 0 : Infinity * Math.sign(m)) : m / Math.sqrt(v / n);
    return { mean: m, t, df: n - 1, p: tTwoSided(t, n - 1) };
  }

  /**
   * Simulate one study. Each participant has a personal effect drawn from
   * N(effect, spread), split evenly around 50% "brighter", and answers
   * binomially on `trials` positive and `trials` negative trials.
   */
  function simulateStudy(rand, { effect, spread, n, trials }) {
    const diffs = new Array(n);
    for (let i = 0; i < n; i++) {
      const e = effect + spread * normal(rand);
      const clamp = (p) => Math.min(0.999, Math.max(0.001, p));
      const pos = binomial(rand, trials, clamp(0.5 + e / 2)) / trials;
      const neg = binomial(rand, trials, clamp(0.5 - e / 2)) / trials;
      diffs[i] = pos - neg;
    }
    return oneSampleT(diffs);
  }

  /**
   * Normal approximation to power for the same design. The per person
   * difference has variance spread² plus binomial noise from both cells.
   */
  function analyticPower({ effect, spread, n, trials }, z = 1.959964) {
    const sigma = Math.sqrt(spread * spread + (2 * 0.25) / trials);
    if (sigma === 0) return effect === 0 ? 0.05 : 1;
    const shift = (effect / sigma) * Math.sqrt(n);
    return 1 - normCdf(z - shift) + normCdf(-z - shift);
  }

  return { rng, normal, binomial, normCdf, incBeta, tTwoSided, oneSampleT, simulateStudy, analyticPower };
});
