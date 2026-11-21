import { test, expect, mockAddress, mockApprovedCommunities, nextFormPost, postedField } from "../support/test";
import { items, itemId } from "../support/ids";

// The fixture's Poland: Test Club (Gdańsk, gaming space, a Discord invite)
// and Test Person, a member of it.
const CLUB = { name: "Test Club", lat: 54.35, lon: 18.65, type: "Club/Community", gamingSpace: true, links: [] };

test.describe("Update", () => {
  test("opens the banner form with the entry's details", async ({ world, country, joinForm }) => {
    await world.goto("Poland");
    await country.openFromList("Test Club");
    await country.page.locator("#community-card-update").click();

    await expect(joinForm.dialog).toBeVisible();
    await expect(joinForm.page.locator("#join-title")).toHaveText("Update your banner");
    await expect(joinForm.page.locator("#join-submit")).toHaveText("Send the update");
    await expect(joinForm.page.locator("#join-submit-end")).toHaveText("Send the update");
    await expect(joinForm.field("name")).toHaveValue("Test Club");
    await expect(joinForm.field("type")).toHaveValue("Club/Community");
    await expect(joinForm.gamingSpace(true)).toBeChecked();
    await expect(joinForm.field("discord")).toHaveValue("https://discord.gg/testclub");
    await expect(joinForm.field("comment")).toHaveValue("We meet every Thursday.");
    await expect(joinForm.field("town")).toHaveValue("Gdańsk"); // its town, from the map
  });

  test("an entry with no town is asked for one when updated (\"Your town or city?\")", async ({ page, world, country, joinForm }) => {
    await mockApprovedCommunities(page, { Poland: [{ name: "Townless Club", lat: 52.4, lon: 16.9, type: "Club/Community", gamingSpace: true, discordUsername: "townless" }] });
    await world.goto("Poland");
    await country.openFromList("Townless Club");
    await country.page.locator("#community-card-update").click();
    await expect(joinForm.field("town")).toHaveValue("");
    await joinForm.submit({ askTown: true });
    await expect(page.locator("#town-check")).toBeVisible();
    await expect(page.locator("#town-check-add")).toHaveText("Add my town or city");
  });

  test("a store's update has its tick boxes filled in as on the map", async ({ world, country, joinForm }) => {
    await world.goto("France");
    await country.openFromList("Test Store");
    await country.page.locator("#community-card-update").click();
    await expect(joinForm.field("sells_miniatures")).toBeChecked();
    await expect(joinForm.field("sells_materials")).toBeChecked();
  });

  test("sends the changes as an update to that entry", async ({ page, world, country, joinForm }) => {
    await world.goto("Poland");
    await country.openFromList("Test Club");
    await country.page.locator("#community-card-update").click();
    await joinForm.field("name").fill("Test Club Gdańsk");
    const post = nextFormPost(page);
    await joinForm.submit();
    const request = await post;

    expect(postedField(request, "form-name")).toBe("community-update");
    expect(postedField(request, "target")).toBe("Test Club");
    expect(postedField(request, "country")).toBe("Poland");
    expect(postedField(request, "name")).toBe("Test Club Gdańsk");
    expect(postedField(request, "latitude")).toBe("54.3500");
    await expect(page.locator("#join-done-title")).toHaveText("Update sent!");
  });

  test("an update keeps its country, even with an address abroad, so it finds its entry", async ({ page, world, country, joinForm }) => {
    await mockAddress(page, { lat: 52.52, lon: 13.405 }); // Berlin
    await world.goto("Poland");
    await country.openFromList("Test Club");
    await country.page.locator("#community-card-update").click();
    await joinForm.field("address").fill("Alexanderplatz 1, Berlin");
    const post = nextFormPost(page);
    await joinForm.submit();
    const request = await post;
    expect(postedField(request, "target")).toBe("Test Club");
    expect(postedField(request, "country")).toBe("Poland");
    expect(postedField(request, "pin_from")).toBe("map");
  });

  test("planting a new banner afterwards is a new submission again", async ({ page, world, country, joinForm }) => {
    await world.goto("Poland");
    await country.openFromList("Test Club");
    await country.page.locator("#community-card-update").click();
    await joinForm.closeButton.click();

    await country.addButton.click();
    await expect(country.card).toBeHidden(); // it would cover the map
    await country.clickStreetMap(0.3, 0.6);
    await expect(joinForm.field("name")).toHaveValue("");
    const post = nextFormPost(page);
    await joinForm.fill({ name: "New Club", type: "Club/Community", gamingSpace: false, discord: "discord.gg/newclub" });
    await joinForm.submit();
    const request = await post;
    expect(postedField(request, "form-name")).toBe("community-submission");
    expect(postedField(request, "target")).toBe("");
  });

  test("an approved update replaces the entry's details; members follow a new name", async ({ page, world, country }) => {
    await mockApprovedCommunities(page, {}, {}, {
      Poland: [{ target: "Test Club", community: { ...CLUB, name: "Renamed Club", gamingSpace: false, description: "Now on Fridays." } }],
    });
    await world.goto("Poland");
    await expect(country.communities).toContainText(["Renamed Club"]);
    await expect(country.communities).not.toContainText(["Test Club"]);
    await country.openFromList("Renamed Club");
    await expect(page.locator("#community-card-description")).toHaveText("Now on Fridays.");
    await expect(page.locator("#community-card-region")).toHaveText("Gdańsk"); // the town stays
    await expect(page.locator(items("community-card-facts", "community-card-tag"))).toHaveText(["Club/Community"]);

    await country.openFromList("Test Person");
    await expect(page.locator("#community-card-member-of")).toHaveText("Member of Renamed Club");
  });

  test("an update that moves an entry far away, or takes another's name, is skipped", async ({ page, world, country }) => {
    await mockApprovedCommunities(page, {}, {}, {
      Poland: [
        { target: "Test Club", community: { ...CLUB, name: "Moved Club", lat: 50.06, lon: 19.94 } },
        { target: "Test Club", community: { ...CLUB, name: "Test Person" } },
      ],
    });
    await world.goto("Poland");
    await expect(country.communities).toContainText(["Test Club"]);
    await expect(country.communities).not.toContainText(["Moved Club"]);
  });

  test("an approved update sent before the entry's updatedAt is skipped; a later one still applies (KD-11)", async ({ page, world, country }) => {
    const website = { type: "website", label: "old.example", url: "https://old.example/" };
    const dated = { lat: 52.23, lon: 21.01, type: "Club/Community", gamingSpace: true, region: "Warszawa", description: "As in the file.", links: [website], updatedAt: "2026-06-01T12:00:00Z" };
    await mockApprovedCommunities(page, { Poland: [{ ...dated, name: "Copied Club" }, { ...dated, name: "Later Club" }] }, {}, {
      Poland: [
        { target: "Copied Club", at: "2026-06-01T11:59:00Z", community: { ...dated, name: "Copied Club", description: "Already copied.", links: [], updatedAt: undefined } },
        { target: "Later Club", at: "2026-06-01T12:01:00Z", community: { ...dated, name: "Later Club", description: "Sent later.", links: [], updatedAt: undefined } },
      ],
    });
    await world.goto("Poland");
    await country.openFromList("Copied Club");
    await expect(page.locator("#community-card-description")).toHaveText("As in the file.");
    await expect(page.locator(`#${itemId("community-card-link", "website", "old.example")}-row`)).toHaveAttribute("href", "https://old.example/");

    await country.openFromList("Later Club");
    await expect(page.locator("#community-card-description")).toHaveText("Sent later.");
    await expect(page.locator("#community-card-links")).toHaveCount(0);
  });
});
