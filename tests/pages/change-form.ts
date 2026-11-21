import type { Locator, Page } from "@playwright/test";

/** The "Request deletion" popup, from the link on every card. */
export class ChangeForm {
  readonly dialog: Locator;
  readonly entry: Locator;
  readonly mine: Locator;
  readonly report: Locator;
  readonly goodFaith: Locator;
  readonly reason: Locator;
  readonly contact: Locator;
  readonly sendButton: Locator;
  readonly cancelButton: Locator;
  readonly error: Locator;
  readonly thanks: Locator;

  constructor(readonly page: Page) {
    this.dialog = page.locator("#change-dialog");
    this.entry = page.locator("#change-entry");
    this.mine = page.locator("#change-kind-mine");
    this.report = page.locator("#change-kind-report");
    this.goodFaith = page.locator("#change-good-faith-box");
    this.reason = page.locator("#change-reason");
    this.contact = page.locator("#change-contact");
    this.sendButton = page.locator("#change-submit");
    this.cancelButton = page.locator("#change-cancel");
    this.error = page.locator("#change-error");
    this.thanks = page.locator("#change-done");
  }

  /** kind: about oneself ("mine", the default) or a report; a report is sent in good faith. */
  async send(reason: string, contact: string, kind: "mine" | "report" | "" = "mine") {
    if (kind) await (kind === "mine" ? this.mine : this.report).check();
    if (kind === "report") await this.goodFaith.check();
    await this.reason.fill(reason);
    await this.contact.fill(contact);
    await this.sendButton.click();
  }
}
