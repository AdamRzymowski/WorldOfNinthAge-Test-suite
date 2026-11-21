import { test, expect } from "../support/test";
import { item, itemId, items } from "../support/ids";

/** The countries listed while choosing one ("join-country-poland"...), not "No country by that name". */
const OPTIONS = '#join-country-list > [id^="join-country-"]:not(#join-country-none)';

test.describe("World map", () => {
  test("draws the world's countries", async ({ world }) => {
    await world.goto();
    await expect(world.page).toHaveTitle("The World of Ninth Age Communities");
    expect(await world.countries.count()).toBeGreaterThan(100);
  });

  test(`"Select a country to start", the + before the words, on the map's "Choose the Country" plaque (under the map on narrower screens; on a phone, large at the bottom of the screen, always there), in the middle`, async ({ page, world }) => {
    await world.goto();
    const join = page.locator("#join-button");
    await expect(join).toBeVisible();
    await expect(page.locator("#join-button-text")).toHaveText("Select a country to start");
    const words = (await page.locator("#join-button-text").boundingBox())!;
    const plus = (await page.locator("#join-button-plus").boundingBox())!;
    expect(plus.x + plus.width).toBeLessThanOrEqual(words.x + 1);
    const map = (await world.map.boundingBox())!;
    const box = (await join.boundingBox())!;
    const frame = (await page.locator("#world-frame").boundingBox())!;
    const screen = page.viewportSize()!;
    if (await world.isPhone()) {
      expect(box.y + box.height).toBeGreaterThan(screen.height - 30); // at the bottom of the screen
      expect(box.width).toBeGreaterThan(screen.width * 0.9); // across it
      expect(box.height).toBeGreaterThanOrEqual(56); // large
      // Stuck there: still in the same place at the end of the page.
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      expect(Math.abs((await join.boundingBox())!.y - box.y)).toBeLessThan(2);
      await expect(join).toBeInViewport();
    } else if (screen.width >= 1100) {
      // The painted plaque's middle is 5.5% of the map's width from its top.
      expect(Math.abs(box.y + box.height / 2 - (map.y + map.width * 0.055))).toBeLessThan(6); // on the plaque
    } else {
      expect(box.y).toBeGreaterThanOrEqual(frame.y + frame.height - 1); // under the map
      expect(box.y).toBeLessThan(frame.y + frame.height + 60); // right under it
    }
    expect(Math.abs(box.x + box.width / 2 - (map.x + map.width / 2))).toBeLessThan(map.width * 0.03); // in the middle
  });

  test('once clicked, the button gives way to "Choose a country to start" in its place', async ({ page, world }) => {
    await world.goto();
    const join = page.locator("#join-button");
    const before = (await join.boundingBox())!;
    await join.click();
    await expect(join).toBeHidden();
    await expect(join).toHaveAttribute("aria-pressed", "true");
    const hint = page.locator("#join-hint");
    await expect(hint).toHaveText("Choose a country to start");
    const after = (await hint.boundingBox())!;
    if (await world.isPhone()) {
      // In the bar at the bottom of the screen, which grows upwards for the country box under it.
      const bar = (await page.locator("#join-slot").boundingBox())!;
      expect(bar.y + bar.height).toBeCloseTo(page.viewportSize()!.height, 0);
      expect(after.y).toBeGreaterThanOrEqual(bar.y);
      await expect(page.locator("#join-country")).toBeInViewport();
    } else {
      expect(Math.abs(after.y - before.y)).toBeLessThan(12);
    }

    await page.locator("#join-cancel").click();
    await expect(hint).toBeHidden();
    await expect(join).toBeVisible();
    await expect(join).toBeFocused();
  });

  test("choosing a country after it goes straight to planting a banner", async ({ page, world, country }) => {
    await world.goto();
    await world.pickCountry("Poland");
    await country.expectOpen("Poland");
    await expect(country.plantHint).toBeVisible();
    await expect(page.locator("#join-hint")).toBeHidden();
  });

  test("while choosing, a box under the hint lists every country, narrowed as one types", async ({ page, world }) => {
    await world.goto();
    const box = page.locator("#join-country");
    await expect(box).toBeHidden();
    await page.locator("#join-button").click();
    const hint = (await page.locator("#join-hint").boundingBox())!;
    const pick = (await box.boundingBox())!;
    expect(pick.y).toBeGreaterThanOrEqual(hint.y + hint.height - 1); // under the hint
    await expect(box).toHaveAttribute("placeholder", "Type or pick your country");

    await box.click();
    const options = page.locator(OPTIONS);
    await expect(page.locator(item("join-country", "Poland"))).toHaveText("Poland");
    expect(await options.count()).toBeGreaterThan(150);

    // Names starting with what's typed come first.
    await box.fill("neth");
    expect(await options.evaluateAll((els) => els.map((el) => el.id))).toEqual([itemId("join-country", "Netherlands"), itemId("join-country", "Caribbean Netherlands")]);
    await expect(options).toHaveText(["Netherlands", "Caribbean Netherlands"]);
    await box.fill("atlantis");
    await expect(options).toHaveCount(0);
    await expect(page.locator("#join-country-none")).toHaveText("No country by that name on the map");
  });

  test("picking a country from the list goes straight to planting a banner", async ({ page, world, country }) => {
    await world.goto();
    await page.locator("#join-button").click();
    const box = page.locator("#join-country");
    await box.fill("pol");
    await page.locator(item("join-country", "Poland")).click();
    await country.expectOpen("Poland");
    await expect(country.plantHint).toBeVisible();
    await expect(box).toBeHidden();
  });

  test("typing a country and pressing Enter picks the first match; the arrow keys move through the list", async ({ page, world, country }) => {
    await world.goto();
    await page.locator("#join-button").click();
    const box = page.locator("#join-country");
    await box.fill("ger");
    const options = page.locator(OPTIONS);
    await expect(options.first()).toHaveId(itemId("join-country", "Germany"));
    await expect(options.first()).toHaveText("Germany");
    await expect(options.first()).toHaveAttribute("aria-selected", "true");
    await box.press("ArrowDown");
    await expect(options.nth(1)).toHaveAttribute("aria-selected", "true");
    await box.press("ArrowUp");
    await box.press("Enter");
    await country.expectOpen("Germany");
  });

  test("Escape closes the list, a second Escape stops choosing; clicking the map still works", async ({ page, world, country }) => {
    await world.goto();
    await page.locator("#join-button").click();
    const box = page.locator("#join-country");
    await box.fill("fra");
    const list = page.locator("#join-country-list");
    await expect(list).toBeVisible();
    await box.press("Escape");
    await expect(list).toBeHidden();
    await expect(page.locator("#join-hint")).toBeVisible();
    await box.press("Escape");
    await expect(page.locator("#join-hint")).toBeHidden();
    await expect(box).toBeHidden();

    await page.locator("#join-button").click();
    await expect(box).toHaveValue("");
    await world.pickCountry("Poland"); // as a click on the map: the country opens, ready to plant
    await country.expectOpen("Poland");
    await expect(country.plantHint).toBeVisible();
  });

  test('there is no "Find players near you" plaque any more', async ({ page, world }) => {
    await world.goto();
    expect(await page.locator("#site-root").textContent()).not.toContain("Find players near you");
    await expect(page.locator("#world-map .plaque")).toHaveCount(0);
  });

  test('there is no search box above the map any more: the country is picked with "Select a country to start"', async ({ page, world }) => {
    await world.goto();
    await expect(page.locator("#country-search")).toHaveCount(0);
    await expect(world.joinButton).toBeVisible();
  });

  test('a bar along the bottom has a "T9A News!" button to the Ninth Age news (on a phone, fixed right above "Select a country to start")', async ({ page, world }) => {
    await world.goto();
    const phone = await world.isPhone();
    const bar = page.locator("#news-bar");
    const news = page.locator("#news-link");
    await expect(news).toHaveText("T9A News!");
    await expect(news).toBeInViewport();
    await expect(news).toHaveAttribute("href", "https://community.the-ninth-age.com/news/");
    await expect(news).toHaveAttribute("target", "_blank");
    await expect(news).toHaveAttribute("rel", /noopener/);
    const barBox = (await bar.boundingBox())!;
    const screen = page.viewportSize()!;
    if (!phone) expect(barBox.y + barBox.height).toBeCloseTo(screen.height, 0);
    else {
      const join = (await page.locator("#join-slot").boundingBox())!;
      expect(Math.abs(barBox.y + barBox.height - join.y)).toBeLessThan(2); // right on the join bar
    }
    expect(barBox.width).toBeCloseTo(screen.width, 0);
    // Only the button is a link (in the middle; on a phone at the left); the bar around it isn't.
    const newsBox = (await news.boundingBox())!;
    expect(newsBox.width).toBeLessThan(screen.width / 2);
    if (!phone) expect(Math.abs(newsBox.x + newsBox.width / 2 - screen.width / 2)).toBeLessThan(screen.width * 0.05);
    else expect(newsBox.x).toBeLessThan(30);
    const social = (await page.locator("#social-links").boundingBox())!;
    const about = (await page.locator("#site-links").boundingBox())!;
    const besideX = phone
      ? (newsBox.x + newsBox.width + social.x) / 2 // between the button and the channels
      : (about.x + about.width + newsBox.x) / 2; // between "Who makes this map" and the button
    const besideIt = await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.closest("a")?.href ?? null, [besideX, barBox.y + barBox.height / 2]);
    expect(besideIt).toBeNull();
  });

  test("YouTube, Facebook, Discord and forum links sit in the bottom right corner", async ({ page, world }) => {
    await world.goto();
    const phone = await world.isPhone();
    const social = page.locator("#social-links");
    const youtube = page.locator("#social-youtube");
    const facebook = page.locator("#social-facebook");
    await expect(youtube).toHaveAttribute("href", "https://www.youtube.com/@the9thage/videos");
    await expect(facebook).toHaveAttribute("href", "https://www.facebook.com/9thage/");
    const discord = page.locator("#social-discord");
    await expect(discord).toHaveAttribute("href", "https://discord.gg/4tj2UcEBd");
    const forum = page.locator("#social-forum");
    await expect(forum).toHaveAttribute("href", "https://community.the-ninth-age.com/");
    await expect(youtube).toHaveAccessibleName("The Ninth Age on YouTube");
    await expect(forum).toHaveAccessibleName("The Ninth Age forum");
    // Four, the forum last.
    expect(await social.evaluate((nav) => [...nav.children].map((a) => a.id))).toEqual(["social-youtube", "social-facebook", "social-discord", "social-forum"]);
    for (const link of [youtube, facebook, discord, forum]) {
      await expect(link).toBeInViewport();
      await expect(link).toHaveAttribute("target", "_blank");
      await expect(link).toHaveAttribute("rel", /noopener/);
    }
    const box = (await social.boundingBox())!;
    const screen = page.viewportSize()!;
    if (phone) {
      // In the bar fixed above the join bar, just left of ☰ at its end.
      const menu = (await page.locator("#menu-button").boundingBox())!;
      expect(box.x + box.width).toBeLessThanOrEqual(menu.x + 1);
      expect(menu.x - (box.x + box.width)).toBeLessThan(20);
      expect(box.y + box.height).toBeLessThanOrEqual((await page.locator("#join-slot").boundingBox())!.y + 1);
    } else {
      expect(box.x + box.width).toBeGreaterThan(screen.width - 40); // right edge
      expect(box.y + box.height).toBeGreaterThan(screen.height - 40); // bottom edge
    }
    // Separate from the news button: a click on one is its own.
    const centre = await youtube.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)?.closest("a")?.href;
    });
    expect(centre).toBe("https://www.youtube.com/@the9thage/videos");
  });

  test("the fan-made note at the end of the page clears the news bar", async ({ page, world }) => {
    await world.goto();
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    const note = (await page.locator("#fan-note").boundingBox())!;
    const banner = (await page.locator("#news-link").boundingBox())!;
    expect(note.y + note.height).toBeLessThanOrEqual(banner.y);
  });

  test(`"Learn more about Ninth Age" (top right) is level with "Major global community events" (top left); the language is above "Learn more"; "Show only events" and "Show only stores" under "Learn more"`, async ({ page, world }) => {
    test.skip(page.viewportSize()!.width <= 760, "the phone view puts them in the menu (mobile.spec.ts)");
    await page.clock.setFixedTime(new Date("2026-11-10T12:00:00"));
    await page.route("**/data/communities.json", async (route) => {
      const fixture = await (await route.fetch()).json();
      await route.fulfill({ json: { ...fixture, majorEvents: [{ name: "Test Open", start: "2026-11-21", country: "Germany", links: [] }] } });
    });
    await world.goto();
    const learn = (await page.locator("#learn-more-text").boundingBox())!;
    const major = (await page.locator("#major-button-text").boundingBox())!;
    const lang = (await page.locator("#lang-select").boundingBox())!;
    const events = (await page.locator("#world-events-toggle").boundingBox())!;
    const stores = (await page.locator("#world-stores-toggle").boundingBox())!;
    const screen = page.viewportSize()!;
    expect(events.y).toBeGreaterThanOrEqual(learn.y + learn.height - 1); // under "Learn more"
    expect(stores.y).toBeGreaterThanOrEqual(events.y + events.height - 1); // and under it
    {
      expect(Math.abs(learn.y - major.y)).toBeLessThan(4); // level
      expect(major.x + major.width).toBeLessThan(screen.width / 2); // left
      expect(learn.x).toBeGreaterThan(screen.width / 2); // right
      expect(lang.x).toBeGreaterThan(screen.width / 2); // right
      expect(lang.y + lang.height).toBeLessThanOrEqual(learn.y + 1); // above "Learn more"
      expect(Math.abs(events.x + events.width / 2 - (learn.x + learn.width / 2))).toBeLessThan(4); // under it, not beside
    }
  });

  test("the next major events show under their button, each opening the full list", async ({ page, world }) => {
    test.skip(page.viewportSize()!.width <= 760, "the phone view has only the button, in the menu (mobile.spec.ts)");
    const majorEvents = [1, 2, 3, 4].map((n) => ({ name: `Major ${n}`, start: `2026-12-0${n}`, country: "Germany", links: [{ label: "New Recruit", url: "https://www.newrecruit.eu/" }] }));
    await page.clock.setFixedTime(new Date("2026-11-10T12:00:00"));
    await page.route("**/data/communities.json", async (route) => {
      const fixture = await (await route.fetch()).json();
      await route.fulfill({ json: { ...fixture, majorEvents } });
    });
    await world.goto();
    await expect(page.locator(items("major-preview", "major-preview"))).toHaveCount(3);
    const first = page.locator(`#${itemId("major-preview", "Major 1", "2026-12-01")}-button`);
    await expect(page.locator(`#${itemId("major-preview", "Major 1", "2026-12-01")}-name`)).toHaveText("Major 1");
    // A red button like the others, with the blue glow of a country under the pointer.
    await expect(first).toHaveCSS("background-image", /linear-gradient/);
    await expect(first).toHaveCSS("box-shadow", /rgba\(11, 79, 216/);
    await page.locator(`#${itemId("major-preview", "Major 3", "2026-12-03")}-button`).click();
    await expect(page.locator("#major-dialog")).toBeVisible();
    await expect(page.locator(items("major-list", "major-event"))).toHaveCount(4);
  });

  test("the bottom bar links to who makes the map and to the privacy note (on a phone, the ☰ menu)", async ({ page, world }) => {
    await world.goto();
    if (await world.isPhone()) {
      await expect(page.locator("#site-links")).toBeHidden(); // not in the bar
      await world.openMenu();
    }
    const [who, privacy] = (await world.isPhone()) ? ["#menu-who", "#menu-privacy"] : ["#site-who", "#site-privacy"];
    await expect(page.locator(who)).toHaveText("Who makes this map");
    await expect(page.locator(who)).toHaveAttribute("href", "privacy.html#who");
    await expect(page.locator(privacy)).toHaveText("Privacy");
    await expect(page.locator(privacy)).toHaveAttribute("href", "privacy.html");
    await page.locator(who).click();
    await expect(page.locator("#who")).toHaveText("Who runs this map");
    await expect(page.locator("#who")).toBeInViewport();
  });

  test("the painted map says in small print it's an AI-generated temporary placeholder, in its bottom left corner (bottom right on a phone, where the zoom buttons take the left)", async ({ page, world }) => {
    await world.goto();
    const note = page.locator("#ai-note");
    await expect(note).toHaveText("AI-generated temporary placeholder");
    const box = (await note.boundingBox())!;
    const map = (await world.map.boundingBox())!;
    if (await world.isPhone()) expect(box.x + box.width).toBeGreaterThan(map.x + map.width - 30);
    else expect(box.x).toBeLessThan(map.x + 30);
    expect(box.y + box.height).toBeGreaterThan(map.y + map.height - 30);
  });

  test("a #country link opens that country", async ({ world, country }) => {
    await world.goto("France");
    await country.expectOpen("France");
  });
});
