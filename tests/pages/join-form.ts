import type { Locator, Page } from "@playwright/test";

/** Each field's ID, by the name it's sent under. */
const FIELDS: Record<string, string> = {
  name: "join-name",
  type: "join-type",
  member_of: "join-member-select",
  sells_miniatures: "join-sells-miniatures",
  sells_materials: "join-sells-materials",
  town: "join-town",
  address: "join-address",
  discord: "join-discord",
  whatsapp: "join-whatsapp",
  facebook: "join-facebook",
  website: "join-website",
  forum_username: "join-forum-username",
  discord_username: "join-discord-username",
  comment: "join-comment",
  logo: "join-logo",
  consent: "join-consent-box",
  target: "join-target",
  country: "join-form-country",
  latitude: "join-latitude",
  longitude: "join-longitude",
  pin_from: "join-pin-from",
  country_choice: "join-country-choice",
};

/** The "What does your banner include?" form, opened by planting a banner. */
export class JoinForm {
  readonly dialog: Locator;
  readonly form: Locator;
  readonly closeButton: Locator;
  readonly submitButton: Locator;
  readonly error: Locator;
  readonly requiredNotes: Locator;
  readonly done: Locator;

  constructor(readonly page: Page) {
    this.dialog = page.locator("#join-dialog");
    this.form = page.locator("#join-form");
    this.closeButton = page.locator("#join-close");
    this.submitButton = page.locator("#join-submit");
    this.error = page.locator("#join-error");
    this.requiredNotes = page.locator('#join-form [id$="-required"]');
    this.done = page.locator("#join-done");
  }

  /** A field by the name it's sent under ("town", "latitude"...), found by its ID. */
  field(name: string): Locator {
    const id = FIELDS[name];
    if (!id) throw new Error(`No ID for the banner form's field "${name}"`);
    return this.page.locator(`#${id}`);
  }

  /** "Has gaming space?": Yes or No. */
  gamingSpace(yes: boolean): Locator {
    return this.page.locator(yes ? "#join-space-yes" : "#join-space-no");
  }

  async fill(values: {
    name?: string;
    type?: "Club/Community" | "Store" | "Person";
    gamingSpace?: boolean;
    sellsMiniatures?: boolean;
    sellsMaterials?: boolean;
    town?: string;
    address?: string;
    discord?: string;
    whatsapp?: string;
    website?: string;
    comment?: string;
  }) {
    if (values.name !== undefined) await this.field("name").fill(values.name);
    if (values.type) await this.field("type").selectOption(values.type);
    if (values.gamingSpace !== undefined) await this.gamingSpace(values.gamingSpace).check();
    // A store's tick boxes: what it sells.
    if (values.sellsMiniatures !== undefined) await this.field("sells_miniatures").setChecked(values.sellsMiniatures);
    if (values.sellsMaterials !== undefined) await this.field("sells_materials").setChecked(values.sellsMaterials);
    if (values.town !== undefined) await this.field("town").fill(values.town);
    if (values.address !== undefined) await this.field("address").fill(values.address);
    if (values.discord !== undefined) await this.field("discord").fill(values.discord);
    if (values.whatsapp !== undefined) await this.field("whatsapp").fill(values.whatsapp);
    if (values.website !== undefined) await this.field("website").fill(values.website);
    if (values.comment !== undefined) await this.field("comment").fill(values.comment);
  }

  /** Ticks "I agree that ... will be shown publicly" (unless told not to) and sends.
   *  If "Your town or city?" asks (no town, or a far one), it answers "Send
   *  without" by itself, unless askTown is true: the town specs answer it. */
  async submit({ consent = true, askTown = false } = {}) {
    if (consent) await this.field("consent").check();
    if (!askTown) this.sendWithoutTownIfAsked();
    await this.submitButton.click();
  }

  /** Answers "Send without" if "Your town or city?" shows within a few seconds
   *  (not awaited: most sends never ask). */
  sendWithoutTownIfAsked() {
    void this.page.locator("#town-check-skip").click({ timeout: 8000 }).catch(() => {});
  }
}
