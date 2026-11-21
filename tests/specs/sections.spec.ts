import { test, expect, mockApprovedCommunities } from "../support/test";

// Territories come from data/territories.json (the real file): France has
// French Guiana, Guadeloupe, Martinique, Réunion, Mayotte and seven more.
test.describe("Country sections", () => {
  test.beforeEach(async ({ page }) => {
    await mockApprovedCommunities(page, {
      France: [{ name: "Guiana Club", lat: 4.93, lon: -52.33, type: "Club/Community", region: "Cayenne" }],
    });
  });

  test("a country with territories lists each in its own section", async ({ page, world, country }) => {
    await world.goto("France");
    await expect(country.sectionButtons).toHaveText([
      "France", "French Guiana", "Guadeloupe", "Martinique", "Réunion", "Mayotte", "French Polynesia", "New Caledonia",
      "Saint Barthélemy", "Saint Martin", "Saint Pierre and Miquelon", "Wallis and Futuna", "French Southern and Antarctic Lands",
    ]);
    await expect(country.section("France")).toHaveAttribute("aria-pressed", "true");
    await expect(country.communities).toContainText(["Test Store"]);
    await expect(country.communities).not.toContainText(["Guiana Club"]);

    await country.section("French Guiana").click();
    await expect(country.section("French Guiana")).toHaveAttribute("aria-pressed", "true");
    await expect(country.communities).toHaveCount(1);
    await expect(country.communities).toContainText(["Guiana Club"]);
    await expect(page).toHaveURL(/#French%20Guiana$/);
  });

  test("a territory's name opens its section, from the address or the search", async ({ world, country }) => {
    await world.goto("French Guiana");
    await country.expectOpen("France");
    await expect(country.section("French Guiana")).toHaveAttribute("aria-pressed", "true");

    await country.closeButton.click();
    // Closing clears the address a moment later (the dialog's "close" event): wait
    // for that, or it would wipe the next one.
    await expect(world.page).not.toHaveURL(/#/);
    await world.goto("Réunion");
    await expect(country.section("Réunion")).toHaveAttribute("aria-pressed", "true");
  });

  test("a card from another section offers to switch to it", async ({ page, world, country }) => {
    await world.goto("France");
    await country.waitForStreetMap();
    // French Guiana is off screen from France's map, so the marker is clicked directly.
    await country.streetMarker("Guiana Club").dispatchEvent("click");
    await expect(page.locator("#community-card-switch")).toHaveText("Switch to French Guiana");
    await page.locator("#community-card-switch").click();

    await expect(country.section("French Guiana")).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("#community-card-title")).toHaveText("Guiana Club");
  });

  test("a territory the map draws on its own opens as its country's section", async ({ page, world, country }) => {
    await mockApprovedCommunities(page, {
      "Falkland Is.": [{ name: "Stanley Club", lat: -51.7, lon: -57.85, type: "Club/Community" }],
    });
    await world.goto("Falkland Is.");
    await country.expectOpen("United Kingdom");
    await expect(country.section("Falkland Islands")).toHaveAttribute("aria-pressed", "true");
    await expect(country.communities).toContainText(["Stanley Club"]);
    await expect(page).toHaveURL(/#Falkland%20Islands$/);

    await country.section("United Kingdom").click();
    await expect(country.communities).not.toContainText(["Stanley Club"]);
  });

  test("parts of a country's own shape: Spain's Canary Islands, Portugal's Azores", async ({ world, country }) => {
    await world.goto("Spain");
    await expect(country.sectionButtons).toHaveText(["Spain", "Canary Islands"]);
    await world.goto("Portugal");
    await expect(country.sectionButtons).toHaveText(["Portugal", "Azores", "Madeira"]);
  });

  test("a country without territories has no section buttons", async ({ world, country }) => {
    await world.goto("Poland");
    await expect(country.sectionTabs).toBeHidden();
  });
});
