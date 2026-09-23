/**
 * Timeline assembly for the Brightness Perception Experiment.
 *
 * Flow: browser check → consent → fullscreen → instructions → practice
 * (repeated if needed) → main block with cover task (with a break) →
 * valence ratings → save → debrief + personal results.
 *
 * Depends on (loaded by experiment.html): jsPsych 8 + plugins, and the
 * BPE_CONFIG / BPE_STIMULI / BPE_DESIGN / BPE_ANALYSIS / BPE_RESULTS globals.
 */
(function () {
  "use strict";

  const C = BPE_CONFIG;
  const D = BPE_DESIGN;
  const A = BPE_ANALYSIS;

  const params = Object.fromEntries(new URLSearchParams(window.location.search));
  const session = D.resolveSession(params);

  document.documentElement.style.setProperty("--bg-grey", `rgb(${Array(3).fill(C.background_luminance)})`);

  const jsPsych = initJsPsych({
    display_element: "experiment",
    show_progress_bar: true,
    auto_update_progress_bar: false,
    message_progress_bar: "",
    on_finish: () => {
      // Consent refusal and browser exclusion end early with their own message.
      if (jsPsych.data.get().filter({ task: "test" }).count() === 0) return;
      BPE_RESULTS.render(document.getElementById("experiment"), finalContext());
    },
  });

  // Seeded randomisation: the seed is stored with the data so any
  // participant's trial order can be regenerated exactly.
  const seed = jsPsych.randomization.setSeed(session.seed ?? undefined);
  const shuffle = (xs) => jsPsych.randomization.shuffle(xs);
  const keys = D.keyMapping(C.keys, C.design.counterbalance_keys && jsPsych.randomization.sampleBernoulli(0.5) === 1);
  const filename = D.makeFilename(session, jsPsych.randomization.randomID(6), new Date());

  jsPsych.data.addProperties({
    subject_id: session.subject_id,
    study_id: session.study_id,
    session_id: session.session_id,
    mode: session.mode,
    simulated: session.simulate !== null,
    experiment_version: C.study.version,
    seed,
    brighter_key: keys.brighter,
    darker_key: keys.darker,
    keys_swapped: keys.swapped,
  });

  // ---------- stimuli ----------

  const testStimuli =
    session.mode === "demo"
      ? D.sampleDemoStimuli(BPE_STIMULI.test, C.demo.words_per_category, C.demo.repeats_per_category, shuffle)
      : BPE_STIMULI.test.slice();
  const testSequence = D.buildTestSequence(testStimuli, shuffle, C.luminance.reference);
  const practiceSequence = D.buildPracticeSequence(BPE_STIMULI.practice, shuffle, C.luminance);
  const valenceSequence = shuffle(testStimuli);

  // Progress: practice ~15 %, main block ~65 %, ratings ~20 %.
  const progress = (value) => jsPsych.progressBar && (jsPsych.progressBar.progress = Math.min(1, value));

  // ---------- small view helpers ----------

  const kbd = (k) => `<kbd>${k === " " ? "Space" : k.toUpperCase()}</kbd>`;
  const escapeHtml = (s) =>
    String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const panel = (html) => `<div class="panel">${html}</div>`;
  const square = (L, size = 200) =>
    `<div class="swatch" style="--size:${size}px;background-color:rgb(${L},${L},${L})"></div>`;
  const keyLegend = () =>
    `<div class="key-legend"><span>${kbd(keys.brighter)} brighter</span><span>${kbd(keys.darker)} darker</span></div>`;
  const iti = () => jsPsych.randomization.sampleWithoutReplacement(C.timing.iti_ms, 1)[0];

  const continueScreen = (html, label = "Continue") => ({
    type: jsPsychHtmlButtonResponse,
    stimulus: panel(html),
    choices: [label],
    post_trial_gap: C.timing.instruction_gap_ms,
    data: { task: "instructions" },
  });

  const referenceScreen = (intro) =>
    continueScreen(`
      <h2>The reference square</h2>
      <p>${intro}</p>
      ${square(C.luminance.reference)}
      <p>Remember its brightness. Each square you judge is compared against this one.</p>
      ${keyLegend()}`, "I'm ready");

  // ---------- trials ----------

  const timeline = [];

  timeline.push({
    type: jsPsychBrowserCheck,
    minimum_width: C.browser.min_width,
    minimum_height: C.browser.min_height,
    skip_features: ["webcam", "microphone", "webaudio"],
    inclusion_function: (d) => C.browser.allow_mobile || !d.mobile,
    exclusion_message: () =>
      panel(`<h2>Please switch to a computer</h2>
        <p>This study needs a physical keyboard and a screen of at least
        ${C.browser.min_width}×${C.browser.min_height} pixels, so it can't be completed on a phone or tablet.</p>`),
    data: { task: "browser_check" },
  });

  timeline.push({
    type: jsPsychHtmlButtonResponse,
    stimulus: panel(`
      ${session.mode === "demo" ? `<div class="badge">Demo mode — responses are not uploaded</div>` : ""}
      <h1>${C.study.name}</h1>
      <p class="lede">A short study about how we perceive brightness.</p>
      <ul class="facts">
        <li><strong>${session.mode === "demo" ? C.demo.estimated_minutes : C.study.estimated_minutes} min</strong><span>duration</span></li>
        <li><strong>${session.mode === "demo" ? testSequence.length : BPE_STIMULI.test.length + BPE_STIMULI.test.filter((s) => s.repeated).length}</strong><span>trials</span></li>
        <li><strong>Keyboard</strong><span>required</span></li>
      </ul>
      <details>
        <summary>Consent information</summary>
        <p>You will see words and grey squares and press keys to respond. Participation is voluntary
        and you may stop at any time by closing this window. Responses are recorded anonymously
        and linked only to your Prolific ID. There are no known risks. Questions: ${C.study.contact}.</p>
      </details>
      <p>By clicking <em>I agree</em> you confirm you are 18 or older and consent to take part.</p>`),
    choices: ["I agree — start", "I do not agree"],
    data: { task: "consent" },
    on_finish: (data) => {
      data.consented = data.response === 0;
      if (!data.consented) {
        jsPsych.abortExperiment(panel(`<h2>No problem</h2><p>You have chosen not to take part. You can close this window.</p>`));
      }
    },
    simulation_options: { data: { response: 0 } },
  });

  timeline.push({
    type: jsPsychFullscreen,
    fullscreen_mode: true,
    message: panel(`<h2>Full screen</h2><p>The study runs in full screen to keep distractions (and other
      brightness sources on your screen) to a minimum.</p>`),
    button_label: "Enter full screen",
    data: { task: "fullscreen" },
  });

  timeline.push({
    type: jsPsychInstructions,
    pages: [
      panel(`<h2>How it works</h2>
        <p>On each trial you'll see a <strong>+</strong>, then a word, then a grey square.</p>
        <div class="sequence">
          <div class="frame"><span class="fx">+</span><small>${C.timing.fixation_ms} ms</small></div>
          <div class="arrow">→</div>
          <div class="frame"><span class="w">word</span><small>${C.timing.word_ms} ms</small></div>
          <div class="arrow">→</div>
          <div class="frame">${square(C.luminance.reference, 56)}<small>until you respond</small></div>
        </div>
        <p>Your task: decide whether the square is <strong>brighter</strong> or <strong>darker</strong> than a reference square.</p>`),
      panel(`<h2>Responding</h2>
        <p>Keep your index fingers on ${kbd(keys.brighter)} and ${kbd(keys.darker)}.</p>
        ${keyLegend()}
        <p>Respond as quickly and accurately as you can. The differences can be subtle — go with your first impression.</p>`),
    ],
    show_clickable_nav: true,
    button_label_previous: "Back",
    button_label_next: "Next",
    data: { task: "instructions" },
  });

  timeline.push(referenceScreen("This is the reference square."));

  // Practice: repeated if accuracy is below threshold (up to a maximum).
  let practiceBlocks = 0;
  const practiceTrial = {
    type: jsPsychWordProbe,
    word: jsPsych.timelineVariable("word"),
    luminance: jsPsych.timelineVariable("luminance"),
    correct_response: jsPsych.timelineVariable("correct_response"),
    probe_size: C.probe_size_px,
    fixation_duration: C.timing.fixation_ms,
    word_duration: C.timing.word_ms,
    brighter_key: keys.brighter,
    darker_key: keys.darker,
    feedback: true,
    feedback_duration: C.timing.feedback_ms,
    prompt: keyLegend(),
    post_trial_gap: iti,
    data: {
      task: "practice",
      category: jsPsych.timelineVariable("category"),
      practice_block: () => practiceBlocks + 1,
    },
    // Simulated participants get practice right ~85 % of the time.
    simulation_options: {
      data: {
        response: () => {
          const right = jsPsych.evaluateTimelineVariable("correct_response");
          return jsPsych.randomization.sampleBernoulli(0.85) ? right : right === "brighter" ? "darker" : "brighter";
        },
      },
    },
    on_finish: () => progress(0.02 + 0.13 * (jsPsych.data.get().filter({ task: "practice" }).count() / (practiceSequence.length * C.design.practice_max_blocks))),
  };

  timeline.push(continueScreen(`<h2>Practice</h2>
    <p>Let's start with ${practiceSequence.length} practice trials. You'll be told whether each answer was correct.</p>`, "Start practice"));

  timeline.push({
    timeline: [
      {
        timeline: [continueScreen(`<h2>Let's practise once more</h2>
          <p>Those were tricky. Here's another short round — compare each square carefully with the reference.</p>
          ${square(C.luminance.reference)}${keyLegend()}`)],
        conditional_function: () => practiceBlocks > 0,
      },
      { timeline: [practiceTrial], timeline_variables: practiceSequence, randomize_order: true },
    ],
    loop_function: () => {
      practiceBlocks++;
      const last = jsPsych.data.get().filter({ task: "practice", practice_block: practiceBlocks });
      const accuracy = last.filter({ correct: true }).count() / Math.max(1, last.count());
      return accuracy < C.design.practice_min_accuracy && practiceBlocks < C.design.practice_max_blocks;
    },
  });

  timeline.push(continueScreen(`<h2>Nice work — practice complete</h2>
    <p>The main part works the same way, but <strong>without feedback</strong>.</p>
    <p>One extra task: sometimes the <strong>same word appears twice in a row</strong>.
    When you notice a repeat, press ${kbd(C.keys.repeat)} — any time while the word or square is on screen —
    and then give your brightness answer as usual.</p>`));

  timeline.push(referenceScreen("Here is the reference square again."));

  // Simulated participants carry a modest valence bias so the demo
  // dashboard has something to show (clearly labelled as simulated).
  const simulatedBrightnessBias = { positive: 0.68, neutral: 0.5, negative: 0.34 };

  const testTrial = {
    type: jsPsychWordProbe,
    word: jsPsych.timelineVariable("word"),
    luminance: jsPsych.timelineVariable("luminance"),
    probe_size: C.probe_size_px,
    fixation_duration: C.timing.fixation_ms,
    word_duration: C.timing.word_ms,
    brighter_key: keys.brighter,
    darker_key: keys.darker,
    repeat_key: C.keys.repeat,
    prompt: `${keyLegend()}<div class="key-legend subtle"><span>${kbd(C.keys.repeat)} repeated word</span></div>`,
    post_trial_gap: iti,
    data: {
      task: "test",
      category: jsPsych.timelineVariable("category"),
      is_repeat: jsPsych.timelineVariable("is_repeat"),
      has_repeat: jsPsych.timelineVariable("has_repeat"),
      trial_index_in_block: jsPsych.timelineVariable("trial_index_in_block"),
    },
    simulation_options: {
      data: {
        response: () =>
          jsPsych.randomization.sampleBernoulli(simulatedBrightnessBias[jsPsych.evaluateTimelineVariable("category")])
            ? "brighter"
            : "darker",
        repeat_pressed: () =>
          jsPsych.randomization.sampleBernoulli(jsPsych.evaluateTimelineVariable("is_repeat") ? 0.9 : 0.02) === 1,
      },
    },
    on_finish: (data) => progress(0.15 + 0.65 * ((data.trial_index_in_block + 1) / testSequence.length)),
  };

  const cut = D.breakIndex(testSequence, C.design.break_at);
  const blocks = cut === -1 ? [testSequence] : [testSequence.slice(0, cut), testSequence.slice(cut)];
  blocks.forEach((block, i) => {
    if (i > 0) {
      timeline.push(continueScreen(`<h2>Halfway there</h2>
        <p>Take a short break if you like. Press continue when you're ready.</p>
        ${square(C.luminance.reference)}
        <p class="muted">Reference square — ${kbd(keys.brighter)} brighter · ${kbd(keys.darker)} darker · ${kbd(C.keys.repeat)} repeat</p>`));
    }
    timeline.push({ timeline: [testTrial], timeline_variables: block });
  });

  // Valence ratings (manipulation check).
  const V = C.keys.valence;
  const ratingByKey = Object.fromEntries(Object.entries(V).map(([rating, key]) => [key, rating]));
  const valencePrompt = `<div class="key-legend">
      <span>${kbd(V.positive)} positive</span><span>${kbd(V.neutral)} neutral</span><span>${kbd(V.negative)} negative</span>
    </div>`;

  timeline.push(continueScreen(`<h2>Last part</h2>
    <p>You'll now see each word again. Rate how <strong>emotionally positive or negative</strong> it is.</p>
    ${valencePrompt}`, "Start rating"));

  timeline.push({
    timeline: [
      {
        type: jsPsychHtmlKeyboardResponse,
        stimulus: () => `<div class="valence-word">${escapeHtml(jsPsych.evaluateTimelineVariable("word"))}</div>`,
        choices: Object.values(V),
        prompt: valencePrompt,
        post_trial_gap: 300,
        data: {
          task: "valence",
          word: jsPsych.timelineVariable("word"),
          category: jsPsych.timelineVariable("category"),
        },
        simulation_options: {
          data: {
            response: () => {
              const cat = jsPsych.evaluateTimelineVariable("category");
              return jsPsych.randomization.sampleBernoulli(0.85) ? V[cat] : V.neutral;
            },
          },
        },
        on_finish: (data) => {
          data.rating = ratingByKey[data.response] ?? null;
          const done = jsPsych.data.get().filter({ task: "valence" }).count();
          progress(0.8 + 0.2 * (done / valenceSequence.length));
        },
      },
    ],
    timeline_variables: valenceSequence,
  });

  timeline.push({ type: jsPsychFullscreen, fullscreen_mode: false, delay_after: 0, data: { task: "fullscreen" } });

  // Upload (Prolific runs only), with retries and a manual fallback.
  if (session.mode === "prolific" && session.simulate === null) {
    timeline.push({
      type: jsPsychHtmlKeyboardResponse,
      stimulus: panel(`<h2>Saving your responses…</h2><div class="spinner" aria-hidden="true"></div>
        <p class="muted" id="save-status">Please don't close this window.</p>`),
      choices: "NO_KEYS",
      data: { task: "save" },
      on_load: () => saveData().then((result) => jsPsych.finishTrial(result)),
    });
  }

  // ---------- data ----------

  function attachQualityMetrics() {
    const ix = jsPsych.data.getInteractionData();
    jsPsych.data.addProperties({
      blur_events: ix.filter({ event: "blur" }).count(),
      fullscreen_exits: ix.filter({ event: "fullscreenexit" }).count(),
    });
  }

  function csv() {
    attachQualityMetrics();
    return jsPsych.data.get().ignore("stimulus").csv();
  }

  async function saveData() {
    const status = () => document.getElementById("save-status");
    const body = csv();
    for (let attempt = 1; attempt <= C.datapipe.max_attempts; attempt++) {
      try {
        // saveData resolves (rather than rejects) with an Error on network
        // failure, and with { error } when the server refuses the upload.
        const result = await jsPsychPipe.saveData(C.datapipe.experiment_id, filename, body);
        if (result instanceof Error) throw result;
        if (!result || result.error) throw new Error(result?.error ?? "empty response");
        return { save_success: true, save_attempts: attempt, filename };
      } catch (err) {
        console.warn(`Save attempt ${attempt} failed:`, err);
        if (attempt < C.datapipe.max_attempts) {
          if (status()) status().textContent = `Connection problem — retrying (${attempt + 1}/${C.datapipe.max_attempts})…`;
          await new Promise((r) => setTimeout(r, C.datapipe.retry_base_ms * 2 ** (attempt - 1)));
        }
      }
    }
    return { save_success: false, save_attempts: C.datapipe.max_attempts, filename };
  }

  function download() {
    const blob = new Blob([csv()], { type: "text/csv" });
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: filename });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  function finalContext() {
    const rows = jsPsych.data.get().values();
    const save = rows.find((r) => r.task === "save");
    return {
      config: C,
      session,
      keys,
      summary: A.summarize(rows, C.design),
      saveFailed: save ? !save.save_success : false,
      download,
      completionUrl: session.mode === "prolific" ? C.prolific.completion_url + C.prolific.completion_code : null,
    };
  }

  // Expose for debugging and the end-to-end tests.
  window.BPE = { jsPsych, session, testSequence, filename, csv };

  if (session.simulate) jsPsych.simulate(timeline, session.simulate);
  else jsPsych.run(timeline);
})();
