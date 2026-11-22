import { readFileSync } from "node:fs";
import { test, expect } from "../support/test";

// Visual regression (npm run visual): each key view of the live site compared
// with its approved screenshot, inside the network fence and with the fixed
// test data and clock, so only a change in the site's look makes a
// difference. Baselines live in visual/__screenshots__/<platform>/<project>/;
// make or accept them with npm run visual:update (only when asked: each view
// downloads the site), then commit them. Windows and Linux (CI) draw fonts
// differently, so each keeps its own.

const FIXTURE = JSON.parse(readFileSync(new URL("../fixtures/communities.json", import.meta.url), "utf8"));
const MAJOR = [{ name: "Test Open", start: "2026-11-21", end: "2026-11-22", place: "Melle", country: "Germany", links: [{ label: "New Recruit", url: "https://www.newrecruit.eu/" }] }];

test.describe("Visual regression", () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.setFixedTime(new Date("2026-11-10T12:00:00"));
  });

  test("home page", async ({ page, world }) => {
    await world.goto();
    await expect(page).toHaveScreenshot("home.png", { fullPage: true });
  });

  test("home page, phone menu open", async ({ page, world }) => {
    await world.goto();
    test.skip(!(await world.isPhone()), "the phone view's menu");
    await world.openMenu();
    await expect(page.locator("#phone-menu")).toHaveScreenshot("phone-menu.png");
  });

  test("a country", async ({ page, world, country }) => {
    await world.goto("Poland");
    await country.waitForStreetMap();
    await expect(page.locator("#country-dialog")).toHaveScreenshot("country.png");
  });

  test("a community's card", async ({ page, world, country }) => {
    await world.goto("Poland");
    await country.openFromList("Test Club");
    await expect(page.locator("#country-dialog")).toHaveScreenshot("community-card.png");
  });

  test("major global community events", async ({ page, world }) => {
    await page.route("**/data/communities.json", (route) => route.fulfill({ json: { ...FIXTURE, majorEvents: MAJOR } }));
    await world.goto();
    await world.openMajorEvents();
    await expect(page.locator("#major-dialog")).toHaveScreenshot("major-events.png");
  });

  test("Report a bug", async ({ page, world }) => {
    await world.goto();
    await world.openBugReport();
    await expect(page.locator("#bug-dialog")).toHaveScreenshot("bug-report.png");
  });
});
