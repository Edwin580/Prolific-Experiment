// Verifies that every CDN <script>/<link> in the HTML pages pins an exact
// version that matches package.json and carries a correct SRI hash
// (computed from the same file in node_modules).
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const pages = ["experiment.html"];
const pkg = JSON.parse(await readFile("package.json", "utf8"));
const deps = pkg.devDependencies;
const tag = /<(?:script|link)\b[^>]*?(?:src|href)="https:\/\/cdn\.jsdelivr\.net\/npm\/((?:@[^/]+\/)?[^@/]+)@([^/]+)\/([^"]+)"[^>]*>/g;

let failures = 0;
let checked = 0;
for (const page of pages) {
  const html = await readFile(page, "utf8");
  for (const m of html.matchAll(tag)) {
    const [el, name, version, file] = m;
    checked++;
    const integrity = el.match(/integrity="([^"]+)"/)?.[1];
    const expected = "sha384-" + createHash("sha384").update(await readFile(`node_modules/${name}/${file}`)).digest("base64");
    const problems = [];
    if (deps[name] !== version) problems.push(`version ${version} ≠ package.json ${deps[name]}`);
    if (integrity !== expected) problems.push(`integrity should be ${expected}`);
    if (!/crossorigin="anonymous"/.test(el)) problems.push("missing crossorigin");
    if (problems.length) {
      failures++;
      console.error(`✗ ${page}: ${name}@${version}/${file}\n    ${problems.join("\n    ")}`);
    }
  }
}
console.log(`${checked - failures}/${checked} CDN resources verified.`);
process.exit(failures ? 1 : 0);
