// Runs a Playwright suite and keeps an HTML report of this run only: the
// previous report (and the last run's screenshots in test-results/) is
// deleted first, so reports never pile up.
//
//   node run-report.mjs ui|a11y [more playwright arguments]
//
// The report goes to reports/ui or reports/a11y (npm run report and
// report:a11y open it), the results as data to reports/ui.json or a11y.json,
// and the PDF and CSV test report (report/build.mjs) is made again after.
import { spawn } from "node:child_process";
import { rmSync } from "node:fs";
import { fileURLToPath } from "node:url";

const TESTS = fileURLToPath(new URL(".", import.meta.url));
const SUITES = { ui: [], a11y: ["-c", "playwright.a11y.config.ts"] };
const [suite = "ui", ...rest] = process.argv.slice(2);
if (!SUITES[suite]) {
  console.error(`Unknown suite "${suite}": ui or a11y`);
  process.exit(1);
}

const folder = `reports/${suite}`;
const alone = !process.env.NO_SUMMARY; // not one pack of npm test
const node = (script) => new Promise((resolve) => spawn(process.execPath, script, { cwd: TESTS, stdio: "inherit" }).on("exit", resolve));
rmSync(`${TESTS}${folder}`, { recursive: true, force: true });
rmSync(`${TESTS}${folder}.json`, { force: true });
rmSync(`${TESTS}test-results`, { recursive: true, force: true });

// Playwright's command line through Node, without a shell, so arguments like
// -g "privacy page" arrive whole on every system.
const run = spawn(process.execPath, [`${TESTS}node_modules/@playwright/test/cli.js`, "test", ...SUITES[suite], ...rest], {
  cwd: TESTS,
  stdio: "inherit",
  env: { ...process.env, HTML_REPORT: folder },
});
run.on("exit", (code) => {
  console.log(`\nReport: tests/${folder}/index.html (npm run ${suite === "ui" ? "report" : "report:a11y"} opens it)`);
  // The PDF and CSV report, with this run in it (npm test makes it once, after every pack).
  if (alone) node(["report/build.mjs"]).then(() => process.exit(code ?? 1));
  else process.exit(code ?? 1);
});
