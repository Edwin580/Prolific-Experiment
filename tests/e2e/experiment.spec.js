const { test, expect } = require("./fixtures");

const rows = (page, filter) =>
  page.evaluate((f) => window.BPE.jsPsych.data.get().filter(f).values(), filter);

test("data-only simulation runs end to end and produces well-formed data", async ({ page }) => {
  await page.goto("/experiment.html?simulate=data-only&seed=demo-seed");
  await expect(page.getByRole("heading", { name: /what was really going on/i })).toBeVisible();

  const expected = await page.evaluate(() => window.BPE.testSequence.length);
  const test = await rows(page, { task: "test" });
  expect(test).toHaveLength(expected);
  for (const r of test) {
    expect(["brighter", "darker"]).toContain(r.response);
    expect(r.luminance).toBe(168);
    expect(r.seed).toBe("demo-seed");
  }
  // Repeat targets always directly follow their first showing.
  test.forEach((r, i) => r.is_repeat && expect(test[i - 1].word).toBe(r.word));

  const valence = await rows(page, { task: "valence" });
  expect(valence.length).toBeGreaterThan(0);
  expect(valence.every((r) => ["positive", "neutral", "negative"].includes(r.rating))).toBe(true);

  // CSV export excludes the bulky HTML stimulus column.
  const header = await page.evaluate(() => window.BPE.csv().split("\n")[0]);
  expect(header).not.toContain('"stimulus"');
  expect(header).toContain('"repeat_pressed"');
});

test("the results page downloads the data as a CSV file", async ({ page }) => {
  await page.goto("/experiment.html?simulate=data-only&seed=csv");
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: /Download data/ }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^demo_anon_\d{8}T\d{6}_[A-Za-z0-9]+\.csv$/);
  const csv = require("node:fs").readFileSync(await download.path(), "utf8");
  const lines = csv.trim().split("\n");
  expect(lines[0]).toContain('"word"');
  const expected = await page.evaluate(() => window.BPE.testSequence.length);
  expect(lines.filter((l) => l.includes('"test"')).length).toBe(expected);
});

test("a fixed seed reproduces the same trial order", async ({ page }) => {
  const order = async () => {
    await page.goto("/experiment.html?simulate=data-only&seed=abc123");
    await expect(page.locator(".results")).toBeVisible();
    return page.evaluate(() => window.BPE.testSequence.map((t) => t.word).join(","));
  };
  expect(await order()).toBe(await order());
});

test("visual simulation drives the real plugin and renders the dashboard", async ({ page }) => {
  await page.goto("/experiment.html?simulate=visual&seed=visual-test");
  await expect(page.locator(".wp-probe").first()).toBeVisible({ timeout: 60_000 });
  await expect(page.locator(".results")).toBeVisible({ timeout: 220_000 });
  await expect(page.getByText(/Simulated participant/)).toBeVisible();
  await expect(page.locator(".chart .bar")).toHaveCount(6);

  const test = await rows(page, { task: "test" });
  // Frame-based timing should land within ~2 frames of the targets.
  for (const r of test) {
    expect(Math.abs(r.word_duration_measured - 400)).toBeLessThan(40);
    expect(Math.abs(r.fixation_duration_measured - 800)).toBeLessThan(40);
  }
  const hits = test.filter((r) => r.is_repeat && r.repeat_pressed).length;
  expect(hits).toBeGreaterThan(0); // seeded: the simulated participant catches repeats 90 % of the time
});

test("a real participant: keyboard responses are recorded from probe onset only", async ({ page }) => {
  await page.goto("/experiment.html?seed=kbd");
  await page.getByRole("button", { name: /I agree/ }).click();
  await page.getByRole("button", { name: /full screen/i }).click();
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: /I'm ready/ }).click();
  await page.getByRole("button", { name: /Start practice/ }).click();

  const probe = page.locator(".wp-probe");

  // A key pressed before the probe appears must not count as the response.
  await expect(page.locator(".wp-stage")).toBeVisible();
  await page.keyboard.press("j");
  await expect(probe).toBeVisible();
  await page.keyboard.press("f");
  await expect(page.locator(".wp-feedback")).toBeVisible();

  // The row is written once the feedback screen has finished.
  await expect.poll(async () => (await rows(page, { task: "practice" })).length).toBe(1);
  const [first] = await rows(page, { task: "practice" });
  expect(first.response).toBe("brighter"); // the early "j" was ignored
  expect(first.response_key).toBe("f");
  expect(first.rt).toBeGreaterThan(0);
  expect(typeof first.correct).toBe("boolean");
  expect(first.repeat_pressed).toBe(false);
});

test("declining consent ends the study without a results screen", async ({ page }) => {
  await page.goto("/experiment.html");
  await page.getByRole("button", { name: /I do not agree/ }).click();
  await expect(page.getByText(/chosen not to take part/)).toBeVisible();
  await expect(page.locator(".results")).toHaveCount(0);
});

test("the legacy URL redirects and keeps Prolific parameters", async ({ page }) => {
  await page.goto("/Brightness%20Perception%20Experiment_up.html?PROLIFIC_PID=p1&STUDY_ID=s1&SESSION_ID=x1");
  await page.waitForURL(/experiment\.html\?PROLIFIC_PID=p1&STUDY_ID=s1&SESSION_ID=x1$/);
  expect(await page.evaluate(() => window.BPE.session.mode)).toBe("prolific");
});
