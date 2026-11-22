import { defineConfig, devices } from "@playwright/test";

// The live site only (see playwright.config.ts).
process.env.BASE_URL ??= "https://t9a-community.com";
const report = process.env.HTML_REPORT;

// Web Vitals budget (vitals/): npm run vitals. Chrome (the vitals APIs are
// Chromium's) on a desktop and on a phone, one test at a time so runs don't
// slow each other down. Not part of the usual packs: run it only when asked.
export default defineConfig({
  testDir: "./vitals",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  reporter: report ? [["list"], ["html", { open: "never", outputFolder: report }]] : [["list"]],
  use: { baseURL: process.env.BASE_URL },
  projects: [
    { name: "vitals-desktop", use: { ...devices["Desktop Chrome"], channel: "chrome", viewport: { width: 1440, height: 900 } } },
    { name: "vitals-phone", use: { ...devices["Pixel 7"], channel: "chrome" } },
  ],
});
