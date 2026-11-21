import type { Page, Locator } from "@playwright/test";
import { test, expect } from "../support/test";
import { itemId, items } from "../support/ids";

/** Every item the phone menu can show, in order: its buttons, the two filters under "Filter on the map", and the two links side by side. */
const MENU_ITEMS = ["menu-on-map", "menu-events-filter", "menu-stores-filter", "menu-major", "menu-learn", "menu-who", "menu-privacy", "menu-bug"];

/** The menu items showing now, by ID, in order. */
async function shownMenuItems(page: Page) {
  const shown: string[] = [];
  for (const id of MENU_ITEMS) if (await page.locator(`#${id}`).isVisible()) shown.push(id);
  return shown;
}

// The phone layout: nothing wider than the screen, the important buttons in
// reach. Runs on the phone projects only (chrome-mobile, edge-mobile,
// firefox-mobile); every other spec runs there too.

test.skip(({ viewport }) => (viewport?.width ?? 0) >= 768, "phone layout only");

/** No sideways scrolling: the page is no wider than the screen. */
async function expectNoSidewaysScroll(page: Page) {
  const { scroll, screen } = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, screen: window.innerWidth }));
  expect(scroll).toBeLessThanOrEqual(screen);
}

/** The element fits across the screen. */
async function expectFitsScreen(page: Page, locator: Locator) {
  const box = (await locator.boundingBox())!;
  const width = page.viewportSize()!.width;
  expect(box.x).toBeGreaterThanOrEqual(-1);
  expect(box.x + box.width).toBeLessThanOrEqual(width + 1);
}

test.describe("Phone layout", () => {
  test(`the world map page fits the screen, with "Select a country to start" always in reach at the bottom`, async ({ page, world }) => {
    await world.goto();
    await expectNoSidewaysScroll(page);
    await expect(world.joinButton).toBeInViewport();
    await expectFitsScreen(page, world.joinButton);
  });

  test("New Recruit's credit sits in the map's bottom right corner, above the placeholder note", async ({ page, world }) => {
    await world.goto();
    const credit = (await page.locator("#nr-credit").boundingBox())!;
    const note = (await page.locator("#ai-note").boundingBox())!;
    const map = (await world.map.boundingBox())!;
    expect(credit.x + credit.width).toBeLessThanOrEqual(map.x + map.width + 1); // within the map
    expect(credit.x + credit.width).toBeGreaterThan(map.x + map.width - 40); // its right side
    expect(credit.y + credit.height).toBeLessThanOrEqual(note.y + 1); // above the note, not over it
  });

  test("☰ sits at the right end of the news bar, right above \"Select a country to start\"; the zoom buttons in the map's bottom left", async ({ page, world }) => {
    await world.goto();
    const menu = (await page.locator("#menu-button").boundingBox())!;
    const news = (await page.locator("#news-bar").boundingBox())!;
    const bar = (await page.locator("#join-slot").boundingBox())!;
    const screen = page.viewportSize()!;
    expect(menu.width).toBeGreaterThanOrEqual(44); // big enough for the thumb
    expect(menu.x + menu.width).toBeGreaterThan(screen.width - 24); // the right edge
    expect(menu.y).toBeGreaterThanOrEqual(news.y - 1); // in the news bar…
    expect(menu.y + menu.height).toBeLessThanOrEqual(news.y + news.height + 1);
    expect(Math.abs(news.y + news.height - bar.y)).toBeLessThan(2); // …which sits right on the join bar
    const zoom = (await page.locator("#map-zoom").boundingBox())!;
    const map = (await world.map.boundingBox())!;
    expect(zoom.x).toBeLessThan(map.x + 24); // the map's left side
    expect(zoom.y + zoom.height).toBeGreaterThan(map.y + map.height - 80); // at its bottom
  });

  test("the menu: Filter on the map, the major events, Learn more about Ninth Age, Who makes this map and Privacy side by side, then Report a bug, all as wide as each other (the filters under it smaller)", async ({ page, world }) => {
    await page.clock.setFixedTime(new Date("2026-11-10T12:00:00"));
    await page.route("**/data/communities.json", async (route) => {
      const fixture = await (await route.fetch()).json();
      await route.fulfill({ json: { ...fixture, majorEvents: [{ name: "Test Open", start: "2026-11-21", country: "Germany", links: [] }] } });
    });
    await world.goto();
    const menu = page.locator("#phone-menu");
    await expect(menu).toBeHidden();
    await world.openMenu();
    await expect(page.locator("#menu-button")).toHaveAttribute("aria-expanded", "true");
    expect(await shownMenuItems(page)).toEqual(["menu-on-map", "menu-major", "menu-learn", "menu-who", "menu-privacy", "menu-bug"]);
    await page.locator("#menu-on-map").click();
    expect(await shownMenuItems(page)).toEqual(MENU_ITEMS);
    for (const [id, text] of [
      ["menu-on-map", "Filter on the map"], ["menu-events-filter", "Show only events"], ["menu-stores-filter", "Show only stores"],
      ["menu-major", "Major global community events"], ["menu-learn", "Learn more about Ninth Age"], ["menu-who", "Who makes this map"],
      ["menu-privacy", "Privacy"], ["menu-bug", "Report a bug"],
    ]) await expect(page.locator(`#${id}`)).toHaveText(text);
    // The menu's own buttons (not the two links side by side, nor the filters under "Filter on the map"), all the same width.
    const widths = await Promise.all(["#menu-on-map", "#menu-major", "#menu-learn", "#menu-bug"].map(async (id) => Math.round((await page.locator(id).boundingBox())!.width)));
    expect(new Set(widths).size).toBe(1);
    await expect(page.locator("#menu-learn")).toHaveAttribute("href", "https://www.the-ninth-age.com/");
  });

  test("the menu closes with ☰ and Escape, but not with a tap on the map", async ({ page, world }) => {
    await world.goto();
    const menu = page.locator("#phone-menu");
    await world.openMenu();
    const map = (await world.map.boundingBox())!;
    await page.mouse.click(map.x + map.width / 2, map.y + 40); // the map, above the menu
    await expect(menu).toBeVisible();
    await page.locator("#menu-button").click();
    await expect(menu).toBeHidden();
    await world.openMenu();
    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();
    await expect(page.locator("#menu-button")).toBeFocused();
  });

  test("a filter chosen in the menu changes the map and closes the menu; while on, it reads \"Show everything again\"", async ({ page, world }) => {
    await world.goto();
    await world.filter("stores"); // ☰ → Filter on the map → Show only stores
    await expect(page.locator("#phone-menu")).toBeHidden();
    await expect(page.locator("#store-seals")).toBeVisible();
    await expect(page.locator("#community-seals")).toBeHidden();
    await world.openMenu();
    await page.locator("#menu-on-map").click();
    const item = page.locator("#menu-stores-filter");
    await expect(item).toHaveText("Show everything again");
    await expect(item).toHaveAttribute("aria-pressed", "true");
  });

  test("the major events and Report a bug open from the menu, closing it", async ({ page, world }) => {
    await page.clock.setFixedTime(new Date("2026-11-10T12:00:00"));
    await page.route("**/data/communities.json", async (route) => {
      const fixture = await (await route.fetch()).json();
      await route.fulfill({ json: { ...fixture, majorEvents: [{ name: "Test Open", start: "2026-11-21", country: "Germany", links: [] }] } });
    });
    await world.goto();
    await world.openMajorEvents();
    await expect(page.locator("#phone-menu")).toBeHidden();
    await expect(page.locator("#major-dialog")).toBeVisible();
    await page.locator("#major-close").click();
    await world.openBugReport();
    await expect(page.locator("#phone-menu")).toBeHidden();
    await expect(page.locator("#bug-dialog")).toBeVisible();
  });

  for (const lang of ["de", "el", "fi"]) {
    test(`${lang}: the menu's longer words wrap onto more lines, never past its side`, async ({ page, world }) => {
      await page.setViewportSize({ width: 320, height: 640 });
      await world.goto("", { lang });
      await world.openMenu();
      await page.locator("#menu-on-map").click();
      const menu = (await page.locator("#phone-menu").boundingBox())!;
      for (const id of await shownMenuItems(page)) {
        const item = page.locator(`#${id}`);
        const fits = await item.evaluate((el) => el.scrollWidth <= el.clientWidth + 1);
        expect(fits).toBe(true);
        const box = (await item.boundingBox())!;
        expect(box.x + box.width).toBeLessThanOrEqual(menu.x + menu.width + 1);
      }
      await expectNoSidewaysScroll(page);
    });
  }

  test("a country fits the screen: the map, then the list under it", async ({ page, world, country }) => {
    await world.goto("Poland");
    await country.waitForStreetMap();
    await expectNoSidewaysScroll(page);
    await expectFitsScreen(page, country.streetMap);
    await expectFitsScreen(page, country.addButton);
    const map = (await country.streetMap.boundingBox())!;
    const list = (await page.locator("#community-list").boundingBox())!;
    expect(list.y).toBeGreaterThanOrEqual(map.y + map.height - 1);
  });

  test("the filter's buttons fit the screen, two a line under Go back", async ({ page, world, country }) => {
    await world.goto("Poland");
    await country.filterBar.scrollIntoViewIfNeeded();
    await expectFitsScreen(page, country.filterBar);
    for (const which of ["People", "Stores", "Events", "Communities", "Has gaming space"] as const) await expectFitsScreen(page, country.filterBox(which));
    const back = (await country.backButton.boundingBox())!;
    const people = (await country.filterBox("People").boundingBox())!;
    const stores = (await country.filterBox("Stores").boundingBox())!;
    const events = (await country.filterBox("Events").boundingBox())!;
    expect(people.y).toBeGreaterThanOrEqual(back.y + back.height - 1); // under Go back
    expect(Math.abs(people.y - stores.y)).toBeLessThan(2); // two a line
    expect(stores.x).toBeGreaterThan(people.x + people.width - 1);
    expect(events.y).toBeGreaterThan(people.y + people.height - 1); // then the next line
    await country.setFilter({ gamingSpace: true });
    await expectNoSidewaysScroll(page);
  });

  test("a country's section buttons wrap instead of running off the screen", async ({ page, world, country }) => {
    await world.goto("United Kingdom"); // 15 sections
    await expect(country.sectionButtons).toHaveCount(15);
    await expectFitsScreen(page, country.sectionTabs);
    for (const button of await country.sectionButtons.all()) await expectFitsScreen(page, button);
  });

  test("a card fits the screen, with Add event, Update and the contacts in reach", async ({ page, world, country }) => {
    await world.goto("Poland");
    await country.openFromList("Test Club");
    await expectFitsScreen(page, country.card);
    for (const id of ["add-event", "update", "request-deletion"]) {
      const button = page.locator(`#community-card-${id}`);
      await button.scrollIntoViewIfNeeded();
      await expectFitsScreen(page, button);
    }
    await expectFitsScreen(page, page.locator("#community-card-links"));
  });

  test("the banner form fits the screen: the send button at the top, the agreement at the bottom", async ({ page, world, country, joinForm }) => {
    await world.goto("Poland");
    await country.openFromList("Test Club");
    await page.locator("#community-card-update").click();
    await expectFitsScreen(page, joinForm.dialog);
    await expect(joinForm.submitButton).toBeInViewport();
    const consent = page.locator("#join-consent");
    await consent.scrollIntoViewIfNeeded();
    await expect(joinForm.field("consent")).toBeInViewport();
    await expectFitsScreen(page, consent);
  });

  test("the gallery and deletion forms fit the screen", async ({ page, world, country }) => {
    await world.goto("Poland");
    await country.openFromList("Test Club");
    await page.locator("#community-card-add-images").click();
    await expectFitsScreen(page, page.locator("#gallery-dialog"));
    await page.locator("#gallery-close").click();
    await page.locator("#community-card-request-deletion").click();
    await expectFitsScreen(page, page.locator("#change-dialog"));
  });

  test("the bottom block (the news bar with ☰, and \"Select a country to start\") stays put while the page scrolls", async ({ page, world }) => {
    await world.goto();
    await world.filter("events"); // a long page: the events list under the map
    const where = () => Promise.all(["#news-bar", "#menu-button", "#join-slot"].map(async (id) => (await page.locator(id).boundingBox())!.y));
    const before = await where();
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    const after = await where();
    after.forEach((y, i) => expect(Math.abs(y - before[i])).toBeLessThan(2));
    // The page's end clears the block: the fan-made note is above it.
    const note = (await page.locator("#fan-note").boundingBox())!;
    expect(note.y + note.height).toBeLessThanOrEqual(before[0] + 1);
  });

  test("the news banner fits the screen", async ({ page, world }) => {
    await world.goto();
    await expectFitsScreen(page, page.locator("#news-link"));
    // The news button and the social links don't overlap.
    const words = (await page.locator("#news-link").evaluate((el) => {
      const range = document.createRange();
      range.selectNodeContents(el);
      const r = range.getBoundingClientRect();
      return { right: r.right };
    }));
    const social = (await page.locator("#social-links").boundingBox())!;
    expect(words.right).toBeLessThanOrEqual(social.x);
    await expectFitsScreen(page, page.locator("#social-links"));
  });

  test("under \"Filter on the map\", the filters are smaller than the menu's buttons, with the blue glow", async ({ page, world }) => {
    await world.goto();
    await world.openMenu();
    await page.locator("#menu-on-map").click();
    const main = (await page.locator("#menu-on-map").boundingBox())!;
    for (const item of [page.locator("#menu-events-filter"), page.locator("#menu-stores-filter")]) {
      const box = (await item.boundingBox())!;
      expect(box.width).toBeLessThan(main.width * 0.9); // smaller
      expect(Math.abs(box.x + box.width / 2 - (main.x + main.width / 2))).toBeLessThan(3); // set in, centred
      await expect(item).toHaveCSS("box-shadow", /rgba\(11, 79, 216/); // the blue glow
    }
  });

  test("with a filter on, \"Show everything again\" sits at the map's bottom middle, and resets it", async ({ page, world }) => {
    await world.goto();
    const reset = page.locator("#map-reset");
    await expect(reset).toBeHidden();
    await world.filter("stores");
    await expect(reset).toBeVisible();
    const box = (await reset.boundingBox())!;
    const map = (await world.map.boundingBox())!;
    expect(Math.abs(box.x + box.width / 2 - (map.x + map.width / 2))).toBeLessThan(4); // the middle
    expect(box.y + box.height).toBeGreaterThan(map.y + map.height - 70); // the bottom
    await reset.click();
    await expect(reset).toBeHidden();
    await expect(page.locator("#store-seals")).toBeHidden();
    await expect(world.filterButton("stores")).toHaveText("Show only stores");
  });

  test("a country opens with its map first: its name and ×, Add, Add event and Go back come under it", async ({ world, country }) => {
    await world.goto("Poland");
    await country.waitForStreetMap();
    const map = (await country.streetMap.boundingBox())!;
    const order = [country.title, country.addButton, country.addEventButton, country.backButton];
    let previous = map.y + map.height - 1;
    for (const locator of order) {
      const box = (await locator.boundingBox())!;
      expect(box.y).toBeGreaterThanOrEqual(previous); // under the map, in this order
      previous = box.y + box.height - 1;
    }
    const close = (await country.closeButton.boundingBox())!;
    const title = (await country.title.boundingBox())!;
    expect(Math.abs(close.y + close.height / 2 - (title.y + title.height / 2))).toBeLessThan(6); // × beside the name
  });

  test("no Filter button sits on the map any more: the filter is under it (CR-12)", async ({ page, world, country }) => {
    await world.goto("Poland");
    await country.waitForStreetMap();
    await expect(page.locator("#filter-on")).toHaveCount(0);
    const map = (await page.locator("#country-map-wrap").boundingBox())!;
    const bar = (await country.filterBar.boundingBox())!;
    expect(bar.y).toBeGreaterThanOrEqual(map.y + map.height - 1);
  });

  test("with something filtered out, the map is two thirds wide and the list beside it shows what's left; a tap opens its card", async ({ page, world, country }) => {
    await world.goto("Poland");
    await country.waitForStreetMap();
    const side = page.locator("#map-side-list");
    await expect(side).toBeHidden();
    await country.setFilter({ types: ["People"] });
    await expect(page.locator(items("map-side-list", "side"))).toHaveCount(1);
    await expect(page.locator(`#${itemId("side", "Test Person")}-name`)).toHaveText("Test Person");
    const wrap = (await page.locator("#country-map-wrap").boundingBox())!;
    const map = (await country.streetMap.boundingBox())!;
    expect(map.width / wrap.width).toBeGreaterThan(0.6);
    expect(map.width / wrap.width).toBeLessThan(0.72); // two thirds
    const list = (await side.boundingBox())!;
    expect(list.x).toBeGreaterThanOrEqual(map.x + map.width - 2); // on the right
    await page.locator(`#${itemId("side", "Test Person")}-button`).click();
    await expect(country.card).toBeVisible();
    await expect(page.locator("#community-card-title")).toHaveText("Test Person");

    await country.resetFilter(); // everything shown again
    await expect(side).toBeHidden();
    await expect.poll(async () => (await country.streetMap.boundingBox())!.width / (await page.locator("#country-map-wrap").boundingBox())!.width).toBeGreaterThan(0.95);
  });

  test("the privacy page opens at its top with \"Back to the map\" as a button, and scrolls to its end", async ({ page, world }) => {
    await world.goto();
    await world.openMenu();
    await page.locator("#menu-who").click();
    await expect(page).toHaveURL(/privacy/);
    const back = page.locator("#privacy-back-link");
    await expect(back).toBeInViewport(); // at the top…
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0); // …even from #who
    await expect(back).toHaveCSS("background-image", /linear-gradient/); // the site's red button, not a link
    await expect(page.locator("#privacy-back-bottom-link")).toBeHidden(); // no link at the end
    // The note runs the page's length: its last part is reached by scrolling the page.
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expect(page.locator("#privacy-change-title")).toBeInViewport();
    await back.scrollIntoViewIfNeeded();
    await back.click();
    await expect(world.map).toBeVisible(); // back on the map
  });

  test("the privacy note fits the screen", async ({ page }) => {
    await page.goto("/privacy.html");
    await expectNoSidewaysScroll(page);
  });
});
