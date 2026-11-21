# Test strategy

## The product

[t9a-community.com](https://t9a-community.com) is a static site on Netlify:
a painted world map where players of *The Ninth Age* find communities,
stores and events by country. Visitors add their own entries through forms
(join, update, event, tip, gallery, deletion request, bug report), which go
to Netlify Forms and serverless functions for review before they appear.
It is translated into a dozen languages and has a separate phone view.

## What matters most (risks)

| Risk | Impact | How it's tested |
|---|---|---|
| A form loses or garbles a submission | Communities never appear; trust lost | `join`, `update`, `events`, `tip`, `gallery`, `change`, `bug` specs check every field posted, validation and the success state |
| Personal data shown or sent where it shouldn't be | Legal (GDPR) and trust | `security.spec.ts` (the privacy note's contents, consent to publish, no calls to Google Fonts or CDNs); the security & legal scan agent |
| Untrusted text injected into the page (XSS, `javascript:` links) | Security | `security.spec.ts`: HTML in names, comments and events shown as text, non-web links not linked, `rel="noopener"`, the Content-Security-Policy blocking outside scripts, honeypot fields |
| The map or a country doesn't open | The site's main purpose fails | `world*`, `country`, `sections`, `filter` specs |
| Broken on phones | Most visitors are on phones | Every UI test also runs at phone size in three browsers; `mobile` and `view` specs |
| Not usable with a keyboard or screen reader | Excludes people; WCAG 2.2 AA | axe-core on 29 views, desktop and phone; focus checks in the form specs |
| Translations missing or overflowing | Looks broken to non-English visitors | `i18n.spec.ts`; the quality run in four languages |
| Slow or failing under a crowd | Bad first impression | k6 smoke run of the live site; load, spike and soak on a local copy (site repository) |

## Levels and where they run

| Level | Tool | Runs against | Where |
|---|---|---|---|
| End-to-end UI | Playwright (TypeScript) | Live site, inside the network fence | This repository |
| Accessibility | axe-core in Playwright | Live site | This repository |
| Visual quality | Playwright measuring run + Quality Checker agent | Live site | This repository |
| Performance | k6 | Live site: smoke only; local copy: load, spike, soak | Smoke here; the rest in the site repository |
| Server functions | Node test runner | Local copy | Site repository (needs the site's code) |
| Manual | Generated test cases (PDF) | Live site | `tests/manual tests/` |
| Static checks | TypeScript strict, ESLint, eslint-plugin-playwright | The test code | CI on every push |

## Testing in production, safely

The UI tests run against the live site because the site is static and the
deploy is the product. `tests/support/test.ts` fences the network: the map's
data comes from `tests/fixtures/communities.json`, every form post and API
call is answered inside the browser, and every other site (OpenStreetMap,
address search, New Recruit) is blocked or answered locally. Nothing a test
does reaches the site's inbox, its functions or a third party.

The remaining cost is bandwidth (about 1.5 MB per test against Netlify's
monthly allowance), so: no scheduled runs, Chrome only by default, and only
the k6 smoke profile ever touches the live site.

## Test design rules

- **Elements by ID only** (no CSS classes, text, roles or XPath), built
  through `support/ids.ts`, so tests survive restyling and translation.
- **Fixed test data and clock**: invented entries ("Test Club", "Test Store")
  and a fixed date, so results don't depend on the live map's content.
- **Phone and desktop by the site's own switch** (`<html data-view>`), not by
  guessing from the window width.
- **One manual case per automated test**, generated into a PDF, so a person
  can repeat any check and the two never drift apart.
- **Accessibility failures are reported, never "fixed" in the test.**

## Entry and exit

- **Entry:** a site release is deployed; the specs are synced from the site
  repository; `npm run check` passes.
- **Release check:** a sanity run of the previous release's tests (they should
  fail where the release changed things, proving it's live) and a regression
  run of the new suite (`.claude/skills/release-tests`).
- **Exit:** everything passes except documented known issues
  ([docs/known-issues/](known-issues/README.md)); accessibility violations
  are listed in the report.

## Reporting

Each run produces Playwright HTML reports, a PDF and CSV summary compared
with the previous run, and, in CI, a page on GitHub Pages. Defects go to
`docs/known-issues/`; work items to the
[project board](https://github.com/users/AdamRzymowski/projects/1).
