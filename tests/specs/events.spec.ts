import { test, expect, mockAddress, mockApprovedCommunities, nextFormPost, postedField } from "../support/test";
import { item, itemId } from "../support/ids";

// The fixture's Polish events, all hosted by Test Club:
// - Test Tournament, 5–6 Dec 2026;
// - Weekend Doubles, 7–8 Nov 2026;
// - Old Cup, 1 Oct 2026.
test.describe("Events", () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.setFixedTime(new Date("2026-11-10T12:00:00"));
  });

  test("lists a country's upcoming events, soonest first, with their day and host", async ({ page, world, country }) => {
    await world.goto("Poland");
    await expect(page.locator("#events-title")).toHaveText("Upcoming events");
    expect(await country.events.evaluateAll((els) => els.map((el) => el.id))).toEqual([itemId("event", "Weekend Doubles", "2026-11-07"), itemId("event", "Test Tournament", "2026-12-05")]);
    await expect(country.eventNames).toHaveText(["Weekend Doubles", "Test Tournament"]);
    await expect(country.eventPart("Weekend Doubles", "2026-11-07", "name")).toHaveAttribute(
      "href",
      "https://example.com/weekend-doubles",
    );
    await expect(country.eventDates).toHaveText(["Sat, 7 Nov – Sun, 8 Nov 2026", "Sat, 5 Dec – Sun, 6 Dec 2026"]);
    await expect(country.eventsEmpty).toBeHidden();

    await expect(country.eventPart("Weekend Doubles", "2026-11-07", "host")).toHaveText("at Test Club");
    await country.eventPart("Weekend Doubles", "2026-11-07", "host-button").click();
    await expect(page.locator("#community-card-title")).toHaveText("Test Club");
  });

  test("each event has a Report button, opening the form about that event", async ({ page, world, country, changeForm }) => {
    await world.goto("Poland");
    await expect(country.eventPart("Weekend Doubles", "2026-11-07", "report")).toHaveAttribute("aria-label", "Report Weekend Doubles");
    await country.eventPart("Weekend Doubles", "2026-11-07", "report").click();
    await expect(changeForm.dialog).toBeVisible();
    await expect(page.locator("#change-title")).toHaveText("Report");
    await expect(changeForm.entry).toHaveText("About the event Weekend Doubles, Poland");
    const post = nextFormPost(page);
    await changeForm.send("It was cancelled", "me@example.com", "report");
    const request = await post;
    expect(postedField(request, "subject")).toBe("event");
    expect(postedField(request, "entry")).toBe("Weekend Doubles");
    expect(postedField(request, "country")).toBe("Poland");
  });

  test.describe("a weekly event", () => {
    // 10 Nov 2026 (the clock) is a Tuesday; 5 Nov 2026 a Thursday.
    const WEEKLY = { community: "Test Club", name: "Painting night", start: "2026-11-05", repeat: "weekly", url: "https://example.com/painting" };

    test("shows its weekday and next session, and is sorted by it", async ({ page, world, country }) => {
      await mockApprovedCommunities(page, {}, { Poland: [WEEKLY] });
      await world.goto("Poland");
      // Weekend Doubles (7–8 Nov) stays upcoming until two days after it ends.
      await expect(country.eventNames).toHaveText(["Weekend Doubles", "Painting night", "Test Tournament"]);
      const painting = country.event("Painting night", "2026-11-05");
      await expect(country.events.nth(1)).toHaveId(itemId("event", "Painting night", "2026-11-05"));
      await expect(country.eventPart("Painting night", "2026-11-05", "date")).toHaveText("Every Thursday · next Thu, 12 Nov 2026");
      await expect(country.eventPart("Painting night", "2026-11-05", "date")).toHaveAttribute("datetime", "2026-11-12");
      await expect(painting).toHaveClass(/weekly/);
    });

    test("on its day, today's session is the next one", async ({ page, world, country }) => {
      await page.clock.setFixedTime(new Date("2026-11-12T12:00:00"));
      await mockApprovedCommunities(page, {}, { Poland: [WEEKLY] });
      await world.goto("Poland");
      await expect(country.eventDates.first()).toHaveText("Every Thursday · next Thu, 12 Nov 2026");
      await expect(country.eventPart("Painting night", "2026-11-05", "date")).toHaveText("Every Thursday · next Thu, 12 Nov 2026");
    });

    test("stays upcoming however long ago it started", async ({ page, world, country }) => {
      await mockApprovedCommunities(page, {}, { Poland: [{ ...WEEKLY, start: "2025-01-02" }] });
      await world.goto("Poland");
      await expect(country.eventNames).toContainText(["Painting night"]);
    });

    test("moves to past events two days after its last session", async ({ page, world, country }) => {
      await mockApprovedCommunities(page, {}, { Poland: [{ ...WEEKLY, start: "2026-09-03", until: "2026-10-29" }] });
      await world.goto("Poland");
      await expect(country.eventNames).not.toContainText(["Painting night"]);
      await country.pastToggle.click();
      await expect(country.eventPart("Painting night", "2026-09-03", "date", true)).toHaveText("Every Thursday, until Thu, 29 Oct 2026");
    });
  });

  test("past events are one click away", async ({ world, country }) => {
    await world.goto("Poland");
    await expect(country.pastEvents.first()).toBeHidden();
    await expect(country.pastToggle).toHaveText("Show past events (1)");
    await country.pastToggle.click();
    await expect(country.pastEventNames).toHaveText(["Old Cup"]);
    await expect(country.pastToggle).toHaveText("Hide past events (1)");
    await country.pastToggle.click();
    await expect(country.pastEvents.first()).toBeHidden();
  });

  test("an event moves to past events two days after its last day", async ({ page, world, country }) => {
    // Weekend Doubles ends on 8 November: still upcoming on the 10th...
    await world.goto("Poland");
    await expect(country.eventNames).toContainText(["Weekend Doubles"]);

    // ...and past from the 11th.
    await page.clock.setFixedTime(new Date("2026-11-11T09:00:00"));
    await page.reload();
    await expect(country.eventNames).toHaveText(["Test Tournament"]);
    await country.pastToggle.click();
    await expect(country.pastEventNames).toHaveText(["Weekend Doubles", "Old Cup"]);
  });

  test("a country with a host but no events says so", async ({ world, country }) => {
    await world.goto("France");
    await expect(country.eventsSection).toBeVisible();
    await expect(country.eventsEmpty).toHaveText("No upcoming events yet.");
    await expect(country.pastToggle).toBeHidden();
  });

  test("a country with no one on the map and no events shows no events section", async ({ world, country }) => {
    await world.goto("Spain");
    await expect(country.empty).toBeVisible();
    await expect(country.eventsSection).toBeHidden();
  });

  test("adds events approved since the last deploy, without repeating known ones", async ({ page, world, country }) => {
    await mockApprovedCommunities(page, {}, {
      Poland: [
        { community: "Test Club", name: "Test Tournament", start: "2026-12-05", url: "https://example.com/test-tournament" },
        { community: "Test Club", name: "New Year Cup", start: "2027-01-09", url: "https://example.com/new-year" },
      ],
    });
    await world.goto("Poland");
    await expect(country.eventNames).toHaveText(["Weekend Doubles", "Test Tournament", "New Year Cup"]);
  });

  test("a league from New Recruit still running shows since when, marked League", async ({ page, world, country }) => {
    await mockApprovedCommunities(page, {}, {}, {}, {
      Poland: [{ name: "Polska Liga T9A", start: "2026-10-01", url: "https://www.newrecruit.eu/app/tournydetails/details?id=6a4444444444444444444444", source: "newrecruit", nrId: "6a4444444444444444444444", online: true }],
    });
    await world.goto("Poland");
    await expect(country.eventPart("Polska Liga T9A", "2026-10-01", "date")).toHaveText("Since Thu, 1 Oct 2026");
    await expect(country.eventPart("Polska Liga T9A", "2026-10-01", "tag")).toHaveText("League");
    // A one-off event isn't one.
    await expect(country.eventPart("Test Tournament", "2026-12-05", "tag")).toHaveCount(0);
  });

  test("adds New Recruit's tournaments, credited to it, unless the country already has them", async ({ page, world, country }) => {
    const nr = (id: string, name: string, start: string) => ({
      name, start, url: `https://www.newrecruit.eu/app/tournydetails/details?id=${id}`, source: "newrecruit", nrId: id,
    });
    await mockApprovedCommunities(
      page,
      {},
      { Poland: [{ name: "Winter Clash", start: "2026-12-12", url: "https://www.newrecruit.eu/app/tournydetails/details?id=cccccccccccccccccccccccc" }] },
      {},
      {
        Poland: [
          nr("aaaaaaaaaaaaaaaaaaaaaaaa", "Krakow Open", "2026-11-21"),
          nr("dddddddddddddddddddddddd", "TEST tournament!", "2026-12-05"), // the same name
          nr("cccccccccccccccccccccccc", "Winter Clash 2026", "2026-12-12"), // the same tournament, linked
          nr("bbbbbbbbbbbbbbbbbbbbbbbb", "Old League", "2026-11-14"), // in newRecruitHidden
        ],
      },
    );
    await world.goto("Poland");
    await expect(country.eventNames).toHaveText(["Weekend Doubles", "Krakow Open", "Test Tournament", "Winter Clash"]);
    const credit = country.eventPart("Krakow Open", "2026-11-21", "credit");
    await expect(credit).toHaveText("from New Recruit");
    await expect(credit).toHaveAttribute("href", "https://www.newrecruit.eu/");
    await expect(page.locator('#event-list [id^="event-"][id$="-credit"]')).toHaveCount(1); // only New Recruit's own
  });

  test("an event with a New Recruit link carries New Recruit's logo, linking to it; others don't", async ({ page, world, country }) => {
    await mockApprovedCommunities(
      page,
      {},
      { Poland: [{ name: "Winter Clash", start: "2026-12-12", url: "https://www.newrecruit.eu/app/tournydetails/details?id=cccccccccccccccccccccccc" }] },
      {},
      { Poland: [{ name: "Krakow Open", start: "2026-11-21", url: "https://www.newrecruit.eu/app/tournydetails/details?id=aaaaaaaaaaaaaaaaaaaaaaaa", source: "newrecruit", nrId: "aaaaaaaaaaaaaaaaaaaaaaaa" }] },
    );
    await world.goto("Poland");
    for (const [name, start] of [["Krakow Open", "2026-11-21"], ["Winter Clash", "2026-12-12"]]) {
      const logo = country.eventPart(name, start, "source-logo");
      await expect(logo).toHaveAttribute("href", "https://www.newrecruit.eu/");
      await expect(logo).toBeVisible();
      expect(await logo.evaluate((a) => a.querySelector("img")?.alt)).toBe("New Recruit"); // its logo, named
    }
    // Test Tournament links to example.com.
    await expect(country.eventPart("Test Tournament", "2026-12-05", "source-logo")).toHaveCount(0);
  });

  test("the world map credits New Recruit in its lower right corner, with its logo and a link", async ({ page, world }) => {
    await world.goto();
    const credit = page.locator("#nr-credit");
    await expect(credit).toHaveText("Events powered by New Recruit");
    await expect(page.locator("#nr-credit-text")).toHaveText("Events powered by New Recruit");
    await expect(credit).toHaveAttribute("href", "https://www.newrecruit.eu/");
    await expect(page.locator("#nr-credit-logo")).toBeVisible();
    const box = (await credit.boundingBox())!;
    const map = (await page.locator("#map-stage").boundingBox())!;
    expect(box.x + box.width).toBeGreaterThan(map.x + map.width - 40); // its right side
    expect(box.y + box.height).toBeGreaterThan(map.y + map.height - 80); // at its bottom
  });

  test.describe(`"Add event" under the country's name`, () => {
    test.beforeEach(async ({ world, country, eventForm }) => {
      await world.goto("Poland");
      await country.addEventButton.click();
      await expect(eventForm.dialog).toBeVisible();
    });

    test("the host is picked from everyone here, or no one", async ({ eventForm }) => {
      await expect(eventForm.host).toBeHidden();
      await expect(eventForm.hostPick).toHaveValue("");
      await expect(eventForm.page.locator("#event-host-select > option")).toHaveText(["No one (not tied to anyone)"]);
      await expect(eventForm.page.locator("#event-host-group-club-community > option")).toHaveText(["Test Club"]);
      await expect(eventForm.page.locator("#event-host-group-person > option")).toHaveText(["Test Person"]);
    });

    test("tied to no one, it needs an address or Online event", async ({ page, eventForm }) => {
      let posted = false;
      page.on("request", (r) => (posted ||= r.method() === "POST"));
      await eventForm.send({ name: "Open Day", date: "2027-03-20", link: "https://example.com/open" });
      await expect(eventForm.error).toHaveText("Please give the event's address, or tick Online event.");
      expect(posted).toBe(false);
    });

    test(`"Online event" swaps the address for the hosting country, and sends no place`, async ({ page, eventForm }) => {
      await expect(eventForm.address).toBeVisible();
      await expect(eventForm.hostingCountry).toBeHidden();
      await eventForm.online.check();
      await expect(eventForm.address).toBeHidden();
      await expect(eventForm.hostingCountry).toHaveValue("Poland");

      const post = nextFormPost(page);
      await eventForm.send({ name: "Online League", date: "2027-03-20", link: "https://example.com/league" });
      const request = await post;
      expect(postedField(request, "online")).toBe("Yes");
      expect(postedField(request, "community")).toBe("");
      expect(postedField(request, "country")).toBe("Poland");
      expect(postedField(request, "address")).toBe("");
      expect(postedField(request, "latitude")).toBe("");
    });

    test("the address says it's shown publicly, so not to give a private home address", async ({ page }) => {
      await expect(page.locator("#event-address-field")).toContainText("shown publicly with the event and put on the map, so don't give a private home address");
    });

    test("won't send an event name with an email address or phone number", async ({ eventForm }) => {
      await eventForm.send({ name: "Open Day, call 0612345678", date: "2027-03-20", address: "Rynek 1", link: "https://example.com/open" });
      await expect(eventForm.error).toHaveText("We noticed an email address or phone number here. To keep you safe, we don't publish those: please take it out.");
    });

    test("an address found on the map sends its spot", async ({ page, eventForm }) => {
      await mockAddress(page, { lat: 52.23, lon: 21.01 });
      const post = nextFormPost(page);
      await eventForm.send({ name: "Open Day", date: "2027-03-20", address: "Rynek 1, Warszawa", link: "https://example.com/open" });
      const request = await post;
      expect(postedField(request, "address")).toBe("Rynek 1, Warszawa");
      expect(postedField(request, "latitude")).toBe("52.2300");
      expect(postedField(request, "longitude")).toBe("21.0100");
    });

    test("tied to no one, an address in another country asks which country", async ({ page, eventForm }) => {
      await mockAddress(page, { lat: 52.52, lon: 13.405 }); // Berlin, from Poland
      const post = nextFormPost(page);
      await eventForm.send({ name: "Open Day", date: "2027-03-20", address: "Alexanderplatz 1, Berlin", link: "https://example.com/open" });
      await expect(page.locator("#country-check-text")).toHaveText("The address isn't in the country you picked. Where should the event go?");
      await expect(page.locator("#country-check-found")).toHaveText("Germany, where the address is");
      await page.locator("#country-check-found").click();
      const request = await post;
      expect(postedField(request, "country")).toBe("Germany");
      expect(postedField(request, "latitude")).toBe("52.5200");
    });

    test("kept in the country picked, an event with an address abroad has no spot on the map", async ({ page, eventForm }) => {
      await mockAddress(page, { lat: 52.52, lon: 13.405 });
      const post = nextFormPost(page);
      await eventForm.send({ name: "Open Day", date: "2027-03-20", address: "Alexanderplatz 1, Berlin", link: "https://example.com/open" });
      await expect(page.locator("#country-check-picked")).toHaveText("Poland, as picked");
      await page.locator("#country-check-picked").click();
      const request = await post;
      expect(postedField(request, "country")).toBe("Poland");
      expect(postedField(request, "latitude")).toBe("");
    });

    test("a hosted event stays in its host's country, wherever its address", async ({ page, eventForm }) => {
      await mockAddress(page, { lat: 52.52, lon: 13.405 });
      await eventForm.hostPick.selectOption("Test Club");
      const post = nextFormPost(page);
      await eventForm.send({ name: "Away Day", date: "2027-03-20", address: "Alexanderplatz 1, Berlin", link: "https://example.com/away" });
      const request = await post;
      expect(postedField(request, "country")).toBe("Poland");
      expect(postedField(request, "community")).toBe("Test Club");
      expect(postedField(request, "latitude")).toBe("");
      await expect(page.locator("#country-check")).toBeHidden(); // never asked
    });

    test("with a host picked, the address is optional", async ({ page, eventForm }) => {
      await eventForm.hostPick.selectOption("Test Club");
      const post = nextFormPost(page);
      await eventForm.send({ name: "Club Cup", date: "2027-03-20", link: "https://example.com/cup" });
      expect(postedField(await post, "community")).toBe("Test Club");
    });
  });

  test("an event tied to no one shows its address, an online one says so, and only the first is on the map", async ({ page, world, country }) => {
    await mockApprovedCommunities(page, {}, {
      Poland: [
        { name: "Open Day", start: "2026-11-20", url: "https://example.com/open", place: "Rynek 1, Kraków", lat: 50.06, lon: 19.94 },
        { name: "Online League", start: "2026-11-21", url: "https://example.com/league", online: true },
      ],
    });
    await world.goto("Poland");
    await country.waitForStreetMap();
    await expect(country.eventPart("Open Day", "2026-11-20", "place")).toHaveText("Rynek 1, Kraków");
    await expect(country.eventPart("Online League", "2026-11-21", "place")).toHaveText("Online");
    // Open Day at its address, and the fixture's Test Tournament at its host's pin (CR-15).
    await expect(page.locator('#street-map [id^="event-marker-"]')).toHaveCount(2);
    await expect(page.locator(item("event-marker", "Online League", "2026-11-21"))).toHaveCount(0);
    await page.locator(item("event-marker", "Open Day", "2026-11-20")).click();
    await expect(page.locator("#event-popup-name")).toHaveText("Open Day");
    await expect(page.locator("#event-popup-name")).toHaveAttribute("href", "https://example.com/open");
  });

  // CR-15 (KD-4): events on the street map.
  test.describe("on the street map", () => {
    test("a hosted event with no spot of its own has its swords beside its host's banner", async ({ page, world, country }) => {
      await world.goto("Poland");
      await country.waitForStreetMap();
      const swords = page.locator(item("event-marker", "Test Tournament", "2026-12-05"));
      await expect(swords).toHaveCount(1);
      const host = (await country.streetMarker("Test Club").boundingBox())!;
      const box = (await swords.boundingBox())!;
      expect(Math.abs(box.y + box.height / 2 - (host.y + host.height / 2))).toBeLessThan(4); // the same spot
      expect(box.x).toBeGreaterThan(host.x + host.width / 2); // beside it, not over it
      await expect(country.eventPart("Test Tournament", "2026-12-05", "no-spot")).toHaveCount(0);
    });

    test("events on one spot are one marker with their number, its popup listing them all", async ({ page, world, country }) => {
      await mockApprovedCommunities(page, {}, {
        Poland: [
          { name: "Games Day December", start: "2026-12-06", url: "https://example.com/dec", place: "Rynek 1, Kraków", lat: 50.06, lon: 19.94 },
          { name: "Games Day January", start: "2027-01-03", url: "https://example.com/jan", place: "Rynek 1, Kraków", lat: 50.06, lon: 19.94 },
        ],
      });
      await world.goto("Poland");
      await country.waitForStreetMap();
      const marker = page.locator(item("event-marker", "Games Day December", "2026-12-06"));
      await expect(page.locator(`#${itemId("event-marker", "Games Day December", "2026-12-06")}-count`)).toHaveText("2");
      await expect(page.locator(item("event-marker", "Games Day January", "2027-01-03"))).toHaveCount(0);
      await marker.click();
      await expect(page.locator("#event-popup-1-name")).toHaveText("Games Day December");
      await expect(page.locator("#event-popup-2-name")).toHaveText("Games Day January");
    });

    test(`an in-person event with no spot and no host on the map says "No exact place on the map", and has no swords`, async ({ page, world, country }) => {
      await mockApprovedCommunities(page, {}, {
        Poland: [
          { name: "Somewhere Cup", start: "2026-11-28", url: "https://example.com/somewhere" },
          { name: "Online League", start: "2026-11-21", url: "https://example.com/league", online: true },
        ],
      });
      await world.goto("Poland");
      await country.waitForStreetMap();
      await expect(country.eventPart("Somewhere Cup", "2026-11-28", "no-spot")).toHaveText("No exact place on the map");
      await expect(country.eventPart("Online League", "2026-11-21", "no-spot")).toHaveCount(0);
      await expect(page.locator(item("event-marker", "Somewhere Cup", "2026-11-28"))).toHaveCount(0);
      if (await world.isPhone()) {
        // The list beside the map has it too, saying so (shown once something is filtered out).
        await country.setFilter({ types: [], events: true });
        await expect(page.locator(`#${itemId("side", "event", "Somewhere Cup", "2026-11-28")}-no-spot`)).toHaveText("No exact place on the map");
      }
    });
  });

  test.describe("Add event", () => {
    test("every card offers it: clubs with or without gaming space, and people", async ({ page, world, country }) => {
      await mockApprovedCommunities(page, {
        Poland: [{ name: "Online Club", lat: 50.06, lon: 19.94, type: "Club/Community", gamingSpace: false }],
      });
      await world.goto("Poland");
      for (const name of ["Test Club", "Online Club", "Test Person"]) {
        await country.openFromList(name);
        await expect(page.locator("#community-card-add-event")).toHaveText("Add event");
      }
    });

    test("a store offers it too", async ({ page, world, country }) => {
      await world.goto("France");
      await country.openFromList("Test Store");
      await expect(page.locator("#community-card-add-event")).toHaveText("Add event");
    });

    test("a person can host an event, and it links to their card", async ({ page, world, country, eventForm }) => {
      await mockApprovedCommunities(page, {}, {
        Poland: [{ community: "Test Person", name: "Garage Game", start: "2026-11-20", url: "https://example.com/garage" }],
      });
      await world.goto("Poland");
      await expect(country.eventPart("Garage Game", "2026-11-20", "host-button")).toHaveText("Test Person");
      await country.eventPart("Garage Game", "2026-11-20", "host-button").click();
      await expect(page.locator("#community-card-title")).toHaveText("Test Person");

      await page.locator("#community-card-add-event").click();
      await expect(eventForm.host).toHaveText("Hosted by Test Person");
    });

    test.describe("the form", () => {
      test.beforeEach(async ({ world, country, eventForm }) => {
        await world.goto("Poland");
        await country.openFromList("Test Club");
        await country.page.locator("#community-card-add-event").click();
        await expect(eventForm.dialog).toBeVisible();
        await expect(eventForm.host).toHaveText("Hosted by Test Club");
      });

      test("needs a name, a date and a link", async ({ page, eventForm }) => {
        let posted = false;
        page.on("request", (r) => (posted ||= r.method() === "POST"));
        await eventForm.send({});
        await expect(eventForm.error).toHaveText("Please give the event's name.");
        await eventForm.send({ name: "Spring Cup" });
        await expect(eventForm.error).toHaveText("Please pick the event's date.");
        await eventForm.send({ name: "Spring Cup", date: "2027-03-20" });
        await expect(eventForm.error).toHaveText("Please add a link to the event.");
        await eventForm.send({ name: "Spring Cup", date: "2027-03-20", link: "not a link" });
        await expect(eventForm.error).toContainText("should be a link");
        expect(posted).toBe(false);
      });

      test("rejects a date that has passed, or a last day before the first", async ({ eventForm }) => {
        await eventForm.send({ name: "Spring Cup", date: "2026-11-01", link: "https://example.com/spring" });
        await expect(eventForm.error).toHaveText("That date has already passed.");
        await eventForm.send({ name: "Spring Cup", date: "2027-03-20", lastDay: "2027-03-19", link: "https://example.com/spring" });
        await expect(eventForm.error).toHaveText("The last day can't be before the first.");
      });

      test("sends the event to Netlify Forms, for its host and country", async ({ page, eventForm }) => {
        const post = nextFormPost(page);
        await eventForm.send({ name: "Spring Cup", date: "2027-03-20", lastDay: "2027-03-21", link: "example.com/spring" });
        const request = await post;
        expect(postedField(request, "form-name")).toBe("event-submission");
        expect(postedField(request, "country")).toBe("Poland");
        expect(postedField(request, "community")).toBe("Test Club");
        expect(postedField(request, "name")).toBe("Spring Cup");
        expect(postedField(request, "start_date")).toBe("2027-03-20");
        expect(postedField(request, "end_date")).toBe("2027-03-21");
        expect(postedField(request, "link")).toBe("https://example.com/spring");

        await expect(page.locator("#event-done-note")).toContainText("within 24 hours");
        await page.locator("#event-done-close").click();
        await expect(eventForm.dialog).toBeHidden();
      });

      test("the logo's + opens the file picker too", async ({ page, eventForm }) => {
        const chooser = page.waitForEvent("filechooser");
        await page.locator("#event-logo-preview").click();
        expect((await chooser).element()).toBeTruthy();
      });

      test('"Recurring weekly" swaps the date for a day of the week, and "Last day" for an optional last session', async ({ eventForm }) => {
        await expect(eventForm.date).toBeVisible();
        await expect(eventForm.weekday).toBeHidden();
        await expect(eventForm.lastDay).toBeVisible();
        await expect(eventForm.until).toBeHidden();
        await eventForm.weekly.check();
        await expect(eventForm.date).toBeHidden();
        await expect(eventForm.weekday).toBeVisible();
        await expect(eventForm.page.locator("#event-weekday-select > option")).toHaveText(["Choose a day", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]);
        await expect(eventForm.lastDay).toBeHidden();
        await expect(eventForm.until).toBeVisible();
        await eventForm.weekly.uncheck();
        await expect(eventForm.date).toBeVisible();
        await expect(eventForm.lastDay).toBeVisible();
      });

      test('"One-day event" leaves only the date: no "Last day", none sent', async ({ page, eventForm }) => {
        await expect(eventForm.lastDay).toBeVisible();
        await eventForm.lastDay.fill("2027-03-21");
        await eventForm.oneDay.check();
        await expect(eventForm.lastDay).toBeHidden();
        await expect(eventForm.date).toBeVisible();
        const post = nextFormPost(page);
        await eventForm.send({ name: "Club Cup", date: "2027-03-20", link: "https://example.com/cup" });
        const request = await post;
        expect(postedField(request, "start_date")).toBe("2027-03-20");
        expect(postedField(request, "end_date")).toBe("");
      });

      test('"One-day event" goes for a weekly event, and "Last day" comes back without it', async ({ eventForm }) => {
        await eventForm.oneDay.check();
        await eventForm.weekly.check();
        await expect(eventForm.oneDay).toBeHidden();
        await eventForm.weekly.uncheck();
        await expect(eventForm.oneDay).toBeVisible();
        await expect(eventForm.oneDay).not.toBeChecked();
        await expect(eventForm.lastDay).toBeVisible();
      });

      test("a weekly event needs its day of the week", async ({ eventForm }) => {
        await eventForm.weekly.check();
        await eventForm.send({ name: "Painting night", link: "https://example.com/painting" });
        await expect(eventForm.error).toHaveText("Please choose the day of the week.");
      });

      test("sends a weekly event from the next such day (today included), with its last session", async ({ page, eventForm }) => {
        // The clock says Tuesday 10 Nov 2026.
        const post = nextFormPost(page);
        await eventForm.send({ name: "Painting night", weekday: "Thursday", until: "2027-01-28", link: "https://example.com/painting" });
        const request = await post;
        expect(postedField(request, "recurring")).toBe("weekly");
        expect(postedField(request, "start_date")).toBe("2026-11-12");
        expect(postedField(request, "until")).toBe("2027-01-28");
        expect(postedField(request, "end_date")).toBe("");
      });

      test("rejects a last session before the first", async ({ eventForm }) => {
        await eventForm.send({ name: "Painting night", weekday: "Thursday", until: "2026-11-11", link: "https://example.com/painting" });
        await expect(eventForm.error).toHaveText("The last session can't be before the first.");
      });

      test("only its buttons close it, not Escape", async ({ page, eventForm }) => {
        await eventForm.name.fill("Spring Cup");
        await page.keyboard.press("Escape");
        await expect(eventForm.dialog).toBeVisible();
        await expect(eventForm.name).toHaveValue("Spring Cup");
        await eventForm.cancelButton.click();
        await expect(eventForm.dialog).toBeHidden();
      });

      test("Add event is at the top too; at the end it's in the middle, Cancel at the right (CR-18)", async ({ eventForm }) => {
        await expect(eventForm.sendTopButton).toHaveText("Add event");
        await expect(eventForm.sendButton).toHaveText("Add event");
        const form = (await eventForm.page.locator("#event-form").boundingBox())!;
        const top = (await eventForm.sendTopButton.boundingBox())!;
        const name = (await eventForm.name.boundingBox())!;
        expect(top.y + top.height).toBeLessThanOrEqual(name.y); // above the fields
        expect(Math.abs(top.x + top.width / 2 - (form.x + form.width / 2))).toBeLessThan(4); // centred
        await eventForm.sendButton.scrollIntoViewIfNeeded();
        const send = (await eventForm.sendButton.boundingBox())!;
        const cancel = (await eventForm.cancelButton.boundingBox())!;
        expect(Math.abs(send.y - cancel.y)).toBeLessThan(4); // one row
        expect(cancel.x).toBeGreaterThan(send.x + send.width); // Cancel after it, at the right
        expect(Math.abs(send.x + send.width / 2 - (form.x + form.width / 2))).toBeLessThan(40); // about the middle
      });

      test("the Add event at the top sends the form too, with the same checks (CR-18)", async ({ page, eventForm }) => {
        await mockAddress(page, { lat: 50.06, lon: 19.94 });
        await eventForm.sendTopButton.click();
        await expect(eventForm.error).toBeVisible(); // nothing filled in yet
        await eventForm.name.fill("Spring Cup");
        await eventForm.date.fill("2027-03-20");
        await eventForm.address.fill("Rynek 1, Kraków");
        await eventForm.link.fill("https://example.com/spring");
        await eventForm.consent.check();
        const post = nextFormPost(page);
        await eventForm.sendTopButton.click();
        expect(postedField(await post, "name")).toBe("Spring Cup");
        await expect(eventForm.done).toBeVisible();
        await expect(eventForm.sendTopButton).toBeHidden();
      });
    });
  });
});
