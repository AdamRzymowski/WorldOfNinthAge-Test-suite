// npm test: asks which test packs to run, runs them one after another, each
// keeping a fresh report, then makes the PDF and CSV test report of this run,
// compared with the previous one (report/build.mjs; see README.md, "Tests").
// The packs:
//
// Every run tests the live site, https://t9a-community.com (or --base-url).
//
//   web     UI Web: Chrome, Edge and Firefox on a desktop
//   mobile  Mobile: Chrome, Edge and Firefox on a phone
//   a11y    Accessibility: axe-core against WCAG 2.2 AA
//   perf    Performance: a k6 smoke run of the live site (1 visitor, 30 s)
//
// UI Web, Mobile and Accessibility come ticked (Enter runs them); Performance
// only runs when ticked or named. To skip the question:
//
//   node run-packs.mjs --packs=web,mobile,a11y,perf [--perf=smoke|load|spike] [--headed]
//   node run-packs.mjs --packs=all        UI Web, Mobile and Accessibility
//
// Without a terminal to ask in (GitHub Actions) and no --packs, it runs those three.
//
// A release check of the live site (.claude/skills/release-tests):
//
//   node run-packs.mjs --packs=web,mobile,a11y --base-url=https://t9a-community.com --kind=sanity|regression [--browsers=chrome]
//
// --base-url tests another deployed site instead of the live one;
// --kind names the report (release-sanity-report-...); --browsers keeps only
// those browsers' projects: chrome, edge, firefox, safari (WebKit, only
// when named) (each test loads the site, against Netlify's
// allowance).
//
// Anything else is passed on to Playwright, e.g. a spec file or -g "words".
import { spawn } from "node:child_process";
import { rmSync } from "node:fs";
import { emitKeypressEvents } from "node:readline";
import { fileURLToPath } from "node:url";

const TESTS = fileURLToPath(new URL(".", import.meta.url));
const PACKS = [
  { id: "web", label: "UI Web", hint: "Chrome, Edge and Firefox on a desktop", projects: ["chrome", "edge", "firefox", "safari"] },
  { id: "mobile", label: "Mobile", hint: "Chrome, Edge and Firefox on a phone", projects: ["chrome-mobile", "edge-mobile", "firefox-mobile", "safari-mobile"] },
  { id: "a11y", label: "Accessibility", hint: "every view against WCAG 2.2 AA, desktop and phone" },
  { id: "perf", label: "Performance", hint: "k6 smoke run of the live site: 1 visitor, 30 seconds" },
];
// What "run tests" means without more said: the UI and accessibility packs.
// Performance only when asked for by name (and soak, 2 hours, never from here:
// npm run perf:soak).
const DEFAULT = ["web", "mobile", "a11y"];
// Only smoke may go to the live site: load, spike and soak download gigabytes,
// against the Netlify account's monthly allowance.
const PROFILES = [{ id: "smoke", label: "Smoke", hint: "1 visitor, 30 seconds" }];

const args = process.argv.slice(2);
const option = (name) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const headed = args.includes("--headed");
const passOn = args.filter((a) => !/^--(packs|perf|base-url|kind|browsers)=/.test(a) && a !== "--headed");
const baseUrl = option("base-url") ?? "https://t9a-community.com";
const kind = option("kind");
const browsers = option("browsers")?.split(",").map((s) => s.trim()).filter(Boolean);
if (kind && !["sanity", "regression"].includes(kind)) fail(`Unknown --kind "${kind}": sanity or regression.`);
const interactive = process.stdin.isTTY && process.stdout.isTTY;

let chosen;
const given = option("packs");
if (given) {
  chosen = given === "all" ? DEFAULT : given.split(",").map((s) => s.trim()).filter(Boolean);
  const unknown = chosen.filter((id) => !PACKS.some((p) => p.id === id));
  if (unknown.length) fail(`Unknown pack: ${unknown.join(", ")}. The packs: ${PACKS.map((p) => p.id).join(", ")}, or all.`);
} else if (interactive) {
  chosen = await pick("Which test packs should run?", PACKS, { multiple: true, ticked: DEFAULT });
} else {
  chosen = DEFAULT; // no terminal to ask in: the usual run
}

if (kind && chosen.includes("perf")) fail("Performance never runs from a release check.");

let profile = option("perf");
if (chosen.includes("perf") && !profile) profile = "smoke";
if (profile && !PROFILES.some((p) => p.id === profile)) fail(`Unknown performance run "${profile}": only smoke goes to the live site.`);

// This run's data only: the report shows the packs run now (the others as
// not run). Earlier reports stay, the two newest kept (report/build.mjs).
for (const file of ["ui", "ui.json", "a11y", "a11y.json", "perf.html", "perf.json", "perf-run.json"]) {
  rmSync(`${TESTS}reports/${file}`, { recursive: true, force: true });
}

const runs = [];
const projects = PACKS.filter((p) => p.projects && chosen.includes(p.id))
  .flatMap((p) => p.projects)
  // Safari (WebKit) only when named: --browsers=safari, or with others (chrome,safari).
  .filter((name) => (browsers ? browsers.some((b) => name === b || name.startsWith(`${b}-`)) : !name.startsWith("safari")));
if (projects.length) {
  const label = PACKS.filter((p) => p.projects && chosen.includes(p.id)).map((p) => p.label).join(" + ");
  runs.push([label, ["run-report.mjs", "ui", ...projects.map((p) => `--project=${p}`), ...(headed ? ["--headed"] : []), ...passOn]]);
}
if (chosen.includes("a11y")) runs.push(["Accessibility", ["run-report.mjs", "a11y", ...(headed ? ["--headed"] : []), ...passOn]]);
if (chosen.includes("perf")) runs.push([`Performance (${profile})`, ["perf/run.mjs", profile, "--report", `--url=${baseUrl}`, "--yes"]]);

const releaseEnv = { BASE_URL: baseUrl, ...(kind ? { REPORT_KIND: kind } : {}) };
const run = (cmd) => new Promise((resolve) => spawn(process.execPath, cmd, { cwd: TESTS, stdio: "inherit", env: { ...process.env, NO_SUMMARY: "1", ...releaseEnv } }).on("exit", (code) => resolve(code ?? 1)));

console.log(`\nRunning: ${runs.map(([label]) => label).join(", ")}`);
const failed = [];
for (const [label, cmd] of runs) {
  console.log(`\n=== ${label} ===\n`);
  if ((await run(cmd)) !== 0) failed.push(label);
}
await new Promise((resolve) => spawn(process.execPath, ["report/build.mjs", ...(interactive ? ["--open"] : [])], { cwd: TESTS, stdio: "inherit", env: { ...process.env, ...releaseEnv } }).on("exit", resolve));
if (failed.length) console.log(`\nWith problems: ${failed.join(", ")}`);
process.exit(failed.length ? 1 : 0);

/* --------------------------------------------------------------- the question */

// A list to choose from with the arrow keys: Space ticks one (multiple), A
// ticks all, Enter confirms. Resolves to the chosen ids.
function pick(question, choices, { multiple = false, initial = 0, ticked: preset = [] } = {}) {
  return new Promise((resolve) => {
    let cursor = initial;
    const ticked = new Set(preset);
    let note = "";
    const { stdin, stdout } = process;
    emitKeypressEvents(stdin);
    stdin.setRawMode(true);
    stdin.resume();
    const help = multiple ? "↑↓ move · Space tick · A all · Enter run" : "↑↓ move · Enter choose";
    let drawn = 0;
    const draw = () => {
      if (drawn) stdout.write(`\x1b[${drawn}A\x1b[0J`);
      const lines = [`\x1b[1m? ${question}\x1b[0m  \x1b[2m${help}\x1b[0m`];
      choices.forEach((c, i) => {
        const mark = multiple ? (ticked.has(c.id) ? "\x1b[32m◉\x1b[0m" : "◯") : i === cursor ? "\x1b[36m●\x1b[0m" : "○";
        const pointer = i === cursor ? "\x1b[36m❯\x1b[0m" : " ";
        lines.push(`${pointer} ${mark} ${i === cursor ? `\x1b[1m${c.label}\x1b[0m` : c.label}  \x1b[2m${c.hint}\x1b[0m`);
      });
      lines.push(note ? `\x1b[33m${note}\x1b[0m` : "");
      stdout.write(lines.join("\n") + "\n");
      drawn = lines.length;
    };
    const done = (ids) => {
      stdin.off("keypress", onKey);
      stdin.setRawMode(false);
      stdin.pause();
      stdout.write(`\x1b[${drawn}A\x1b[0J\x1b[1m? ${question}\x1b[0m ${choices.filter((c) => ids.includes(c.id)).map((c) => c.label).join(", ")}\n`);
      resolve(ids);
    };
    const onKey = (_, key = {}) => {
      if (key.ctrl && key.name === "c") {
        stdin.setRawMode(false);
        process.exit(130);
      }
      note = "";
      if (key.name === "up") cursor = (cursor + choices.length - 1) % choices.length;
      else if (key.name === "down") cursor = (cursor + 1) % choices.length;
      else if (multiple && key.name === "space") ticked.has(choices[cursor].id) ? ticked.delete(choices[cursor].id) : ticked.add(choices[cursor].id);
      else if (multiple && key.name === "a") ticked.size === choices.length ? ticked.clear() : choices.forEach((c) => ticked.add(c.id));
      else if (key.name === "return") {
        if (!multiple) return done([choices[cursor].id]);
        if (ticked.size) return done(choices.filter((c) => ticked.has(c.id)).map((c) => c.id));
        note = "Tick at least one with Space.";
      }
      draw();
    };
    stdin.on("keypress", onKey);
    draw();
  });
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
