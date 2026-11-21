import type { Locator, Page } from "@playwright/test";

/** The "Add an event" popup, from "Add event" on a card (the host fixed) or under the country's name (the host picked, or no one). */
export class EventForm {
  readonly dialog: Locator;
  readonly host: Locator;
  readonly hostPick: Locator;
  readonly online: Locator;
  readonly address: Locator;
  readonly hostingCountry: Locator;
  readonly name: Locator;
  readonly date: Locator;
  readonly lastDay: Locator;
  readonly link: Locator;
  readonly weekly: Locator;
  readonly oneDay: Locator;
  readonly weekday: Locator;
  readonly until: Locator;
  readonly consent: Locator;
  readonly sendButton: Locator;
  /** The second "Add event", under the title (CR-18). */
  readonly sendTopButton: Locator;
  readonly cancelButton: Locator;
  readonly error: Locator;
  readonly done: Locator;

  constructor(readonly page: Page) {
    this.dialog = page.locator("#event-dialog");
    this.host = page.locator("#event-host");
    this.hostPick = page.locator("#event-host-select");
    this.online = page.locator("#event-online");
    this.address = page.locator("#event-address");
    this.hostingCountry = page.locator("#event-country-shown");
    this.name = page.locator("#event-name");
    this.date = page.locator("#event-start");
    this.lastDay = page.locator("#event-end");
    this.link = page.locator("#event-link");
    this.weekly = page.locator("#event-recurring");
    this.oneDay = page.locator("#event-one-day-box");
    this.weekday = page.locator("#event-weekday-select");
    this.until = page.locator("#event-until-date");
    this.consent = page.locator("#event-consent-box");
    this.sendButton = page.locator("#event-submit");
    this.sendTopButton = page.locator("#event-submit-top");
    this.cancelButton = page.locator("#event-cancel");
    this.error = page.locator("#event-error");
    this.done = page.locator("#event-done");
  }

  /** weekday ("Thursday"...) ticks "Recurring weekly" and picks that day in place of a date. */
  async send({ name = "", date = "", lastDay = "", link = "", consent = true, weekday = "", until = "", address = "", online = false }) {
    await this.name.fill(name);
    if (online) await this.online.check();
    if (address) await this.address.fill(address);
    if (weekday) {
      await this.weekly.check();
      await this.weekday.selectOption({ label: weekday });
    } else if (date) await this.date.fill(date);
    if (lastDay) await this.lastDay.fill(lastDay);
    if (until) await this.until.fill(until);
    await this.link.fill(link);
    if (consent) await this.consent.check();
    await this.sendButton.click();
  }
}
