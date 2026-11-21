import { defineConfig, devices } from "@playwright/test";

// The live site only (see playwright.config.ts).
process.env.BASE_URL ??= "https://t9a-community.com";

// The Quality Checker's measuring run (quality/), started by the quality-checker agent: npm run quality.
// Each view in each language at a phone width and a desktop width, inside the suite's network fence.
// QUALITY_WIDTHS=390,1024,1920 measures other widths (under 768 is a phone). Every view downloads the site.
const widths = (process.env.QUALITY_WIDTHS ?? "412,1366").split(",").map(Number).filter(Boolean);

export default defineConfig({
  testDir: "./quality",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  reporter: [["list"]],
  use: { baseURL: process.env.BASE_URL },
  projects: widths.map((width) =>
    width < 768
      ? { name: `quality-phone-${width}`, use: { ...devices["Pixel 7"], channel: "chrome", viewport: { width, height: 915 } } }
      : { name: `quality-desktop-${width}`, use: { ...devices["Desktop Chrome"], channel: "chrome", viewport: { width, height: 900 } } },
  ),
});
