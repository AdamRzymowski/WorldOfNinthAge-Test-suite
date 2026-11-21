import type { Locator, Page } from "@playwright/test";

/** The "Know a community here?" popup, from "Know one? Tell us.". */
export class TipForm {
  readonly dialog: Locator;
  readonly name: Locator;
  readonly howToFind: Locator;
  readonly sendButton: Locator;
  readonly cancelButton: Locator;
  readonly error: Locator;
  readonly thanks: Locator;

  constructor(readonly page: Page) {
    this.dialog = page.locator("#tip-dialog");
    this.name = page.locator("#tip-name");
    this.howToFind = page.locator("#tip-how");
    this.sendButton = page.locator("#tip-submit");
    this.cancelButton = page.locator("#tip-cancel");
    this.error = page.locator("#tip-error");
    this.thanks = page.locator("#tip-done");
  }

  async send(name: string, howToFind: string) {
    await this.name.fill(name);
    await this.howToFind.fill(howToFind);
    await this.sendButton.click();
  }
}
