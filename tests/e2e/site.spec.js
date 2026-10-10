const { test, expect } = require("./fixtures");

test("project page: the inline task runs, reveals, and the simulator reports power", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.getByRole("button", { name: "Start" }).click();
  for (let i = 0; i < 12; i++) {
    await expect(page.locator("#answer.live")).toBeVisible();
    await page.keyboard.press(i % 2 ? "f" : "j");
  }
  await expect(page.getByText(/All twelve squares were/)).toBeVisible();
  await expect(page.locator("#rows tr")).toHaveCount(12);
  await expect(page.locator(".bar-row")).toHaveCount(3);

  await page.locator("#power").scrollIntoViewIfNeeded();
  await expect(page.locator("#sim-stats")).toContainText("Power from simulation", { timeout: 30_000 });
  await expect(page.locator("#run")).toBeEnabled({ timeout: 30_000 });
  expect(errors).toEqual([]);
});
