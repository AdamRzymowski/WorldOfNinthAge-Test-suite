import type { Page } from "@playwright/test";
import { test, expect, mockApprovedCommunities } from "../support/test";

// Test IDs (README.md, "Test IDs"): every element a test uses has an ID of
// its own, so the tests find everything by ID. Each view is checked for IDs
// used twice, and for something a visitor can use (a button, link, field,
// country, seal or marker) without one.

/** IDs used more than once on the page. */
const repeated = (page: Page) =>
  page.evaluate(() => {
    const seen = new Map<string, number>();
    for (const el of document.querySelectorAll("[id]")) seen.set(el.id, (seen.get(el.id) ?? 0) + 1);
    return [...seen].filter(([, n]) => n > 1).map(([id]) => id);
  });

/** What a visitor can use, showing, with no ID: described by tag, class and text. */
const withoutId = (page: Page) =>
  page.evaluate(() => {
    const usable = "button, a[href], input:not([type=hidden]), select, textarea, [role=button], [role=option], [tabindex='0'], .leaflet-marker-icon, .seal";
    return [...document.querySelectorAll<HTMLElement>(usable)]
      .filter((el) => !el.id && el.getClientRects().length > 0)
      // Leaflet's own credit links and the links in blocks translated whole
      // (data-i18n-html) can't hold an ID: their block has one instead.
      .filter((el) => !el.closest(".leaflet-control-attribution, [data-i18n-html]"))
      .map((el) => `<${el.tagName.toLowerCase()} class="${el.className}"> ${(el.textContent ?? "").trim().slice(0, 40)}`);
  });

async function expectIds(page: Page, where: string) {
  expect(await repeated(page), `${where}: IDs used twice`).toEqual([]);
  expect(await withoutId(page), `${where}: usable elements without an ID`).toEqual([]);
}

test.describe("Test IDs", () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.setFixedTime(new Date("2026-11-10T12:00:00"));
  });

  test("every ID is used once, and everything a visitor can use has one: the world map and its filters", async ({ page, world }) => {
    await world.goto();
    await expectIds(page, "home");
    await world.filter("events");
    await expectIds(page, "events shown");
    await world.filter("stores");
    await expectIds(page, "stores shown");
    if (await world.isPhone()) {
      await world.openMenu();
      await page.locator("#menu-on-map").click();
      await expectIds(page, "the menu");
    }
  });

  test("…in a country, its card and lists, and with the filter on", async ({ page, world, country }) => {
    // Two entries with the same name in different lists: still one ID each.
    await mockApprovedCommunities(page, {
      Poland: [{ name: "Test Club", lat: 50.06, lon: 19.94, type: "Person" }],
    });
    await world.goto("Poland");
    await country.waitForStreetMap();
    await expectIds(page, "Poland");
    await country.openFromList("Test Club");
    await expectIds(page, "a card");
    await country.setFilter({ types: ["People", "Communities"] });
    await expectIds(page, "the filter on");
  });

  test("…in every form", async ({ page, world, country }) => {
    await world.goto("Poland");
    await country.waitForStreetMap();
    await country.addButton.click();
    await country.clickStreetMap();
    await expectIds(page, "the banner form");
    await page.locator("#join-close").click();
    await country.addEventButton.click();
    await expectIds(page, "the event form");
  });

  test("…on the privacy page", async ({ page }) => {
    await page.goto("/privacy.html");
    await expectIds(page, "privacy");
  });

  test("items built from a name keep the same ID in every language", async ({ page, world }) => {
    await world.goto("Poland", { lang: "el" });
    await expect(page.locator("#community-test-club")).toBeVisible();
    await expect(page.locator("#country-poland")).toHaveAttribute("aria-label", /^Πολωνία/);
  });
});
