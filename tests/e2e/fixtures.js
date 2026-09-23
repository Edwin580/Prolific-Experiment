// Serves CDN dependencies from node_modules so the tests are hermetic and
// exercise the exact pinned versions (SRI hashes still apply).
const base = require("@playwright/test");
const path = require("node:path");
const fs = require("node:fs");

const CDN = /^https:\/\/cdn\.jsdelivr\.net\/npm\/((?:@[^/]+\/)?[^@/]+)@[^/]+\/(.+)$/;

exports.test = base.test.extend({
  page: async ({ page }, use) => {
    await page.route("https://cdn.jsdelivr.net/npm/**", (route) => {
      const [, name, file] = route.request().url().match(CDN);
      const full = path.join(__dirname, "..", "..", "node_modules", name, file);
      route.fulfill({
        status: 200,
        headers: { "access-control-allow-origin": "*" },
        contentType: file.endsWith(".css") ? "text/css" : "text/javascript",
        body: fs.readFileSync(full),
      });
    });
    // Fail loudly on any uncaught page error.
    const errors = [];
    page.on("pageerror", (e) => errors.push(e));
    await use(page);
    base.expect(errors, errors.map(String).join("\n")).toEqual([]);
  },
});
exports.expect = base.expect;
