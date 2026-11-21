import type { Page } from "@playwright/test";
import { test, expect } from "../support/test";

// The two views, phone and desktop (js/view.js): one switch on <html
// data-view>, decided before the page is drawn and following the screen as it
// changes. The phone view's own rules are in css/phone.css.

const view = (page: Page) => page.evaluate(() => document.documentElement.dataset.view);
const position = (page: Page, id: string) => page.locator(`#${id}`).evaluate((el) => getComputedStyle(el).position);

test.describe("Phone and desktop views", () => {
  // A phone-sized screen (firefox-mobile is one without being a phone).
  const phoneSized = (page: Page) => page.viewportSize()!.width <= 760;

  test("a phone opens the phone view, a computer the desktop view", async ({ page, world }) => {
    await world.goto();
    expect(await view(page)).toBe(phoneSized(page) ? "phone" : "desktop");
    // The phone view keeps the corners above the map; the desktop view puts them over it.
    expect(await position(page, "corner-left")).toBe(phoneSized(page) ? "static" : "absolute");
  });

  test("narrowing the window switches to the phone view and widening it switches back, with nothing left of the other", async ({ page, world }) => {
    await world.goto();
    const changes: string[] = [];
    await page.exposeFunction("viewChanged", (to: string) => changes.push(to));
    await page.evaluate(() => document.addEventListener("viewchange", (e) => (window as any).viewChanged((e as CustomEvent).detail.view)));

    await page.setViewportSize({ width: 1280, height: 800 });
    await expect.poll(() => view(page)).toBe("desktop");
    expect(await position(page, "corner-left")).toBe("absolute");
    expect(await position(page, "join-slot")).toBe("absolute"); // on the map's plaque

    await page.setViewportSize({ width: 390, height: 844 });
    await expect.poll(() => view(page)).toBe("phone");
    expect(await position(page, "corner-left")).toBe("static");
    expect(await position(page, "join-slot")).toBe("fixed"); // at the bottom of the screen
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);

    await page.setViewportSize({ width: 1280, height: 800 });
    await expect.poll(() => view(page)).toBe("desktop");
    expect(await position(page, "corner-left")).toBe("absolute");
    expect(await position(page, "join-slot")).toBe("absolute");
    expect(changes.slice(-2)).toEqual(["phone", "desktop"]); // one change each way
  });

  test("a country left open keeps working through the switch", async ({ page, world }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await world.goto("Poland");
    await expect(page.locator("#country-dialog")).toBeVisible();
    const areas = () => page.locator("#country-body").evaluate((el) => getComputedStyle(el).gridTemplateAreas);
    expect(await areas()).toBe('"map list events"');

    await page.setViewportSize({ width: 390, height: 844 });
    await expect.poll(() => view(page)).toBe("phone");
    await expect(page.locator("#country-dialog")).toBeVisible();
    expect(await areas()).toBe("none"); // one column
    expect((await page.locator("#country-dialog").boundingBox())!.width).toBeLessThanOrEqual(390);

    await page.setViewportSize({ width: 1280, height: 800 });
    await expect.poll(() => view(page)).toBe("desktop");
    expect(await areas()).toBe('"map list events"');
  });

  test("a phone turned on its side stays in the phone view", async ({ page, world, isMobile }) => {
    test.skip(!isMobile, "a touch screen only");
    await world.goto();
    await page.setViewportSize({ width: 915, height: 412 });
    await expect.poll(() => view(page)).toBe("phone");
    expect(await position(page, "corner-left")).toBe("static");
  });

  test("the privacy note has the same two views", async ({ page }) => {
    await page.goto("/privacy.html");
    expect(await view(page)).toBe(phoneSized(page) ? "phone" : "desktop");
  });
});
