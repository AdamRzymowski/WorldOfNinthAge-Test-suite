# BR-001: Phone test for major-event links calls `page.locator()` with no selector

- **Found:** 21 Nov 2026, test-suite commit 9510b2a (site version 1.97), by the new type-check (`npm run typecheck`, issue #4)
- **Status:** open (to be fixed in the site's repository, where the spec is written)
- **Severity:** high: the test can't do what its title says, so the behaviour it guards (CR-19) is untested on phones
- **Type:** defect in the test code, not in the site

## Where

- **File:** `tests/specs/major.spec.ts`, lines 92–94
- **Test:** "Major global community events › on a phone, an event's links are one per row across the whole card, their text centred (CR-19)"
- **Projects:** the phone projects (`chrome-mobile`, `edge-mobile`, `firefox-mobile`); desktop projects skip it

## Steps to reproduce

1. In `tests/`, run `npm run typecheck`.
2. Or run the test itself: `npx playwright test specs/major.spec.ts -g "one per row" --project=chrome-mobile`.

## Expected

The type-check passes, and the test measures the event's card and its links:
the card's box, then each link's box and alignment.

## Actual

```
specs/major.spec.ts(93,30): error TS2554: Expected 1-2 arguments, but got 0.
specs/major.spec.ts(94,30): error TS2554: Expected 1-2 arguments, but got 0.
```

```ts
const open = itemId("major-event", "Test Open", "2026-11-21");
const card = (await page.locator().boundingBox())!;
const boxes = await page.locator().evaluateAll((links) => …);
```

`open` is built but never used (ESLint: `'open' is assigned a value but never
used`), and both `page.locator()` calls have lost their selectors. Without a
selector the call can't find the card or its links, so the test can't check
the layout on any phone project (not yet confirmed by a run: tests run only
when asked).

## Evidence

The same lines are in the site's repository at its `main` (commit f1f23d0),
so the sync copied them as they are.

## Likely cause

Two template strings using `open` (for example `` `#${open}` `` and a selector
for its links) were removed by a text replacement that treated `${…}` as a
shell variable.

## Proposed fix

In the site's repository, restore the two selectors from the spec's history
(`git log -p -- tests/specs/major.spec.ts`), run the test on a phone project,
and let the next sync bring it here. CI's type-check then passes.
