import type { Page } from "@playwright/test";
import { test, expect, mockApprovedCommunities, nextFormPost, postedField } from "../support/test";
import { itemId } from "../support/ids";

// The site in the visitor's language (js/i18n.js, i18n/<lang>.json). The
// other specs run in English, the browser's language; these pick one with
// ?lang= or the selector in the page's top right corner.

const LANGUAGES = ["es", "fr", "de", "it", "pl", "sv", "nb", "da", "fi", "el", "cs", "uk"] as const;
const missing = (page: Page) => page.evaluate(() => [...((window as { __i18nMissing?: Set<string> }).__i18nMissing ?? [])]);

// Nothing sticks out sideways: the page is never wider than the screen.
async function expectFitsSideways(page: Page, where: string) {
  const { scroll, width } = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, width: window.innerWidth }));
  expect(scroll, `${where}: the page is wider than the screen`).toBeLessThanOrEqual(width);
}

test.describe("Languages", () => {
  test("English for an English browser, with a selector of all thirteen", async ({ page, world }) => {
    await world.goto();
    await expect(page.locator("#site-root")).toHaveAttribute("lang", "en");
    const select = page.locator("#lang-select");
    await expect(select).toHaveValue("en");
    await expect(page.locator("#lang-select > option")).toHaveText(["English", "Español", "Français", "Deutsch", "Italiano", "Polski", "Svenska", "Norsk", "Dansk", "Suomi", "Ελληνικά", "Čeština", "Українська"]);
  });

  test(`the selector is in the top right corner, above "Learn more" (on a phone, alone in the top right corner)`, async ({ page, world }) => {
    await world.goto();
    const select = (await page.locator("#lang-select").boundingBox())!;
    const screen = page.viewportSize()!;
    expect(select.y).toBeLessThan(40);
    if (!(await world.isPhone())) {
      const learn = (await page.locator("#learn-more-text").boundingBox())!;
      expect(select.x).toBeGreaterThan(screen.width / 2); // the right side
      expect(Math.abs(select.x + select.width - (learn.x + learn.width))).toBeLessThan(4); // right-aligned with "Learn more"
      expect(select.y + select.height).toBeLessThanOrEqual(learn.y + 1); // above it
    } else {
      expect(screen.width - (select.x + select.width)).toBeLessThan(screen.width * 0.06); // the top right corner
    }
  });

  test("?lang= picks one, and the choice stays for the next visit", async ({ page, world }) => {
    await world.goto("", { lang: "de" });
    await expect(page.locator("#site-root")).toHaveAttribute("lang", "de");
    await expect(page.locator("#join-button")).toContainText("Wähle ein Land, um zu beginnen");
    await page.goto("/");
    await expect(page.locator("#join-button")).toContainText("Wähle ein Land, um zu beginnen");
  });

  test("the selector reloads the page in the language, and remembers it", async ({ page, world, country }) => {
    await world.goto();
    await page.locator("#lang-select").selectOption("pl");
    await expect(page.locator("#site-root")).toHaveAttribute("lang", "pl");
    await expect(page.locator("#lang-select")).toHaveValue("pl");
    await expect(page.locator("#lang-picker")).toContainText("Język"); // its label, in Polish
    await world.goto("Poland");
    await expect(country.title).toHaveText("Polska");
  });

  test("in a country, its own selector shows the language, and a change comes back in it to the same country (CR-17)", async ({ page, world, country }) => {
    await world.goto("Poland");
    const select = page.locator("#country-lang-select");
    await expect(select).toBeVisible();
    await expect(select).toHaveValue("en");
    await select.selectOption("de");
    await expect(page.locator("#site-root")).toHaveAttribute("lang", "de");
    await expect(country.dialog).toBeVisible();
    await expect(country.title).toHaveText("Polen");
    await expect(page.locator("#country-lang-select")).toHaveValue("de");
  });

  test("in a country, the selector sits in the top right corner: beside × on a desktop, above the map on a phone (CR-17)", async ({ page, world, country }) => {
    await world.goto("Poland");
    await country.waitForUnfurled();
    const picker = (await page.locator("#country-lang-select").boundingBox())!;
    const close = (await country.closeButton.boundingBox())!;
    const title = (await country.title.boundingBox())!;
    const map = (await country.streetMap.boundingBox())!;
    if (await world.isPhone()) {
      expect(picker.y + picker.height).toBeLessThanOrEqual(map.y + 1); // above the map
      expect(Math.abs(picker.x + picker.width - (map.x + map.width))).toBeLessThan(12); // at its right
    } else {
      expect(picker.x + picker.width).toBeLessThanOrEqual(close.x); // left of ×
      expect(Math.abs(picker.y + picker.height / 2 - (close.y + close.height / 2))).toBeLessThan(4); // level with it
      expect(picker.x).toBeGreaterThan(title.x + title.width); // clear of the name
    }
  });

  test.describe("a browser in Polish", () => {
    test.use({ locale: "pl-PL" });
    test("gets Polish without choosing", async ({ page, world }) => {
      await world.goto();
      await expect(page.locator("#site-root")).toHaveAttribute("lang", "pl");
    });
  });

  test.describe("a browser in Norwegian nynorsk", () => {
    test.use({ locale: "nn-NO" });
    test("gets Norwegian (bokmål), the one Norwegian there is", async ({ page, world }) => {
      await world.goto();
      await expect(page.locator("#site-root")).toHaveAttribute("lang", "nb");
    });
  });

  test("Greek is set in a font that has Greek letters", async ({ page, world }) => {
    await world.goto("", { lang: "el" });
    await expect.poll(() => page.evaluate(() => document.fonts.check('700 16px "Alegreya SC"', "Ελληνικά"))).toBe(true);
    expect(await page.locator("#join-button").evaluate((el) => getComputedStyle(el).fontFamily)).toContain("Alegreya SC");
  });

  test("Ukrainian is set in fonts that have Cyrillic letters", async ({ page, world }) => {
    await world.goto("", { lang: "uk" });
    // Loaded on demand (the home page may not use plain Alegreya yet): a face with these letters loads.
    const covers = (font: string, text: string) => page.evaluate(async ([f, t]) => (await document.fonts.load(f, t)).some((face) => face.status === "loaded" && face.unicodeRange.toUpperCase().includes("U+400-")), [font, text] as const);
    expect(await covers('700 16px "Alegreya SC"', "Українська")).toBe(true);
    expect(await covers('400 16px "Alegreya"', "Їжак ґанок")).toBe(true);
    expect(await page.locator("#join-button").evaluate((el) => getComputedStyle(el).fontFamily)).toContain("Alegreya SC");
    await expect(page.locator("#join-button-text")).toHaveText("Оберіть країну, щоб почати");
  });

  for (const lang of LANGUAGES) {
    test(`${lang}: every text is translated, on the home page, in a country and in every form`, async ({ page, world, country, joinForm, eventForm }) => {
      await world.goto("", { lang });
      await world.filter("events");
      await world.goto("Poland", { lang });
      await country.openFromList("Test Club");
      await page.locator("#community-card-update").click();
      await joinForm.submitButton.click(); // the "required" notes
      await page.evaluate(() => document.querySelectorAll<HTMLDialogElement>("dialog[open]:not(#country-dialog)").forEach((d) => d.close()));
      await country.addEventButton.click();
      await eventForm.sendButton.click();
      expect(await missing(page)).toEqual([]);
      await expect(page.locator("#site-root")).toHaveAttribute("lang", lang);
    });

    test(`${lang}: nothing sticks out sideways, on the home page and in a country`, async ({ page, world, country }) => {
      await world.goto("", { lang });
      await expectFitsSideways(page, "home");
      await world.goto("Poland", { lang });
      await country.waitForStreetMap();
      await expectFitsSideways(page, "country");
      // The longest buttons: their words stay inside them. (Found by place:
      // the page objects name them in English.)
      for (const id of ["#add-button", "#add-event-button", "#country-back", "#filter-person", "#filter-store", "#filter-event", "#filter-club", "#filter-space"]) {
        const button = page.locator(id);
        const fits = await button.evaluate((el) => el.scrollWidth <= el.clientWidth + 1);
        expect(fits, `${id}: "${(await button.textContent()) ?? ""}" fits its button`).toBe(true);
      }
      await country.addButton.click();
      const hint = (await country.plantHint.boundingBox())!;
      const map = (await country.streetMap.boundingBox())!;
      expect(hint.x).toBeGreaterThanOrEqual(map.x - 1);
      expect(hint.x + hint.width).toBeLessThanOrEqual(map.x + map.width + 1);
    });
  }

  test("country names, dates and counts are in the language", async ({ page, world, country }) => {
    await page.clock.setFixedTime(new Date("2026-11-10T12:00:00"));
    await world.goto("Poland", { lang: "pl" });
    await expect(country.title).toHaveText("Polska");
    await expect(page.locator(`#${itemId("event", "Weekend Doubles", "2026-11-07")}-date`)).toHaveText(/lis/); // listopad: November
    await expect(page.locator("#country-poland")).toHaveAttribute("aria-label", /^Polska.*społeczno/);
  });

  test("a long country name stays whole, centred and clear of ×", async ({ page, world, country }) => {
    await world.goto("Central African Rep.", { lang: "pl" });
    await expect(country.title).toHaveText("Republika Środkowoafrykańska");
    const fits = await country.title.evaluate((el) => el.scrollWidth <= el.clientWidth);
    expect(fits).toBe(true);
    const title = (await country.title.boundingBox())!;
    const close = (await page.locator("#country-close").boundingBox())!;
    const parchment = (await page.locator("#country-parchment").boundingBox())!;
    expect(title.x + title.width).toBeLessThanOrEqual(close.x);
    expect(Math.abs(title.x + title.width / 2 - (parchment.x + parchment.width / 2))).toBeLessThan(3);
  });

  test("a country can be picked by its name in the language", async ({ world, country }) => {
    await world.goto("", { lang: "pl" });
    await world.pickCountry("Germany", "Niemcy"); // typed in Polish; its ID is by the English name
    await country.expectOpen("Niemcy");
  });

  test("what visitors wrote stays as they wrote it", async ({ page, world, country }) => {
    // A name that is also one of the site's words.
    await mockApprovedCommunities(page, { Poland: [{ name: "Update", lat: 50.06, lon: 19.94, type: "Store", description: "Close to the station" }] });
    await world.goto("Poland", { lang: "de" });
    await country.openFromList("Update");
    await expect(page.locator("#community-card-title")).toHaveText("Update");
    await expect(page.locator("#community-card-description")).toHaveText("Close to the station");
    await expect(page.locator("#community-card-tag-type")).toHaveText("Laden"); // the site's word for Store
  });

  test("forms send the same values in every language", async ({ page, world, country, eventForm }) => {
    await world.goto("Poland", { lang: "fr" });
    await expect(page.locator("#join-type > option")).toHaveText(["Choisissez…", "Club/Communauté", "Boutique", "Personne"]);
    expect(await page.locator("#join-type > option").evaluateAll((os) => os.map((o) => (o as HTMLOptionElement).value))).toEqual(["", "Club/Community", "Store", "Person"]);
    await country.addEventButton.click();
    const post = nextFormPost(page);
    await eventForm.online.check();
    await eventForm.name.fill("Ligue en ligne");
    await eventForm.date.fill("2030-03-20");
    await eventForm.link.fill("https://example.com/ligue");
    await eventForm.consent.check();
    await eventForm.sendButton.click();
    const request = await post;
    expect(postedField(request, "country")).toBe("Poland");
    expect(postedField(request, "online")).toBe("Yes");
  });

  test("the privacy page follows the choice", async ({ page, world }) => {
    await world.goto("", { lang: "it" });
    await page.goto("/privacy.html");
    await expect(page.locator("#privacy-public-title")).toHaveText("Cosa è pubblico");
    await expect(page.locator("#privacy-page")).toContainText("Netlify");
    await expect(page.locator('#privacy-page a[href="https://www.netlify.com/"]')).toHaveCount(1);
  });
});
