import { expect, type Locator, type Page } from "@playwright/test";
import { item, items, itemId } from "../support/ids";

/** The full-screen country window: its map, lists and community card. */
export class CountryDialog {
  readonly dialog: Locator;
  readonly title: Locator;
  readonly closeButton: Locator;
  readonly backButton: Locator;
  readonly streetMap: Locator;
  readonly addButton: Locator;
  readonly addEventButton: Locator;
  readonly addRow: Locator;
  readonly plantHint: Locator;
  readonly communities: Locator;
  readonly people: Locator;
  readonly peopleSection: Locator;
  readonly empty: Locator;
  readonly tipButton: Locator;
  readonly card: Locator;
  readonly eventsSection: Locator;
  readonly events: Locator;
  readonly eventsEmpty: Locator;
  readonly pastToggle: Locator;
  readonly pastEvents: Locator;
  readonly filterBar: Locator;
  readonly switchRow: Locator;
  readonly filterEmpty: Locator;
  readonly sectionTabs: Locator;
  readonly sectionButtons: Locator;

  constructor(readonly page: Page) {
    this.dialog = page.locator("#country-dialog");
    this.title = page.locator("#country-title");
    this.closeButton = page.locator("#country-close");
    this.backButton = page.locator("#country-back");
    this.streetMap = page.locator("#street-map");
    this.addButton = page.locator("#add-button");
    this.addEventButton = page.locator("#add-event-button");
    this.addRow = page.locator("#country-add-row");
    this.plantHint = page.locator("#plant-hint");
    this.communities = page.locator(items("community-list", "community"));
    this.people = page.locator(items("people-list", "person"));
    this.peopleSection = page.locator("#people-section");
    this.empty = page.locator("#community-empty");
    this.tipButton = page.locator("#tip-button");
    this.card = page.locator("#community-card");
    this.eventsSection = page.locator("#events-section");
    this.events = page.locator(items("event-list", "event"));
    this.eventsEmpty = page.locator("#events-empty");
    this.pastToggle = page.locator("#past-toggle");
    this.pastEvents = page.locator(items("past-list", "past-event"));
    this.filterBar = page.locator("#filter-bar");
    this.switchRow = page.locator("#country-switch-row");
    this.filterEmpty = page.locator("#filter-empty");
    this.sectionTabs = page.locator("#section-tabs");
    this.sectionButtons = page.locator(items("section-tabs", "section-tab"));
  }

  /** The button for one section, by its English name: the country's own land or a territory. */
  section(name: string): Locator {
    return this.page.locator(item("section-tab", name));
  }

  /** A filter button (CR-12): "Show people"... or "Has gaming space". Pressed (aria-pressed) is on: a green ✓; off, a red ✕. */
  filterBox(which: "People" | "Communities" | "Stores" | "Events" | "Has gaming space"): Locator {
    const id = { People: "filter-person", Communities: "filter-club", Stores: "filter-store", Events: "filter-event", "Has gaming space": "filter-space" }[which];
    return this.page.locator(`#${id}`);
  }

  /** Switches one filter button on or off (a click, only if it isn't that way already). */
  async setFilterButton(which: Parameters<CountryDialog["filterBox"]>[0], on: boolean) {
    const button = this.filterBox(which);
    if (((await button.getAttribute("aria-pressed")) === "true") !== on) await button.click();
    await expect(button).toHaveAttribute("aria-pressed", String(on));
  }

  /** Sets the filter: the types to show (the others switched off), Events, and whether only those with a gaming space. */
  async setFilter({ types, gamingSpace = false, events }: { types?: ("People" | "Communities" | "Stores")[]; gamingSpace?: boolean; events?: boolean }) {
    if (types) {
      for (const type of ["People", "Communities", "Stores"] as const) await this.setFilterButton(type, types.includes(type));
    }
    if (events !== undefined) await this.setFilterButton("Events", events);
    await this.setFilterButton("Has gaming space", gamingSpace);
  }

  /** Every filter button back as at first: the four kinds on, "Has gaming space" off. */
  async resetFilter() {
    await this.setFilter({ types: ["People", "Communities", "Stores"], events: true, gamingSpace: false });
  }

  async expectOpen(country: string) {
    await expect(this.dialog).toBeVisible();
    await expect(this.title).toHaveText(country);
  }

  /** A community's marker on the map, by its name. */
  streetMarker(name: string): Locator {
    return this.page.locator(item("marker", name));
  }

  /** An entry in the Communities list ("community-<name>") or the People list ("person-<name>"). */
  listItem(name: string): Locator {
    return this.page.locator(`${item("community", name)}, ${item("person", name)}`);
  }

  /** Opens a community's card from the Communities or People list. */
  async openFromList(name: string) {
    await this.page.locator(`#${itemId("community", name)}-button, #${itemId("person", name)}-button`).click();
    await expect(this.card).toBeVisible();
  }

  /** An event in "Upcoming events" (or "Past events"), by its name and first day. */
  event(name: string, start: string, past = false): Locator {
    return this.page.locator(item(past ? "past-event" : "event", name, start));
  }

  /** A part of an event ("name", "date", "place", "host-button", "credit", "report", "source-logo"...). */
  eventPart(name: string, start: string, part: string, past = false): Locator {
    return this.page.locator(`#${itemId(past ? "past-event" : "event", name, start)}-${part}`);
  }

  /** Every listed event's name (or days), in order: each event's "-name" ("-date"). */
  get eventNames(): Locator {
    return this.page.locator('#event-list [id^="event-"][id$="-name"]');
  }
  get eventDates(): Locator {
    return this.page.locator('#event-list [id^="event-"][id$="-date"]');
  }
  get pastEventNames(): Locator {
    return this.page.locator('#past-list [id^="past-event-"][id$="-name"]');
  }
  get pastEventDates(): Locator {
    return this.page.locator('#past-list [id^="past-event-"][id$="-date"]');
  }

  /** Waits until the map is drawn for the open country. */
  async waitForStreetMap() {
    await expect(this.streetMap).toBeVisible();
    await expect(this.page.locator("#street-zoom-in")).toBeAttached();
  }

  /** Waits for the window to finish unfurling (its opening animation), so measurements are final. */
  async waitForUnfurled() {
    await this.dialog.evaluate((el) =>
      Promise.all(el.getAnimations({ subtree: true }).filter((a) => a.effect?.getTiming().iterations !== Infinity).map((a) => a.finished.catch(() => undefined))),
    );
  }

  /** Clicks the map at a point given as fractions of its size. */
  async clickStreetMap(x = 0.5, y = 0.5) {
    // On a phone the filter's buttons (CR-12/13) make the window taller, so
    // pressing Add can leave the map scrolled out of sight: bring it back.
    await this.streetMap.scrollIntoViewIfNeeded();
    const box = (await this.streetMap.boundingBox())!;
    await this.page.mouse.click(box.x + box.width * x, box.y + box.height * y);
  }
}
