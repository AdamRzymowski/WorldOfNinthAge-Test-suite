import { test, expect, mockApprovedCommunities } from "../support/test";
import { itemId, items } from "../support/ids";

// The world map's stores filter (js/world-stores.js): the "Show only stores" button
// beside "Show only events", and the panel on the map's right side. The fixture's
// Test Store (Paris, France) sells T9A-compatible miniatures and materials;
// each test adds Germany's Berlin Minis (sells miniatures), Dresden Trays
// (sells materials only) and Hamburg Games (sells neither) through the
// approved submissions.

test.describe("World map: stores", () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.setFixedTime(new Date("2026-11-10T12:00:00"));
    await mockApprovedCommunities(page, {
      Germany: [
        { name: "Berlin Minis", lat: 52.52, lon: 13.4, type: "Store", gamingSpace: false, sellsMiniatures: true, region: "Berlin" },
        { name: "Dresden Trays", lat: 51.05, lon: 13.74, type: "Store", gamingSpace: false, sellsMiniatures: false, sellsMaterials: true, region: "Dresden" },
        { name: "Hamburg Games", lat: 53.55, lon: 10, type: "Store", gamingSpace: true, sellsMiniatures: false, sellsMaterials: false, region: "Hamburg" },
      ],
    });
  });

  test("off at first: the list is closed, and the map shows communities and events", async ({ page, world }) => {
    await world.goto();
    const toggle = world.filterButton("stores");
    await expect(toggle).toHaveText("Show only stores");
    await expect(toggle).toHaveAttribute("aria-pressed", "false");
    await expect(page.locator("#world-stores-panel")).toBeHidden();
    await expect(page.locator("#store-seals")).toBeHidden();
  });

  test("on, only the stores selling T9A miniatures or materials are listed, by country, and the seals count them", async ({ page, world }) => {
    await world.goto();
    await world.filter("stores");
    await expect(page.locator("#world-stores-title")).toHaveText("Stores selling T9A miniatures or materials");
    await expect(page.locator("#stores-note")).toHaveText("Stores are listed as they describe themselves. A listing isn't a recommendation, and we don't check what they sell or whether it's licensed.");
    const stores = page.locator(items("world-store-list", "world-store"));
    const listed = [["France", "Test Store"], ["Germany", "Berlin Minis"], ["Germany", "Dresden Trays"]];
    expect(await stores.evaluateAll((els) => els.map((el) => el.id))).toEqual(listed.map(([where, name]) => itemId("world-store", where, name)));
    for (const [where, name] of listed) await expect(page.locator(`#${itemId("world-store", where, name)}-name`)).toHaveText(name);
    await expect(page.locator(`#${itemId("world-store", "Germany", "Berlin Minis")}-where`)).toHaveText("Berlin · Germany");

    // Only the store seals: one in France, two in Germany.
    await expect(page.locator("#store-seals")).toBeVisible();
    for (const other of ["#community-seals", "#event-seals", "#online-seals"]) await expect(page.locator(other)).toBeHidden();
    await expect(page.locator("#store-seal-france-count")).toHaveText("1");
    await expect(page.locator("#store-seal-germany-count")).toHaveText("2");
  });

  test("the button is under Show only events (in the menu too, on a phone), the list in the same place as the events'", async ({ page, world }) => {
    await world.goto();
    const phone = await world.isPhone();
    if (phone) {
      await world.openMenu();
      await page.locator("#menu-on-map").click();
    }
    const events = (await page.locator(phone ? "#menu-events-filter" : "#world-events-toggle").boundingBox())!;
    const toggle = page.locator(phone ? "#menu-stores-filter" : "#world-stores-toggle");
    const button = (await toggle.boundingBox())!;
    await toggle.click();
    const panel = (await page.locator("#world-stores-panel").boundingBox())!;
    const map = (await world.map.boundingBox())!;
    expect(button.y).toBeGreaterThanOrEqual(events.y + events.height - 1); // under it
    expect(Math.abs(button.x - events.x)).toBeLessThan(2); // lined up
    if (!phone) {
      expect(panel.x).toBeGreaterThan(map.x + map.width / 2); // the map's right side
      expect(panel.x + panel.width).toBeLessThanOrEqual(map.x + map.width);
    } else {
      await expect(page.locator("#phone-menu")).toBeHidden(); // choosing closes the menu
      expect(panel.y).toBeGreaterThanOrEqual(map.y + map.height - 1); // under the map
    }
  });

  test("a store's name opens its card; a country's name opens the country", async ({ page, world, country }) => {
    await world.goto();
    await world.filter("stores");
    await page.locator(`#${itemId("world-store", "Germany", "Berlin Minis")}-name`).click();
    await country.expectOpen("Germany");
    await expect(page.locator("#community-card-title")).toHaveText("Berlin Minis");
    await page.goto("/");
    await world.filter("stores");
    await expect(page.locator(`#${itemId("world-store", "France", "Test Store")}-country`)).toHaveText("France");
    await page.locator(`#${itemId("world-store", "France", "Test Store")}-country`).click();
    await country.expectOpen("France");
  });

  test("one filter at a time: Show only stores turns Show only events off, and back", async ({ page, world }) => {
    await world.goto();
    const events = world.filterButton("events");
    const stores = world.filterButton("stores");
    await world.filter("events");
    await world.filter("stores");
    await expect(events).toHaveText("Show only events");
    await expect(events).toHaveAttribute("aria-pressed", "false");
    await expect(page.locator("#world-events-panel")).toBeHidden();
    await expect(page.locator("#event-seals")).toBeHidden();
    await expect(stores).toHaveText("Show everything again");
    await world.filter("events");
    await expect(stores).toHaveText("Show only stores");
    await expect(page.locator("#world-stores-panel")).toBeHidden();
    await expect(page.locator("#store-seals")).toBeHidden();
    await expect(page.locator("#event-seals")).toBeVisible();
  });

  test(`on, the button says "Show everything again", and that brings everything back`, async ({ page, world }) => {
    await world.goto();
    await world.filter("stores");
    await expect(world.filterButton("stores")).toHaveText("Show everything again");
    await world.filter("stores");
    await expect(world.filterButton("stores")).toHaveText("Show only stores");
    await expect(page.locator("#world-stores-panel")).toBeHidden();
    await expect(page.locator("#community-seals")).toBeVisible();
    await expect(page.locator("#event-seals")).toBeVisible();
  });
});
