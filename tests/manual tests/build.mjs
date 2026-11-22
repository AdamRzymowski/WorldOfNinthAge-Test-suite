// "Manual tests.pdf": every UI test written out for a person to follow, one
// per page: its title, the functionality, the platforms it's tested on (in
// one entry), the setup, the steps, the expected result with a screenshot of
// it, and the app version it was last valid in. From cases.mjs (the words),
// screenshots/ and validity.json (from capture.mjs), and Playwright's list of
// tests (the platforms). npm run manual makes it after a capture; npm run
// manual:pdf makes it again from what's there.
import { execFileSync, spawn } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import { CASES } from "./cases.mjs";
import { appVersion } from "./capture.mjs";

const HERE = fileURLToPath(new URL(".", import.meta.url));
const TESTS = fileURLToPath(new URL("..", import.meta.url));
const PDF = `${HERE}Manual tests.pdf`;
const esc = (text) => String(text ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const slug = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 150);

if (process.argv.includes("--open")) {
  open(PDF);
  process.exit(0);
}

const FEATURES = {
  "world.spec.ts": "World map",
  "country.spec.ts": "Country window",
  "filter.spec.ts": "Country filter",
  "sections.spec.ts": "Country sections",
  "join.spec.ts": "Plant your banner",
  "update.spec.ts": "Update",
  "tip.spec.ts": "Know one? Tell us",
  "bug.spec.ts": "Report a bug",
  "change.spec.ts": "Request deletion",
  "gallery.spec.ts": "Gallery",
  "events.spec.ts": "Events",
  "world-events.spec.ts": "World map: upcoming events",
  "world-stores.spec.ts": "World map: stores",
  "major.spec.ts": "Major global community events",
  "look.spec.ts": "Look and layout",
  "mobile.spec.ts": "Phone layout",
  "i18n.spec.ts": "Languages",
  "security.spec.ts": "Security",
  "drop.spec.ts": "Drag and drop images",
  "keyboard.spec.ts": "Keyboard only",
};
const BROWSER = { chrome: "Chrome", edge: "Edge", firefox: "Firefox", "chrome-mobile": "Chrome", "edge-mobile": "Edge", "firefox-mobile": "Firefox" };

/* ------------------------------------------- which test runs where */

// Every UI test and the projects it runs in, from Playwright's own list.
const listed = JSON.parse(
  execFileSync(process.execPath, [`${TESTS}node_modules/@playwright/test/cli.js`, "test", "--list", "--reporter=json", ...Object.keys(BROWSER).map((p) => `--project=${p}`)], {
    cwd: TESTS,
    maxBuffer: 64 * 1024 * 1024,
  }).toString(),
);
const tests = new Map(); // "file › describe › … › title" (without the top describe) → projects
const walk = (suite, path) => {
  for (const spec of suite.specs ?? []) {
    const key = [path[0], ...path.slice(2), spec.title].join(" › ");
    const projects = tests.get(key) ?? new Set();
    for (const t of spec.tests ?? []) projects.add(t.projectName);
    tests.set(key, projects);
  }
  for (const child of suite.suites ?? []) walk(child, [...path, child.title]);
};
for (const suite of listed.suites ?? []) walk(suite, [suite.title.replace(/^.*[\\/]/, "")]);

const validity = existsSync(`${HERE}validity.json`) ? JSON.parse(readFileSync(`${HERE}validity.json`, "utf8")) : {};
const matcher = (c) => new RegExp(`^${[c.spec, c.test].join(" › ").replace(/[.*+?^${}()|[\]\\]/g, (ch) => (ch === "*" ? "([a-z]{2})" : `\\${ch}`))}$`);

function platforms(projects) {
  const desktop = [...projects].filter((p) => !p.endsWith("-mobile")).map((p) => BROWSER[p]);
  const phone = [...projects].filter((p) => p.endsWith("-mobile")).map((p) => BROWSER[p]);
  const list = (names) => {
    const sorted = ["Chrome", "Edge", "Firefox"].filter((n) => names.includes(n));
    return sorted.length > 1 ? `${sorted.slice(0, -1).join(", ")} and ${sorted.at(-1)}` : sorted[0];
  };
  if (desktop.length && phone.length && list(desktop) === list(phone)) return `${list(desktop)}, on a desktop and on a phone`;
  return [desktop.length && `${list(desktop)} on a desktop`, phone.length && `${list(phone)} on a phone`].filter(Boolean).join("; ");
}

const cases = CASES.map((c, i) => {
  const re = matcher(c);
  const keys = [...tests.keys()].filter((k) => re.test(k));
  const projects = new Set(keys.flatMap((k) => [...tests.get(k)]));
  const langs = keys.map((k) => k.match(re)?.[1]).filter(Boolean);
  // The screenshot: from a desktop if the test runs there, else a phone.
  const shotKey = keys.find((k) => k.includes(" › de: ")) ?? keys[0];
  const shotFile = shotKey && ["chrome", "chrome-mobile"].map((p) => `${HERE}screenshots/${slug(shotKey)}--${p}.jpg`).find(existsSync);
  const versions = keys.map((k) => validity[k]).filter(Boolean);
  const oldest = versions.length === keys.length && versions.length ? versions.reduce((a, b) => (compareVersions(a.version, b.version) <= 0 ? a : b)) : null;
  return {
    ...c,
    id: `MT-${String(i + 1).padStart(3, "0")}`,
    feature: FEATURES[c.spec] ?? c.spec,
    keys,
    platforms: keys.length ? platforms(projects) : "",
    languages: langs.length ? langs : null,
    shot: shotFile ? `data:image/jpeg;base64,${readFileSync(shotFile).toString("base64")}` : null,
    shotOn: shotFile?.endsWith("--chrome-mobile.jpg") ? "Chrome on a phone" : "Chrome on a desktop",
    valid: oldest,
  };
});

function compareVersions(a, b) {
  const [x, y] = [a, b].map((v) => String(v).split(".").map(Number));
  return (x[0] - y[0]) || (x[1] - y[1]);
}

// Tests without a case, and cases without a test: listed, so they get fixed.
const covered = new Set(cases.flatMap((c) => c.keys));
const uncovered = [...tests.keys()].filter((k) => !covered.has(k));
const orphans = cases.filter((c) => !c.keys.length);

/* --------------------------------------------------------------- the PDF */

const version = appVersion();
const made = new Date().toLocaleDateString("en-GB", { dateStyle: "long" });
const byFeature = Object.groupBy(cases, (c) => c.feature);

const page = (c) => `
<section class="case">
  <div class="head"><span class="id">${c.id}</span><span class="feature">${esc(c.feature)}</span></div>
  <h2>${esc(c.title)}</h2>
  <table class="facts">
    <tr><th>Platforms</th><td>${esc(c.platforms || "–")}${c.languages ? `<br><span class="muted">In each language: ${esc(c.languages.join(", "))}</span>` : ""}</td></tr>
    <tr><th>Last valid in</th><td>${c.valid ? `Version ${esc(c.valid.version)} <span class="muted">(passed ${esc(c.valid.date)})</span>` : `<span class="warn">Not passed yet in a capture</span>`}</td></tr>
    <tr><th>Automated test</th><td class="muted">tests/specs/${esc(c.spec)}: ${esc(c.test.replace("*", "each language"))}</td></tr>
    ${c.setup ? `<tr><th>Setup</th><td>${esc(c.setup)}</td></tr>` : ""}
  </table>
  <div class="cols">
    <div><h3>Steps</h3><ol>${c.steps.map((s) => `<li>${esc(s)}</li>`).join("")}</ol></div>
    <div><h3>Expected result</h3><ul>${c.expected.map((s) => `<li>${esc(s)}</li>`).join("")}</ul></div>
  </div>
  ${c.shot ? `<figure><img src="${c.shot}" alt=""><figcaption>Expected result, ${esc(c.shotOn)}, at the end of the automated test.</figcaption></figure>` : `<p class="warn">No screenshot: the automated test hasn't passed in the last capture.</p>`}
</section>`;

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Manual tests</title><style>
  @page { size: A4; margin: 14mm 14mm 16mm; }
  * { box-sizing: border-box; }
  body { margin: 0; color: #22190f; font: 10pt/1.45 "Segoe UI", system-ui, sans-serif; }
  h1 { font-size: 24pt; margin: 0 0 3mm; }
  h2 { font-size: 15pt; margin: 1mm 0 3mm; }
  h3 { font-size: 10.5pt; margin: 0 0 1.5mm; }
  .muted { color: #6d5d4b; font-size: 8.5pt; }
  .warn { color: #a15c00; }
  .cover p { max-width: 165mm; }
  .toc { columns: 2; column-gap: 8mm; font-size: 8.5pt; }
  .toc h4 { margin: 3mm 0 1mm; font-size: 9pt; break-after: avoid; }
  .toc div { break-inside: avoid; }
  .case { break-before: page; }
  .head { display: flex; justify-content: space-between; border-bottom: 0.4mm solid #c8973e; padding-bottom: 1.5mm; }
  .id { font-weight: 700; color: #8b1a10; } .feature { color: #6d5d4b; }
  .facts { width: 100%; border-collapse: collapse; margin-bottom: 4mm; }
  .facts th { width: 32mm; text-align: left; vertical-align: top; color: #6d5d4b; font-weight: 600; padding: 1mm 2mm 1mm 0; }
  .facts td { padding: 1mm 0; border-bottom: 0.2mm solid #eee3d1; }
  .cols { display: grid; grid-template-columns: 1fr 1fr; gap: 6mm; margin-bottom: 4mm; }
  ol, ul { margin: 0; padding-left: 5mm; } li { margin-bottom: 1mm; }
  figure { margin: 0; text-align: center; }
  figure img { max-width: 100%; max-height: 118mm; border: 0.3mm solid #d8ccb8; border-radius: 1.5mm; }
  figcaption { margin-top: 1mm; color: #6d5d4b; font-size: 8pt; }
</style></head><body>
  <section class="cover">
    <h1>Manual tests</h1>
    <p class="muted">The World of Ninth Age Communities · version ${esc(version)} · made ${esc(made)} · ${cases.length} tests</p>
    <p>Every automated UI test, written out to follow by hand. Each page gives the test's title, the platforms it's tested on, the steps, the expected result with a screenshot taken at the end of the automated test, and the app version it was last valid in (the last version whose automated run passed it).</p>
    <p><b>Test data.</b> The automated tests run on the live site, but replace its map data inside the browser with the test data (<code>tests/fixtures/communities.json</code>); by hand on the live site you see the real map instead, so follow each case with its own names. In the test data, Poland has <i>Test Club</i> (Gdańsk, gaming space, a Discord invite, "We meet every Thursday.") and <i>Test Person</i> (Warsaw, a member of Test Club); France has <i>Test Store</i> (Paris). Poland's events: Weekend Doubles (7–8 Nov 2026), Test Tournament (5–6 Dec 2026) and the past Old Cup (1 Oct 2026). The automated tests fix the date at 10 Nov 2026: on another day, event dates and "past" or "upcoming" differ.</p>
    <p><b>Setup.</b> Some tests need server answers the automated test prepares (approved submissions, a failing send…); their Setup line says so. By hand, check those when such data is on the site.</p>
    <p><b>Phones.</b> "On a phone" means a phone, or a desktop browser's phone view (developer tools, about 400 px wide).</p>
    <h3>Contents</h3>
    <div class="toc">${Object.entries(byFeature)
      .map(([feature, list]) => `<div><h4>${esc(feature)}</h4>${list.map((c) => `<div>${c.id} ${esc(c.title)}</div>`).join("")}</div>`)
      .join("")}</div>
  </section>
  ${cases.map(page).join("")}
</body></html>`;

const browser = await chromium.launch({ channel: "chrome" }).catch(() => chromium.launch());
const pdf = await browser.newPage();
await pdf.setContent(html, { waitUntil: "load" });
await pdf.pdf({
  path: PDF,
  format: "A4",
  printBackground: true,
  displayHeaderFooter: true,
  headerTemplate: "<span></span>",
  footerTemplate: `<div style="width:100%;font:7pt sans-serif;color:#8a7b68;padding:0 14mm;display:flex;justify-content:space-between"><span>Manual tests · version ${esc(version)}</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>`,
  margin: { top: "14mm", bottom: "16mm", left: "14mm", right: "14mm" },
});
await browser.close();
if (process.argv.includes("--html")) writeFileSync(`${HERE}Manual tests.html`, html);

console.log(`Manual tests: ${cases.length} cases, ${cases.filter((c) => c.shot).length} with a screenshot → tests/manual tests/Manual tests.pdf`);
if (uncovered.length) console.log(`UI tests without a case (add them to cases.mjs):\n  ${uncovered.join("\n  ")}`);
if (orphans.length) console.log(`Cases whose test is gone (update cases.mjs):\n  ${orphans.map((c) => `${c.spec} › ${c.test}`).join("\n  ")}`);

function open(file) {
  const opener = process.platform === "win32" ? ["cmd", ["/c", "start", "", file]] : [process.platform === "darwin" ? "open" : "xdg-open", [file]];
  spawn(opener[0], opener[1], { stdio: "ignore", detached: true }).unref();
}
