import { test, expect } from "../support/test";

// Web Vitals budget (npm run vitals): what a visitor waits for on the live
// site, measured in Chrome as the page loads: Largest Contentful Paint (the
// map or the country showing), Cumulative Layout Shift (nothing jumping) and
// Time to First Byte. Budgets are Google's "good" thresholds; VITALS_LCP,
// VITALS_CLS and VITALS_TTFB change them. Inside the network fence, so the map
// data comes from the test data and other sites are blocked. Only when asked:
// each view downloads the site.

const BUDGET = {
  lcp: Number(process.env.VITALS_LCP ?? 2500),
  cls: Number(process.env.VITALS_CLS ?? 0.1),
  ttfb: Number(process.env.VITALS_TTFB ?? 800),
};

type Vitals = { lcp: number; cls: number; ttfb: number };

/** Collects LCP and CLS from the page's own performance entries, after it has settled. */
async function measure(page: import("@playwright/test").Page): Promise<Vitals> {
  await page.waitForLoadState("load");
  await page.waitForTimeout(3000); // late shifts and a late largest paint still count
  return page.evaluate(
    () =>
      new Promise<Vitals>((resolve) => {
        let lcp = 0;
        let cls = 0;
        new PerformanceObserver((list) => {
          for (const e of list.getEntries()) lcp = Math.max(lcp, e.startTime);
        }).observe({ type: "largest-contentful-paint", buffered: true });
        new PerformanceObserver((list) => {
          for (const e of list.getEntries() as (PerformanceEntry & { value: number; hadRecentInput: boolean })[]) if (!e.hadRecentInput) cls += e.value;
        }).observe({ type: "layout-shift", buffered: true });
        const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming;
        setTimeout(() => resolve({ lcp: Math.round(lcp), cls: Math.round(cls * 1000) / 1000, ttfb: Math.round(nav.responseStart) }), 100);
      }),
  );
}

async function expectWithinBudget(vitals: Vitals) {
  await test.info().attach("web-vitals", { contentType: "application/json", body: JSON.stringify({ ...vitals, budget: BUDGET }, null, 2) });
  test.info().annotations.push({ type: "web vitals", description: `LCP ${vitals.lcp} ms, CLS ${vitals.cls}, TTFB ${vitals.ttfb} ms` });
  expect.soft(vitals.lcp, `LCP ${vitals.lcp} ms (budget ${BUDGET.lcp})`).toBeLessThanOrEqual(BUDGET.lcp);
  expect.soft(vitals.cls, `CLS ${vitals.cls} (budget ${BUDGET.cls})`).toBeLessThanOrEqual(BUDGET.cls);
  expect.soft(vitals.ttfb, `TTFB ${vitals.ttfb} ms (budget ${BUDGET.ttfb})`).toBeLessThanOrEqual(BUDGET.ttfb);
}

test.describe("Web Vitals", () => {
  test("home page, the world map", async ({ page, world }) => {
    await world.goto();
    await expectWithinBudget(await measure(page));
  });

  test("a country opened straight from its link", async ({ page, world, country }) => {
    await world.goto("Poland");
    await country.waitForStreetMap();
    await expectWithinBudget(await measure(page));
  });
});
