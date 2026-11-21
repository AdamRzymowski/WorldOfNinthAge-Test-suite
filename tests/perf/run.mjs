// Starts a k6 performance run of perf/visitors.js (see README.md,
// "Performance tests"):
//
//   node perf/run.mjs [smoke|load|spike|soak] [--report] [--url=https://…] [--yes]
//
// soak (2 hours) is only ever started on its own: npm run perf:soak.
//   node perf/run.mjs open        opens the last report
//
// Without --url it runs against the live site, https://t9a-community.com (this
// project has no copy of the site to serve), so it needs --yes. --report keeps an HTML report of this run in
// reports/perf.html and its numbers in reports/perf.json, replacing the
// previous ones, then makes the PDF and CSV test report again (report/build.mjs).
// Another --url sends real
// traffic there, so it needs --yes: every request counts against the Netlify
// account's monthly allowance.
import { spawn } from "node:child_process";
import { mkdirSync, rmSync, existsSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const TESTS = fileURLToPath(new URL("..", import.meta.url));
const REPORT = "reports/perf.html";
const DATA = "reports/perf.json"; // the run's numbers, for the summary page
const META = "reports/perf-run.json"; // what was run, where and when
const PORT = 8092;
const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const url = args.find((a) => a.startsWith("--url="))?.slice(6) ?? "https://t9a-community.com";
const profile = args.find((a) => !a.startsWith("--")) ?? "smoke";
let server = null; // the local site server, when there's no --url
const stop = () => server?.kill();

if (profile === "open") {
  if (!existsSync(`${TESTS}${REPORT}`)) exit("No report yet: run npm run perf:smoke first.");
  const opener = process.platform === "win32" ? ["cmd", ["/c", "start", "", REPORT]] : [process.platform === "darwin" ? "open" : "xdg-open", [REPORT]];
  spawn(opener[0], opener[1], { cwd: TESTS, stdio: "ignore", detached: true }).unref();
  process.exit(0);
}

if (url && !/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/?$/.test(url) && profile !== "smoke") {
  exit(`Only the smoke run may go to ${url}: a ${profile} run downloads gigabytes, against the Netlify account's monthly allowance.`);
}
if (url && !/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/?$/.test(url) && !flag("yes")) {
  exit(`This sends real traffic to ${url}, which counts against the Netlify account's monthly allowance.\nAdd --yes to go ahead.`);
}

const base = url ?? `http://localhost:${PORT}`;
process.on("SIGINT", () => (stop(), process.exit(130)));

try {
  if (server) await waitFor(`${base}/index.html`);
  const env = { ...process.env, BASE_URL: base, PROFILE: profile };
  if (flag("report")) {
    mkdirSync(`${TESTS}reports`, { recursive: true });
    for (const file of [REPORT, DATA, META]) rmSync(`${TESTS}${file}`, { force: true });
    Object.assign(env, { K6_WEB_DASHBOARD: "true", K6_WEB_DASHBOARD_EXPORT: REPORT, K6_WEB_DASHBOARD_OPEN: "false" });
  }
  console.log(`k6: ${profile} run against ${base}${flag("report") ? `, report in tests/${REPORT}` : ""}`);
  const startedAt = new Date().toISOString();
  const k6Args = ["run", ...(flag("report") ? ["--summary-export", DATA] : []), "perf/visitors.js"];
  const code = await new Promise((resolve) => {
    const k6 = spawn("k6", k6Args, { cwd: TESTS, env, stdio: "inherit" });
    k6.on("error", () => resolve(exit("k6 isn't installed: see README.md, \"Performance tests\".")));
    k6.on("exit", (c) => resolve(c ?? 1));
  });
  stop();
  if (flag("report")) {
    writeFileSync(`${TESTS}${META}`, JSON.stringify({ profile, base, startedAt, finishedAt: new Date().toISOString(), exitCode: code }));
    if (existsSync(`${TESTS}${REPORT}`)) console.log(`Report: tests/${REPORT} (npm run report:perf opens it)`);
    if (!process.env.NO_SUMMARY) await new Promise((resolve) => spawn(process.execPath, ["report/build.mjs"], { cwd: TESTS, stdio: "inherit" }).on("exit", resolve));
  }
  process.exit(code);
} catch (err) {
  stop();
  exit(err.message);
}

async function waitFor(address) {
  for (let i = 0; i < 50; i++) {
    try {
      if ((await fetch(address)).ok) return;
    } catch {
      // Not up yet.
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`The local server didn't start on ${address}`);
}

function exit(message) {
  console.error(message);
  stop();
  process.exit(1);
}
