import { defineConfig, devices, type Project } from "@playwright/test";

// This project tests the live site only (it has none of the site's code):
// BASE_URL defaults to it. Set here, before the workers start, so
// support/test.ts fences the network around the same host.
process.env.BASE_URL ??= "https://t9a-community.com";
const DESKTOP = { width: 1440, height: 900 };
const PHONE = devices["Pixel 7"];

// The site's specs (specs/) run in full in every browser, on desktop and on a
// phone: Chrome and Edge as installed (channels), and Firefox. Firefox can't
// pretend to be a phone (no isMobile), so its phone run is a phone-sized touch
// screen with a phone's user agent.
const web: Project[] = [
  { name: "chrome", use: { ...devices["Desktop Chrome"], channel: "chrome", viewport: DESKTOP } },
  { name: "edge", use: { ...devices["Desktop Edge"], channel: "msedge", viewport: DESKTOP } },
  { name: "firefox", use: { ...devices["Desktop Firefox"], viewport: DESKTOP } },
  { name: "chrome-mobile", use: { ...PHONE, channel: "chrome" } },
  { name: "edge-mobile", use: { ...PHONE, channel: "msedge" } },
  {
    name: "firefox-mobile",
    use: {
      browserName: "firefox",
      viewport: PHONE.viewport,
      userAgent: PHONE.userAgent,
      hasTouch: true,
      deviceScaleFactor: PHONE.deviceScaleFactor,
    },
  },
  // Safari's engine (WebKit), on a desktop and an iPhone. Only when named
  // (--browsers=safari or --project=safari): run-packs.mjs leaves it out of
  // the usual runs, so they don't download the site a fourth time.
  { name: "safari", use: { ...devices["Desktop Safari"], viewport: DESKTOP } },
  { name: "safari-mobile", use: { ...devices["iPhone 14"] } },
].map((project) => ({ ...project, testDir: "./specs" }));

// Only the list in the terminal (and GitHub's notes on GitHub), unless run
// through run-report.mjs (npm test, test:report), which sets HTML_REPORT to
// the report's folder: then also the HTML report, and the results as data
// (<folder>.json) for the PDF and CSV report (report/build.mjs).
const report = process.env.HTML_REPORT;

export default defineConfig({
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [
    ["list"],
    ...(process.env.CI ? [["github"] as const] : []),
    ...(report ? [["html", { open: "never", outputFolder: report }] as const, ["json", { outputFile: `${report}.json` }] as const] : []),
  ],
  use: {
    baseURL: process.env.BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  // The Netlify Functions' own checks (the server project) stay in the
  // site's repository: they test its code, which isn't here.
  projects: web,
});
