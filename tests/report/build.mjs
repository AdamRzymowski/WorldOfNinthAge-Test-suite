// The test report of a run: a PDF (reports/test-report-<date>_<time>.pdf) and a
// spreadsheet (reports/test-results-<date>_<time>.csv), named by when the run
// started; see README.md, "Reports". For every test: what it checks, the
// functionality it belongs to, the platform (browser, desktop or phone), the
// result, and how that compares with the previous run (the CSV before this
// one). Only the two newest of each are kept: this run's and the one before.
//
// It reads what the packs leave in reports/: ui.json and a11y.json
// (Playwright's results; the accessibility ones carry axe-core's findings)
// and perf.json with perf-run.json (k6's numbers). A pack not run is shown
// as not run.
//
//   node report/build.mjs [--open] [--html] the report, opened if asked (--html
//                                           also keeps the page it's printed from)
//   node report/build.mjs --show=pdf|csv    opens the newest one as it is
import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const TESTS = fileURLToPath(new URL("..", import.meta.url));
// A release check against the live site (REPORT_KIND sanity or regression,
// BASE_URL the site; .claude/skills/release-tests) keeps files of its own,
// release-sanity-report-<date>_<time>.pdf and so on, compared only with the
// previous check of the same kind.
const KIND = process.env.REPORT_KIND;
const REPORT = KIND ? `release-${KIND}-report` : "test-report";
const RESULTS = KIND ? `release-${KIND}-results` : "test-results";
// The reports there, newest first: test-report-2026-11-10_1305.pdf and so on.
const reports = (prefix, ext) =>
  (existsSync(`${TESTS}reports`) ? readdirSync(`${TESTS}reports`) : [])
    .filter((f) => f.startsWith(`${prefix}-`) && f.endsWith(ext))
    .sort()
    .reverse()
    .map((f) => `reports/${f}`);

// Opening the newest report as it is: --show=pdf or --show=csv.
const show = process.argv.find((a) => a.startsWith("--show="))?.slice(7);
if (show) {
  const [file] = show === "csv" ? reports(RESULTS, ".csv") : reports(REPORT, ".pdf");
  if (!file) {
    console.log("No report yet: run npm test first.");
    process.exit(1);
  }
  open(file);
  process.exit(0);
}

const read = (file) => (existsSync(`${TESTS}${file}`) ? JSON.parse(readFileSync(`${TESTS}${file}`, "utf8")) : null);
const esc = (text) => String(text ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const plain = (text) => String(text ?? "").replace(/\u001b\[[0-9;]*m/g, "");
const when = (iso) => new Date(iso).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
const minutes = (ms) => (ms >= 60000 ? `${Math.floor(ms / 60000)} min ${Math.round((ms % 60000) / 1000)} s` : `${Math.round(ms / 1000)} s`);
const ms = (value) => (value >= 1000 ? `${(value / 1000).toFixed(2)} s` : `${Math.round(value)} ms`);
const percent = (value) => `${(value * 100).toFixed(value > 0 && value < 0.01 ? 2 : 1)}%`;
const plural = (count, one, many) => `${count} ${count === 1 ? one : many}`;

/* ------------------------------------------------------------ what's what */

// Each Playwright project: the browser and the screen.
const PLATFORMS = {
  chrome: ["Chrome", "Desktop"],
  edge: ["Edge", "Desktop"],
  firefox: ["Firefox", "Desktop"],
  "chrome-mobile": ["Chrome", "Phone"],
  "edge-mobile": ["Edge", "Phone"],
  "firefox-mobile": ["Firefox", "Phone"],
  server: ["Node", "Server (no browser)"],
  "a11y-desktop": ["Chrome", "Desktop"],
  "a11y-phone": ["Chrome", "Phone"],
};
const platform = (project) => (PLATFORMS[project] ?? [project, ""]).filter(Boolean).join(" · ");
const MOBILE = new Set(["chrome-mobile", "edge-mobile", "firefox-mobile"]);

// The functionality each spec file checks (its first describe otherwise).
const FEATURES = {
  "look.spec.ts": "Look and layout",
  "tip.spec.ts": "Know one? Tell us",
  "content.spec.ts": "Server: prank and test checks",
  "i18n.spec.ts@server": "Server: translations complete",
  "links.spec.ts": "Server: link checks",
  "publishing.spec.ts": "Server: publishing",
  "submission-created.spec.ts": "Server: spam and bot holds",
  "views.spec.ts": "Accessibility (WCAG 2.2 AA)",
};

/* ------------------------------------------------------------- the rows */

// One row per test and platform, from a Playwright JSON report.
function playwrightRows(report, pack) {
  const rows = [];
  const walk = (suite, path) => {
    for (const spec of suite.specs ?? []) {
      for (const test of spec.tests ?? []) {
        const file = path[0];
        const server = test.projectName === "server";
        const featureKey = server && file === "i18n.spec.ts" ? "i18n.spec.ts@server" : file;
        const describes = path.slice(1);
        // The first describe names the functionality, unless the file has its own.
        const keepDescribes = featureKey === "i18n.spec.ts@server";
        const functionality = FEATURES[featureKey] ?? describes[0] ?? file;
        const check = [...(keepDescribes ? describes : describes.slice(1)), spec.title].join(" › ");
        const last = test.results?.at(-1) ?? {};
        const errors = (last.errors?.length ? last.errors : last.error ? [last.error] : []).map((e) => plain(e.message));
        const attachment = (test.results ?? []).flatMap((r) => r.attachments ?? []).find((a) => a.name === "axe-violations" && a.body);
        const violations = attachment ? JSON.parse(Buffer.from(attachment.body, "base64").toString("utf8")) : null;
        const [browser, device] = PLATFORMS[test.projectName] ?? [test.projectName, ""];
        rows.push({
          pack: pack === "ui" ? (MOBILE.has(test.projectName) ? "Mobile" : "UI Web") : "Accessibility",
          functionality,
          check,
          project: test.projectName,
          platform: platform(test.projectName),
          browser,
          device,
          result: { expected: "passed", unexpected: "failed", flaky: "flaky", skipped: "skipped" }[test.status],
          seconds: ((last.duration ?? 0) / 1000).toFixed(1),
          detail: violations?.length
            ? violations.map((v) => `${v.id} (${v.impact}): ${v.help}, ${plural(v.targets.length, "element", "elements")}`).join("; ")
            : errorLines(errors[0] ?? ""),
          violations: violations ?? [],
        });
      }
    }
    for (const child of suite.suites ?? []) walk(child, [...path, child.title]);
  };
  for (const suite of report.suites ?? []) walk(suite, [suite.title.replace(/^.*[\\/]/, "")]);
  return rows;
}

// The first useful lines of an error: what was expected and what came instead.
function errorLines(message) {
  const lines = message.split("\n").map((l) => l.trimEnd()).filter((l) => l.trim() && !/^\s*(at |Call log|- |\d+ \||>\s*\d+ \||\||\d+ × locator)/.test(l));
  return lines.slice(0, 5).join("\n");
}

// k6's thresholds (perf/visitors.js), in words: one row each.
const LIMITS = [
  ["http_req_failed", "rate<0.01", "Fewer than 1 in 100 requests fail"],
  ["checks", "rate>0.99", "More than 99 in 100 checks pass"],
  ["http_req_duration{kind:page}", "p(95)<800", "Pages: 95 in 100 within 0.8 s"],
  ["http_req_duration{kind:asset}", "p(95)<1500", "Styles, scripts and images: 95 in 100 within 1.5 s"],
  ["http_req_duration{kind:data}", "p(95)<2000", "Map data: 95 in 100 within 2 s"],
];
const PROFILES = {
  smoke: "Smoke: 1 visitor, 30 s",
  load: "Load: up to 100 visitors, 5 min",
  spike: "Spike: 0 to 200 visitors in 2 min, down to 10, 5½ min",
  soak: "Soak: 20 visitors, 2 hours",
};

function perfRows(data, run) {
  const m = data.metrics;
  // Soak: the last 20 minutes no more than 1.5 times slower than the first.
  const early = m["http_req_duration{phase:early}"];
  const late = m["http_req_duration{phase:late}"];
  const drift = early && late ? [{
    pack: "Performance",
    functionality: `Performance: ${PROFILES[run?.profile] ?? run?.profile ?? "run"}`,
    check: "Doesn't slow down over the run: the last 20 minutes within 1.5× the first",
    project: "k6",
    platform: `k6 · ${run?.base?.includes("localhost") ? "local server" : run?.base ?? "site"}`,
    browser: "k6",
    device: run?.base?.includes("localhost") ? "Local server" : run?.base ?? "",
    result: late["p(95)"] <= Math.max(early["p(95)"] * 1.5, early["p(95)"] + 50) ? "passed" : "failed",
    seconds: "",
    detail: `This run: ${ms(early["p(95)"])} → ${ms(late["p(95)"])}`,
    value: `${ms(early["p(95)"])} → ${ms(late["p(95)"])}`,
  }] : [];
  return [...drift, ...LIMITS.filter(([metric, rule]) => m[metric]?.thresholds?.[rule] !== undefined).map(([metric, rule, label]) => {
    const values = m[metric];
    const actual = rule.startsWith("p(95)") ? ms(values["p(95)"]) : percent(values.value ?? values.rate ?? 0);
    return {
      pack: "Performance",
      functionality: `Performance: ${PROFILES[run?.profile] ?? run?.profile ?? "run"}`,
      check: label,
      project: "k6",
      platform: `k6 · ${run?.base?.includes("localhost") ? "local server" : run?.base ?? "site"}`,
      browser: "k6",
      device: run?.base?.includes("localhost") ? "Local server" : run?.base ?? "",
      result: values.thresholds[rule] ? "failed" : "passed",
      seconds: "",
      detail: `This run: ${actual}`,
      value: actual,
    };
  })];
}

/* ---------------------------------------------------- the previous run */

const COLUMNS = ["Run at", "Pack", "Functionality", "What it checks", "Platform", "Browser", "Device", "Result", "Previous result", "Change", "Duration (s)", "Details"];
const keyOf = (r) => [r.pack, r.functionality, r.check, r.platform].join("\u0001");

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') (field += '"'), i++;
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") row.push(field), (field = "");
    else if (c === "\n") row.push(field), rows.push(row), (row = []), (field = "");
    else if (c !== "\r") field += c;
  }
  if (field || row.length) row.push(field), rows.push(row);
  const [header, ...body] = rows;
  return body.map((cells) => Object.fromEntries(header.map((h, i) => [h.replace(/^﻿/, ""), cells[i] ?? ""])));
}

// When this run started, and so its files' names: 2026-11-10_1305.
const startedAt =
  [read("reports/ui.json")?.stats.startTime, read("reports/a11y.json")?.stats.startTime, read("reports/perf-run.json")?.startedAt].filter(Boolean).sort()[0] ??
  new Date().toISOString();
const pad = (n) => String(n).padStart(2, "0");
const d = new Date(startedAt);
const stamp = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`;
const PDF = `reports/${REPORT}-${stamp}.pdf`;
const CSV = `reports/${RESULTS}-${stamp}.csv`;

// The previous run: the newest CSV that isn't this run's.
const PREVIOUS = reports(RESULTS, ".csv").find((f) => f !== CSV);
const previousRows = PREVIOUS ? parseCsv(readFileSync(`${TESTS}${PREVIOUS}`, "utf8")) : null;
const previous = new Map(
  (previousRows ?? []).map((p) => [keyOf({ pack: p.Pack, functionality: p.Functionality, check: p["What it checks"], platform: p.Platform }), p]),
);
const previousAt = previousRows?.[0]?.["Run at"];

function compare(row) {
  if (!previousRows) return { previous: "", change: "first run" };
  const before = previous.get(keyOf(row));
  if (!before) return { previous: "", change: "new test" };
  const was = before.Result;
  const failedNow = row.result === "failed";
  const failedBefore = was === "failed";
  let change = "same";
  if (failedNow && !failedBefore && was !== "skipped") change = "new failure";
  else if (!failedNow && failedBefore && row.result !== "skipped") change = "fixed";
  else if (failedNow && failedBefore) change = "still failing";
  if (row.value && before.Details) change += ` (was ${before.Details.replace(/^This run: /, "")})`;
  return { previous: was, change };
}

/* --------------------------------------------------------------- build */

const ui = read("reports/ui.json");
const a11y = read("reports/a11y.json");
const perf = read("reports/perf.json");
const perfRun = read("reports/perf-run.json");

const rows = [
  ...(ui ? playwrightRows(ui, "ui") : []),
  ...(a11y ? playwrightRows(a11y, "a11y") : []),
  ...(perf ? perfRows(perf, perfRun) : []),
].map((r) => ({ ...r, ...compare(r) }));

if (!rows.length) {
  console.log("Nothing to report yet: run npm test first.");
  process.exit(0);
}

const runAt = [ui?.stats.startTime, a11y?.stats.startTime, perfRun?.startedAt].filter(Boolean).sort()[0] ?? new Date().toISOString();
const packs = ["UI Web", "Mobile", "Accessibility", "Performance"].map((name) => {
  const own = rows.filter((r) => r.pack === name);
  const tally = { passed: 0, failed: 0, flaky: 0, skipped: 0 };
  for (const r of own) tally[r.result]++;
  const changes = { "new failure": 0, fixed: 0, "still failing": 0, "new test": 0 };
  for (const r of own) for (const k of Object.keys(changes)) if (r.change.startsWith(k)) changes[k]++;
  return { name, rows: own, tally, changes, ran: own.length > 0 };
});
const ran = packs.filter((p) => p.ran);
const troubled = ran.filter((p) => p.tally.failed);

/* ----------------------------------------------------------------- CSV */

const cell = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
const csv =
  "﻿" +
  [COLUMNS.map(cell).join(","), ...rows.map((r) => [runAt, r.pack, r.functionality, r.check, r.platform, r.browser, r.device, r.result, r.previous, r.change, r.seconds, r.detail].map(cell).join(","))].join("\r\n") +
  "\r\n";
writeFileSync(`${TESTS}${CSV}`, csv);

/* ----------------------------------------------------------------- PDF */

const MARK = { passed: "✓", failed: "✗", flaky: "≈", skipped: "–" };
const changeTag = (change) =>
  change.startsWith("new failure") ? `<span class="tag bad">new failure</span>` : change.startsWith("fixed") ? `<span class="tag good">fixed</span>` : change.startsWith("new test") ? `<span class="tag">new</span>` : "";

// A pack's tests: one row per check, a column per platform.
function matrix(pack) {
  const platforms = [...new Set(pack.rows.map((r) => r.platform))];
  const byFeature = new Map();
  for (const r of pack.rows) {
    const checks = byFeature.get(r.functionality) ?? new Map();
    const cells = checks.get(r.check) ?? {};
    cells[r.platform] = r;
    checks.set(r.check, cells);
    byFeature.set(r.functionality, checks);
  }
  const head = `<tr><th class="what">What it checks</th>${platforms.map((p) => `<th class="plat">${esc(p).replace(" · ", "<br>")}</th>`).join("")}<th class="chg">Compared with the previous run</th></tr>`;
  return [...byFeature]
    .map(([feature, checks]) => {
      const lines = [...checks].map(([check, cells]) => {
        const all = Object.values(cells);
        const notes = all.filter((r) => r.change !== "same" && r.change !== "first run").map((r) => `${r.change.replace(/ \(was .*\)/, "")}: ${r.platform}`);
        const same = all.every((r) => r.change === "same");
        return `<tr class="${all.some((r) => r.result === "failed") ? "bad" : ""}"><td class="what">${esc(check)}</td>${platforms
          .map((p) => (cells[p] ? `<td class="plat ${cells[p].result}">${MARK[cells[p].result]}${changeTag(cells[p].change)}</td>` : `<td class="plat none">·</td>`))
          .join("")}<td class="chg">${previousRows ? (same ? "Same" : esc(notes.join("; ") || "Same")) : "First run"}</td></tr>`;
      });
      return `<h3>${esc(feature)}</h3><table class="matrix"><thead>${head}</thead><tbody>${lines.join("")}</tbody></table>`;
    })
    .join("");
}

function failures(pack) {
  const failed = pack.rows.filter((r) => r.result === "failed");
  if (!failed.length) return "";
  const once = new Map();
  for (const r of failed) {
    const key = `${r.functionality} › ${r.check}`;
    const entry = once.get(key) ?? { ...r, platforms: [] };
    entry.platforms.push(r.platform);
    once.set(key, entry);
  }
  return `<h3>What failed, and why</h3><ol class="fails">${[...once.values()]
    .map((f) => `<li><strong>${esc(f.functionality)}</strong>: ${esc(f.check)}<div class="muted">on ${esc(f.platforms.join(", "))}${f.change.startsWith("new failure") ? " · <b>new since the previous run</b>" : f.change.startsWith("still") ? " · also failed in the previous run" : ""}</div>${f.detail ? `<pre>${esc(f.detail)}</pre>` : ""}</li>`)
    .join("")}</ol>`;
}

function a11yRules(pack) {
  const rules = new Map();
  for (const r of pack.rows)
    for (const v of r.violations) {
      const rule = rules.get(v.id) ?? { ...v, views: new Set(), platforms: new Set(), elements: new Set() };
      rule.views.add(r.check);
      rule.platforms.add(r.device);
      v.targets.forEach((t) => rule.elements.add(t));
      rules.set(v.id, rule);
    }
  if (!rules.size) return "";
  const order = { critical: 4, serious: 3, moderate: 2, minor: 1 };
  return `<h3>Accessibility problems, by rule</h3><table class="list"><thead><tr><th>Problem</th><th>How serious</th><th>Where</th><th>Elements</th></tr></thead><tbody>${[...rules.values()]
    .sort((a, b) => (order[b.impact] ?? 0) - (order[a.impact] ?? 0))
    .map((r) => `<tr><td><strong>${esc(r.help)}</strong><div class="muted">${esc(r.id)}</div></td><td class="impact ${esc(r.impact)}">${esc(r.impact)}</td><td>${[...r.views].map(esc).join("<br>")}<div class="muted">${[...r.platforms].join(", ")}</div></td><td>${r.elements.size}<div class="muted">${[...r.elements].slice(0, 3).map(esc).join("<br>")}</div></td></tr>`)
    .join("")}</tbody></table>`;
}

function perfTable(pack) {
  const m = perf.metrics;
  const kinds = [["Pages", "page"], ["Styles, scripts, images", "asset"], ["Map data", "data"]].filter(([, k]) => m[`http_req_duration{kind:${k}}`]);
  return `<div class="numbers"><div><b>${m.http_reqs?.count ?? 0}</b>requests</div><div><b>${(m.http_reqs?.rate ?? 0).toFixed(1)}</b>a second</div><div><b>${m.vus_max?.value ?? m.vus_max?.max ?? "–"}</b>visitors at most</div><div><b>${percent(m.http_req_failed?.value ?? 0)}</b>failed</div></div>
    <table class="list"><thead><tr><th>Limit</th><th>Result</th><th>This run</th><th>Previous run</th></tr></thead><tbody>${pack.rows
      .map((r) => `<tr class="${r.result === "failed" ? "bad" : ""}"><td>${esc(r.check)}</td><td class="${r.result}">${MARK[r.result]} ${r.result === "passed" ? "within" : "missed"}</td><td>${esc(r.value)}</td><td>${r.previous ? `${esc(r.previous)}${(r.change.match(/\(was (.*)\)/) ?? [])[1] ? `, ${esc(r.change.match(/\(was (.*)\)/)[1])}` : ""}` : "–"}</td></tr>`)
      .join("")}</tbody></table>
    <table class="list"><thead><tr><th>Response times</th><th>Typical</th><th>95 in 100 within</th><th>Slowest</th></tr></thead><tbody>${kinds
      .map(([label, k]) => {
        const v = m[`http_req_duration{kind:${k}}`];
        return `<tr><td>${label}</td><td>${ms(v.med)}</td><td>${ms(v["p(95)"])}</td><td>${ms(v.max)}</td></tr>`;
      })
      .join("")}</tbody></table>`;
}

const PACK_INFO = {
  "UI Web": "Everything the site does, in Chrome, Edge and Firefox on a desktop, and the Netlify Functions' checks on the server.",
  Mobile: "Everything the site does, in Chrome, Edge and Firefox on a phone, plus the phone layout.",
  Accessibility: "Every view, scanned by axe-core against WCAG 2.2 AA, in Chrome on a desktop and a phone.",
  Performance: "Virtual visitors loading the site's own files, against the time and failure limits.",
};

const overviewRows = packs
  .map((p) =>
    p.ran
      ? `<tr class="${p.tally.failed ? "bad" : ""}"><td><b>${p.name}</b></td><td class="${p.tally.failed ? "failed" : "passed"}">${p.tally.failed ? "Problems" : "Passed"}</td><td>${p.tally.passed}</td><td>${p.tally.failed}</td><td>${p.tally.flaky + p.tally.skipped}</td><td>${previousRows ? `${p.changes["new failure"]} new failures, ${p.changes.fixed} fixed, ${p.changes["still failing"]} still failing, ${p.changes["new test"]} new` : "first run"}</td></tr>`
      : `<tr class="none"><td><b>${p.name}</b></td><td colspan="5">Not run</td></tr>`,
  )
  .join("");

const sections = ran
  .map(
    (p) => `<section class="pack"><h2>${p.name} <span class="badge ${p.tally.failed ? "bad" : "good"}">${p.tally.failed ? `${plural(new Set(p.rows.filter((r) => r.result === "failed").map((r) => r.check)).size, "check", "checks")} failed` : "All passed"}</span></h2>
      <p class="muted">${PACK_INFO[p.name]}</p>
      ${p.name === "Performance" ? perfTable(p) : `${p.name === "Accessibility" ? a11yRules(p) : ""}${failures(p)}<h3 class="sub">Every check</h3><p class="muted key">✓ passed · ✗ failed · ≈ passed on a retry · – skipped · <span class="tag bad">new failure</span> <span class="tag good">fixed</span> <span class="tag">new</span> compared with the previous run</p>${matrix(p)}`}
    </section>`,
  )
  .join("");

const releaseCheck = KIND ? `Release ${KIND} check of ${process.env.BASE_URL ?? "the live site"}: ` : "";
const headline = releaseCheck + (troubled.length ? `${plural(troubled.length, "pack", "packs")} of ${ran.length} had problems` : ran.length === 1 ? `${ran[0].name} passed` : `All ${ran.length} packs passed`);
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Test report</title><style>
  @page { size: A4; margin: 14mm 12mm 16mm; }
  * { box-sizing: border-box; }
  body { margin: 0; color: #22190f; font: 9.5pt/1.4 "Segoe UI", system-ui, sans-serif; }
  h1 { font-size: 20pt; margin: 0 0 2mm; }
  h2 { font-size: 14pt; margin: 0 0 1mm; display: flex; gap: 3mm; align-items: center; }
  h3 { font-size: 10.5pt; margin: 5mm 0 1.5mm; break-after: avoid; }
  .cover { border-left: 3mm solid ${troubled.length ? "#b3261e" : "#2f7d32"}; padding: 2mm 0 2mm 5mm; margin-bottom: 6mm; }
  .muted { color: #6d5d4b; font-size: 8.5pt; }
  .pack { break-before: page; }
  table { width: 100%; border-collapse: collapse; margin: 1mm 0 3mm; }
  th, td { border-bottom: 0.3mm solid #e3d8c6; padding: 1.2mm 1.5mm; text-align: left; vertical-align: top; }
  th { background: #f4ede0; font-size: 8pt; }
  thead { display: table-header-group; }
  tr { break-inside: avoid; }
  tr.bad td { background: #fdf0ee; }
  tr.none td { color: #8a7b68; }
  .matrix .plat { width: 15mm; text-align: center; font-size: 11pt; }
  .matrix th.plat { font-size: 7pt; }
  .matrix .chg { width: 42mm; font-size: 8pt; }
  .passed { color: #2f7d32; font-weight: 700; } .failed { color: #b3261e; font-weight: 700; } .flaky { color: #a15c00; font-weight: 700; } .skipped, .none { color: #9a8a75; }
  .tag { display: inline-block; margin-left: 1mm; padding: 0 1.2mm; border-radius: 1mm; font-size: 6.5pt; font-weight: 700; color: #22190f; background: #e3d8c6; vertical-align: middle; }
  .tag.bad { background: #b3261e; color: #fff; } .tag.good { background: #2f7d32; color: #fff; }
  .badge { font-size: 9pt; padding: 0.5mm 3mm; border-radius: 10mm; color: #fff; } .badge.good { background: #2f7d32; } .badge.bad { background: #b3261e; }
  .fails li { margin-bottom: 2.5mm; break-inside: avoid; }
  pre { margin: 1mm 0 0; padding: 2mm; background: #f6f1e7; border-radius: 1.5mm; white-space: pre-wrap; word-break: break-word; font-size: 7.5pt; }
  .impact { font-weight: 700; text-transform: capitalize; } .impact.critical, .impact.serious { color: #b3261e; } .impact.moderate { color: #a15c00; }
  .numbers { display: flex; gap: 3mm; margin: 2mm 0 3mm; } .numbers div { flex: 1; background: #f6f1e7; border-radius: 1.5mm; padding: 2mm 3mm; color: #6d5d4b; font-size: 8pt; } .numbers b { display: block; font-size: 14pt; color: #22190f; }
  .key { margin-top: 0; }
</style></head><body>
  <div class="cover">
    <h1>${esc(headline)}</h1>
    <div class="muted">Test report · The World of Ninth Age Communities · run ${when(runAt)}${previousAt ? ` · compared with the run of ${when(previousAt)}` : " · no previous run to compare with"}</div>
  </div>
  <table class="list"><thead><tr><th>Pack</th><th>Result</th><th>Passed</th><th>Failed</th><th>Retried or skipped</th><th>Compared with the previous run</th></tr></thead><tbody>${overviewRows}</tbody></table>
  <p class="muted">Each pack follows on its own pages: what failed and why first, then every check with its result on each platform. The same results, one row per check and platform, are in test-results.csv beside this file.</p>
  ${sections}
</body></html>`;

// --html also keeps the page the PDF is printed from, to look at in a browser.
if (process.argv.includes("--html")) writeFileSync(`${TESTS}reports/test-report.html`, html);
const browser = await chromium.launch({ channel: "chrome" }).catch(() => chromium.launch());
const page = await browser.newPage();
await page.setContent(html, { waitUntil: "load" });
rmSync(`${TESTS}${PDF}`, { force: true });
await page.pdf({
  path: `${TESTS}${PDF}`,
  format: "A4",
  printBackground: true,
  displayHeaderFooter: true,
  headerTemplate: "<span></span>",
  footerTemplate: `<div style="width:100%;font:7pt sans-serif;color:#8a7b68;padding:0 12mm;display:flex;justify-content:space-between"><span>Test report · run ${esc(when(runAt))}</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>`,
  margin: { top: "14mm", bottom: "16mm", left: "12mm", right: "12mm" },
});
await browser.close();

// The two newest of each kept: this run's and the one before.
for (const old of [...reports(REPORT, ".pdf").slice(2), ...reports(RESULTS, ".csv").slice(2)]) rmSync(`${TESTS}${old}`, { force: true });

/* ------------------------------------------------------------- the end */

console.log(`\n${headline}`);
for (const p of ran) console.log(`  ${p.name}: ${p.tally.passed} passed, ${p.tally.failed} failed${previousRows ? `; ${p.changes["new failure"]} new failures, ${p.changes.fixed} fixed` : ""}`);
console.log(`Report: tests/${PDF} and tests/${CSV} (npm run report:pdf and report:csv open them)`);
if (process.env.GITHUB_STEP_SUMMARY) {
  writeFileSync(process.env.GITHUB_STEP_SUMMARY, `## ${headline}\n\n| Pack | Passed | Failed |\n| --- | --- | --- |\n${ran.map((p) => `| ${p.name} | ${p.tally.passed} | ${p.tally.failed} |`).join("\n")}\n\nThe PDF and CSV are in the run's test-reports artifact.\n`, { flag: "a" });
}
if (process.argv.includes("--open")) open(PDF);

function open(file) {
  const opener = process.platform === "win32" ? ["cmd", ["/c", "start", "", file]] : [process.platform === "darwin" ? "open" : "xdg-open", [file]];
  spawn(opener[0], opener[1], { cwd: TESTS, stdio: "ignore", detached: true }).unref();
}
