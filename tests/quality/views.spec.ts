import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { test } from "../support/test";
import type { CountryDialog } from "../pages/country-dialog";
import type { WorldPage } from "../pages/world-page";
import { findTextOverlaps, measure, type Finding } from "./measure";

// The Quality Checker's measuring run (npm run quality; the quality-checker agent starts it, never on its own).
// Opens each view of the live site in each language, inside the suite's network fence (support/test.ts: no
// form posts, no function calls, no other sites), and measures what looks broken to a visitor (quality/measure.ts).
// It records, it doesn't fail: every view with findings gets reports/quality/<project>/<view>-<lang>.json and a
// screenshot with the elements involved outlined in magenta. The agent checks each one by eye before filing.
//
// Languages: QUALITY_LANGS=en,de,pl (default en,de,pl,el: long words are where text stops fitting).
// Every view in every language downloads the site, against the Netlify account's monthly allowance.

const LANGS = (process.env.QUALITY_LANGS ?? "en,de,pl,el").split(",").map((s) => s.trim()).filter(Boolean);
const FIXTURE = JSON.parse(readFileSync(new URL("../fixtures/communities.json", import.meta.url), "utf8"));
const MAJOR = [{ name: "Test Open", start: "2026-11-21", end: "2026-11-22", place: "Melle", country: "Germany", links: [{ label: "New Recruit", url: "https://www.newrecruit.eu/" }] }];

type Ctx = { page: import("@playwright/test").Page; world: WorldPage; country: CountryDialog };
type View = { hash?: string; scope?: string; phoneOnly?: boolean; prepare?: (c: Ctx) => Promise<void> };

const VIEWS: Record<string, View> = {
  home: {},
  "home-events": { prepare: ({ world }) => world.filter("events") },
  "home-stores": { prepare: ({ world }) => world.filter("stores") },
  "phone-menu": { phoneOnly: true, scope: "#phone-menu", prepare: ({ world }) => world.openMenu() },
  "join-country-list": {
    prepare: async ({ page }) => {
      await page.locator("#join-button").click();
      await page.locator("#join-country").fill("ger");
    },
  },
  "major-events": {
    scope: "#major-dialog",
    prepare: async ({ page, world }) => {
      await page.route("**/data/communities.json", (route) => route.fulfill({ json: { ...FIXTURE, majorEvents: MAJOR } }));
      await world.goto("", { lang: page.url().match(/lang=(\w+)/)?.[1] });
      await world.openMajorEvents();
    },
  },
  country: { hash: "Poland", scope: "#country-dialog", prepare: ({ country }) => country.waitForStreetMap() },
  "country-empty": { hash: "Spain", scope: "#country-dialog" },
  "community-card": { hash: "Poland", scope: "#country-dialog", prepare: ({ country }) => country.openFromList("Test Club") },
  "store-card": { hash: "France", scope: "#country-dialog", prepare: ({ country }) => country.openFromList("Test Store") },
  "event-form": { hash: "Poland", scope: "#event-dialog", prepare: ({ country }) => country.addEventButton.click() },
  "tip-form": { hash: "Spain", scope: "#tip-dialog", prepare: ({ country }) => country.tipButton.click() },
  "bug-report": { scope: "#bug-dialog", prepare: ({ world }) => world.openBugReport() },
};

test.describe("Quality check", () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.setFixedTime(new Date("2026-11-10T12:00:00"));
  });

  for (const lang of LANGS)
    for (const [name, view] of Object.entries(VIEWS)) {
      test(`${name} (${lang})`, async ({ page, world, country }) => {
        await world.goto(view.hash ?? "", { lang });
        const phone = await world.isPhone();
        test.skip(!!view.phoneOnly && !phone, "a phone view only");
        if (view.prepare) await view.prepare({ page, world, country });
        await page.evaluate(() => document.fonts.ready);
        await page.evaluate(() => Promise.all(document.getAnimations().filter((a) => a.effect?.getTiming().iterations !== Infinity).map((a) => a.finished)));

        const scope = view.scope ?? null;
        const found: Finding[] = [...(await page.evaluate(measure, { scope, phone })), ...(await page.evaluate(findTextOverlaps, scope))];
        test.info().annotations.push({ type: "findings", description: String(found.length) });
        if (!found.length) return;

        const dir = `reports/quality/${test.info().project.name}`;
        mkdirSync(dir, { recursive: true });
        await page.evaluate((boxes) => {
          for (const q of boxes) {
            const d = document.createElement("div");
            d.style.cssText = `position:absolute;z-index:2147483647;pointer-events:none;outline:3px solid #ff00ff;left:${q.x}px;top:${q.y}px;width:${q.w}px;height:${q.h}px`;
            document.body.append(d);
          }
        }, found.flatMap((f) => [f.box, f.otherBox]).filter((b) => !!b));
        const shot = `${dir}/${name}-${lang}.png`;
        await page.screenshot({ path: shot, fullPage: !scope });
        const viewport = page.viewportSize();
        writeFileSync(
          `${dir}/${name}-${lang}.json`,
          JSON.stringify({ view: name, hash: view.hash ?? "", lang, layout: phone ? "phone" : "desktop", viewport, url: page.url(), screenshot: shot, findings: found }, null, 2),
        );
        await test.info().attach(`findings-${name}-${lang}`, { contentType: "application/json", body: JSON.stringify(found, null, 2) });
        await test.info().attach(`screenshot-${name}-${lang}`, { path: shot, contentType: "image/png" });
      });
    }
});
