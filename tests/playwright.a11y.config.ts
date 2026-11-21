import { defineConfig, devices } from "@playwright/test";

// The live site only (see playwright.config.ts).
process.env.BASE_URL ??= "https://t9a-community.com";
// The HTML report's folder, when run through run-report.mjs (npm run
// test:a11y:report), with the results as data beside it for the summary page;
// otherwise only the list in the terminal.
const report = process.env.HTML_REPORT;

// The accessibility suite (a11y/), a run of its own: npm run test:a11y.
// axe-core checks every view against WCAG 2.2 AA in Chrome, on a desktop and
// on a phone, against the live site, inside the same network fence as the specs.
export default defineConfig({
  testDir: "./a11y",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  reporter: report
    ? [["list"], ["html", { open: "never", outputFolder: report }], ["json", { outputFile: `${report}.json` }]]
    : [["list"]],
  use: {
    baseURL: process.env.BASE_URL,
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "a11y-desktop", use: { ...devices["Desktop Chrome"], channel: "chrome", viewport: { width: 1440, height: 900 } } },
    { name: "a11y-phone", use: { ...devices["Pixel 7"], channel: "chrome" } },
  ],
});
