import { test, expect, nextFormPost, postedField } from "../support/test";

// A 1x1 red PNG, to stand in for a photo.
const RED_PIXEL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==",
  "base64",
);
const image = (name: string) => ({ name, mimeType: "image/png", buffer: RED_PIXEL_PNG });

test.describe("Gallery", () => {
  test("every card has one, for people, communities and stores", async ({ page, world, country }) => {
    await world.goto("Poland");
    for (const name of ["Test Club", "Test Person"]) {
      await country.openFromList(name);
      await expect(page.locator("#community-card-add-images")).toHaveText("Add images");
    }
    await world.goto("France");
    await country.openFromList("Test Store");
    await expect(page.locator("#community-card-gallery")).toBeVisible();
  });

  test("shows the entry's images and approved ones, opening full size", async ({ page, world, country }) => {
    await page.route("**/api/communities", (route) =>
      route.fulfill({
        json: { countries: {}, events: {}, updates: {}, gallery: { Poland: [{ community: "Test Club", images: ["/assets/banner-logo.webp", "/assets/store-logo.webp"] }] } },
      }),
    );
    await world.goto("Poland");
    await country.openFromList("Test Club");
    await expect(page.locator("#community-card-gallery-title")).toHaveText("Gallery (2)");
    await expect(page.locator('#community-card-photos > [id^="community-card-photo-"]')).toHaveCount(2);
    await expect(page.locator("#community-card-photo-2-image")).toBeVisible();
    // Checked by safeUrl(), which gives the link in full.
    await expect(page.locator("#community-card-photo-1-link")).toHaveAttribute("href", new URL("/assets/banner-logo.webp", process.env.BASE_URL).href);
    await expect(page.locator("#community-card-photo-1-link")).toHaveAttribute("target", "_blank");
  });

  test("each image has a Report button, opening the form about that photo", async ({ page, world, country, changeForm }) => {
    await page.route("**/api/communities", (route) =>
      route.fulfill({
        json: { countries: {}, events: {}, updates: {}, gallery: { Poland: [{ community: "Test Club", images: ["/assets/banner-logo.webp", "/assets/store-logo.webp"] }] } },
      }),
    );
    await world.goto("Poland");
    await country.openFromList("Test Club");
    await expect(page.locator("#community-card-photo-1-report")).toHaveText("Report");
    await page.locator("#community-card-photo-2-report").click();
    await expect(changeForm.dialog).toBeVisible();
    await expect(page.locator("#change-title")).toHaveText("Report");
    await expect(changeForm.entry).toHaveText("About a photo of Test Club, Poland");
    const post = nextFormPost(page);
    await changeForm.send("Not our club", "me@example.com", "report");
    const request = await post;
    expect(postedField(request, "subject")).toBe("photo");
    expect(postedField(request, "photo")).toBe(new URL("/assets/store-logo.webp", page.url()).href); // its full address
    expect(postedField(request, "entry")).toBe("Test Club");
  });

  test("the banner form has no store-front photo any more", async ({ world, country, joinForm }) => {
    await world.goto("Poland");
    await country.waitForStreetMap();
    await country.addButton.click();
    await country.clickStreetMap();
    await joinForm.fill({ type: "Store" });
    await expect(joinForm.page.locator("#join-photo")).toHaveCount(0);
  });

  test.describe("Add images", () => {
    test.beforeEach(async ({ world, country }) => {
      await world.goto("Poland");
      await country.openFromList("Test Club");
      await country.page.locator("#community-card-add-images").click();
      await expect(country.page.locator("#gallery-dialog")).toBeVisible();
    });

    test("sends up to three images, made smaller, for that entry", async ({ page }) => {
      const dialog = page.locator("#gallery-dialog");
      await expect(page.locator("#gallery-about")).toHaveText("For Test Club");
      // The agreement covers the uploader's age, and anyone young in the photos.
      await expect(page.locator("#gallery-consent")).toContainText("I'm 16 or older, or a parent or guardian agrees.");
      await expect(page.locator("#gallery-consent")).toContainText("If anyone shown is under 16, their parent or guardian agrees too.");
      await page.locator("#gallery-images").setInputFiles([image("a.png"), image("b.png")]);
      await expect(page.locator('#gallery-previews > [id^="gallery-preview-"]')).toHaveCount(2);

      await page.locator("#gallery-consent-box").check();
      const post = nextFormPost(page);
      await page.locator("#gallery-submit").click();
      const body = (await post).postDataBuffer()!.toString("latin1");
      expect(body).toContain('name="form-name"\r\n\r\ngallery-submission');
      expect(body).toContain('name="community"\r\n\r\nTest Club');
      expect(body).toMatch(/name="image1"; filename="test-club-1\.(webp|jpeg)"/);
      expect(body).toMatch(/name="image2"; filename="test-club-2\.(webp|jpeg)"/);
      expect(body).not.toContain('name="image3"');
      await expect(page.locator("#gallery-done-title")).toHaveText("Images sent!");
    });

    test("refuses more than three, none, or without agreeing they'll be public", async ({ page }) => {
      const dialog = page.locator("#gallery-dialog");
      await page.locator("#gallery-submit").click();
      await expect(page.locator("#gallery-error")).toHaveText("Please pick at least one image.");
      await page.locator("#gallery-images").setInputFiles([image("a.png"), image("b.png"), image("c.png"), image("d.png")]);
      await expect(page.locator("#gallery-error")).toHaveText("Please pick at most 3 images at a time.");
      await page.locator("#gallery-images").setInputFiles([image("a.png")]);
      await page.locator("#gallery-submit").click();
      await expect(page.locator("#gallery-error")).toHaveText("Please tick the box to agree that this will be public.");
    });
  });
});
