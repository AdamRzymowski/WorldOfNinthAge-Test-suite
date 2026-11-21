import { test, expect, nextFormPost, postedField } from "../support/test";

// "Report a bug" (js/bug.js): the button in the map's bottom right corner,
// beside New Recruit's credit (CR-11; on a phone, the last item in the menu) and its form, sent to the Netlify form bug-report. The server's
// checks on it are in tests/server/content.spec.ts and links.spec.ts.

test.describe("Report a bug", () => {
  test("the button is in the map's bottom right corner, left of New Recruit's credit (on a phone, the last item in the menu)", async ({ page, world }) => {
    await world.goto();
    if (!(await world.isPhone())) {
      const bug = (await page.locator("#bug-button").boundingBox())!;
      const credit = (await page.locator("#nr-credit").boundingBox())!;
      const zoom = (await page.locator("#map-zoom").boundingBox())!;
      const map = (await page.locator("#map-stage").boundingBox())!;
      expect(bug.x).toBeGreaterThan(map.x + map.width / 2); // the right side
      expect(bug.y + bug.height).toBeGreaterThan(map.y + map.height - 60); // at the map's bottom
      expect(bug.x + bug.width).toBeLessThanOrEqual(credit.x + 1); // left of the credit
      expect(Math.abs(bug.y + bug.height / 2 - (credit.y + credit.height / 2))).toBeLessThan(4); // on its row
      expect(bug.y).toBeGreaterThanOrEqual(zoom.y + zoom.height); // under the zoom buttons
    } else {
      await expect(page.locator("#bug-button")).toBeHidden(); // not on the page
      await world.openMenu();
      await expect(page.locator("#menu-bug")).toHaveText("Report a bug");
      expect(await page.locator("#phone-menu").evaluate((menu) => menu.lastElementChild!.id)).toBe("menu-bug"); // the lowest
    }
  });

  test.describe("the form", () => {
    test.beforeEach(async ({ page, world }) => {
      await world.goto();
      await world.openBugReport();
      await expect(page.locator("#bug-dialog")).toBeVisible();
      await expect(page.locator("#bug-title")).toHaveText("Report a bug");
    });

    test("needs a title and a description", async ({ page }) => {
      let posted = false;
      page.on("request", (r) => (posted ||= r.method() === "POST"));
      const dialog = page.locator("#bug-dialog");
      await page.locator("#bug-submit").click();
      await expect(page.locator("#bug-error")).toHaveText("Please give the bug a title.");
      await expect(page.locator("#bug-title-input")).toBeFocused();
      await page.locator("#bug-title-input").fill("   ");
      await page.locator("#bug-submit").click();
      await expect(page.locator("#bug-error")).toHaveText("Please give the bug a title.");
      await page.locator("#bug-title-input").fill("The map doesn't load");
      await page.locator("#bug-submit").click();
      await expect(page.locator("#bug-error")).toHaveText("Please describe the bug.");
      expect(posted).toBe(false);
    });

    test("keeps to the lengths the server allows", async ({ page }) => {
      const dialog = page.locator("#bug-dialog");
      await expect(page.locator("#bug-title-input")).toHaveAttribute("maxlength", "120");
      await expect(page.locator("#bug-description")).toHaveAttribute("maxlength", "2000");
    });

    test("sends the report to Netlify Forms, with the page it came from", async ({ page, world }) => {
      const dialog = page.locator("#bug-dialog");
      await page.locator("#bug-title-input").fill("  The map doesn't load  ");
      await page.locator("#bug-description").fill("On my phone in Firefox the map stays blank.");
      const post = nextFormPost(page);
      await page.locator("#bug-submit").click();
      const request = await post;
      expect(postedField(request, "form-name")).toBe("bug-report");
      expect(postedField(request, "title")).toBe("The map doesn't load");
      expect(postedField(request, "description")).toBe("On my phone in Firefox the map stays blank.");
      expect(postedField(request, "page")).toBe(page.url());
      expect(postedField(request, "bot-field")).toBe("");

      const done = page.locator("#bug-done");
      await expect(page.locator("#bug-done-text")).toHaveText("Thank you for the report! We will look into it.");
      await page.locator("#bug-done-close").click();
      await expect(dialog).toBeHidden();
      await expect(await world.bugReturnFocus()).toBeFocused(); // its button, or ☰ on a phone
    });

    test("only its buttons close it, not Escape; opening it again starts empty", async ({ page, world }) => {
      const dialog = page.locator("#bug-dialog");
      await page.locator("#bug-title-input").fill("Something");
      await page.keyboard.press("Escape");
      await expect(dialog).toBeVisible();
      await expect(page.locator("#bug-title-input")).toHaveValue("Something");
      await page.locator("#bug-cancel").click();
      await expect(dialog).toBeHidden();
      await world.openBugReport();
      await expect(page.locator("#bug-title-input")).toHaveValue("");
    });
  });
});
