import { test, expect, nextFormPost, postedField } from "../support/test";

test.describe("Know one? Tell us.", () => {
  test.beforeEach(async ({ world, country }) => {
    await world.goto("Spain"); // no communities in the test data
    await expect(country.empty).toBeVisible();
    await country.tipButton.click();
  });

  test("asks for the name before sending", async ({ page, tipForm }) => {
    let posted = false;
    page.on("request", (r) => (posted ||= r.method() === "POST"));
    await tipForm.sendButton.click();
    await expect(tipForm.error).toHaveText("Please give the community or store's name.");

    await tipForm.name.fill("Club Madrid");
    await tipForm.sendButton.click();
    await expect(tipForm.error).toHaveText("Please tell us how to find them.");
    expect(posted).toBe(false);
  });

  test("sends the tip to Netlify Forms and thanks the visitor", async ({ page, tipForm }) => {
    const post = nextFormPost(page);
    await tipForm.send("Club Madrid", "They play in Madrid, discord.gg/madrid");
    const request = await post;
    expect(postedField(request, "form-name")).toBe("community-tip");
    expect(postedField(request, "country")).toBe("Spain");
    expect(postedField(request, "name")).toBe("Club Madrid");
    expect(postedField(request, "how_to_find")).toBe("They play in Madrid, discord.gg/madrid");

    await expect(page.locator("#tip-done-text")).toHaveText(
      "Thank you for letting us know! We will reach out to them and ask if we can add them to this map.",
    );
    await expect(tipForm.name).toBeHidden();
    await page.locator("#tip-done-close").click();
    await expect(tipForm.dialog).toBeHidden();
  });

  test("says so when sending fails", async ({ page, tipForm }) => {
    await page.route(
      (url) => url.pathname === "/",
      (route) => (route.request().method() === "POST" ? route.fulfill({ status: 500 }) : route.fallback()),
    );
    await tipForm.send("Club Madrid", "Madrid");
    await expect(tipForm.error).toContainText("didn't go through");
    await expect(tipForm.thanks).toBeHidden();
    await expect(tipForm.sendButton).toBeEnabled();
  });

  test("only its buttons close it, not Escape", async ({ page, tipForm }) => {
    await tipForm.name.fill("Club Madrid");
    await page.keyboard.press("Escape");
    await expect(tipForm.dialog).toBeVisible();
    await expect(tipForm.name).toHaveValue("Club Madrid");

    await tipForm.cancelButton.click();
    await expect(tipForm.dialog).toBeHidden();
  });
});
