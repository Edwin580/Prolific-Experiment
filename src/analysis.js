/**
 * Pure analysis helpers used by the end-of-study results dashboard (and
 * reusable offline). Input is plain row objects as produced by jsPsych, so
 * this runs unchanged in the browser and in Node (see tests/analysis.test.js).
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.BPE_ANALYSIS = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const CATEGORIES = ["positive", "neutral", "negative"];

  const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

  function sd(xs) {
    if (xs.length < 2) return null;
    const m = mean(xs);
    return Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / (xs.length - 1));
  }

  /**
   * Inverse of the standard normal CDF (Acklam's rational approximation,
   * relative error < 1.15e-9). Used for d′.
   */
  function probit(p) {
    if (p <= 0 || p >= 1) throw new RangeError("probit: p must be in (0, 1)");
    const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.38357751867269e2, -3.066479806614716e1, 2.506628277459239];
    const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1];
    const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
    const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416];
    const lo = 0.02425;
    let q, r;
    if (p < lo) {
      q = Math.sqrt(-2 * Math.log(p));
      return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
    }
    if (p > 1 - lo) {
      q = Math.sqrt(-2 * Math.log(1 - p));
      return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
    }
    q = p - 0.5;
    r = q * q;
    return ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  }

  /**
   * Signal-detection sensitivity with the log-linear correction
   * (Hautus, 1995), which keeps d′ finite when a rate is 0 or 1.
   */
  function dPrime(hits, misses, falseAlarms, correctRejections) {
    const hr = (hits + 0.5) / (hits + misses + 1);
    const far = (falseAlarms + 0.5) / (falseAlarms + correctRejections + 1);
    return probit(hr) - probit(far);
  }

  /**
   * Summarise one participant.
   * @param {object[]} rows all jsPsych data rows
   * @param {{min_valid_rt_ms:number, max_valid_rt_ms:number}} opts
   */
  function summarize(rows, opts) {
    const test = rows.filter((r) => r.task === "test");
    const valid = (r) => r.response != null && r.rt >= opts.min_valid_rt_ms && r.rt <= opts.max_valid_rt_ms;

    const byCategory = {};
    for (const cat of CATEGORIES) {
      const trials = test.filter((r) => r.category === cat);
      const ok = trials.filter(valid);
      const brighter = ok.filter((r) => r.response === "brighter").length;
      const rts = ok.map((r) => r.rt);
      byCategory[cat] = {
        n: trials.length,
        n_valid: ok.length,
        p_brighter: ok.length ? brighter / ok.length : null,
        mean_rt: mean(rts),
        sd_rt: sd(rts),
      };
    }

    const pos = byCategory.positive.p_brighter;
    const neg = byCategory.negative.p_brighter;

    // Cover task: a hit is pressing the repeat key on the second showing of a
    // repeated word; a false alarm is pressing it on any other trial.
    const targets = test.filter((r) => r.is_repeat);
    const lures = test.filter((r) => !r.is_repeat);
    const hits = targets.filter((r) => r.repeat_pressed).length;
    const fas = lures.filter((r) => r.repeat_pressed).length;
    const cover = {
      targets: targets.length,
      hits,
      false_alarms: fas,
      hit_rate: targets.length ? hits / targets.length : null,
      false_alarm_rate: lures.length ? fas / lures.length : null,
      d_prime: targets.length && lures.length ? dPrime(hits, targets.length - hits, fas, lures.length - fas) : null,
    };

    // Manipulation check: do the participant's own valence ratings agree with
    // the a-priori categories?
    const ratings = rows.filter((r) => r.task === "valence" && r.rating);
    const confusion = {};
    for (const a of CATEGORIES) {
      confusion[a] = {};
      for (const b of CATEGORIES) confusion[a][b] = 0;
    }
    for (const r of ratings) if (confusion[r.category]) confusion[r.category][r.rating]++;
    const agree = ratings.filter((r) => r.rating === r.category).length;

    const practice = rows.filter((r) => r.task === "practice");
    const timing = test.map((r) => r.word_duration_measured).filter((x) => x != null);

    return {
      by_category: byCategory,
      // Positive minus negative proportion of "brighter" judgements. The
      // hypothesis predicts > 0 (positive words make identical squares look brighter).
      valence_effect: pos != null && neg != null ? pos - neg : null,
      cover,
      valence_ratings: { n: ratings.length, agreement: ratings.length ? agree / ratings.length : null, confusion },
      practice_accuracy: practice.length ? practice.filter((r) => r.correct).length / practice.length : null,
      excluded_trials: test.length - test.filter(valid).length,
      word_duration: { mean: mean(timing), sd: sd(timing) },
    };
  }

  return { CATEGORIES, mean, sd, probit, dPrime, summarize };
});
