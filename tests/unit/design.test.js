const test = require("node:test");
const assert = require("node:assert/strict");
const D = require("../../src/design.js");
const STIMULI = require("../../src/stimuli.js");
const CONFIG = require("../../src/config.js");

// Deterministic "shuffle" (reverse) and a seeded Fisher–Yates for property tests.
const reverse = (xs) => xs.slice().reverse();
function seededShuffle(seed) {
  let s = seed;
  const rand = () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296);
  return (xs) => {
    const a = xs.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
}

test("resolveSession: Prolific participant", () => {
  const s = D.resolveSession({ PROLIFIC_PID: "abc", STUDY_ID: "st", SESSION_ID: "se" });
  assert.equal(s.mode, "prolific");
  assert.equal(s.subject_id, "abc");
  assert.equal(s.simulate, null);
});

test("resolveSession: no PID, ?demo=1 or ?simulate force demo mode", () => {
  assert.equal(D.resolveSession({}).mode, "demo");
  assert.equal(D.resolveSession({ PROLIFIC_PID: "abc", demo: "1" }).mode, "demo");
  assert.equal(D.resolveSession({ PROLIFIC_PID: "abc", simulate: "visual" }).mode, "demo");
  assert.equal(D.resolveSession({ simulate: "bogus" }).simulate, null);
});

test("keyMapping swaps brighter/darker when counterbalanced", () => {
  assert.deepEqual(D.keyMapping(CONFIG.keys, false), { brighter: "f", darker: "j", swapped: false });
  assert.deepEqual(D.keyMapping(CONFIG.keys, true), { brighter: "j", darker: "f", swapped: true });
});

test("buildTestSequence: only the second showing of a repeated word is a target", () => {
  const seq = D.buildTestSequence(
    [{ word: "a", category: "positive", repeated: true }, { word: "b", category: "neutral" }],
    (xs) => xs,
    168
  );
  assert.deepEqual(
    seq.map((t) => [t.word, t.is_repeat, t.has_repeat, t.trial_index_in_block]),
    [["a", false, true, 0], ["a", true, true, 1], ["b", false, false, 2]]
  );
  assert.ok(seq.every((t) => t.luminance === 168));
});

test("buildTestSequence on the real stimulus list", () => {
  for (let seed = 1; seed <= 50; seed++) {
    const seq = D.buildTestSequence(STIMULI.test, seededShuffle(seed), 168);
    const repeated = STIMULI.test.filter((s) => s.repeated).length;
    assert.equal(seq.length, STIMULI.test.length + repeated);
    assert.equal(seq.filter((t) => t.is_repeat).length, repeated);
    seq.forEach((t, i) => {
      // Every target immediately follows the same word; nothing else repeats back-to-back.
      if (t.is_repeat) assert.equal(seq[i - 1].word, t.word);
      else if (i > 0) assert.notEqual(seq[i - 1].word, t.word);
    });
  }
});

test("buildTestSequence does not mutate its input", () => {
  const input = [{ word: "a", category: "positive", repeated: true }];
  const copy = JSON.parse(JSON.stringify(input));
  D.buildTestSequence(input, reverse, 168);
  assert.deepEqual(input, copy);
});

test("buildPracticeSequence maps probe direction to luminance and correct answer", () => {
  const seq = D.buildPracticeSequence(STIMULI.practice, reverse, CONFIG.luminance);
  assert.equal(seq.length, STIMULI.practice.length);
  for (const t of seq) {
    assert.equal(t.luminance, CONFIG.luminance[t.correct_response]);
    assert.notEqual(t.luminance, CONFIG.luminance.reference);
  }
});

test("sampleDemoStimuli: balanced across categories and includes repeats", () => {
  const out = D.sampleDemoStimuli(STIMULI.test, 8, 1, seededShuffle(7));
  for (const cat of ["positive", "neutral", "negative"]) {
    const inCat = out.filter((s) => s.category === cat);
    assert.equal(inCat.length, 8);
    assert.equal(inCat.filter((s) => s.repeated).length, 1);
  }
  assert.equal(new Set(out.map((s) => s.word)).size, out.length);
});

test("breakIndex never separates a repeated word from its repeat", () => {
  const seq = [
    { is_repeat: false }, { is_repeat: false }, { is_repeat: false },
    { is_repeat: true }, { is_repeat: false }, { is_repeat: false },
  ];
  assert.equal(D.breakIndex(seq, 0.5), 4);
  assert.equal(D.breakIndex(seq, null), -1);
  assert.equal(D.breakIndex([{ is_repeat: false }], 0.5), -1);
});

test("makeFilename is unique-ish and filesystem safe", () => {
  const date = new Date("2026-09-23T10:11:12.345Z");
  assert.equal(
    D.makeFilename({ mode: "prolific", subject_id: "5f/../x y" }, "ab12", date),
    "prolific_5fxy_20260923T101112_ab12.csv"
  );
  assert.equal(D.makeFilename({ mode: "demo", subject_id: null }, "zz", date), "demo_anon_20260923T101112_zz.csv");
});

test("stimulus lists are well-formed", () => {
  const cats = new Set(["positive", "negative", "neutral"]);
  const words = STIMULI.test.map((s) => s.word);
  assert.equal(new Set(words).size, words.length, "duplicate test words");
  assert.ok(STIMULI.test.every((s) => cats.has(s.category)));
  assert.ok(STIMULI.practice.every((s) => s.probe === "brighter" || s.probe === "darker"));
});
