# Brightness Perception Experiment

**Do positive words make a grey square look brighter?** This is an online experiment built with
[jsPsych 8](https://www.jspsych.org) and run on [Prolific](https://www.prolific.com). Participants read a word, then
decide whether a grey square is brighter or darker than a reference square. In the main block
**every square is exactly the reference grey**, so any difference between positive, neutral and
negative words comes from perception, not from the stimulus.

| Try it | URL |
|---|---|
| Project page | `index.html` |
| Short demo | `experiment.html?demo=1` |
| Watch a simulated participant | `experiment.html?simulate=visual` |
| Jump straight to a results dashboard | `experiment.html?simulate=data-only` |
| Live Prolific study | `experiment.html?PROLIFIC_PID={{%PROLIFIC_PID%}}&STUDY_ID={{%STUDY_ID%}}&SESSION_ID={{%SESSION_ID%}}` |

The old entry point, `Brightness Perception Experiment_up.html`, still works. It forwards to
`experiment.html` and keeps the query string, so existing Prolific links don't break.

## Running locally

```bash
npm install      # dev dependencies only (tests + local copies of the CDN libraries)
npm start        # http://localhost:8080
npm test         # unit + end-to-end tests
```

There is no build step. The site is plain static files, so it can be hosted on GitHub Pages, Netlify,
or any static host.

## Procedure

1. **Browser check.** Desktop only, window at least 800×600. The screen refresh rate is recorded.
2. **Consent**, then **fullscreen**.
3. **Instructions** with a diagram of the trial sequence, then the **reference square** (rgb 168).
4. **Practice.** 6 trials with feedback, where the squares really are brighter (174) or darker (162).
   If accuracy is below 50%, the block runs again (at most twice).
5. **Main block.** 74 words plus 6 immediate repeats, each followed by the reference grey. A cover task
   (press **Space** when a word repeats) keeps attention on the words. There is a self-paced break
   halfway through.
6. **Valence ratings.** Each word is rated positive, neutral or negative. This checks that
   participants agree with the word categories.
7. **Debrief** and a personal results dashboard. The data is **downloaded as a CSV file**
   (automatically in Prolific mode), then the participant returns to Prolific.

Each trial shows a fixation cross for 800 ms, the word for 400 ms, and then the square until the
participant responds. The gap between trials is 900, 1000 or 1100 ms.

## Project layout

```
index.html                 project / landing page
experiment.html            the experiment (loads the scripts below)
css/experiment.css         styles (uniform grey during the task, colour only on the results page)
src/config.js              every tunable parameter: timings, luminances, keys, completion code
src/stimuli.js             practice and test word lists (plain data)
src/design.js              pure logic: session/mode resolution, trial sequences, break placement, file names
src/analysis.js            pure logic: per-category summaries, d′, rating agreement
src/plugin-word-probe.js   custom jsPsych plugin: fixation → word → probe as one frame-timed trial
src/experiment.js          timeline assembly
src/results.js             debrief + results dashboard
tests/unit/                Node test runner tests for design.js and analysis.js
tests/e2e/                 Playwright tests (simulation runs, real keyboard input, consent, legacy URL)
scripts/                   static dev server; SRI/version checker
```

For routine changes (timings, word lists, completion code) you only need to edit `src/config.js`
and `src/stimuli.js`.

## Technical notes

- **Frame-timed trials.** `plugin-word-probe` changes the display inside `requestAnimationFrame`
  callbacks and records the measured fixation and word durations and the frame interval on every
  row, so dropped frames show up in the data.
- **The two responses are recorded separately.** The repeat key is listened for from word onset until
  the trial ends, separately from the brighter/darker response. In v1, pressing Space replaced the
  brightness answer on repeat trials.
- **Reproducible randomisation.** Each session's RNG seed is saved in the data. Pass `?seed=…` to
  reproduce a trial order exactly.
- **Simulation.** The custom plugin supports jsPsych's `simulate()` in both `data-only` and `visual`
  modes. The simulated participant has a built-in valence bias, so the demo dashboard has something
  to show. It is clearly labelled as simulated.
- **Data quality.** Each row carries `blur_events` and `fullscreen_exits`. Responses outside 150–3000 ms
  are excluded from the summaries. The raw data is always kept.
- **Data is CSV only.** Nothing is uploaded to a server or third-party service. At the end, the data
  is exported in the browser as a CSV file. In Prolific mode it downloads automatically
  (`data.auto_download_in_prolific` in the config); every mode also has a download button. File names
  are unique (`prolific_<PID>_<timestamp>_<random>.csv`), so files never overwrite each other. The
  bulky HTML `stimulus` column is left out, because each row already has `word`.
- **Dependencies.** Every CDN script is pinned to an exact version and has a Subresource Integrity
  hash. `npm run check:sri` checks both against `package.json`, and CI runs it.
- **Optional key counterbalancing.** Set `design.counterbalance_keys: true` to swap F/J for a random
  half of participants. The mapping is recorded in the data.

## Data dictionary (main columns)

| column | meaning |
|---|---|
| `task` | `practice`, `test`, `valence`, `instructions`, `consent`, `browser_check`, `fullscreen` |
| `word`, `category` | prime word and its a-priori valence |
| `luminance` | probe grey level (always 168 in `test`) |
| `response` | `brighter` / `darker` (probe trials) |
| `rt` | brightness response time from probe onset (ms) |
| `correct` | practice only |
| `is_repeat` | this trial is the second showing of a repeated word (cover-task target) |
| `has_repeat` | this word is one of the repeated words (true for both of its showings) |
| `repeat_pressed`, `repeat_rt` | Space pressed on this trial; time from word onset |
| `fixation_duration_measured`, `word_duration_measured`, `frame_interval_estimate` | timing checks (ms) |
| `rating` | valence rating (`valence` rows) |
| `subject_id`, `study_id`, `session_id`, `mode`, `seed`, `experiment_version` | session metadata |
| `brighter_key`, `darker_key`, `keys_swapped` | response mapping |
| `blur_events`, `fullscreen_exits` | attention and quality indicators |

## What changed from v1

v1 was a single HTML file. These issues were fixed:

- The DataPipe plugin was loaded **without a version**. It now resolves to a release that requires
  jsPsych 8, which is incompatible with the jsPsych 7.3.4 the page loaded. DataPipe has been removed;
  data is now saved as a CSV download.
- Main-trial `correct_response` was `"g"`, a key that couldn't be pressed. So *correct* was always false,
  and the debrief's "average response time" (taken over correct trials) came out as `NaN`.
- Both showings of a repeated word were flagged `repeated: true`. That made the first showing count as
  a miss, which the debrief tried to patch by doubling the percentage (`× 2`).
- Pressing Space on a repeat trial **discarded the brightness judgement** for that trial.
- An unused loop referenced an undefined variable (`repeat_accuracy`).
- A stray `// datapipe plugin` comment sat outside a `<script>` tag in `<head>`.
- Data files were named `${PROLIFIC_PID}.csv`. Without a PID this became `null.csv`, so different
  sessions could collide.
- There was no consent screen, no browser or size check, no fullscreen, and no attention metrics.

## Notes for the researcher

- `power` appears both in practice (on a brighter probe) and in the main block. Consider swapping one of
  them, so a word already paired with "brighter" in practice doesn't appear in the test.
- The probe is 400 px (it was 500 px) so the square and key hints fit on 800×600 screens. Change
  `probe_size_px` in the config to restore it.
- The prime word is shown at 28 px (it was 20 px). Change `--word-size` in `css/experiment.css`.

## Ethics

The study uses mild deception: the squares in the main block are all identical, and the repeated-word
task is a cover task. Both are fully explained in the debrief. Make sure you have ethical approval
before collecting data.

## Contact

Edwin Cortazo — edwincortazo@gmail.com
