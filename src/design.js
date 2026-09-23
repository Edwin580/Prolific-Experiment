/**
 * Pure design helpers: participant/mode resolution and trial-sequence
 * construction. No DOM and no jsPsych dependency, so everything here is unit
 * tested in Node (see tests/design.test.js).
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.BPE_DESIGN = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const SIMULATION_MODES = ["visual", "data-only"];

  /**
   * Work out who is taking part and how the experiment should behave.
   * @param {Record<string,string|undefined>} params URL query parameters
   */
  function resolveSession(params) {
    const pid = params.PROLIFIC_PID || null;
    const simulate = SIMULATION_MODES.includes(params.simulate) ? params.simulate : null;
    const demo = !pid || params.demo === "1" || simulate !== null;
    return {
      mode: demo ? "demo" : "prolific",
      simulate,
      subject_id: pid,
      study_id: params.STUDY_ID || null,
      session_id: params.SESSION_ID || null,
      // Optional fixed seed for exactly reproducible randomisation (?seed=abc).
      seed: params.seed || null,
    };
  }

  /** Brighter/darker key assignment, optionally swapped for counterbalancing. */
  function keyMapping(keys, swap) {
    return swap
      ? { brighter: keys.darker, darker: keys.brighter, swapped: true }
      : { brighter: keys.brighter, darker: keys.darker, swapped: false };
  }

  /**
   * Build the main-block sequence. Words are shuffled, then every word flagged
   * `repeated` is immediately shown a second time. Only that second showing is
   * a cover-task target (`is_repeat`); the first is an ordinary trial.
   *
   * @param {Array<{word:string,category:string,repeated?:boolean}>} stimuli
   * @param {(xs:any[])=>any[]} shuffle returns a shuffled copy
   * @param {number} luminance probe grey level (identical on every trial)
   */
  function buildTestSequence(stimuli, shuffle, luminance) {
    const sequence = [];
    for (const s of shuffle(stimuli.slice())) {
      const base = { word: s.word, category: s.category, luminance, has_repeat: !!s.repeated };
      sequence.push({ ...base, is_repeat: false });
      if (s.repeated) sequence.push({ ...base, is_repeat: true });
    }
    return sequence.map((trial, i) => ({ ...trial, trial_index_in_block: i }));
  }

  /** Practice trials: the probe is clearly brighter or darker than reference. */
  function buildPracticeSequence(practice, shuffle, luminance) {
    return shuffle(practice.slice()).map((p) => ({
      word: p.word,
      category: p.category,
      luminance: luminance[p.probe],
      correct_response: p.probe,
    }));
  }

  /**
   * Shorter stimulus set for demos: `perCategory` words from each category,
   * `repeatsPerCategory` of which are drawn from the words flagged repeated.
   */
  function sampleDemoStimuli(stimuli, perCategory, repeatsPerCategory, shuffle) {
    const out = [];
    for (const cat of categories(stimuli)) {
      const pool = stimuli.filter((s) => s.category === cat);
      const reps = shuffle(pool.filter((s) => s.repeated)).slice(0, repeatsPerCategory);
      const rest = shuffle(pool.filter((s) => !s.repeated)).slice(0, Math.max(0, perCategory - reps.length));
      out.push(...reps, ...rest);
    }
    return out;
  }

  function categories(stimuli) {
    return [...new Set(stimuli.map((s) => s.category))];
  }

  /** Index after which to insert the break, or -1 for none. Never splits a repeat pair. */
  function breakIndex(sequence, fraction) {
    if (fraction == null || sequence.length < 2) return -1;
    let i = Math.round(sequence.length * fraction);
    while (i < sequence.length && sequence[i].is_repeat) i++;
    return i > 0 && i < sequence.length ? i : -1;
  }

  /** A collision-resistant, filesystem-safe data file name. */
  function makeFilename(session, randomId, date) {
    const safe = (s) => String(s).replace(/[^A-Za-z0-9_-]/g, "").slice(0, 64);
    const who = session.subject_id ? safe(session.subject_id) : "anon";
    const stamp = date.toISOString().replace(/[-:]/g, "").replace(/\..+/, "");
    return `${session.mode}_${who}_${stamp}_${safe(randomId)}.csv`;
  }

  return {
    resolveSession,
    keyMapping,
    buildTestSequence,
    buildPracticeSequence,
    sampleDemoStimuli,
    categories,
    breakIndex,
    makeFilename,
  };
});
