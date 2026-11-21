import { test, expect, mockApprovedCommunities } from "../support/test";
import { itemId, items } from "../support/ids";

// The card's tags, in order ("community-card-tag-type"...).
const TAGS = items("community-card-facts", "community-card-tag");

test.describe("Country window", () => {
  test("shows the real map, with no painted view to switch to", async ({ page, world, country }) => {
    await world.goto("Poland");
    await country.waitForStreetMap();
    await expect(page.locator("#view-toggle")).toHaveCount(0);
    await expect(page.locator("#country-map")).toHaveCount(0);
  });

  test("lists clubs and stores under Communities and individuals under People", async ({ world, country }) => {
    await world.goto("Poland");
    await expect(country.communities).toHaveCount(1);
    await expect(country.communities).toContainText(["Test Club"]);
    await expect(country.peopleSection).toBeVisible();
    await expect(country.people).toHaveCount(1);
    await expect(country.people).toContainText(["Test Person"]);
    await expect(country.empty).toBeHidden();
  });

  test("a community's card shows its details and contacts", async ({ page, world, country }) => {
    await world.goto("Poland");
    await country.openFromList("Test Club");
    await expect(page.locator("#community-card-title")).toHaveText("Test Club");
    await expect(page.locator("#community-card-region")).toHaveText("Gdańsk");
    await expect(page.locator("#community-card-description")).toHaveText("We meet every Thursday.");
    const discord = `#${itemId("community-card-link", "discord", "Join the Discord server")}`;
    await expect(page.locator(`${discord}-detail`)).toHaveText("Join the Discord server");
    await expect(page.locator(`${discord}-row`)).toHaveAttribute(
      "href",
      "https://discord.gg/testclub",
    );
  });

  test("only a gaming space gets a tag, not the lack of one", async ({ page, world, country }) => {
    await world.goto("Poland");
    await country.openFromList("Test Club");
    await expect(page.locator(TAGS)).toHaveText(["Club/Community", "Has gaming space"]);
    await expect(page.locator("#community-card-tag-gaming-space")).toHaveText("Has gaming space");
    await country.openFromList("Test Person");
    await expect(page.locator(TAGS)).toHaveText(["Person"]);
    await expect(page.locator("#community-card-tag-gaming-space")).toHaveCount(0);
  });

  test("a store that sells T9A-compatible miniatures or T9A-related materials says so on its card", async ({ page, world, country }) => {
    await world.goto("France");
    await country.openFromList("Test Store");
    await expect(page.locator(TAGS)).toHaveText(["Store", "Has gaming space", "Sells T9A-compatible miniatures", "Sells T9A-related materials"]);
  });

  test('the contacts come under "Contact us here:", or for a person "Contact me here:"', async ({ page, world, country }) => {
    await world.goto("Poland");
    await country.openFromList("Test Club");
    await expect(page.locator("#community-card-contact-heading")).toHaveText("Contact us here:");
    await expect(page.locator("#community-card-links")).toBeVisible();
    expect(await page.locator("#community-card-contact-heading").evaluate((el) => el.nextElementSibling?.id)).toBe("community-card-links"); // right under it
    await country.openFromList("Test Person");
    await expect(page.locator("#community-card-contact-heading")).toHaveText("Contact me here:");
  });

  test("a club's card lists its members, and a member's card links back", async ({ page, world, country }) => {
    await world.goto("Poland");
    await country.openFromList("Test Club");
    await expect(page.locator("#community-card-members-title")).toHaveText("Members (1)");
    await page.locator(`#${itemId("community-card-member", "Test Person")}-button`).click();

    await expect(page.locator("#community-card-title")).toHaveText("Test Person");
    await expect(page.locator("#community-card-member-of")).toHaveText("Member of Test Club");
    await expect(page.locator("#community-card-club")).toHaveText("Test Club");
    await page.locator("#community-card-club").click();
    await expect(page.locator("#community-card-title")).toHaveText("Test Club");
  });

  test("a member of a club that isn't on the map shows no membership", async ({ page, world, country }) => {
    await mockApprovedCommunities(page, {
      Poland: [{ name: "Lone Player", lat: 50.06, lon: 19.94, type: "Person", memberOf: "Unknown Club" }],
    });
    await world.goto("Poland");
    await country.openFromList("Lone Player");
    await expect(page.locator("#community-card-member-of")).toHaveCount(0);
  });

  test("shows the communities of every country on the map", async ({ world, country }) => {
    await world.goto("Poland");
    await country.waitForStreetMap();
    await expect(country.streetMarker("Test Club")).toBeAttached();
    await expect(country.streetMarker("Test Store")).toBeAttached(); // in France
  });

  test("a neighbour's card offers to switch to its country", async ({ page, world, country }) => {
    await world.goto("Poland");
    await country.waitForStreetMap();
    // France is off screen from Poland's map, so the marker is clicked directly.
    await country.streetMarker("Test Store").dispatchEvent("click");
    const switchButton = page.locator("#community-card-switch");
    await expect(switchButton).toHaveText("Switch to France");
    await switchButton.click();

    await country.expectOpen("France");
    await expect(country.communities).toContainText(["Test Store"]);
    await expect(page.locator("#community-card-title")).toHaveText("Test Store");
    await expect(switchButton).toBeHidden();
  });

  test("only its buttons close it, not Escape", async ({ world, country }) => {
    await world.goto("Poland");
    await country.page.keyboard.press("Escape");
    await expect(country.dialog).toBeVisible();

    await country.closeButton.click();
    await expect(country.dialog).toBeHidden();
    await expect(country.page).not.toHaveURL(/#/);
  });

  test("the back button returns to the world map", async ({ world, country }) => {
    await world.goto("Poland");
    await country.backButton.click();
    await expect(country.dialog).toBeHidden();
    await expect(world.map).toBeVisible();
  });

  test("adds submissions approved since the last deploy, without repeating known ones", async ({ page, world, country }) => {
    await mockApprovedCommunities(page, {
      Poland: [
        { name: "Test Club", lat: 54.35, lon: 18.65, type: "Club/Community" },
        { name: "Fresh Club", lat: 50.06, lon: 19.94, type: "Club/Community", region: "Kraków" },
      ],
    });
    await world.goto("Poland");
    await expect(country.communities).toHaveCount(2);
    await expect(country.communities).toContainText(["Test Club", "Fresh Club"]);
  });

  test("still works when the approved-submissions function is down", async ({ page, world, country }) => {
    await page.route("**/api/communities", (route) => route.fulfill({ status: 502 }));
    await world.goto("Poland");
    await expect(country.communities).toContainText(["Test Club"]);
  });
});
