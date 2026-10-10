/**
 * Interactive pieces of the project page: a short version of the real task,
 * a live frame timing monitor, and a power simulator.
 * Uses BPE_CONFIG, BPE_STIMULI, BPE_ANALYSIS and BPE_STATS.
 */
(function () {
  "use strict";

  const C = BPE_CONFIG;
  const A = BPE_ANALYSIS;
  const S = BPE_STATS;
  const $ = (id) => document.getElementById(id);
  const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const median = (xs) => {
    const s = xs.slice().sort((a, b) => a - b);
    const m = s.length >> 1;
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  };
  const shuffle = (xs) => {
    const a = xs.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  const escapeHtml = (s) =>
    String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const pct = (x) => (x == null ? "n/a" : `${Math.round(x * 100)}%`);

  const L = C.luminance.reference;
  document.documentElement.style.setProperty("--probe", `rgb(${L},${L},${L})`);
  document.documentElement.style.setProperty("--stage-bg", `rgb(${Array(3).fill(C.background_luminance)})`);

  /* ---------------------------------------------------------------- 01 task */

  const PER_CATEGORY = 4;
  const CATS = A.CATEGORIES;
  const task = { trials: [], rows: [], i: 0, phase: "idle", t: {}, frames: [], onAnswer: null };

  function pickTrials() {
    const words = [...new Map(BPE_STIMULI.test.map((s) => [s.word, s])).values()];
    return shuffle(CATS.flatMap((c) => shuffle(words.filter((w) => w.category === c)).slice(0, PER_CATEGORY)));
  }

  function startTask() {
    task.trials = pickTrials();
    task.rows = [];
    task.i = 0;
    $("rows").innerHTML = "";
    $("csv").disabled = true;
    $("reveal").hidden = true;
    $("stage-idle").hidden = true;
    $("stage-done").hidden = true;
    $("stage-run").hidden = false;
    $("stage").focus({ preventScroll: true });
    runTrial();
  }

  function show(which) {
    $("fix").hidden = which !== "fix";
    $("word").hidden = which !== "word";
    $("probe").hidden = which !== "probe";
    $("answer").classList.toggle("live", which === "probe");
  }

  // Same scheduling rule as the plugin: switch on the frame where less than
  // half a frame of the target duration is left.
  function runTrial() {
    const trial = task.trials[task.i];
    $("counter").textContent = `${task.i + 1} / ${task.trials.length}`;
    $("word").textContent = trial.word;
    task.t = { fix: null, word: null, probe: null };
    task.frames = [];
    task.phase = "fix";
    show("fix");
    let last = null;
    const half = () => (task.frames.length ? median(task.frames) / 2 : 8);
    const tick = (now) => {
      if (last !== null) task.frames.push(now - last);
      last = now;
      if (task.phase === "fix") {
        if (task.t.fix === null) task.t.fix = now;
        else if (now - task.t.fix >= C.timing.fixation_ms - half()) {
          task.t.word = now;
          task.phase = "word";
          show("word");
        }
      } else if (task.phase === "word" && now - task.t.word >= C.timing.word_ms - half()) {
        task.t.probe = now;
        task.phase = "probe";
        show("probe");
        return;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  function answer(response) {
    if (task.phase !== "probe") return;
    const rt = performance.now() - task.t.probe;
    const trial = task.trials[task.i];
    const row = {
      task: "test",
      word: trial.word,
      category: trial.category,
      luminance: L,
      response,
      rt: Math.round(rt),
      fixation_duration_measured: +(task.t.word - task.t.fix).toFixed(1),
      word_duration_measured: +(task.t.probe - task.t.word).toFixed(1),
      frame_interval_estimate: +median(task.frames).toFixed(2),
    };
    task.rows.push(row);
    appendRow(row, task.rows.length);
    task.phase = "iti";
    show(null);
    task.i++;
    const iti = C.timing.iti_ms[Math.floor(Math.random() * C.timing.iti_ms.length)];
    setTimeout(task.i < task.trials.length ? runTrial : finishTask, iti);
  }

  function appendRow(r, n) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${n}</td><td>${escapeHtml(r.word)}</td><td class="c-${r.category}">${r.category.slice(0, 3)}</td>
      <td>${r.response}</td><td>${r.rt}</td><td>${r.word_duration_measured}</td>`;
    $("rows").appendChild(tr);
    tr.scrollIntoView({ block: "nearest" });
  }

  function finishTask() {
    task.phase = "idle";
    $("stage-run").hidden = true;
    $("stage-done").hidden = false;
    $("stage-done").innerHTML = `<p>Done. The reveal is below.</p><button class="btn" id="again">Run it again</button>`;
    $("again").addEventListener("click", startTask);
    $("csv").disabled = false;

    const s = A.summarize(task.rows, C.design);
    $("bars").innerHTML = `<div class="bars-title">“Brighter” answers by word type</div>` +
      CATS.map((c) => {
        const p = s.by_category[c].p_brighter;
        return `<div class="bar-row">
          <span class="bar-label">${c}</span>
          <span class="bar-track"><span class="bar-fill c-${c}" style="width:${(p ?? 0) * 100}%"></span><span class="bar-mid"></span></span>
          <span class="bar-val mono">${pct(p)}</span>
        </div>`;
      }).join("") + `<div class="bars-note">The tick marks 50%, which is what no bias looks like.</div>`;

    const wd = s.word_duration;
    const fr = median(task.rows.map((r) => r.frame_interval_estimate));
    const eff = s.valence_effect;
    const rts = task.rows.map((r) => r.rt);
    $("trial-stats").innerHTML = [
      ["valence effect", eff == null ? "n/a" : `${eff > 0 ? "+" : ""}${Math.round(eff * 100)} pts`],
      ["median RT", `${Math.round(median(rts))} ms`],
      ["word on screen", `${wd.mean.toFixed(1)} ms ± ${(wd.sd ?? 0).toFixed(1)}`],
      ["target", `${C.timing.word_ms} ms`],
      ["frame interval", `${fr.toFixed(2)} ms`],
    ].map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join("");

    $("reveal").hidden = false;
    $("reveal").scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function downloadCsv() {
    const cols = Object.keys(task.rows[0]);
    const lines = [cols.join(","), ...task.rows.map((r) => cols.map((c) => JSON.stringify(r[c] ?? "")).join(","))];
    const a = Object.assign(document.createElement("a"), {
      href: URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/csv" })),
      download: "brightness_demo.csv",
    });
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  $("start").addEventListener("click", startTask);
  $("csv").addEventListener("click", downloadCsv);
  document.querySelectorAll("#answer .key").forEach((b) => b.addEventListener("click", () => answer(b.dataset.r)));
  document.addEventListener("keydown", (e) => {
    if (task.phase === "idle" || e.repeat || e.metaKey || e.ctrlKey) return;
    const k = e.key.toLowerCase();
    if (k === C.keys.brighter) answer("brighter");
    else if (k === C.keys.darker) answer("darker");
    else return;
    e.preventDefault();
  });

  /* ------------------------------------------------------------- 02 timing */

  const RING = 240;
  const intervals = [];
  const canvas = $("frames");
  let timingVisible = false;
  let lastFrame = null;
  let lastStats = 0;

  function frameLoop(now) {
    if (lastFrame !== null) {
      intervals.push(now - lastFrame);
      if (intervals.length > RING) intervals.shift();
    }
    lastFrame = now;
    drawFrames();
    if (now - lastStats > 250) {
      lastStats = now;
      updateFrameStats();
    }
    if (timingVisible) requestAnimationFrame(frameLoop);
    else lastFrame = null;
  }

  function sizeCanvas(cv) {
    const dpr = window.devicePixelRatio || 1;
    const w = cv.clientWidth;
    const h = cv.clientHeight;
    if (cv.width !== Math.round(w * dpr)) {
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(h * dpr);
    }
    const ctx = cv.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, w, h };
  }

  function drawFrames() {
    const { ctx, w, h } = sizeCanvas(canvas);
    ctx.clearRect(0, 0, w, h);
    if (intervals.length < 2) return;
    const med = median(intervals);
    const top = Math.max(med * 3, 40);
    const bw = w / RING;
    const y = (v) => h - (Math.min(v, top) / top) * (h - 8);
    const ink = css("--muted"), hot = css("--hot"), line = css("--text-2");
    intervals.forEach((v, i) => {
      ctx.fillStyle = v > med * 1.5 ? hot : ink;
      const yy = y(v);
      ctx.fillRect(i * bw, yy, Math.max(1, bw - 1), h - yy);
    });
    ctx.strokeStyle = line;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(0, y(med));
    ctx.lineTo(w, y(med));
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = line;
    ctx.font = "11px 'IBM Plex Mono', ui-monospace, monospace";
    ctx.fillText(`median ${med.toFixed(2)} ms`, 6, Math.max(12, y(med) - 6));
  }

  function yourInterval() {
    return intervals.length >= 20 ? median(intervals) : null;
  }

  function updateFrameStats() {
    const med = yourInterval();
    if (med == null) return;
    const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const sd = Math.sqrt(intervals.reduce((a, x) => a + (x - mean) ** 2, 0) / (intervals.length - 1));
    const dropped = intervals.filter((v) => v > med * 1.5).length;
    $("fps-live").textContent = `${(1000 / med).toFixed(1)} Hz`;
    $("frame-stats").innerHTML = [
      ["refresh", `${(1000 / med).toFixed(1)} Hz`],
      ["median", `${med.toFixed(2)} ms`],
      ["jitter (SD)", `${sd.toFixed(2)} ms`],
      ["long frames", `${dropped} of ${intervals.length}`],
    ].map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join("");
    updateQuant();
  }

  function updateQuant() {
    const target = +$("target").value;
    $("target-out").textContent = `${target} ms`;
    const yours = yourInterval();
    const displays = [
      ...(yours ? [{ name: "yours", hz: 1000 / yours, mine: true }] : []),
      { name: "60 Hz", hz: 60 }, { name: "75 Hz", hz: 75 }, { name: "120 Hz", hz: 120 },
      { name: "144 Hz", hz: 144 }, { name: "240 Hz", hz: 240 },
    ];
    $("quant").innerHTML = displays.map((d) => {
      const f = 1000 / d.hz;
      const n = Math.max(1, Math.round(target / f));
      const shown = n * f;
      const err = shown - target;
      return `<tr class="${d.mine ? "mine" : ""}"><td>${d.mine ? `yours, ${d.hz.toFixed(0)} Hz` : d.name}</td><td>${n}</td>
        <td>${shown.toFixed(1)} ms</td><td class="${Math.abs(err) > f / 4 ? "off" : ""}">${err >= 0 ? "+" : "−"}${Math.abs(err).toFixed(1)}</td></tr>`;
    }).join("");
  }

  $("target").addEventListener("input", updateQuant);
  updateQuant();

  /* -------------------------------------------------------------- 03 power */

  const STUDIES = 1000;
  const controls = {
    effect: { el: $("effect"), out: $("o-effect"), fmt: (v) => v.toFixed(3) },
    spread: { el: $("spread"), out: $("o-spread"), fmt: (v) => v.toFixed(3) },
    n: { el: $("n"), out: $("o-n"), fmt: (v) => String(v) },
    trials: { el: $("trials"), out: $("o-trials"), fmt: (v) => String(v) },
  };
  let sim = null;
  let simTimer = null;

  const params = () => Object.fromEntries(Object.entries(controls).map(([k, c]) => [k, +c.el.value]));

  function onControl() {
    for (const c of Object.values(controls)) c.out.textContent = c.fmt(+c.el.value);
    drawCurve(params(), sim && sim.done ? sim.power : null);
    clearTimeout(simTimer);
    simTimer = setTimeout(runSim, 300);
  }

  function runSim() {
    const p = params();
    const rand = S.rng((Math.random() * 2 ** 32) >>> 0);
    const run = { p, results: [], done: false, power: null };
    sim = run;
    $("run").disabled = true;
    const step = () => {
      if (sim !== run) return;
      const batch = Math.max(5, Math.round(20000 / (p.n * p.trials)));
      for (let i = 0; i < batch && run.results.length < STUDIES; i++) run.results.push(S.simulateStudy(rand, p));
      const sig = run.results.filter((r) => r.p < 0.05).length;
      run.power = sig / run.results.length;
      $("sim-progress").textContent = `${run.results.length} / ${STUDIES}`;
      drawHist(run);
      if (run.results.length < STUDIES) requestAnimationFrame(step);
      else {
        run.done = true;
        $("run").disabled = false;
        drawCurve(p, run.power);
      }
      updateSimStats(run);
    };
    requestAnimationFrame(step);
  }

  function updateSimStats(run) {
    const p = run.p;
    const ps = run.results.map((r) => r.p);
    let n80 = null;
    for (let n = 3; n <= 5000; n++) {
      if (S.analyticPower({ ...p, n }) >= 0.8) { n80 = n; break; }
    }
    $("sim-stats").innerHTML = [
      ["simulated power", pct(run.power)],
      ["analytic power", pct(S.analyticPower(p))],
      ["median p", ps.length ? median(ps).toFixed(3) : "n/a"],
      ["N for 80%", p.effect === 0 ? "never" : n80 ?? "> 5000"],
    ].map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join("");
  }

  const svgNS = "http://www.w3.org/2000/svg";
  function svgSize(svg) {
    const w = Math.max(280, svg.clientWidth || 600);
    const h = svg.clientHeight || 200;
    svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
    return { w, h };
  }

  function drawHist(run) {
    const svg = $("hist");
    const { w, h } = svgSize(svg);
    const p = run.p;
    const se = Math.sqrt(p.spread ** 2 + 0.5 / p.trials) / Math.sqrt(p.n);
    const lo = Math.min(-0.02, p.effect - 4 * se);
    const hi = Math.max(0.02, p.effect + 4 * se);
    const BINS = 48;
    const bw = (hi - lo) / BINS;
    const sig = new Array(BINS).fill(0), non = new Array(BINS).fill(0);
    for (const r of run.results) {
      const b = Math.min(BINS - 1, Math.max(0, Math.floor((r.mean - lo) / bw)));
      (r.p < 0.05 ? sig : non)[b]++;
    }
    const peak = Math.max(1, ...sig.map((s, i) => s + non[i]));
    const m = { l: 8, r: 8, t: 10, b: 26 };
    const x = (v) => m.l + ((v - lo) / (hi - lo)) * (w - m.l - m.r);
    const y = (c) => (h - m.b) - (c / peak) * (h - m.t - m.b);
    const colW = (w - m.l - m.r) / BINS;
    let out = "";
    for (let i = 0; i < BINS; i++) {
      const x0 = m.l + i * colW;
      if (non[i]) out += `<rect class="h-non" x="${x0}" y="${y(non[i])}" width="${colW - 1}" height="${h - m.b - y(non[i])}"/>`;
      if (sig[i]) out += `<rect class="h-sig" x="${x0}" y="${y(non[i] + sig[i])}" width="${colW - 1}" height="${y(non[i]) - y(non[i] + sig[i])}"/>`;
    }
    const tick = (v, label, cls) =>
      `<line class="${cls}" x1="${x(v)}" x2="${x(v)}" y1="${m.t}" y2="${h - m.b}"/>
       <text class="axis" x="${x(v)}" y="${h - 8}" text-anchor="middle">${label}</text>`;
    out += `<line class="base" x1="${m.l}" x2="${w - m.r}" y1="${h - m.b}" y2="${h - m.b}"/>`;
    out += tick(0, "0", "zero");
    if (Math.abs(x(p.effect) - x(0)) > 40) out += tick(p.effect, `true ${p.effect.toFixed(3)}`, "truth");
    out += `<text class="legend" x="${w - m.r}" y="${m.t + 4}" text-anchor="end"><tspan class="l-sig">■</tspan> p &lt; .05  <tspan class="l-non">■</tspan> not significant</text>`;
    svg.innerHTML = out;
  }

  function drawCurve(p, simulated) {
    const svg = $("curve");
    const { w, h } = svgSize(svg);
    const m = { l: 34, r: 12, t: 10, b: 24 };
    const maxN = 300;
    const x = (n) => m.l + (n / maxN) * (w - m.l - m.r);
    const y = (v) => m.t + (1 - v) * (h - m.t - m.b);
    let d = "";
    for (let n = 2; n <= maxN; n += 2) d += `${d ? "L" : "M"}${x(n).toFixed(1)},${y(S.analyticPower({ ...p, n })).toFixed(1)}`;
    let out = [0, 0.5, 1].map((v) => `<line class="grid" x1="${m.l}" x2="${w - m.r}" y1="${y(v)}" y2="${y(v)}"/>
      <text class="axis" x="${m.l - 6}" y="${y(v)}" dy="0.32em" text-anchor="end">${v * 100}%</text>`).join("");
    out += `<line class="eighty" x1="${m.l}" x2="${w - m.r}" y1="${y(0.8)}" y2="${y(0.8)}"/>
      <text class="axis" x="${w - m.r}" y="${y(0.8) - 5}" text-anchor="end">80%</text>`;
    out += [0, 100, 200, 300].map((n) => `<text class="axis" x="${x(n)}" y="${h - 6}" text-anchor="middle">${n}</text>`).join("");
    out += `<path class="curve" d="${d}"/>`;
    out += `<line class="now" x1="${x(p.n)}" x2="${x(p.n)}" y1="${m.t}" y2="${h - m.b}"/>`;
    if (simulated != null) out += `<circle class="dot" cx="${x(p.n)}" cy="${y(simulated)}" r="5"><title>simulated ${pct(simulated)}</title></circle>`;
    svg.innerHTML = out;
  }

  for (const c of Object.values(controls)) c.el.addEventListener("input", onControl);
  $("run").addEventListener("click", runSim);

  /* -------------------------------------------------- start when on screen */

  let simStarted = false;
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.target.id === "timing") {
        const was = timingVisible;
        timingVisible = e.isIntersecting;
        if (timingVisible && !was) requestAnimationFrame(frameLoop);
      }
      if (e.target.id === "power" && e.isIntersecting && !simStarted) {
        simStarted = true;
        runSim();
      }
    }
  }, { rootMargin: "100px" });
  io.observe($("timing"));
  io.observe($("power"));

  for (const c of Object.values(controls)) c.out.textContent = c.fmt(+c.el.value);
  drawCurve(params(), null);
  window.addEventListener("resize", () => {
    drawCurve(params(), sim && sim.done ? sim.power : null);
    if (sim) drawHist(sim);
  });
})();
