// The manual tests' screenshots and versions: runs the UI specs in Chrome on
// a desktop and on a phone, keeping each passing test's last screen as its
// expected result (screenshots/, replaced each time), and notes the app's
// version for every test that passed (validity.json: the version each test
// was last valid in). Then build.mjs makes the PDF: npm run manual.
import { spawn, execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const HERE = fileURLToPath(new URL(".", import.meta.url));
const TESTS = fileURLToPath(new URL("..", import.meta.url));
const SHOTS = `${HERE}screenshots`;
const RESULTS = `${HERE}.capture.json`;
const VALIDITY = `${HERE}validity.json`;

// The app's version: the version-X.Y branch being worked on.
export function appVersion() {
  try {
    const branch = execSync("git rev-parse --abbrev-ref HEAD", { cwd: TESTS }).toString().trim();
    const m = branch.match(/^version-(\d+\.\d+)$/);
    if (m) return m[1];
    const last = execSync("git branch --list \"version-*\" --sort=-committerdate --format=%(refname:short)", { cwd: TESTS }).toString().split("\n")[0];
    return last.replace(/^version-/, "") || branch;
  } catch {
    return "unknown";
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  rmSync(SHOTS, { recursive: true, force: true });
  mkdirSync(SHOTS, { recursive: true });
  rmSync(RESULTS, { force: true });

  const code = await new Promise((resolve) =>
    spawn(process.execPath, [`${TESTS}node_modules/@playwright/test/cli.js`, "test", "--project=chrome", "--project=chrome-mobile", "--reporter=list,json"], {
      cwd: TESTS,
      stdio: "inherit",
      env: { ...process.env, MANUAL_SHOTS: SHOTS, PLAYWRIGHT_JSON_OUTPUT_NAME: RESULTS },
    }).on("exit", (c) => resolve(c ?? 1)),
  );

  // Each test that passed (on either screen) was valid in this version.
  const version = appVersion();
  const today = new Date().toISOString().slice(0, 10);
  const validity = existsSync(VALIDITY) ? JSON.parse(readFileSync(VALIDITY, "utf8")) : {};
  const report = existsSync(RESULTS) ? JSON.parse(readFileSync(RESULTS, "utf8")) : { suites: [] };
  const passed = new Set();
  const walk = (suite, path) => {
    for (const spec of suite.specs ?? []) {
      for (const t of spec.tests ?? []) if (t.status === "expected" || t.status === "flaky") passed.add([path[0], ...path.slice(2), spec.title].join(" › "));
    }
    for (const child of suite.suites ?? []) walk(child, [...path, child.title]);
  };
  for (const suite of report.suites ?? []) walk(suite, [suite.title.replace(/^.*[\\/]/, "")]);
  for (const key of passed) validity[key] = { version, date: today };
  writeFileSync(VALIDITY, JSON.stringify(Object.fromEntries(Object.entries(validity).sort()), null, 1) + "\n");
  rmSync(RESULTS, { force: true });
  console.log(`\n${passed.size} tests passed: marked valid in version ${version}.`);
  if (code !== 0) console.log("Some tests failed: their cases keep the version they were last valid in, and the screenshot is missing.");
}
