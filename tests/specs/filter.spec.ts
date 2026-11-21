import { test, expect, mockApprovedCommunities } from "../support/test";
import { item, itemId, items } from "../support/ids";

// The country filter (js/filter.js, CR-12): a button per kind ("Show people",
// "Show stores", "Show events", "Show communities") and "Show entries with
// gaming space only" ("Has gaming space" in the page object),
// beside Go back. The fixture's Poland: Test Club (gaming space) and Test
// Person (none).

/** A filter button's mark: what its ::before shows (✓ or ✕) and its colour. */
const mark = (button: import("@playwright/test").Locator) =>
  button.evaluate((el) => {
    const style = getComputedStyle(el, "::before");
    return { text: style.content, background: style.backgroundColor };
  });

test.describe("Country filter", () => {
  test("its five buttons sit beside Go back: the four kinds on (a green tick), Has gaming space off (a red x)", async ({ page, world, country }) => {
    await world.goto("Poland");
    for (const [which, label] of [["People", "Show people"], ["Stores", "Show stores"], ["Events", "Show events"], ["Communities", "Show communities"]] as const) {
      await expect(country.filterBox(which)).toHaveText(label);
      await expect(country.filterBox(which)).toHaveAttribute("aria-pressed", "true");
      const on = await mark(country.filterBox(which));
      expect(on.text).toContain("✓");
      expect(on.background).toBe("rgb(47, 143, 58)"); // green
    }
    await expect(country.filterBox("Has gaming space")).toHaveText("Show entries with gaming space only");
    await expect(country.filterBox("Has gaming space")).toHaveAttribute("aria-pressed", "false");
    const off = await mark(country.filterBox("Has gaming space"));
    expect(off.text).toContain("✕");
    expect(off.background).toBe("rgb(192, 40, 28)"); // red
    // In this order, after Go back, in one row.
    expect(await country.switchRow.evaluate((row) => [row.querySelector("#country-back"), ...row.querySelectorAll("#filter-bar > button")].map((el) => el!.id))).toEqual([
      "country-back", "filter-person", "filter-store", "filter-event", "filter-club", "filter-space",
    ]);
    // The old Filter button and its drop-down are gone.
    await expect(page.locator("#filter-on")).toHaveCount(0);
    await expect(page.locator("#filter-panel")).toHaveCount(0);
    await expect(country.communities).toHaveCount(1);
    await expect(country.people).toHaveCount(1);
  });

  test("a click switches a button off (a red x) and back on (a green tick)", async ({ world, country }) => {
    await world.goto("Poland");
    const people = country.filterBox("People");
    await people.click();
    await expect(people).toHaveAttribute("aria-pressed", "false");
    expect((await mark(people)).text).toContain("✕");
    await expect(country.peopleSection).toBeHidden();
    await people.click();
    await expect(people).toHaveAttribute("aria-pressed", "true");
    expect((await mark(people)).text).toContain("✓");
    await expect(country.people).toHaveCount(1);
  });

  test("on a desktop, Go back lines up with the map's left edge, the buttons on its right above the map", async ({ page, world, country }) => {
    test.skip(page.viewportSize()!.width <= 760, "on a phone the map is above them (CR-12)");
    await world.goto("Poland");
    await country.waitForStreetMap();
    await country.waitForUnfurled();
    const back = (await country.backButton.boundingBox())!;
    const map = (await country.streetMap.boundingBox())!;
    const bar = (await country.filterBar.boundingBox())!;
    expect(Math.abs(back.x - map.x)).toBeLessThan(4); // the map's left edge
    expect(bar.x).toBeGreaterThan(back.x + back.width); // on its right
    expect(Math.abs(bar.y + bar.height / 2 - (back.y + back.height / 2))).toBeLessThan(6); // the same row
    expect(back.y + back.height).toBeLessThanOrEqual(map.y); // above the map
    // The buttons centred across the window, as the Add buttons above them (CR-13).
    const add = (await country.addRow.boundingBox())!;
    expect(Math.abs(bar.x + bar.width / 2 - (add.x + add.width / 2))).toBeLessThan(3);
  });

  test("shows only the chosen types, in the lists and on the map", async ({ world, country }) => {
    await world.goto("Poland");
    await country.waitForStreetMap();
    await country.setFilter({ types: ["People"] });
    await expect(country.communities).toHaveCount(0);
    await expect(country.people).toContainText(["Test Person"]);
    await expect(country.streetMarker("Test Club")).toHaveCount(0);
    await expect(country.streetMarker("Test Person")).toBeAttached();
  });

  test("Show events switched off takes the events' crossed swords off the map", async ({ page, world, country }) => {
    await page.clock.setFixedTime(new Date("2026-11-10T12:00:00"));
    await mockApprovedCommunities(page, {}, { Poland: [{ community: "Test Club", name: "Map Event", start: "2026-11-21", place: "Warsaw", lat: 52.23, lon: 21.01, url: "https://example.com/map-event" }] });
    await world.goto("Poland");
    await country.waitForStreetMap();
    const swords = page.locator(item("event-marker", "Map Event", "2026-11-21"));
    await expect(swords).toHaveCount(1);
    await country.setFilter({ events: false });
    await expect(swords).toHaveCount(0);
    await expect(country.event("Map Event", "2026-11-21")).toBeVisible(); // still in Upcoming events
    await country.setFilter({ events: true });
    await expect(swords).toHaveCount(1);
  });

  test("the list beside the map (what the filter leaves) is the phone view's only", async ({ page, world, country }) => {
    await world.goto("Poland");
    await country.waitForStreetMap();
    const side = page.locator("#map-side-list");
    await expect(side).toBeHidden(); // nothing filtered out yet
    await country.setFilter({ types: ["Communities"] });
    if (await world.isPhone()) {
      await expect(page.locator(items("map-side-list", "side"))).toHaveCount(1);
      await expect(page.locator(`#${itemId("side", "Test Club")}-name`)).toHaveText("Test Club");
    } else await expect(side).toBeHidden();
  });

  test("Has gaming space shows only those with one", async ({ world, country }) => {
    await world.goto("Poland");
    await country.setFilter({ gamingSpace: true });
    await expect(country.filterBox("Has gaming space")).toHaveAttribute("aria-pressed", "true");
    await expect(country.communities).toContainText(["Test Club"]);
    await expect(country.peopleSection).toBeHidden();

    await country.setFilter({ gamingSpace: false });
    await expect(country.people).toContainText(["Test Person"]);
  });

  test("says when nothing matches, and switching everything back on shows it all again", async ({ world, country }) => {
    await world.goto("Poland");
    await country.setFilter({ types: ["Stores"] });
    await expect(country.filterEmpty).toBeVisible();
    await expect(country.empty).toBeHidden();

    await country.resetFilter();
    await expect(country.filterEmpty).toBeHidden();
    await expect(country.communities).toHaveCount(1);
    await expect(country.people).toHaveCount(1);
  });

  test("closes the card of a community it hides", async ({ world, country }) => {
    await world.goto("Poland");
    await country.openFromList("Test Club");
    await country.setFilter({ types: ["People"] });
    await expect(country.card).toBeHidden();
  });

  test("keeps its choice in the next country", async ({ page, world, country }) => {
    await mockApprovedCommunities(page, {
      France: [{ name: "Home Player", lat: 45.76, lon: 4.84, type: "Person", gamingSpace: true }],
    });
    await world.goto("Poland");
    await country.setFilter({ types: ["People", "Communities"] });
    await world.goto("France");
    await expect(country.filterBox("Stores")).toHaveAttribute("aria-pressed", "false");
    await expect(country.communities).toHaveCount(0); // Test Store is hidden
    await expect(country.people).toContainText(["Home Player"]);
  });
});
