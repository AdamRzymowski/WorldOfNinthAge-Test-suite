import { test, expect, mockApprovedCommunities } from "../support/test";
import { itemId, items } from "../support/ids";

/** A world-list event's ID: "world-event-<name>-<first day>". */
const event = (name: string, start: string) => itemId("world-event", name, start);

// The world map's events filter (js/world-events.js): the "Show only events" button
// beside the join button, and the panel on the map's right side. The fixture's Polish events are Weekend Doubles
// (7–8 Nov 2026), Test Tournament (5–6 Dec 2026) and Old Cup (1 Oct 2026, past
// by the clock below); each test can add one elsewhere through the approved
// submissions.

test.describe("World map: upcoming events", () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.setFixedTime(new Date("2026-11-10T12:00:00"));
    await mockApprovedCommunities(page, {}, { Germany: [{ community: "Some Club", name: "German Open", start: "2026-11-21", end: "2026-11-22", url: "https://example.com/open" }] });
  });

  test("off at first: the list is closed, and the map shows communities and events", async ({ page, world }) => {
    await world.goto();
    const toggle = world.filterButton("events");
    await expect(toggle).toHaveText("Show only events");
    await expect(toggle).toHaveAttribute("aria-pressed", "false");
    await expect(page.locator("#world-events-panel")).toBeHidden();
    // Red seals count communities; black ones beside them count upcoming events (Poland two, Germany one).
    await expect(page.locator("#community-seals")).toBeVisible();
    await expect(page.locator("#event-seals")).toBeVisible();
    await expect(page.locator("#event-seal-poland-count")).toHaveText("2");
    await expect(page.locator("#event-seal-germany-count")).toHaveText("1");
  });

  test("event seals are black, with gold edges and numbers", async ({ page, world }) => {
    await world.goto();
    await expect(page.locator("#event-seal-poland-circle")).toHaveCSS("fill", "rgb(0, 0, 0)");
  });

  test(`leagues are listed after the other events, and "Show only online events" keeps only online ones, in the list and the seals`, async ({ page, world }) => {
    const nr = (nrId: string, name: string, start: string, online = false) => ({
      name, start, url: `https://www.newrecruit.eu/app/tournydetails/details?id=${nrId}`, source: "newrecruit", nrId, ...(online ? { online: true } : {}),
    });
    await mockApprovedCommunities(
      page,
      {},
      { Germany: [{ community: "Some Club", name: "German Open", start: "2026-11-21", end: "2026-11-22", url: "https://example.com/open" }] },
      {},
      // Both still listed on New Recruit, so still on though they began weeks ago.
      { Germany: [nr("6a2222222222222222222222", "9th Age Hamburg-Liga", "2026-08-23")], France: [nr("6a3333333333333333333333", "En attendant la maj", "2026-10-21", true)] },
    );
    await world.goto();
    await world.filter("events");
    const events = page.locator(items("world-event-list", "world-event"));
    const leagues = page.locator(items("world-league-list", "world-event"));
    const online = event("En attendant la maj", "2026-10-21");
    expect(await events.evaluateAll((els) => els.map((el) => el.id))).toEqual([
      online, event("Weekend Doubles", "2026-11-07"), event("German Open", "2026-11-21"), event("Test Tournament", "2026-12-05"),
    ]);
    await expect(page.locator(`#${online}-name`)).toHaveText("En attendant la maj");
    await expect(page.locator(`#${online}-date`)).toHaveText("Since Wed, 21 Oct 2026");
    await expect(page.locator("#world-leagues-title")).toHaveText("Leagues");
    await expect(page.locator("#world-leagues-title")).toBeVisible();
    expect(await leagues.evaluateAll((els) => els.map((el) => el.id))).toEqual([event("9th Age Hamburg-Liga", "2026-08-23")]);

    // A red button with its tick box inside; tapping the words ticks it too.
    const box = page.locator("#world-events-online");
    const button = page.locator("#world-events-online-label");
    await expect(button).toHaveCSS("background-image", /rgb\(139, 26, 16\)/); // red
    await page.locator("#world-events-online-text").click();
    await expect(box).toBeChecked();
    await expect(button).toHaveCSS("background-image", /rgb\(200, 151, 62\)/); // gold, as a switched-on button
    await expect(events.filter({ visible: true })).toHaveCount(1);
    await expect(page.locator(`#${online}`)).toBeVisible();
    await expect(page.locator("#world-leagues-title")).toBeHidden();
    // The seals count only online events: France's one.
    await expect(page.locator("#event-seals")).toBeHidden();
    await expect(page.locator("#online-seals")).toBeVisible();
    await expect(page.locator(items("online-seals", "online-seal"))).toHaveCount(1);
    await expect(page.locator("#online-seal-france-count")).toHaveText("1");
    await box.uncheck(); // the box itself unticks it
    await expect(events.filter({ visible: true })).toHaveCount(4);
    await expect(leagues).toBeVisible();
    await expect(page.locator("#online-seals")).toBeHidden();
    await expect(page.locator("#event-seals")).toBeVisible();
  });

  test("a country with only events gets a seal, and opens to its events", async ({ page, world, country }) => {
    await mockApprovedCommunities(page, {}, {}, {}, {
      Australia: [{ name: "Backyard Brawl 2026", start: "2026-11-21", url: "https://www.newrecruit.eu/app/tournydetails/details?id=6a1111111111111111111111", source: "newrecruit", nrId: "6a1111111111111111111111" }],
    });
    await world.goto();
    await expect(page.locator("#event-seal-australia-count")).toHaveText("1");
    await world.goto("Australia");
    await expect(country.events).toHaveCount(1);
    await expect(page.locator(`#${itemId("event", "Backyard Brawl 2026", "2026-11-21")}-name`)).toHaveText("Backyard Brawl 2026");
  });

  test("on, every country's upcoming events are listed, soonest first, and only their seals show", async ({ page, world }) => {
    await world.goto();
    await world.filter("events");
    const events = page.locator(items("world-event-list", "world-event"));
    const open = event("German Open", "2026-11-21");
    expect(await events.evaluateAll((els) => els.map((el) => el.id))).toEqual([event("Weekend Doubles", "2026-11-07"), open, event("Test Tournament", "2026-12-05")]);
    await expect(page.locator(`#${open}-where`)).toHaveText("at Some Club · Germany");
    await expect(page.locator(`#${open}-name`)).toHaveText("German Open");
    await expect(page.locator(`#${open}-name`)).toHaveAttribute("href", "https://example.com/open");

    // Only the event seals: Poland has two upcoming, Germany one.
    await expect(page.locator("#event-seals")).toBeVisible();
    await expect(page.locator("#community-seals")).toBeHidden();
    await expect(page.locator("#event-seal-poland-count")).toHaveText("2");
    await expect(page.locator("#event-seal-germany-count")).toHaveText("1");
  });

  test(`the button is under "Learn more about Ninth Age" (in the menu under "Filter on the map" on a phone), the list on the map's right side (under the map on a phone)`, async ({ page, world }) => {
    await world.goto();
    if (!(await world.isPhone())) {
      const learn = (await page.locator("#learn-more-text").boundingBox())!;
      const toggle = world.filterButton("events");
      const button = (await toggle.boundingBox())!;
      await toggle.click();
      const panel = (await page.locator("#world-events-panel").boundingBox())!;
      const map = (await world.map.boundingBox())!;
      expect(button.y).toBeGreaterThanOrEqual(learn.y + learn.height - 1); // under "Learn more"
      expect(Math.abs(button.x + button.width / 2 - (learn.x + learn.width / 2))).toBeLessThan(4); // in its column
      expect(panel.x).toBeGreaterThan(map.x + map.width / 2); // the map's right side
      expect(panel.x + panel.width).toBeLessThanOrEqual(button.x); // left of the buttons, not over them
      expect(panel.x + panel.width).toBeLessThanOrEqual(map.x + map.width);
      expect(panel.y + panel.height).toBeLessThanOrEqual(map.y + map.height + 1);
    } else {
      // Not on the page: in the menu, once "Filter on the map" is opened.
      await expect(world.filterButton("events")).toBeHidden();
      await world.openMenu();
      const item = page.locator("#menu-events-filter");
      await expect(item).toBeHidden();
      await page.locator("#menu-on-map").click();
      await expect(item).toHaveText("Show only events");
      await expect(item).toBeVisible();
      await item.click();
      await expect(page.locator("#phone-menu")).toBeHidden(); // choosing closes the menu
      const panel = (await page.locator("#world-events-panel").boundingBox())!;
      const map = (await world.map.boundingBox())!;
      expect(panel.y).toBeGreaterThanOrEqual(map.y + map.height - 1); // under the map
    }
  });

  test("while it's on, a phone also has \"Show everything again\" over the map; a desktop doesn't", async ({ page, world }) => {
    await world.goto();
    const reset = page.locator("#map-reset");
    await expect(reset).toBeHidden();
    await world.filter("events");
    if (await world.isPhone()) {
      await expect(reset).toBeVisible();
      await reset.click();
      await expect(reset).toBeHidden();
      await expect(world.filterButton("events")).toHaveText("Show only events");
      await expect(page.locator("#community-seals")).toBeVisible();
    } else {
      await expect(reset).toBeHidden();
    }
  });

  test("each event in the list has a Report button, opening the form about it", async ({ page, world, changeForm }) => {
    await world.goto();
    await world.filter("events");
    await expect(page.locator(`#${event("German Open", "2026-11-21")}-report`)).toHaveAttribute("aria-label", "Report German Open");
    await page.locator(`#${event("German Open", "2026-11-21")}-report`).click();
    await expect(changeForm.entry).toHaveText("About the event German Open, Germany");
  });

  test("a country's name in the list opens that country", async ({ page, world, country }) => {
    await world.goto();
    await world.filter("events");
    await expect(page.locator(`#${event("German Open", "2026-11-21")}-country`)).toHaveText("Germany");
    await page.locator(`#${event("German Open", "2026-11-21")}-country`).click();
    await country.expectOpen("Germany");
  });

  test(`on, the button says "Show everything again", and that brings everything back`, async ({ page, world }) => {
    await world.goto();
    await world.filter("events");
    await expect(world.filterButton("events")).toHaveText("Show everything again");
    await world.filter("events");
    await expect(world.filterButton("events")).toHaveText("Show only events");
    await expect(page.locator("#world-events-panel")).toBeHidden();
    await expect(page.locator("#community-seals")).toBeVisible();
    await expect(page.locator("#event-seals")).toBeVisible();
  });
});
