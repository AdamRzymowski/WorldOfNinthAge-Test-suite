import { readFileSync } from "node:fs";
import type { Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { test, expect, mockAddress } from "../support/test";
import { itemId } from "../support/ids";

// Accessibility: every view of the site, scanned by axe-core against WCAG 2.2
// AA (playwright.a11y.config.ts runs it in Chrome, desktop and phone). A
// failure lists each rule broken, how badly, and the first places it's
// broken, e.g. "color-contrast (serious): Elements must meet minimum color
// contrast ratio thresholds × 3: .tag, …".

const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const FIXTURE = JSON.parse(readFileSync(new URL("../fixtures/communities.json", import.meta.url), "utf8"));

async function expectAccessible(page: Page, scope?: string) {
  // Wait for opening animations, so colours are measured as they end up.
  await page.evaluate(() => Promise.all(document.getAnimations().filter((a) => a.effect?.getTiming().iterations !== Infinity).map((a) => a.finished)));
  let axe = new AxeBuilder({ page }).withTags(WCAG);
  if (scope) axe = axe.include(scope);
  const { violations } = await axe.analyze();
  // For the reports: the PDF groups these by rule (report/build.mjs).
  await test.info().attach("axe-violations", {
    contentType: "application/json",
    body: JSON.stringify(violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, helpUrl: v.helpUrl, targets: v.nodes.map((n) => n.target.join(" ")) }))),
  });
  const found = violations.map(
    (v) => `${v.id} (${v.impact}): ${v.help} × ${v.nodes.length}: ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(", ")}`,
  );
  expect(found).toEqual([]);
}

test.describe("Accessibility (WCAG 2.2 AA)", () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.setFixedTime(new Date("2026-11-10T12:00:00"));
  });

  test("home page", async ({ page, world }) => {
    await world.goto();
    await expectAccessible(page);
  });

  test("home page, the phone menu open", async ({ page, world }) => {
    await world.goto();
    test.skip(!(await world.isPhone()), "the menu is the phone view's");
    await world.openMenu();
    await page.locator("#menu-on-map").click();
    await expectAccessible(page);
  });

  test("home page, upcoming events shown", async ({ page, world }) => {
    await world.goto();
    await world.filter("events");
    await expectAccessible(page);
  });

  test("home page, choosing a country to join, with the country list open", async ({ page, world }) => {
    await world.goto();
    await page.locator("#join-button").click();
    await page.locator("#join-country").fill("ger");
    await expectAccessible(page);
  });

  test("home page, stores shown", async ({ page, world }) => {
    await world.goto();
    await world.filter("stores");
    await expectAccessible(page);
  });

  test("major events", async ({ page, world }) => {
    const majorEvents = [{ name: "Test Open", start: "2026-11-21", end: "2026-11-22", place: "Melle", country: "Germany", links: [{ label: "New Recruit", url: "https://www.newrecruit.eu/" }] }];
    await page.route("**/data/communities.json", (route) => route.fulfill({ json: { ...FIXTURE, majorEvents } }));
    await world.goto();
    await world.openMajorEvents();
    await expectAccessible(page, "#major-dialog");
  });

  test("a country", async ({ page, world, country }) => {
    await world.goto("Poland");
    await country.waitForStreetMap();
    await expectAccessible(page, "#country-dialog");
  });

  test("a country with nothing on the map yet", async ({ page, world }) => {
    await world.goto("Spain");
    await expectAccessible(page, "#country-dialog");
  });

  test("a community's card", async ({ page, world, country }) => {
    await world.goto("Poland");
    await country.openFromList("Test Club");
    await expectAccessible(page, "#country-dialog");
  });

  test("a store's card, with what it sells", async ({ page, world, country }) => {
    await world.goto("France");
    await country.openFromList("Test Store");
    await expect(page.locator("#community-card-tag-sells-miniatures")).toHaveText("Sells T9A-compatible miniatures");
    await expectAccessible(page, "#country-dialog");
  });

  test("the banner form, and its required notes", async ({ page, world, country, joinForm }) => {
    await world.goto("Poland");
    await country.waitForStreetMap();
    await country.addButton.click();
    await country.clickStreetMap();
    await expectAccessible(page, "#join-dialog");
    await joinForm.submitButton.click();
    await expectAccessible(page, "#join-dialog");
  });

  test("the banner form's \"Your town or city?\"", async ({ page, world, country, joinForm }) => {
    await world.goto("Poland");
    await country.waitForStreetMap();
    await country.addButton.click();
    await country.clickStreetMap();
    await joinForm.fill({ name: "New Club", type: "Person", gamingSpace: false, discord: "discord.gg/newclub" });
    await joinForm.submit({ askTown: true });
    await expectAccessible(page, "#town-check");
  });

  test("the banner form for a Store, with its tick boxes for what it sells", async ({ page, world, country, joinForm }) => {
    await world.goto("Poland");
    await country.waitForStreetMap();
    await country.addButton.click();
    await country.clickStreetMap();
    await joinForm.fill({ type: "Store", sellsMaterials: true });
    await expect(page.locator("#join-sells")).toBeVisible();
    await expectAccessible(page, "#join-dialog");
  });

  test("Update your banner, filled in from a card", async ({ page, world, country, joinForm }) => {
    await world.goto("France");
    await country.openFromList("Test Store");
    await page.locator("#community-card-update").click();
    await expect(page.locator("#join-title")).toHaveText("Update your banner");
    await expectAccessible(page, "#join-dialog");
  });

  test("Which country?", async ({ page, world, country, joinForm }) => {
    await mockAddress(page, { lat: 52.52, lon: 13.405 });
    await world.goto("Poland");
    await country.waitForStreetMap();
    await country.addButton.click();
    await country.clickStreetMap();
    await joinForm.fill({ name: "New Club", type: "Club/Community", gamingSpace: true, address: "Alexanderplatz 1, Berlin", discord: "discord.gg/newclub" });
    await joinForm.submit();
    await expect(page.locator("#country-check")).toBeVisible();
    await expectAccessible(page, "#country-check");
  });

  test("the event form", async ({ page, world, country, eventForm }) => {
    await world.goto("Poland");
    await country.addEventButton.click();
    await expectAccessible(page, "#event-dialog");
    await eventForm.sendButton.click();
    await expectAccessible(page, "#event-dialog");
  });

  test("Know one? Tell us.", async ({ page, world, country }) => {
    await world.goto("Spain");
    await country.tipButton.click();
    await expectAccessible(page, "#tip-dialog");
  });

  test("Report a bug", async ({ page, world }) => {
    await world.goto();
    await world.openBugReport();
    await expectAccessible(page, "#bug-dialog");
  });

  test("Report a bug: a missing title, then sent", async ({ page, world }) => {
    await world.goto();
    await world.openBugReport();
    await page.locator("#bug-submit").click();
    await expect(page.locator("#bug-error")).toBeVisible();
    await expectAccessible(page, "#bug-dialog");
    await page.locator("#bug-title-input").fill("The map doesn't load");
    await page.locator("#bug-description").fill("On my phone the map stays blank.");
    await page.locator("#bug-submit").click();
    await expect(page.locator("#bug-done")).toBeVisible();
    await expectAccessible(page, "#bug-dialog");
  });

  test("Request deletion", async ({ page, world, country }) => {
    await world.goto("Poland");
    await country.openFromList("Test Club");
    await page.locator("#community-card-request-deletion").click();
    await expectAccessible(page, "#change-dialog");
  });

  test("Report an event, as a report with the good-faith tick", async ({ page, world, country }) => {
    await world.goto("Poland");
    await page.locator(`#${itemId("event", "Weekend Doubles", "2026-11-07")}-report`).click();
    await page.locator("#change-kind-report").check();
    await expect(page.locator("#change-good-faith")).toBeVisible();
    await expectAccessible(page, "#change-dialog");
  });

  test("Add images", async ({ page, world, country }) => {
    await world.goto("Poland");
    await country.openFromList("Test Club");
    await page.locator("#community-card-add-images").click();
    await expectAccessible(page, "#gallery-dialog");
  });

  test("privacy page", async ({ page }) => {
    await page.goto("/privacy.html");
    await expectAccessible(page);
  });

  // The privacy note's blocks are translated whole, links and lists included.
  for (const lang of ["pl", "de", "el"]) {
    test(`privacy page in ${lang}`, async ({ page, world }) => {
      await world.goto("", { lang });
      await page.goto("/privacy.html");
      await expect(page.locator("#privacy-root")).toHaveAttribute("lang", lang);
      await expectAccessible(page);
    });
  }

  // Translations can change what's readable or labelled: two long ones, and
  // Greek in its own alphabet.
  for (const lang of ["pl", "de", "el"]) {
    test(`home page and a country in ${lang}`, async ({ page, world, country }) => {
      await world.goto("", { lang });
      await expectAccessible(page);
      await world.goto("Poland", { lang });
      await country.waitForStreetMap();
      await expectAccessible(page, "#country-dialog");
    });
  }
});
