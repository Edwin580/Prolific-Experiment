# Brightness priming

Do positive words make a grey square look brighter?

People read a word, then say whether a grey square is brighter or darker than a reference square. In the main block every square is the same grey as the reference, `rgb(168, 168, 168)`. If positive words still get more "brighter" answers than negative ones, the effect is perceptual, since the stimulus never changes.

Built with jsPsych 8 and run on Prolific.

## Try it

Open `index.html`. The project page has three things you can play with:

1. **A short version of the task.** Twelve trials with the real timing. Your rows show up live as you answer, then the page shows that every square was identical and charts your answers by word type.
2. **A live frame timer.** It measures your display's refresh rate with `requestAnimationFrame` and shows how a target duration (400 ms for the word) turns into whole frames on your screen and on common refresh rates.
3. **A power simulator.** Set the effect size, how much people differ, the sample size and the trial count. It runs 1,000 simulated studies in the browser, tests each with a one sample t test, and plots the results next to an analytic power curve.

Other entry points:

| Link | What it does |
|---|---|
| `experiment.html?demo=1` | The full study, shortened |
| `experiment.html?simulate=visual` | Watch a simulated participant take it |
| `experiment.html?simulate=data-only` | Skip straight to a results dashboard |
| `experiment.html?seed=abc` | Replay an exact trial order |
| `experiment.html?PROLIFIC_PID={{%PROLIFIC_PID%}}&STUDY_ID={{%STUDY_ID%}}&SESSION_ID={{%SESSION_ID%}}` | Live Prolific study |

The old file `Brightness Perception Experiment_up.html` forwards to `experiment.html` with the query string intact, so existing Prolific links still work.

## Run it locally

```bash
npm install
npm start        # http://localhost:8080
npm test         # unit tests, then Playwright
```

No build step. Everything is static, so GitHub Pages or any static host works.

## The study

1. Browser check (desktop, at least 800 by 600), consent, fullscreen.
2. Instructions and the reference square.
3. Six practice trials with feedback, where the squares really are brighter (174) or darker (162). Repeated once if accuracy is under 50%.
4. Main block: 74 words plus 6 immediate repeats, all followed by the reference grey. Pressing Space when a word repeats is a cover task that keeps people reading the words. There is a break halfway.
5. Each word is rated positive, neutral or negative, to check the categories.
6. Debrief, a personal results dashboard, and a CSV download.

Each trial is an 800 ms cross, a 400 ms word, then the square until a response. The gap between trials is 900, 1000 or 1100 ms.

## Code

```
index.html                 project page
site/lab.js                interactive demos on the project page
site/stats.js              t distribution, power, simulation (pure, tested)
experiment.html            the study
src/config.js              every parameter: timing, luminance, keys, completion code
src/stimuli.js             word lists
src/design.js              trial order, repeats, break placement, file names
src/analysis.js            per category summaries, d′, rating agreement
src/plugin-word-probe.js   custom jsPsych plugin for one whole trial
src/experiment.js          timeline
src/results.js             debrief and dashboard
tests/unit/                Node tests
tests/e2e/                 Playwright tests
```

To change timings, words or the completion code you only need `src/config.js` and `src/stimuli.js`.

## Technical notes

**Frame timing.** The plugin changes the display inside `requestAnimationFrame` callbacks and switches on the frame where less than half a frame of the target is left. It saves the measured cross and word durations and the frame interval on every row, so dropped frames are visible in the data.

**Two responses per trial.** The repeat key is listened for from word onset to the end of the trial, separately from the brightness answer, so pressing Space never overwrites the judgement.

**Seeded randomisation.** The seed is saved with the data. `?seed=` reproduces a session's trial order exactly.

**Simulation.** The plugin implements jsPsych's `simulate()` in visual and data only modes. The simulated participant has a built in valence bias so the dashboard has something to show, and it is labelled as simulated.

**Scoring.** Responses outside 150 to 3000 ms are excluded from summaries but kept in the raw data. The cover task is scored as d′ with the Hautus (1995) log linear correction, using Acklam's inverse normal approximation.

**Power simulator.** Each simulated participant gets an effect drawn from a normal distribution, answers binomially, and the group is tested with a one sample t test. The t distribution is computed from the regularized incomplete beta function. The analytic curve uses a normal approximation with variance equal to the person to person spread squared plus the binomial noise from both cells. The two agree within a few points.

**Data stays local.** Nothing is uploaded. The data is exported in the browser as CSV, automatically in Prolific mode. File names include the mode, the participant ID, a timestamp and a random suffix so they never collide. Each row also carries `blur_events` and `fullscreen_exits`.

**Dependencies.** Every CDN script is pinned to an exact version with a Subresource Integrity hash. `npm run check:sri` checks them against `package.json` and CI runs it.

## Data columns

| column | meaning |
|---|---|
| `task` | `practice`, `test`, `valence`, `instructions`, `consent`, `browser_check`, `fullscreen` |
| `word`, `category` | prime word and its expected valence |
| `luminance` | grey level of the square (always 168 in `test`) |
| `response`, `rt` | `brighter` or `darker`, and time from square onset in ms |
| `correct` | practice only |
| `is_repeat` | second showing of a repeated word (cover task target) |
| `has_repeat` | the word is one of the repeated ones (true for both showings) |
| `repeat_pressed`, `repeat_rt` | Space was pressed, and time from word onset |
| `fixation_duration_measured`, `word_duration_measured`, `frame_interval_estimate` | timing checks in ms |
| `rating` | valence rating (`valence` rows) |
| `subject_id`, `study_id`, `session_id`, `mode`, `seed`, `experiment_version` | session info |
| `brighter_key`, `darker_key`, `keys_swapped` | key mapping |
| `blur_events`, `fullscreen_exits` | attention checks |

## Ethics

The study uses mild deception: the main block squares are all identical and the repeat task is a cover. Both are explained in the debrief. Get ethical approval before collecting data.

## Contact

Edwin Cortazo, edwincortazo@gmail.com
