// The `test` every spec imports: Playwright's, with the network fenced in and
// the page objects ready to use.
//
// Every request leaving the site tested (localhost, or BASE_URL's host in a
// release check) is answered here, so the tests run offline and never hit
// OpenStreetMap or Netlify (the site's fonts, d3, topojson and
// Leaflet are its own files, served locally like the rest):
// - data/communities.json is tests/fixtures/communities.json;
// - /api/communities (the Netlify Function) answers {} unless a test says
//   otherwise with mockApprovedCommunities();
// - the fixture's events are dated around November 2026: specs about events
//   set the clock with page.clock;
// - form posts (Netlify Forms) answer 200, and any other /api/ call 404: a
//   check of the live site never sends it a submission or runs its functions;
// - Nominatim finds nothing unless a test says otherwise with mockAddress();
// - map tiles are a blank image.

import { test as base, expect, type Page, type Request } from "@playwright/test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { WorldPage } from "../pages/world-page";
import { CountryDialog } from "../pages/country-dialog";
import { JoinForm } from "../pages/join-form";
import { TipForm } from "../pages/tip-form";
import { EventForm } from "../pages/event-form";
import { ChangeForm } from "../pages/change-form";

const here = (path: string) => fileURLToPath(new URL(path, import.meta.url));
// The site tested: the live site, or another deployed one (BASE_URL).
const SITE = new URL(process.env.BASE_URL ?? "https://t9a-community.com").hostname;
const COMMUNITIES = readFileSync(here("../fixtures/communities.json"), "utf8");
const BLANK_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64",
);

async function fenceNetwork(page: Page) {
  // Registered first, so it only catches what nothing below handles.
  await page.route(
    (url) => url.hostname !== SITE,
    (route) => route.abort("blockedbyclient"),
  );
  // Next, any function a test doesn't answer itself (the ones below and
  // mockApprovedCommunities come later, so they win).
  await page.route((url) => url.hostname === SITE && url.pathname.startsWith("/api/"), (route) => route.fulfill({ status: 404, body: "" }));
  await page.route("https://tile.openstreetmap.org/**", (route) =>
    route.fulfill({ body: BLANK_PNG, contentType: "image/png" }),
  );
  await page.route("https://nominatim.openstreetmap.org/**", (route) => route.fulfill({ json: [] }));
  await page.route("**/data/communities.json", (route) =>
    route.fulfill({ body: COMMUNITIES, contentType: "application/json" }),
  );
  await page.route("**/api/communities", (route) => route.fulfill({ json: {} }));
  await page.route(
    (url) => url.hostname === SITE,
    (route) => (route.request().method() === "POST" ? route.fulfill({ status: 200, body: "" }) : route.fallback()),
  );
}

/** Submissions approved through /api/communities: communities, events and updates ({ target, community }), keyed by country name. */
export async function mockApprovedCommunities(
  page: Page,
  countries: Record<string, object[]>,
  events: Record<string, object[]> = {},
  updates: Record<string, object[]> = {},
  newRecruit: Record<string, object[]> = {},
) {
  await page.route("**/api/communities", (route) => route.fulfill({ json: { countries, events, updates, newRecruit } }));
}

/** Makes the address search find whatever is searched for at the given spot. */
export async function mockAddress(page: Page, { lat, lon }: { lat: number; lon: number }) {
  await page.route("https://nominatim.openstreetmap.org/**", (route) =>
    route.fulfill({
      json: [{ lat: String(lat), lon: String(lon), boundingbox: [lat - 0.01, lat + 0.01, lon - 0.01, lon + 0.01].map(String) }],
    }),
  );
}

/** One field of a multipart (banner form) or URL-encoded (tip form) post. */
export function postedField(request: Request, name: string): string | null {
  const body = request.postData() ?? "";
  if (request.headers()["content-type"]?.startsWith("application/x-www-form-urlencoded")) {
    return new URLSearchParams(body).get(name);
  }
  const match = body.match(new RegExp(`name="${name}"\\r\\n\\r\\n([^\\r]*)\\r\\n`));
  return match ? match[1] : null;
}

/** Waits for the next form post to Netlify Forms. */
export function nextFormPost(page: Page) {
  return page.waitForRequest((r) => r.method() === "POST" && new URL(r.url()).pathname === "/");
}

type Fixtures = {
  world: WorldPage;
  country: CountryDialog;
  joinForm: JoinForm;
  tipForm: TipForm;
  eventForm: EventForm;
  changeForm: ChangeForm;
  pageErrors: Error[];
  manualShot: void;
};

export const test = base.extend<Fixtures>({
  page: async ({ page }, use) => {
    await fenceNetwork(page);
    await use(page);
  },
  // Uncaught errors in the page. Checked after every test: a test passes only
  // if the site threw nothing along the way.
  pageErrors: [
    async ({ page }, use) => {
      const errors: Error[] = [];
      page.on("pageerror", (error) => errors.push(error));
      await use(errors);
      expect(errors, "uncaught errors in the page").toEqual([]);
    },
    { auto: true },
  ],
  // For the manual tests (tests/manual tests/capture.mjs): when MANUAL_SHOTS
  // names a folder, a passing test's last screen is saved there, as the
  // expected result of its manual case.
  manualShot: [
    async ({ page }, use, testInfo) => {
      await use();
      const folder = process.env.MANUAL_SHOTS;
      if (!folder || testInfo.status !== "passed") return;
      const [file, ...titles] = testInfo.titlePath;
      const name = [file.replace(/^.*[\\/]/, ""), ...titles.slice(1)].join(" › ");
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 150);
      await page.screenshot({ path: `${folder}/${slug}--${testInfo.project.name}.jpg`, type: "jpeg", quality: 60, animations: "disabled" }).catch(() => {});
    },
    { auto: true },
  ],
  world: async ({ page }, use) => use(new WorldPage(page)),
  country: async ({ page }, use) => use(new CountryDialog(page)),
  joinForm: async ({ page }, use) => use(new JoinForm(page)),
  tipForm: async ({ page }, use) => use(new TipForm(page)),
  eventForm: async ({ page }, use) => use(new EventForm(page)),
  changeForm: async ({ page }, use) => use(new ChangeForm(page)),
});

export { expect };
