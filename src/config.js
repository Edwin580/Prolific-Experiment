/**
 * Experiment configuration.
 *
 * Every tunable parameter of the study lives here so that the timeline code
 * never contains magic numbers. Edit this file to adapt the study; nothing
 * else should need to change for routine adjustments.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.BPE_CONFIG = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  return Object.freeze({
    study: {
      name: "Brightness Perception Experiment",
      version: "2.0.0",
      contact: "Edwin Cortazo — edwincortazo@gmail.com",
      payment: "$2.00",
      estimated_minutes: 10,
    },

    prolific: {
      // Completion URL participants are sent to at the very end.
      completion_code: "C1NTLTMI",
      completion_url: "https://app.prolific.com/submissions/complete?cc=",
    },

    datapipe: {
      // https://pipe.jspsych.org experiment ID. Data is only sent in Prolific mode.
      experiment_id: "vPQ1tiGDQwg7",
      max_attempts: 3,
      retry_base_ms: 1000,
    },

    // Background grey of the whole page, as a single 8-bit channel value.
    background_luminance: 145,

    // The reference ("initial") square, and the practice probes either side of it.
    luminance: {
      reference: 168,
      brighter: 174,
      darker: 162,
    },

    // Square side length in CSS pixels.
    probe_size_px: 400,

    timing: {
      fixation_ms: 800,
      word_ms: 400,
      // Inter-trial interval is sampled uniformly from this list.
      iti_ms: [900, 1000, 1100],
      feedback_ms: 900,
      instruction_gap_ms: 500,
    },

    keys: {
      // Default mapping; swapped for half of participants when counterbalancing is on.
      brighter: "f",
      darker: "j",
      repeat: " ",
      valence: { positive: "f", neutral: "g", negative: "j" },
    },

    design: {
      // Randomly swap the brighter/darker keys per participant (recorded in the data).
      counterbalance_keys: false,
      // Repeat the practice block if accuracy falls below this proportion...
      practice_min_accuracy: 0.5,
      // ...but never run it more than this many times in total.
      practice_max_blocks: 2,
      // Insert a self-paced break after this fraction of the main trials (null = none).
      break_at: 0.5,
      // Responses faster than this are treated as anticipations in the analysis.
      min_valid_rt_ms: 150,
      max_valid_rt_ms: 3000,
    },

    // Demo mode is used whenever there is no PROLIFIC_PID (or ?demo=1 is given).
    demo: {
      words_per_category: 8,
      estimated_minutes: 4,
      repeats_per_category: 1,
    },

    browser: {
      min_width: 800,
      min_height: 600,
      allow_mobile: false,
    },
  });
});
