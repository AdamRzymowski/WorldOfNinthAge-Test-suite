import { test, expect, mockApprovedCommunities } from "../support/test";
import { itemId } from "../support/ids";

// The site's own safeguards, in the browser: what visitors send can't run as
// code, unsafe links don't become links, and the forms ask for consent and
// hide a honeypot for bots. The server's checks are in tests/server/.

const XSS = `<img src=x onerror="window.__xss = true"><script>window.__xss = true</script>`;

test.describe("Security", () => {
  test("a name or comment with HTML in it is shown as text, never run", async ({ page, world, country }) => {
    await mockApprovedCommunities(page, {
      Poland: [{ name: `Evil ${XSS}`, lat: 50.06, lon: 19.94, type: "Club/Community", description: XSS, region: XSS }],
    });
    await world.goto("Poland");
    await country.openFromList(`Evil ${XSS}`); // its ID comes from the whole name
    await expect(page.locator("#community-card-title")).toHaveText(`Evil ${XSS}`);
    await expect(page.locator("#community-card-description")).toHaveText(XSS);
    await expect(page.locator('#community-card img[src="x"], #community-card script')).toHaveCount(0); // nothing of it became an element
    expect(await page.evaluate(() => (window as { __xss?: boolean }).__xss)).toBeUndefined();
  });

  test("an event with HTML in its name is shown as text", async ({ page, world }) => {
    await page.clock.setFixedTime(new Date("2026-11-08T12:00:00"));
    await mockApprovedCommunities(page, {}, { Poland: [{ community: "Test Club", name: XSS, start: "2026-12-01", url: "https://example.com/cup" }] });
    await world.goto("Poland");
    await expect(page.locator(`#${itemId("event", XSS, "2026-12-01")}-name`)).toHaveText(XSS);
    await expect(page.locator('#event-list img[src="x"], #event-list script')).toHaveCount(0);
    expect(await page.evaluate(() => (window as { __xss?: boolean }).__xss)).toBeUndefined();
  });

  test("a contact whose link isn't a web address doesn't become a link", async ({ page, world, country }) => {
    await mockApprovedCommunities(page, {
      Poland: [
        {
          name: "Linky",
          lat: 50.06,
          lon: 19.94,
          type: "Club/Community",
          links: [
            { type: "website", label: "Click me", url: "javascript:window.__xss=true" },
            { type: "website", label: "Data", url: "data:text/html,<script>alert(1)</script>" },
          ],
        },
      ],
    });
    await world.goto("Poland");
    await country.openFromList("Linky");
    await expect(page.locator(`#${itemId("community-card-link", "website", "Click me")}-detail`)).toHaveText("Click me");
    // Not links: each row is a plain box (a <div>), and nothing on the card links to them.
    expect(await page.locator(`#${itemId("community-card-link", "website", "Click me")}-row`).evaluate((el) => el.tagName)).toBe("DIV");
    expect(await page.locator(`#${itemId("community-card-link", "website", "Data")}-row`).evaluate((el) => el.tagName)).toBe("DIV");
    await expect(page.locator('#community-card a[href^="javascript:"], #community-card a[href^="data:"]')).toHaveCount(0);
  });

  test("links on a card open in a new tab without access back to the site", async ({ page, world, country }) => {
    await world.goto("Poland");
    await country.openFromList("Test Club");
    await expect(page.locator("#community-card-logo-link")).toHaveAttribute("rel", /noopener/);
    await expect(page.locator(`#${itemId("community-card-link", "discord", "Join the Discord server")}-row`)).toHaveAttribute("rel", /noopener/);
    const links = page.locator('#community-card a[target="_blank"]'); // and every other one
    expect(await links.count()).toBeGreaterThan(0);
    for (const rel of await links.evaluateAll((as) => as.map((a) => a.getAttribute("rel") ?? ""))) {
      expect(rel).toMatch(/noopener/);
    }
  });

  test("a visit asks nothing of Google Fonts or a CDN: fonts, libraries and icons are the site's own", async ({ page, world, country }) => {
    const hosts = new Set<string>();
    const missing: string[] = [];
    page.on("request", (r) => hosts.add(new URL(r.url()).hostname));
    page.on("response", (r) => r.status() >= 400 && missing.push(new URL(r.url()).pathname));
    await world.goto("Poland");
    await country.openFromList("Test Club"); // a card, with its contact icons
    await page.goto("/privacy.html");
    for (const host of hosts) expect(host, host).not.toMatch(/googleapis|gstatic|jsdelivr|cdnjs|unpkg|cloudflare/);
    expect(missing, "files the site couldn't find").toEqual([]);
    await expect.poll(() => page.evaluate(() => document.fonts.check('700 16px "Cinzel"'))).toBe(true);
  });

  test("the Content-Security-Policy stops a script or image slipped into the page from outside", async ({ page, world }) => {
    await world.goto();
    const blocked = await page.evaluate(async () => {
      const found: string[] = [];
      document.addEventListener("securitypolicyviolation", (e) => found.push(e.violatedDirective));
      const inline = document.createElement("script");
      inline.textContent = "window.__injected = true";
      document.body.append(inline);
      const img = new Image();
      img.src = "https://evil.example.com/pixel.png";
      await new Promise((r) => setTimeout(r, 300));
      return { ran: (window as { __injected?: boolean }).__injected === true, found };
    });
    expect(blocked.ran).toBe(false);
    expect(blocked.found).toEqual(expect.arrayContaining(["script-src-elem", "img-src"]));
  });

  test("both forms that look up an address credit OpenStreetMap under the field", async ({ page, world, country, eventForm }) => {
    await world.goto("Poland");
    await country.addEventButton.click();
    const credit = page.locator("#event-osm-credit");
    await expect(credit).toHaveText("Address search © OpenStreetMap contributors");
    // Its link is translated with the sentence (data-i18n-html), so it has no ID of its own.
    await expect(page.locator("#event-osm-credit > a")).toHaveAttribute("href", "https://www.openstreetmap.org/copyright");
    await expect(page.locator("#join-osm-credit")).toHaveText("Address search © OpenStreetMap contributors");
  });

  test("the home page and the privacy note say it's a fan-made map, not The Ninth Age's own", async ({ page, world }) => {
    const NOTE = "A fan-made community map. Not affiliated with or endorsed by The Ninth Age.";
    await world.goto();
    await expect(page.locator("#fan-note")).toHaveText(NOTE);
    await page.goto("/privacy.html");
    await expect(page.locator("#fan-note")).toHaveText(NOTE);
  });

  test("every public form has a hidden honeypot field for bots", async ({ page, world }) => {
    await world.goto();
    for (const [name, form] of [["community-submission", "join"], ["community-tip", "tip"], ["change-request", "change"], ["event-submission", "event"], ["gallery-submission", "gallery"], ["bug-report", "bug"]]) {
      // Off screen for people (so only bots fill it in), and skipped by Tab.
      const honeypot = page.locator(`#${form}-bot-field`);
      await expect(honeypot, name).toHaveCount(1);
      await expect(honeypot, name).toHaveAttribute("name", "bot-field");
      await expect(honeypot, name).toHaveAttribute("tabindex", "-1");
      expect(await honeypot.evaluate((el) => Boolean(el.closest(".visually-hidden"))), name).toBe(true);
      await expect(page.locator(`#${form}-form`), name).toHaveAttribute("name", name);
      await expect(page.locator(`#${form}-form`), name).toHaveAttribute("netlify-honeypot", "bot-field");
    }
  });

  test("the alert forms are in the page for Netlify to find, never shown", async ({ page, world }) => {
    await world.goto();
    for (const [name, fields] of [
      ["review-alert", ["form", "entry", "country", "reasons", "images", "note"]],
      ["private-alert", ["form", "id", "reasons", "note"]],
      ["bot-alert", ["sender", "submissions", "forms", "first", "last", "note"]],
      ["community-update", ["target", "name", "consent"]],
    ] as const) {
      const form = page.locator(`#${name}-form`);
      await expect(form, name).toHaveAttribute("name", name);
      await expect(form, name).toBeHidden();
      // What's checked here is the fields' names, as Netlify reads them (these forms are never shown).
      for (const field of fields) await expect(form.locator(`[name="${field}"]`), `${name} ${field}`).toHaveCount(1);
    }
  });

  test("an event can't be sent without agreeing it will be public", async ({ page, world, country, eventForm }) => {
    await page.clock.setFixedTime(new Date("2026-11-08T12:00:00"));
    await world.goto("Poland");
    await country.openFromList("Test Club");
    await page.locator("#community-card-add-event").click();
    let posted = false;
    page.on("request", (r) => (posted ||= r.method() === "POST"));
    await eventForm.send({ name: "Cup", date: "2026-12-05", link: "https://newrecruit.eu/cup", consent: false });
    await expect(eventForm.error).toHaveText("Please tick the box to agree that this will be public.");
    expect(posted).toBe(false);
    await expect(page.locator("#event-consent")).toContainText("I'm 16 or older, or a parent or guardian agrees.");
  });

  test("the privacy note says who runs the map, what's public and private, why, who else gets data, for how long, your rights and how to remove an entry", async ({ page }) => {
    await page.goto("/privacy.html");
    for (const [id, heading] of [
      ["who", "Who runs this map"], ["privacy-public-title", "What is public"], ["privacy-rules-title", "Rules for what you add"],
      ["privacy-private-title", "What stays private"], ["privacy-why-title", "Why we use it"], ["privacy-recipients-title", "Who else receives data"],
      ["privacy-browser-title", "In your browser"], ["privacy-keep-title", "How long we keep it"], ["privacy-rights-title", "Your rights"],
      ["privacy-change-title", "Changing or removing an entry"],
    ]) {
      await expect(page.locator(`#${id}`), heading).toHaveText(heading);
    }
    await expect(page.locator("#privacy-page")).toContainText("is never shown on the map (only the town or city you give is); an event's address is shown");
    await expect(page.locator("#privacy-page")).toContainText("run by Adam Rzymowski (Poland)");
    await expect(page.locator("#privacy-page")).toContainText("You'll get a confirmation, and a reply explaining what we decided.");
    await expect(page.locator("#privacy-page")).toContainText("with no gaming space, is rounded to about 1 km");
    await expect(page.locator("#privacy-page")).toContainText("It never reads deletion requests, bug reports or tips.");
    // What the review reads, on what terms, and that alerts reach Gmail too.
    await expect(page.locator("#privacy-page")).toContainText("new banners, events, updates and gallery photos, with their addresses, contacts and images");
    await expect(page.locator("#privacy-page")).toContainText("used on a personal plan under Anthropic's own terms, with use for training switched off");
    await expect(page.locator("#privacy-page")).toContainText("and of the site's alerts about held ones");
    // Where events come from, and what is held for a check (Digital Services Act).
    // Links inside a block translated whole (data-i18n-html) have no IDs of their own.
    await expect(page.locator('#privacy-unchecked > a[href="https://www.newrecruit.eu/"]')).toHaveText("New Recruit");
    await expect(page.locator("#privacy-page")).toContainText("Some submissions are held for a check by hand before they're shown");
    await expect(page.locator("#privacy-page")).toContainText("write to us and we'll tell you why");
    await expect(page.locator("#privacy-page")).toContainText("for entries added before the agreement box existed (before 8 November 2026)");
    await expect(page.locator("#privacy-page")).toContainText("we answer within one month");
    await expect(page.locator("#privacy-page")).toContainText("the IP address, browser and page it came from");
    await expect(page.locator("#privacy-page")).toContainText("Google Safe Browsing checks the links in submissions");
    await expect(page.locator("#privacy-page")).toContainText("Transfers to the USA rely on the EU–US Data Privacy Framework");
    // A contact: who runs it, where to report anything, and your rights.
    await expect(page.locator('#privacy-page a[href="mailto:substandardmonsters@gmail.com"]')).toHaveCount(3);
    await expect(page.locator("#privacy-page")).toContainText("Anyone can report an entry, event or photo");
    await expect(page.locator("#privacy-page")).toContainText("If you're under 16, ask a parent or guardian before adding yourself");
    await expect(page.locator("#privacy-page")).toContainText("We look over new ones for spam, duplicates and these rules, but we don't check the details");
    await expect(page.locator("#privacy-page")).toContainText("We aren't responsible for the sites the links lead to.");
    await expect(page.locator("#privacy-page")).toContainText("Stores are listed as they describe themselves. A listing isn't a recommendation, and we don't check what they sell or whether it's licensed.");
    // Every service that receives visitors' data is named.
    for (const service of ["Netlify", "Google", "GitHub", "Anthropic", "OpenStreetMap"]) {
      await expect(page.locator("#privacy-recipients > li > a").filter({ hasText: new RegExp(`^${service}$`) }), service).toHaveCount(1);
    }
    // At the top on a phone, at the end on a desktop: whichever shows.
    await page.locator("#privacy-back-link:visible, #privacy-back-bottom-link:visible").click();
    await expect(page).toHaveURL(/\/$/);
  });

  test("an update and gallery images say they're checked first, without promising 24 hours", async ({ page, world, country, joinForm }) => {
    await world.goto("Poland");
    await country.openFromList("Test Club");
    await page.locator("#community-card-update").click();
    await joinForm.submit();
    await expect(page.locator("#join-done-text")).toContainText("We'll check it");
    await expect(page.locator("#join-done-note")).toBeHidden();
    await expect(page.locator("#gallery-done-note")).toHaveText("They will appear in the gallery once they've been checked.");
  });
});
