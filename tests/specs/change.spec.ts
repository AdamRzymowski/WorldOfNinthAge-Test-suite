import { test, expect, nextFormPost, postedField } from "../support/test";

test.describe("Request deletion", () => {
  test("every card offers it, and Update under Add event: clubs, stores and people", async ({ page, world, country }) => {
    await world.goto("Poland");
    for (const name of ["Test Club", "Test Person"]) {
      await country.openFromList(name);
      await expect(page.locator("#community-card-request-deletion")).toHaveText("Request deletion");
      await expect(page.locator("#community-card-update")).toHaveText("Update");
    }
    await world.goto("France");
    await country.openFromList("Test Store");
    await expect(page.locator("#community-card-request-deletion")).toBeVisible();
  });

  test.describe("the form", () => {
    test.beforeEach(async ({ world, country, changeForm }) => {
      await world.goto("Poland");
      await country.openFromList("Test Club");
      await country.page.locator("#community-card-request-deletion").click();
      await expect(changeForm.dialog).toBeVisible();
      await expect(changeForm.entry).toHaveText("About Test Club, Poland");
    });

    test("needs only a contact to verify: a reason is optional, and it says removal takes at most a month", async ({ page, changeForm }) => {
      await expect(page.locator("#change-reason-optional")).toHaveText("(optional)");
      await expect(page.locator("#change-note")).toHaveText("We remove the entry within a month, usually much sooner.");
      let posted = false;
      page.on("request", (r) => (posted ||= r.method() === "POST"));
      await changeForm.send("We closed", "");
      await expect(changeForm.error).toHaveText("Please tell us how to contact you to verify the request.");
      expect(posted).toBe(false);

      const post = nextFormPost(page);
      await changeForm.send("", "owner@example.com");
      const request = await post;
      expect(postedField(request, "reason")).toBe("");
      expect(postedField(request, "contact")).toBe("owner@example.com");
    });

    test("sends the request to Netlify Forms for that entry", async ({ page, changeForm }) => {
      const post = nextFormPost(page);
      await changeForm.send("The club has closed", "owner@example.com");
      const request = await post;
      expect(postedField(request, "form-name")).toBe("change-request");
      expect(postedField(request, "country")).toBe("Poland");
      expect(postedField(request, "entry")).toBe("Test Club");
      expect(postedField(request, "subject")).toBe("entry");
      expect(postedField(request, "kind")).toBe("mine");
      expect(postedField(request, "reason")).toBe("The club has closed");
      expect(postedField(request, "contact")).toBe("owner@example.com");

      await expect(page.locator("#change-done-text")).toHaveText(
        "Thank you! We will check your request and contact you if we need anything else.",
      );
      await page.locator("#change-done-close").click();
      await expect(changeForm.dialog).toBeHidden();
    });

    test("asks what it's about; a report needs what's wrong and a good-faith tick", async ({ page, changeForm }) => {
      let posted = false;
      page.on("request", (r) => (posted ||= r.method() === "POST"));
      await changeForm.send("", "owner@example.com", "");
      await expect(changeForm.error).toHaveText("Please choose what it's about.");
      await expect(changeForm.goodFaith).toBeHidden();

      await changeForm.report.check();
      await expect(changeForm.goodFaith).toBeVisible();
      await expect(page.locator("#change-reason-required")).toBeVisible(); // "Reason (required: what's wrong)"
      await expect(page.locator("#change-reason-optional")).toBeHidden();
      await changeForm.contact.fill("owner@example.com");
      await changeForm.sendButton.click();
      await expect(changeForm.error).toHaveText("Please say what's wrong.");
      await changeForm.reason.fill("It's a fake club");
      await changeForm.sendButton.click();
      await expect(changeForm.error).toHaveText("Please confirm you're reporting this in good faith.");
      expect(posted).toBe(false);

      const post = nextFormPost(page);
      await changeForm.goodFaith.check();
      await changeForm.sendButton.click();
      const request = await post;
      expect(postedField(request, "kind")).toBe("report");
      expect(postedField(request, "good_faith")).toBe("Yes");
      expect(postedField(request, "reason")).toBe("It's a fake club");
    });

    test("only its buttons close it, not Escape", async ({ page, changeForm }) => {
      await changeForm.reason.fill("We closed");
      await page.keyboard.press("Escape");
      await expect(changeForm.dialog).toBeVisible();
      await expect(changeForm.reason).toHaveValue("We closed");
      await changeForm.cancelButton.click();
      await expect(changeForm.dialog).toBeHidden();
    });
  });
});
