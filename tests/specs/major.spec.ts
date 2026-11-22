import { readFileSync } from "node:fs";
import type { Page } from "@playwright/test";
import { test, expect } from "../support/test";
import { item, itemId, items } from "../support/ids";

// "Major global community events": the tab in the home page's left corner
// (js/major.js; in the phone view, an item in the menu, js/menu.js), from
// majorEvents in data/communities.json. The fixture has none, so each test
// adds its own.

const FIXTURE = JSON.parse(readFileSync(new URL("../fixtures/communities.json", import.meta.url), "utf8"));

async function withMajorEvents(page: Page, majorEvents: object[]) {
  await page.route("**/data/communities.json", (route) => route.fulfill({ json: { ...FIXTURE, majorEvents } }));
}

const OPEN = {
  name: "Test Open",
  start: "2026-11-21",
  end: "2026-11-22",
  place: "Melle",
  country: "Germany",
  links: [
    { label: "Tournament site", url: "https://example.com/open" },
    { label: "New Recruit", url: "https://www.newrecruit.eu/app/tournydetails/details?id=1" },
  ],
};

test.describe("Major global community events", () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.setFixedTime(new Date("2026-11-10T12:00:00"));
  });

  test("the tab isn't there without a major event", async ({ page, world }) => {
    await world.goto();
    await expect(page.locator("#major-corner")).toBeHidden();
    if (await world.isPhone()) {
      await world.openMenu();
      await expect(page.locator("#menu-major")).toBeHidden(); // nor in the menu
    }
  });

  test("the tab isn't there when every major event is over", async ({ page, world }) => {
    await withMajorEvents(page, [{ ...OPEN, start: "2026-10-01", end: "2026-10-02" }]);
    await world.goto();
    await expect(page.locator("#major-corner")).toBeHidden();
    if (await world.isPhone()) {
      await world.openMenu();
      await expect(page.locator("#menu-major")).toBeHidden(); // nor in the menu
    }
  });

  test("lists the upcoming ones, soonest first, with their days, place and links, New Recruit's first", async ({ page, world }) => {
    await withMajorEvents(page, [
      { ...OPEN, name: "Later Masters", start: "2027-02-06", end: undefined, place: "London", country: "United Kingdom" },
      OPEN,
      { ...OPEN, name: "Old Cup", start: "2026-10-01", end: "2026-10-02" },
    ]);
    await world.goto();
    await world.openMajorEvents();

    const dialog = page.locator("#major-dialog");
    await expect(dialog).toBeVisible();
    await expect(page.locator(items("major-list", "major-event"))).toHaveCount(2); // the old one isn't listed
    const open = itemId("major-event", "Test Open", "2026-11-21");
    await expect(page.locator(item("major-event", "Test Open", "2026-11-21"))).toBeVisible();
    await expect(page.locator(items("major-list", "major-event")).first()).toHaveId(open); // soonest first
    await expect(page.locator(`#${itemId("major-event", "Later Masters", "2027-02-06")}-name`)).toHaveText("Later Masters");
    await expect(page.locator(`#${open}-name`)).toHaveText("Test Open");
    await expect(page.locator(`#${open}-date`)).toHaveText("Sat, 21 Nov – Sun, 22 Nov 2026");
    await expect(page.locator(`#${open}-where`)).toHaveText("Melle, Germany");
    await expect(page.locator(`#${open}-links > a`)).toHaveText(["New Recruit", "Tournament site"]);
    await expect(page.locator(`#${open}-link-new-recruit`)).toHaveAttribute("target", "_blank");

    await page.locator("#major-close").click();
    await expect(dialog).toBeHidden();
  });

  test("a link that isn't a web address isn't shown", async ({ page, world }) => {
    await withMajorEvents(page, [{ ...OPEN, links: [{ label: "Bad", url: "javascript:alert(1)" }, OPEN.links[1]] }]);
    await world.goto();
    await world.openMajorEvents();
    await expect(page.locator(`#${itemId("major-event", "Test Open", "2026-11-21")}-links > a`)).toHaveText(["New Recruit"]);
    await expect(page.locator(`#${itemId("major-event", "Test Open", "2026-11-21")}-link-new-recruit`)).toBeVisible();
  });

  test("on a phone, an event's links are one per row across the whole card, their text centred (CR-19)", async ({ page, world }) => {
    test.skip(!(await world.isPhone()), "on a desktop they stay as they are");
    await withMajorEvents(page, [OPEN]);
    await world.goto();
    await world.openMajorEvents();
    const open = itemId("major-event", "Test Open", "2026-11-21");
    const card = (await page.locator(`#${open}`).boundingBox())!;
    const boxes = await page.locator(`#${open}-links > a`).evaluateAll((links) => links.map((a) => ({ ...a.getBoundingClientRect().toJSON(), align: getComputedStyle(a).justifyContent })));
    expect(boxes).toHaveLength(2);
    for (const box of boxes) {
      expect(box.width).toBeGreaterThan(card.width - 30); // across the card (its padding aside)
      expect(box.align).toBe("center");
    }
    expect(boxes[1].y).toBeGreaterThan(boxes[0].y + boxes[0].height - 1); // one per row
  });
});
