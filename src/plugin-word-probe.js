/**
 * jsPsych 8 plugin: word-probe
 *
 * Runs one complete brightness-judgement trial — fixation cross, prime word,
 * then a grey probe square — as a single jsPsych trial, so all of its data
 * lands in one row.
 *
 * Why a custom plugin rather than three html-keyboard-response trials:
 *   - Display changes are scheduled on requestAnimationFrame, and the actual
 *     fixation/word durations are measured and recorded, so dropped frames
 *     are visible in the data instead of silently lengthening the prime.
 *   - The repeat (cover task) key is listened for from word onset through the
 *     end of the probe, independently of the brightness response. In the
 *     original design pressing space *replaced* the brightness judgement on
 *     repeat trials; here both are recorded.
 *   - Optional per-trial feedback for practice blocks.
 */
var jsPsychWordProbe = (function (jspsych) {
  "use strict";

  const info = {
    name: "word-probe",
    version: "1.0.0",
    parameters: {
      /** The prime word (plain text; it is HTML-escaped before display). */
      word: { type: jspsych.ParameterType.STRING, default: undefined },
      /** 8-bit grey level of the probe square. */
      luminance: { type: jspsych.ParameterType.INT, default: undefined },
      /** Side length of the probe square in CSS pixels. */
      probe_size: { type: jspsych.ParameterType.INT, default: 400 },
      fixation_duration: { type: jspsych.ParameterType.INT, default: 800 },
      word_duration: { type: jspsych.ParameterType.INT, default: 400 },
      brighter_key: { type: jspsych.ParameterType.KEY, default: "f" },
      darker_key: { type: jspsych.ParameterType.KEY, default: "j" },
      /** Key for the repeated-word cover task, or null to disable it. */
      repeat_key: { type: jspsych.ParameterType.KEY, default: null },
      /** "brighter" | "darker" | null (null when there is no correct answer). */
      correct_response: { type: jspsych.ParameterType.STRING, default: null },
      /** Show Correct/Incorrect after the response (practice only). */
      feedback: { type: jspsych.ParameterType.BOOL, default: false },
      feedback_duration: { type: jspsych.ParameterType.INT, default: 900 },
      /** HTML shown beneath the probe, e.g. a key reminder. */
      prompt: { type: jspsych.ParameterType.HTML_STRING, default: null },
    },
    data: {
      word: { type: jspsych.ParameterType.STRING },
      luminance: { type: jspsych.ParameterType.INT },
      /** "brighter" | "darker" */
      response: { type: jspsych.ParameterType.STRING },
      response_key: { type: jspsych.ParameterType.STRING },
      /** Brightness response time, measured from probe onset. */
      rt: { type: jspsych.ParameterType.FLOAT },
      correct: { type: jspsych.ParameterType.BOOL },
      repeat_pressed: { type: jspsych.ParameterType.BOOL },
      /** Repeat-key response time, measured from word onset. */
      repeat_rt: { type: jspsych.ParameterType.FLOAT },
      fixation_duration_measured: { type: jspsych.ParameterType.FLOAT },
      word_duration_measured: { type: jspsych.ParameterType.FLOAT },
      frame_interval_estimate: { type: jspsych.ParameterType.FLOAT },
    },
  };

  const escapeHtml = (s) =>
    String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

  const round = (x) => (x == null ? null : Math.round(x * 10) / 10);

  class WordProbePlugin {
    static info = info;

    constructor(jsPsych) {
      this.jsPsych = jsPsych;
    }

    trial(display_element, trial, on_load) {
      const api = this.jsPsych.pluginAPI;
      const L = trial.luminance;

      display_element.innerHTML = `
        <div class="wp-stage" style="--probe-size:${trial.probe_size}px">
          <div class="wp-slot">
            <div class="wp-fixation" aria-hidden="true">+</div>
            <div class="wp-word" hidden>${escapeHtml(trial.word)}</div>
            <div class="wp-probe" hidden style="background-color:rgb(${L},${L},${L})"></div>
            <div class="wp-feedback" hidden role="status"></div>
          </div>
          <div class="wp-prompt" style="visibility:hidden">${trial.prompt ?? ""}</div>
        </div>`;

      const el = (cls) => display_element.querySelector(cls);
      const fixation = el(".wp-fixation");
      const wordEl = el(".wp-word");
      const probe = el(".wp-probe");
      const feedbackEl = el(".wp-feedback");
      const promptEl = el(".wp-prompt");

      const t = { fixation: null, word: null, probe: null };
      const frames = [];
      let lastFrame = null;
      let rafId = null;
      let phase = "fixation";
      let ended = false;

      const response = { key: null, rt: null };
      const repeat = { pressed: false, rt: null };
      let brightnessListener = null;
      let repeatListener = null;

      // A display change is committed if the upcoming frame would land at or
      // past the target — i.e. we switch when less than half a frame remains.
      const halfFrame = () => (frames.length ? median(frames) / 2 : 8);

      const tick = (now) => {
        if (ended) return;
        if (lastFrame !== null) frames.push(now - lastFrame);
        lastFrame = now;

        if (phase === "fixation") {
          if (t.fixation === null) t.fixation = now;
          else if (now - t.fixation >= trial.fixation_duration - halfFrame()) showWord(now);
        } else if (phase === "word") {
          if (now - t.word >= trial.word_duration - halfFrame()) showProbe(now);
        }
        if (phase === "fixation" || phase === "word") rafId = requestAnimationFrame(tick);
      };

      const showWord = (now) => {
        fixation.hidden = true;
        wordEl.hidden = false;
        t.word = now;
        phase = "word";
        if (trial.repeat_key !== null) {
          repeatListener = api.getKeyboardResponse({
            callback_function: (info) => {
              if (!repeat.pressed) {
                repeat.pressed = true;
                repeat.rt = info.rt;
              }
            },
            valid_responses: [trial.repeat_key],
            rt_method: "performance",
            persist: true,
            allow_held_key: false,
          });
        }
      };

      const showProbe = (now) => {
        wordEl.hidden = true;
        probe.hidden = false;
        promptEl.style.visibility = "visible";
        t.probe = now;
        phase = "probe";
        brightnessListener = api.getKeyboardResponse({
          callback_function: onResponse,
          valid_responses: [trial.brighter_key, trial.darker_key],
          rt_method: "performance",
          persist: false,
          allow_held_key: false,
        });
      };

      const onResponse = (info) => {
        response.key = info.key;
        response.rt = info.rt;
        brightnessListener = null;
        if (trial.feedback && trial.correct_response !== null) {
          const ok = judgement() === trial.correct_response;
          probe.hidden = true;
          promptEl.style.visibility = "hidden";
          feedbackEl.hidden = false;
          feedbackEl.className = "wp-feedback " + (ok ? "is-correct" : "is-incorrect");
          feedbackEl.textContent = ok ? "Correct" : "Incorrect";
          api.setTimeout(end, trial.feedback_duration);
        } else {
          end();
        }
      };

      const judgement = () => {
        if (response.key === null) return null;
        return api.compareKeys(response.key, trial.brighter_key) ? "brighter" : "darker";
      };

      const end = () => {
        if (ended) return;
        ended = true;
        if (rafId !== null) cancelAnimationFrame(rafId);
        if (brightnessListener) api.cancelKeyboardResponse(brightnessListener);
        if (repeatListener) api.cancelKeyboardResponse(repeatListener);

        const resp = judgement();
        this.jsPsych.finishTrial({
          word: trial.word,
          luminance: trial.luminance,
          response: resp,
          response_key: response.key,
          rt: round(response.rt),
          correct: trial.correct_response === null || resp === null ? null : resp === trial.correct_response,
          repeat_pressed: repeat.pressed,
          repeat_rt: round(repeat.rt),
          fixation_duration_measured: t.word !== null ? round(t.word - t.fixation) : null,
          word_duration_measured: t.probe !== null ? round(t.probe - t.word) : null,
          frame_interval_estimate: frames.length ? round(median(frames)) : null,
        });
      };

      on_load?.();
      rafId = requestAnimationFrame(tick);
    }

    simulate(trial, simulation_mode, simulation_options, load_callback) {
      const data = this.createSimulationData(trial, simulation_options);
      if (simulation_mode === "data-only") {
        load_callback();
        this.jsPsych.finishTrial(data);
        return;
      }
      // Visual mode: run the real trial and press the keys at plausible times.
      this.trial(this.jsPsych.getDisplayElement(), trial, load_callback);
      const api = this.jsPsych.pluginAPI;
      const probeOnset = trial.fixation_duration + trial.word_duration + 30;
      if (data.repeat_pressed && trial.repeat_key !== null) {
        api.pressKey(trial.repeat_key, trial.fixation_duration + data.repeat_rt + 30);
      }
      api.pressKey(data.response_key, probeOnset + data.rt);
    }

    createSimulationData(trial, simulation_options) {
      const r = this.jsPsych.randomization;
      const defaults = {
        word: trial.word,
        luminance: trial.luminance,
        response: r.sampleBernoulli(0.5) ? "brighter" : "darker",
        rt: Math.round(r.sampleExGaussian(550, 60, 1 / 200, true)),
        repeat_pressed: false,
        repeat_rt: null,
        fixation_duration_measured: trial.fixation_duration,
        word_duration_measured: trial.word_duration,
        frame_interval_estimate: 16.7,
      };
      const data = this.jsPsych.pluginAPI.mergeSimulationData(defaults, simulation_options);
      data.response_key = data.response === "brighter" ? trial.brighter_key : trial.darker_key;
      data.correct = trial.correct_response === null ? null : data.response === trial.correct_response;
      if (data.repeat_pressed && data.repeat_rt === null) {
        data.repeat_rt = Math.round(r.sampleExGaussian(500, 60, 1 / 150, true));
      }
      return data;
    }
  }

  function median(xs) {
    const s = xs.slice().sort((a, b) => a - b);
    const m = s.length >> 1;
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  }

  return WordProbePlugin;
})(jsPsychModule);
