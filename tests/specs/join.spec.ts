import type { Page } from "@playwright/test";
import { test, expect, mockAddress, nextFormPost, postedField } from "../support/test";

test.describe("Plant your banner", () => {
  test.beforeEach(async ({ world, country }) => {
    await world.goto("Poland");
    await country.waitForStreetMap();
  });

  test("planting on the map opens the form for that spot", async ({ country, joinForm }) => {
    await country.addButton.click();
    await expect(country.plantHint).toBeVisible();
    await country.clickStreetMap();

    await expect(joinForm.dialog).toBeVisible();
    await expect(joinForm.field("country")).toHaveValue("Poland");
    await expect(joinForm.field("latitude")).toHaveValue(/^\d+\.\d{4}$/);
    await expect(joinForm.field("longitude")).toHaveValue(/^\d+\.\d{4}$/);
    await expect(country.plantHint).toBeHidden();
  });

  test("planting on an existing community ignores it", async ({ country, joinForm }) => {
    await country.addButton.click();
    // On a phone, reaching the + button scrolls the map up: bring the marker
    // back to the middle of the screen before clicking its spot.
    const marker = country.streetMarker("Test Club");
    await marker.evaluate((el) => el.scrollIntoView({ block: "center" }));
    const box = (await marker.boundingBox())!;
    await country.page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);

    await expect(joinForm.dialog).toBeVisible();
    await expect(country.card).toBeHidden();
  });

  test.describe("the form", () => {
    test.beforeEach(async ({ country, joinForm }) => {
      await country.addButton.click();
      await country.clickStreetMap();
      await expect(joinForm.dialog).toBeVisible();
    });

    test("marks every empty required section", async ({ page, joinForm }) => {
      let posted = false;
      page.on("request", (r) => (posted ||= r.method() === "POST"));
      await joinForm.submit();
      await expect(joinForm.error).toContainText("Some required sections are empty");
      await expect(joinForm.requiredNotes).toHaveCount(4); // name, type, gaming space, contacts

      await joinForm.fill({ name: "New Club" });
      await expect(joinForm.requiredNotes).toHaveCount(3);
      expect(posted).toBe(false);
    });

    test("needs agreeing that it will be public, with a link to the privacy note", async ({ page, joinForm }) => {
      await joinForm.fill({ name: "New Club", type: "Club/Community", gamingSpace: true, discord: "discord.gg/newclub" });
      let posted = false;
      page.on("request", (r) => (posted ||= r.method() === "POST"));
      await joinForm.submit({ consent: false });
      // Marked like every other required section, with the same message.
      await expect(joinForm.error).toHaveText("Some required sections are empty: they're marked in red below.");
      const consent = page.locator("#join-consent");
      await expect(consent).toHaveClass(/missing/);
      await expect(page.locator("#join-consent-required")).toHaveText("This section is required");
      await expect(joinForm.requiredNotes).toHaveCount(1);
      expect(posted).toBe(false);
      await expect(page.locator("#join-consent-privacy")).toHaveText("Privacy");
      await expect(page.locator("#join-consent-privacy")).toHaveAttribute("href", "privacy.html");
      await expect(consent).toContainText("I'm 16 or older, or a parent or guardian agrees.");

      await joinForm.field("consent").check();
      await expect(consent).not.toHaveClass(/missing/);
      await expect(joinForm.requiredNotes).toHaveCount(0);
    });

    test("the logo's + opens the file picker too", async ({ page, joinForm }) => {
      const chooser = page.waitForEvent("filechooser");
      await page.locator("#join-logo-preview").click();
      expect((await chooser).element()).toBeTruthy();
    });

    test("the agreement is the last thing in the form", async ({ joinForm }) => {
      const last = await joinForm.page.locator("#join-fields").evaluate((el) => el.lastElementChild?.id);
      expect(last).toBe("join-consent");
    });

    test('"Plant my banner!" at the top and again at the end, and the × to close', async ({ joinForm }) => {
      await expect(joinForm.submitButton).toHaveText("Plant my banner!");
      await expect(joinForm.page.locator("#join-submit-end")).toHaveText("Plant my banner!");
      // The second comes after the agreement, the last thing in the form.
      const consent = (await joinForm.page.locator("#join-consent").boundingBox())!;
      const end = (await joinForm.page.locator("#join-submit-end").boundingBox())!;
      expect(end.y).toBeGreaterThan(consent.y + consent.height - 1);
      // No Cancel, unlike the other forms: its buttons are the ×, the two sends and the tick when sent.
      expect(await joinForm.page.locator("#join-form").evaluate((form) => [...form.querySelectorAll("button")].map((b) => b.id))).toEqual(["join-close", "join-submit", "join-submit-end", "join-done-close"]);
      await expect(joinForm.closeButton).toBeVisible();
      await joinForm.closeButton.click();
      await expect(joinForm.dialog).toBeHidden();
    });

    test("won't send an email address or phone number in what's shown on the map", async ({ page, joinForm }) => {
      let posted = false;
      page.on("request", (r) => (posted ||= r.method() === "POST"));
      await joinForm.fill({ name: "New Club", type: "Club/Community", gamingSpace: true, discord: "discord.gg/newclub" });
      await joinForm.field("forum_username").fill("someone@gmail.com");
      await joinForm.submit();
      await expect(joinForm.error).toHaveText("We noticed an email address or phone number here. To keep you safe, we don't publish those: please take it out.");
      await expect(joinForm.field("forum_username")).toBeFocused();
      await joinForm.field("forum_username").fill("");
      await joinForm.fill({ comment: "Call us on +48 601 234 567" });
      await joinForm.submit();
      await expect(joinForm.error).toHaveText("We noticed an email address or phone number here. To keep you safe, we don't publish those: please take it out.");
      expect(posted).toBe(false);

      // A day and time are fine.
      const post = nextFormPost(page);
      await joinForm.fill({ comment: "Thursdays 18:00, from 12.11.2026" });
      await joinForm.submit();
      await post;
    });

    test("rejects a Discord link that isn't an invite", async ({ joinForm }) => {
      await joinForm.fill({ name: "New Club", type: "Club/Community", gamingSpace: true, discord: "discord.com/channels/1" });
      await joinForm.submit();
      await expect(joinForm.error).toHaveText("The Discord link should be an invite, like https://discord.gg/abc123.");
    });

    test("rejects a WhatsApp link that doesn't lead to WhatsApp", async ({ joinForm }) => {
      await joinForm.fill({ name: "New Club", type: "Club/Community", gamingSpace: true, whatsapp: "https://signup.example.org/gameday" });
      await joinForm.submit();
      await expect(joinForm.error).toHaveText("The WhatsApp link should lead to WhatsApp, like https://chat.whatsapp.com/abc123.");
    });

    test("moves the banner to the address when it can be found, without asking in its own country", async ({ page, joinForm }) => {
      await mockAddress(page, { lat: 54.4084, lon: 18.5564 });
      await joinForm.fill({
        name: "New Club",
        type: "Store",
        gamingSpace: true,
        sellsMiniatures: true,
        address: "Stary Rynek Oliwski 7, Gdańsk",
        discord: "https://discord.gg/newclub",
        website: "newclub.pl",
      });
      const post = nextFormPost(page);
      await joinForm.submit();
      const request = await post;

      expect(postedField(request, "form-name")).toBe("community-submission");
      expect(postedField(request, "name")).toBe("New Club");
      expect(postedField(request, "type")).toBe("Store");
      expect(postedField(request, "gaming_space")).toBe("Yes");
      expect(postedField(request, "website")).toBe("https://newclub.pl/");
      expect(postedField(request, "pin_from")).toBe("address");
      expect(postedField(request, "country")).toBe("Poland");
      expect(postedField(request, "country_choice")).toBe("");
      await expect(page.locator("#country-check")).toBeHidden();
      expect(postedField(request, "latitude")).toBe("54.4084");
      expect(postedField(request, "longitude")).toBe("18.5564");
    });

    test.describe("an address in another country asks which country", () => {
      test.beforeEach(async ({ page, joinForm }) => {
        await mockAddress(page, { lat: 52.52, lon: 13.405 }); // Berlin, planted in Poland
        await joinForm.fill({ name: "New Club", type: "Club/Community", gamingSpace: true, address: "Alexanderplatz 1, Berlin", discord: "discord.gg/newclub" });
      });

      test("the address's country: the banner goes there, at the address", async ({ page, joinForm }) => {
        const post = nextFormPost(page);
        await joinForm.submit();
        const check = page.locator("#country-check");
        await expect(page.locator("#country-check-title")).toHaveText("Which country?");
        await expect(page.locator("#country-check-text")).toHaveText("The address isn't in the country you picked. Where should your banner go?");
        await expect(page.locator("#country-check-found")).toBeFocused();
        await page.keyboard.press("Escape"); // only an answer closes it
        await expect(check).toBeVisible();
        await expect(page.locator("#country-check-found")).toHaveText("Germany, where the address is");
        await page.locator("#country-check-found").click();
        const request = await post;
        expect(postedField(request, "country")).toBe("Germany");
        expect(postedField(request, "country_choice")).toBe("address");
        expect(postedField(request, "pin_from")).toBe("address");
        expect(postedField(request, "latitude")).toBe("52.5200");
        expect(postedField(request, "longitude")).toBe("13.4050");
      });

      test("the country picked: the banner stays there, where it was planted", async ({ page, joinForm }) => {
        const planted = await joinForm.field("latitude").inputValue();
        const post = nextFormPost(page);
        await joinForm.submit();
        await expect(page.locator("#country-check-picked")).toHaveText("Poland, as picked");
        await page.locator("#country-check-picked").click();
        const request = await post;
        expect(postedField(request, "country")).toBe("Poland");
        expect(postedField(request, "country_choice")).toBe("picked");
        expect(postedField(request, "pin_from")).toBe("map");
        expect(postedField(request, "latitude")).toBe(planted);
      });
    });

    test("a Store ticks what it sells: T9A-compatible miniatures, T9A-related materials, both or neither; no one else is asked", async ({ page, joinForm }) => {
      const question = page.locator("#join-sells");
      await expect(question).toBeHidden();
      await joinForm.fill({ name: "New Shop", type: "Store", gamingSpace: false, discord: "discord.gg/newshop" });
      await expect(question).toBeVisible();
      await expect(page.locator("#join-sells-legend")).toHaveText("What it sells (tick all that apply)");
      await expect(joinForm.field("sells_miniatures")).toBeVisible();
      await expect(joinForm.field("sells_materials")).toBeVisible();
      await expect(page.locator('#join-sells [type="checkbox"]')).toHaveCount(2); // those two, no more
      await expect(page.locator("#join-sells-materials-hint")).toHaveText("Trays, templates, tokens, terrain…");

      // Neither ticked is an answer too: it sends.
      const post = nextFormPost(page);
      await joinForm.submit();
      const request = await post;
      expect(postedField(request, "sells_miniatures")).toBeNull();
      expect(postedField(request, "sells_materials")).toBeNull();
    });

    test("a club or store is told what Yes means for its pin, a Person isn't; the address says it's never shown (CR-20)", async ({ page, joinForm }) => {
      const hint = page.locator("#join-space-hint");
      for (const type of ["Club/Community", "Store"]) {
        await joinForm.field("type").selectOption(type);
        await expect(hint).toBeVisible();
        await expect(hint).toHaveText("With Yes, your banner sits on the exact spot. If you play at someone's home, answer No: it's then placed within about 1 km.");
      }
      await joinForm.field("type").selectOption("Person");
      await expect(hint).toBeHidden();
      const address = page.locator("#join-address-field");
      await expect(address).toContainText("(optional; the street address itself is never shown)");
      await expect(address).toContainText("If we can find it, your banner goes there: on the exact spot with a gaming space, otherwise within about 1 km.");
    });

    test("a Store's ticks are sent as Yes", async ({ page, joinForm }) => {
      await joinForm.fill({ name: "New Shop", type: "Store", gamingSpace: false, sellsMaterials: true, discord: "discord.gg/newshop" });
      const post = nextFormPost(page);
      await joinForm.submit();
      const request = await post;
      expect(postedField(request, "sells_miniatures")).toBeNull();
      expect(postedField(request, "sells_materials")).toBe("Yes");
    });

    test("a club isn't asked what it sells, even after Store was ticked first", async ({ page, joinForm }) => {
      const question = page.locator("#join-sells");
      await joinForm.fill({ type: "Store", sellsMiniatures: true, sellsMaterials: true });
      await joinForm.fill({ name: "New Club", type: "Club/Community", gamingSpace: true, discord: "discord.gg/newclub" });
      await expect(question).toBeHidden();
      const post = nextFormPost(page);
      await joinForm.submit();
      const request = await post;
      expect(postedField(request, "sells_miniatures")).toBeNull(); // nothing sent at all
      expect(postedField(request, "sells_materials")).toBeNull();
    });

    test("a Person can pick one of the country's clubs", async ({ page, joinForm }) => {
      const memberOf = page.locator("#join-member-of");
      await expect(memberOf).toBeHidden();
      await joinForm.fill({ type: "Club/Community" });
      await expect(memberOf).toBeHidden();
      await joinForm.fill({ type: "Person" });
      await expect(memberOf).toBeVisible();
      // Only clubs and stores, not other people.
      await expect(page.locator("#join-member-select > option")).toHaveText(["No, just me", "Test Club"]);

      await joinForm.fill({ name: "New Player", gamingSpace: false, discord: "discord.gg/newplayer" });
      await joinForm.field("member_of").selectOption("Test Club");
      const post = nextFormPost(page);
      await joinForm.submit();
      expect(postedField(await post, "member_of")).toBe("Test Club");
    });

    test("a club sends no membership, even if one was picked first", async ({ page, joinForm }) => {
      await joinForm.fill({ type: "Person" });
      await joinForm.field("member_of").selectOption("Test Club");
      await joinForm.fill({ name: "New Club", type: "Club/Community", gamingSpace: true, discord: "discord.gg/newclub" });
      const post = nextFormPost(page);
      await joinForm.submit();
      expect(postedField(await post, "member_of")).toBe("");
    });

    test("keeps the planted spot when the address isn't found", async ({ page, joinForm }) => {
      const planted = await joinForm.field("latitude").inputValue();
      await joinForm.fill({ name: "New Club", type: "Person", gamingSpace: false, address: "Nowhere 1", discord: "discord.gg/newclub" });
      const post = nextFormPost(page);
      await joinForm.submit();
      const request = await post;
      expect(postedField(request, "pin_from")).toBe("map");
      expect(postedField(request, "latitude")).toBe(planted);
      expect(postedField(request, "country")).toBe("Poland");
    });

    // "Town or city" (CR-3): optional, shown on the map; "Your town or city?"
    // asks once when it's empty or far from the banner.
    test.describe("the town or city", () => {
      const townCheck = (page: Page) => page.locator("#town-check");

      test("with no town, it asks first: \"Add my town or city\" goes back to the field, \"Send without it\" sends", async ({ page, joinForm }) => {
        await joinForm.fill({ name: "New Club", type: "Person", gamingSpace: false, discord: "discord.gg/newclub" });
        let posted = false;
        page.on("request", (r) => (posted ||= r.method() === "POST"));
        await joinForm.submit({ askTown: true });
        await expect(townCheck(page)).toBeVisible();
        await expect(page.locator("#town-check-text")).toHaveText(
          "You haven't given your town or city. Adding it shows people roughly where you are: we want the location to stay general, but still match where you planted your banner. Without it, your banner goes by where you planted it.",
        );
        await expect(page.locator("#town-check-add")).toHaveText("Add my town or city");
        await page.locator("#town-check-add").click();
        await expect(townCheck(page)).toBeHidden();
        await expect(joinForm.field("town")).toBeFocused();
        expect(posted).toBe(false);

        const post = nextFormPost(page);
        await joinForm.submitButton.click();
        await expect(page.locator("#town-check-skip")).toHaveText("Send without it");
        await page.locator("#town-check-skip").click();
        expect(postedField(await post, "town")).toBe("");
      });

      test("a town found more than 30 km from the banner asks; \"Send without the town\" sends without it", async ({ page, joinForm }) => {
        await mockAddress(page, { lat: 40.42, lon: -3.7 }); // Madrid
        await joinForm.fill({ name: "New Club", type: "Person", gamingSpace: false, town: "Madrid", discord: "discord.gg/newclub" });
        await joinForm.submit({ askTown: true });
        await expect(page.locator("#town-check-text")).toContainText("Madrid is more than 30 km from where you planted your banner.");
        await expect(page.locator("#town-check-add")).toHaveText("Change the town");
        await page.locator("#town-check-add").click();
        await expect(joinForm.field("town")).toBeFocused();

        const post = nextFormPost(page);
        await joinForm.submitButton.click();
        await expect(page.locator("#town-check-skip")).toHaveText("Send without the town");
        await page.locator("#town-check-skip").click();
        const request = await post;
        expect(postedField(request, "town")).toBe("");
        expect(postedField(request, "pin_from")).toBe("map"); // goes by the planted banner
      });

      test("a town the search can't find is sent as written, with no question", async ({ page, joinForm }) => {
        // Not found (the search answers nothing in the tests).
        await joinForm.fill({ name: "New Club", type: "Person", gamingSpace: false, town: "Tinyvillage", discord: "discord.gg/newclub" });
        const post = nextFormPost(page);
        await joinForm.submit({ askTown: true });
        expect(postedField(await post, "town")).toBe("Tinyvillage");
        await expect(townCheck(page)).toBeHidden();
      });

      test("a town near the banner is sent with no question", async ({ page, joinForm }) => {
        const lat = Number(await joinForm.field("latitude").inputValue());
        const lon = Number(await joinForm.field("longitude").inputValue());
        await mockAddress(page, { lat: lat + 0.05, lon }); // about 5 km away
        await joinForm.fill({ name: "New Club", type: "Person", gamingSpace: false, town: "Nearby", discord: "discord.gg/newclub" });
        const post = nextFormPost(page);
        await joinForm.submit({ askTown: true });
        expect(postedField(await post, "town")).toBe("Nearby");
        await expect(townCheck(page)).toBeHidden();
      });

      test("is at most 60 characters, and may not hold an email address or phone number", async ({ page, joinForm }) => {
        await expect(joinForm.field("town")).toHaveAttribute("maxlength", "60");
        await joinForm.fill({ name: "New Club", type: "Person", gamingSpace: false, town: "call 600 700 800", discord: "discord.gg/newclub" });
        await joinForm.submit({ askTown: true });
        await expect(joinForm.error).toHaveText("We noticed an email address or phone number here. To keep you safe, we don't publish those: please take it out.");
        await expect(townCheck(page)).toBeHidden();
      });
    });

    test("shows the 24-hour note in bold, with no Done button: the × or the big tick closes it", async ({ page, joinForm }) => {
      await joinForm.fill({ name: "New Club", type: "Club/Community", gamingSpace: false, discord: "discord.gg/newclub" });
      await joinForm.submit();
      await expect(joinForm.done).toBeVisible();
      const note = page.locator("#join-done-note-text");
      await expect(note).toHaveText("It can take up to 24 hours for your banner to appear on the map.");
      expect(Number(await note.evaluate((el) => getComputedStyle(el).fontWeight))).toBeGreaterThanOrEqual(700);
      // No Done button: the tick is its only button.
      expect(await page.locator("#join-done").evaluate((el) => [...el.querySelectorAll("button")].map((b) => b.id))).toEqual(["join-done-close"]);
      await expect(joinForm.closeButton).toBeFocused();

      await page.keyboard.press("Escape");
      await expect(joinForm.dialog).toBeVisible();
      await joinForm.closeButton.click();
      await expect(joinForm.dialog).toBeHidden();
    });

    test('the "Plant my banner!" at the end sends it too', async ({ page, joinForm }) => {
      await joinForm.fill({ name: "New Club", type: "Club/Community", gamingSpace: false, discord: "discord.gg/newclub" });
      await joinForm.field("consent").check();
      const post = nextFormPost(page);
      joinForm.sendWithoutTownIfAsked();
      await page.locator("#join-submit-end").click();
      expect(postedField(await post, "name")).toBe("New Club");
      await expect(joinForm.done).toBeVisible();
      await expect(page.locator("#join-submit-end")).toBeHidden();
    });

    test("the big green tick closes the form too", async ({ joinForm }) => {
      await joinForm.fill({ name: "New Club", type: "Club/Community", gamingSpace: false, discord: "discord.gg/newclub" });
      await joinForm.submit();
      const tick = joinForm.page.locator("#join-done-close");
      await expect(tick).toBeVisible(); // once the post is answered
      await expect(tick).toHaveText("✓");
      expect((await tick.boundingBox())!.width).toBeGreaterThanOrEqual(120);
      await tick.click();
      await expect(joinForm.dialog).toBeHidden();
    });

    test("Escape doesn't lose what was typed", async ({ page, joinForm }) => {
      await joinForm.fill({ name: "New Club" });
      await page.keyboard.press("Escape");
      await expect(joinForm.dialog).toBeVisible();
      await expect(joinForm.field("name")).toHaveValue("New Club");
    });
  });
});
