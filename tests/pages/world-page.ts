import { expect, type Locator, type Page } from "@playwright/test";
import { item, items } from "../support/ids";

/** The landing page: the painted world map, and "Select a country to start" under it. */
export class WorldPage {
  readonly map: Locator;
  readonly countries: Locator;
  readonly joinButton: Locator;
  readonly countryBox: Locator;

  constructor(readonly page: Page) {
    this.map = page.locator("#world-map");
    this.countries = page.locator(items("world-countries", "country"));
    this.joinButton = page.locator("#join-button");
    this.countryBox = page.locator("#join-country"); // by id: its label is translated
  }

  /** Opens the site, or a country straight away with `#<country>`; in a language with `lang` (js/i18n.js). */
  async goto(hash = "", { lang }: { lang?: string } = {}) {
    await this.page.goto(`/${lang ? `?lang=${lang}` : ""}${hash ? `#${encodeURIComponent(hash)}` : ""}`);
    await expect(this.countries.first()).toBeAttached();
  }

  /** Whether the page is in the phone view (js/view.js). */
  async isPhone() {
    return (await this.page.evaluate(() => document.documentElement.dataset.view)) === "phone";
  }

  /** Opens the phone view's menu (☰). */
  async openMenu() {
    await this.page.locator("#menu-button").click();
    await expect(this.page.locator("#phone-menu")).toBeVisible();
  }

  /** A world filter's own button ("Show only events" or "Show only stores",
   *  "Show everything again" while on). In the phone view it's hidden: the
   *  menu's item stands in for it. */
  filterButton(which: "events" | "stores") {
    return this.page.locator(`#world-${which}-toggle`);
  }

  /** Turns a world filter on or off: its button on a desktop; on a phone, ☰ → Filter on the map → the filter. */
  async filter(which: "events" | "stores") {
    if (await this.isPhone()) {
      await this.openMenu();
      await this.page.locator("#menu-on-map").click();
      await this.page.locator(`#menu-${which}-filter`).click();
      await expect(this.page.locator("#phone-menu")).toBeHidden();
    } else {
      await this.filterButton(which).click();
    }
  }

  /** "Major global community events": its button on a desktop; on a phone, ☰ → the same item. */
  async openMajorEvents() {
    if (await this.isPhone()) {
      await this.openMenu();
      await this.page.locator("#menu-major").click();
    } else {
      await this.page.locator("#major-button").click();
    }
  }

  /** "Report a bug": its button on a desktop; on a phone, ☰ → the same item. */
  async openBugReport() {
    if (await this.isPhone()) {
      await this.openMenu();
      await this.page.locator("#menu-bug").click();
    } else {
      await this.page.locator("#bug-button").click();
    }
  }

  /** What "Report a bug" gives the focus back to: its button, or ☰ on a phone. */
  async bugReturnFocus() {
    return (await this.isPhone()) ? this.page.locator("#menu-button") : this.page.locator("#bug-button");
  }

  /** A country's shape on the world map, by its English name: "#country-poland". */
  country(name: string): Locator {
    return this.page.locator(item("country", name));
  }

  /** "Select a country to start", then the country from the box's list (it opens ready to plant).
   *  typed is what goes in the box (the name in the page's language); country is the English name. */
  async pickCountry(country: string, typed = country) {
    if (await this.joinButton.isVisible()) await this.joinButton.click();
    await this.countryBox.fill(typed);
    await this.page.locator(item("join-country", country)).click();
  }
}
