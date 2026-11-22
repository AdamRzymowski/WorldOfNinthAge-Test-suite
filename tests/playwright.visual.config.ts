import { defineConfig, devices } from "@playwright/test";

// The live site only (see playwright.config.ts).
process.env.BASE_URL ??= "https://t9a-community.com";
const report = process.env.HTML_REPORT;

// Visual regression (visual/): npm run visual compares, npm run visual:update
// makes or accepts the baselines. Chrome on a desktop and on a phone. Not part
// of the usual packs: run it only when asked.
export default defineConfig({
  testDir: "./visual",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  reporter: report ? [["list"], ["html", { open: "never", outputFolder: report }]] : [["list"]],
  snapshotPathTemplate: "{testDir}/__screenshots__/{platform}/{projectName}/{arg}{ext}",
  expect: {
    toHaveScreenshot: { maxDiffPixelRatio: 0.01, animations: "disabled", caret: "hide" },
  },
  use: { baseURL: process.env.BASE_URL },
  projects: [
    { name: "visual-desktop", use: { ...devices["Desktop Chrome"], channel: "chrome", viewport: { width: 1440, height: 900 } } },
    { name: "visual-phone", use: { ...devices["Pixel 7"], channel: "chrome" } },
  ],
});
