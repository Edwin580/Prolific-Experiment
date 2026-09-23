/**
 * Stimulus lists.
 *
 * Words are plain data — presentation (font, size, colour) is handled by the
 * stylesheet, so this file never contains markup.
 *
 *  - `category`  a-priori valence class: "positive" | "negative" | "neutral"
 *  - `repeated`  if true, the word is shown twice in a row in the main block;
 *                the second showing is the target for the cover (1-back) task.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.BPE_STIMULI = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // Practice probes differ clearly from the reference so the task can be learned.
  const practice = [
    { word: "power", category: "positive", probe: "brighter" },
    { word: "wise", category: "positive", probe: "brighter" },
    { word: "brave", category: "positive", probe: "brighter" },
    { word: "insolent", category: "negative", probe: "darker" },
    { word: "clumsy", category: "negative", probe: "darker" },
    { word: "beggar", category: "negative", probe: "darker" },
  ];

  // Main block: every probe is physically identical to the reference square.
  const test = [
    { word: "power", category: "positive", repeated: true },
    { word: "ethical", category: "positive", repeated: true },
    { word: "candy", category: "positive" },
    { word: "studious", category: "positive" },
    { word: "sensible", category: "positive" },
    { word: "righteous", category: "positive" },
    { word: "champion", category: "positive" },
    { word: "pretty", category: "positive" },
    { word: "kiss", category: "positive" },
    { word: "dream", category: "positive" },
    { word: "heaven", category: "positive" },
    { word: "garden", category: "positive" },
    { word: "leisure", category: "positive" },
    { word: "clean", category: "positive" },
    { word: "cordially", category: "positive" },
    { word: "talented", category: "positive" },
    { word: "loyal", category: "positive" },
    { word: "sincere", category: "positive" },
    { word: "reliable", category: "positive" },
    { word: "baby", category: "positive" },
    { word: "festival", category: "positive" },
    { word: "neat", category: "positive" },
    { word: "polite", category: "positive" },
    { word: "prompt", category: "positive" },
    { word: "justice", category: "positive" },
    { word: "sloppy", category: "negative", repeated: true },
    { word: "defeat", category: "negative", repeated: true },
    { word: "touchy", category: "negative" },
    { word: "vain", category: "negative" },
    { word: "insane", category: "negative" },
    { word: "danger", category: "negative" },
    { word: "cruel", category: "negative" },
    { word: "neurotic", category: "negative" },
    { word: "delay", category: "negative" },
    { word: "poison", category: "negative" },
    { word: "greedy", category: "negative" },
    { word: "nasty", category: "negative" },
    { word: "aimless", category: "negative" },
    { word: "hostile", category: "negative" },
    { word: "unfair", category: "negative" },
    { word: "mediocre", category: "negative" },
    { word: "diseased", category: "negative" },
    { word: "mosquito", category: "negative" },
    { word: "cheat", category: "negative" },
    { word: "pompous", category: "negative" },
    { word: "vulgar", category: "negative" },
    { word: "ugly", category: "negative" },
    { word: "crude", category: "negative" },
    { word: "dead", category: "negative" },
    { word: "rude", category: "negative" },
    { word: "opinion", category: "neutral", repeated: true },
    { word: "theory", category: "neutral", repeated: true },
    { word: "idea", category: "neutral" },
    { word: "fact", category: "neutral" },
    { word: "method", category: "neutral" },
    { word: "process", category: "neutral" },
    { word: "structural", category: "neutral" },
    { word: "story", category: "neutral" },
    { word: "sentence", category: "neutral" },
    { word: "task", category: "neutral" },
    { word: "ask", category: "neutral" },
    { word: "dominant", category: "neutral" },
    { word: "conversational", category: "neutral" },
    { word: "elderly", category: "neutral" },
    { word: "young", category: "neutral" },
    { word: "interest", category: "neutral" },
    { word: "adequate", category: "neutral" },
    { word: "even", category: "neutral" },
    { word: "everyday", category: "neutral" },
    { word: "simple", category: "neutral" },
    { word: "active", category: "positive" },
    { word: "music", category: "neutral" },
    { word: "muscular", category: "neutral" },
    { word: "falling", category: "neutral" },
  ];

  return Object.freeze({ practice, test });
});
