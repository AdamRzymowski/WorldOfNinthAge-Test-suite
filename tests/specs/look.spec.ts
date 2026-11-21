import type { Locator } from "@playwright/test";
import { test, expect } from "../support/test";
import { itemId } from "../support/ids";

/** Test Club's Discord link on its card. */
const DISCORD_LINK = `#${itemId("community-card-link", "discord", "Join the Discord server")}-row`;

// One look ("one look" in css/style.css): what can be clicked is a red,
// rounded button; what is only information is square and black.

async function look(locator: Locator) {
  return locator.evaluate((el) => {
    const style = getComputedStyle(el);
    return { radius: parseFloat(style.borderTopLeftRadius), background: style.backgroundImage };
  });
}

async function expectButton(locator: Locator, label: string) {
  const { radius, background } = await look(locator);
  expect(radius, `${label} is rounded`).toBeGreaterThanOrEqual(14);
  expect(background, `${label} is red`).toContain("rgb(139, 26, 16)"); // --blood
}

async function expectInfo(locator: Locator, label: string) {
  const { radius, background } = await look(locator);
  expect(radius, `${label} is square`).toBe(0);
  expect(background, `${label} is black`).toMatch(/rgb\((42, 33, 24|15, 11, 7)\)/);
}

test.describe("One look", () => {
  test("in a country, buttons are red and rounded; the name and headings are square and black", async ({ page, world, country }) => {
    await world.goto("Poland");
    await expectInfo(country.title, "the country's name");
    await expectInfo(page.locator("#communities-title"), "a heading");
    for (const [label, locator] of [
      ["Go back", country.backButton],
      ["Add", country.addButton],
      ["Add event", country.addEventButton],
      ["Close", country.closeButton],
      ["Show people", country.filterBox("People")],
      ["Has gaming space", country.filterBox("Has gaming space")],
    ] as const) {
      await expectButton(locator, label);
    }
  });

  test("on a card, every button and contact link is red and rounded; the tags are square and black", async ({ page, world, country }) => {
    await world.goto("Poland");
    await country.openFromList("Test Club");
    for (const [name, id] of [["Add event", "add-event"], ["Update", "update"], ["Add images", "add-images"], ["Request deletion", "request-deletion"]]) {
      await expectButton(page.locator(`#community-card-${id}`), name);
    }
    await expectButton(page.locator(DISCORD_LINK), "a contact link");
    await expectInfo(page.locator("#community-card-tag-type"), "a tag");
  });

  test("a form's title is square and black; its buttons are red and rounded", async ({ page, world, country, eventForm }) => {
    await world.goto("Poland");
    await country.openFromList("Test Club");
    await page.locator("#community-card-add-event").click();
    await expectInfo(page.locator("#event-title"), "the form's title");
    await expectButton(eventForm.sendButton, "Add event");
    await expectButton(eventForm.cancelButton, "Cancel");
  });

  test("on the home page, the join, language and news buttons are red and the news bar is black", async ({ page, world }) => {
    await world.goto();
    await expectButton(page.locator("#join-button"), "the join button");
    await expectButton(page.locator("#lang-select"), "the language");
    await expectButton(page.locator("#news-link"), "T9A News!");
    await expectInfo(page.locator("#news-bar"), "the news bar");
  });

  test('"Show only online events" is a red button, gold while ticked', async ({ page, world }) => {
    await world.goto();
    await world.filter("events");
    const button = page.locator("#world-events-online-label");
    await expectButton(button, "Show only online events");
    await page.locator("#world-events-online").check();
    expect(await button.evaluate((el) => getComputedStyle(el).backgroundImage)).toContain("rgb(200, 151, 62)"); // --gold
  });

  test("every button grows a little under the pointer, and back after", async ({ page, world, country }) => {
    const grown = (locator: Locator) => locator.evaluate((el) => Number(getComputedStyle(el).scale) || 1);
    await world.goto("Poland");
    await country.openFromList("Test Club");
    for (const [label, locator] of [
      ["Go back", country.backButton],
      ["Add", country.addButton],
      ["Close", country.closeButton],
      ["Add event", page.locator("#community-card-add-event")],
      ["Request deletion", page.locator("#community-card-request-deletion")],
      ["a contact link", page.locator(DISCORD_LINK)],
    ] as const) {
      await locator.hover();
      await expect.poll(() => grown(locator), { message: label }).toBeGreaterThan(1);
    }
    await page.mouse.move(0, 0);
    await expect.poll(() => grown(country.backButton)).toBe(1);
  });

  test("the join button grows in place, staying centred", async ({ page, world }) => {
    await world.goto();
    const join = page.locator("#join-button");
    const centre = async () => {
      const box = (await join.boundingBox())!;
      return box.x + box.width / 2;
    };
    const before = await centre();
    await join.hover();
    await expect.poll(() => join.evaluate((el) => Number(getComputedStyle(el).scale) || 1)).toBeGreaterThan(1);
    expect(Math.abs((await centre()) - before)).toBeLessThan(1.5);
  });

  test("a switched-on button turns gold, so it reads as pressed", async ({ page, world }) => {
    test.skip(page.viewportSize()!.width <= 760, "the phone view has the world filters in its menu");
    await world.goto();
    await world.filter("events");
    expect((await look(world.filterButton("events"))).background).toContain("rgb(200, 151, 62)"); // --gold
  });

  test("the list beside the map never scrolls sideways", async ({ page, world, country }) => {
    await world.goto("Poland");
    await country.openFromList("Test Club");
    await page.locator("#community-list").hover();
    expect(await page.locator("#country-aside").evaluate((el) => el.scrollWidth - el.clientWidth)).toBe(0);
  });

  test("a filter button grows under the pointer, and its row stays put when one is switched off", async ({ world, country }) => {
    await world.goto("Poland");
    const people = country.filterBox("People");
    await people.hover();
    await expect.poll(() => people.evaluate((el) => Number(getComputedStyle(el).scale) || 1)).toBeGreaterThan(1);
    const before = (await country.switchRow.boundingBox())!;
    await people.click();
    const after = (await country.switchRow.boundingBox())!;
    // Its size and place across stay; on a phone the map above it can change height.
    for (const side of ["x", "width", "height"] as const) expect(after[side], side).toBeCloseTo(before[side], 1); // Firefox rounds sub-pixels
    if (!(await world.isPhone())) expect(after.y).toBeCloseTo(before.y, 1);
  });

  test("upcoming events have a column of their own: beside the list on a wide screen, under it otherwise", async ({ page, world, country }) => {
    await world.goto("Poland");
    await expect(country.eventsSection).toBeVisible();
    // Measured once the window has finished unfurling (its opening animation).
    await country.dialog.evaluate((el) => Promise.all(el.getAnimations({ subtree: true }).filter((a) => a.effect?.getTiming().iterations !== Infinity).map((a) => a.finished)));
    const list = (await page.locator("#country-aside").boundingBox())!;
    const events = (await page.locator("#country-events").boundingBox())!;
    const map = (await country.streetMap.boundingBox())!;
    expect(await page.locator("#events-section").evaluate((el) => el.closest("aside")?.id)).toBe("country-events"); // not in the list's column
    const width = page.viewportSize()!.width;
    if (width >= 1100) {
      expect(events.x).toBeGreaterThanOrEqual(list.x + list.width); // beside the list
      expect(Math.abs(events.y - list.y)).toBeLessThan(2); // at the same height
      expect(list.x).toBeGreaterThanOrEqual(map.x + map.width); // both beside the map
    } else {
      expect(events.y).toBeGreaterThanOrEqual(list.y + list.height - 1); // under the list
    }
  });

  test("an open window stops the page behind it scrolling, so no idle scroll bar shows", async ({ page, world, country }) => {
    const overflow = () => page.evaluate(() => getComputedStyle(document.documentElement).overflowY);
    await world.goto();
    expect(await overflow()).not.toBe("hidden");
    await world.goto("France");
    await expect(country.dialog).toBeVisible();
    expect(await overflow()).toBe("hidden");
    await country.closeButton.click();
    await expect(country.dialog).toBeHidden();
    expect(await overflow()).not.toBe("hidden");
  });

  test("a country with no events section keeps only the list beside the map", async ({ page, world }) => {
    await world.goto("Finland");
    await expect(page.locator("#country-events")).toBeHidden();
  });

  test(`"Add a community, store or yourself on the map" and "Add event" come first under the country's name, then "Go back"`, async ({ world, country }) => {
    await world.goto("Poland");
    await expect(country.addButton).toHaveText("Add a community, store or yourself on the map");
    await expect(country.addEventButton).toHaveText("Add event");
    await expect(country.backButton).toHaveText("Go back");
    await country.waitForUnfurled();
    const title = (await country.title.boundingBox())!;
    const add = (await country.addRow.boundingBox())!;
    const back = (await country.backButton.boundingBox())!;
    const map = (await country.streetMap.boundingBox())!;
    expect(add.y).toBeGreaterThanOrEqual(title.y + title.height - 1);
    expect(add.y - (title.y + title.height)).toBeLessThan(30); // directly below
    // Go back under them (CR-12: at the start of the filter's row).
    expect(back.y).toBeGreaterThanOrEqual(add.y + add.height - 1);
    if (!(await world.isPhone())) {
      // On a desktop, all of it above the map, Go back at the map's left edge.
      expect(add.y + add.height).toBeLessThanOrEqual(map.y + 1);
      expect(back.y + back.height).toBeLessThanOrEqual(map.y + 1);
      expect(Math.abs(back.x - map.x)).toBeLessThan(4);
    }
  });

  test(`the country's name, Add and the filter's buttons are centred across the top of the window; "Plant your banner on the map!" over the map`, async ({ page, world, country }) => {
    await world.goto("Poland");
    await country.waitForStreetMap();
    await country.addButton.click();
    await expect(country.plantHint).toBeVisible();
    const centre = async (locator: typeof country.title) => {
      const box = (await locator.boundingBox())!;
      return box.x + box.width / 2;
    };
    const window = await centre(page.locator("#country-parchment"));
    for (const [label, locator] of [
      ["the country's name", country.title],
      ["the Add buttons", country.addRow],
      ["the filter's buttons", country.filterBar], // CR-13; Go back sits at the left (CR-12)
    ] as const) {
      expect(Math.abs((await centre(locator)) - window), label).toBeLessThan(3);
    }
    expect(Math.abs((await centre(country.plantHint)) - (await centre(country.streetMap)))).toBeLessThan(3);
  });
});
