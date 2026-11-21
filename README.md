# World of Ninth Age: test suite

Tests for the live site **https://t9a-community.com**, the World of Ninth Age
Communities map. The site's own code is in its own repository; this project
holds only the tests, and tests what the site serves.

## What's here

| Folder | What |
|---|---|
| `tests/specs/` | Playwright end-to-end tests of the site (UI Web and Mobile packs) |
| `tests/a11y/` | Accessibility tests: axe-core against WCAG 2.2 AA |
| `tests/pages/`, `tests/support/` | Page objects, the network fence, ID helpers |
| `tests/fixtures/communities.json` | The test data the tests use instead of the live map's data |
| `tests/perf/` | k6: a smoke run (1 visitor, 30 s) of the live site |
| `tests/manual tests/` | Every UI test written out for a person (`Manual tests.pdf`) |
| `tests/report/` | The PDF and CSV test report of each run |
| `.claude/` | The test agents for Claude Code: the Playwright Sceptic, the Sanity Checker, and the release-tests skill |

## Setup

```bash
cd tests
npm run setup
```

(installs the packages and Playwright's Firefox, Chrome and Edge).

## Running

From `tests/`:

| Command | Runs |
|---|---|
| `npm test` | Asks which packs (UI Web, Mobile, Accessibility, Performance), runs them, then makes the report |
| `npm run test:all` | UI Web, Mobile and Accessibility, no question |
| `npm run test:chrome` | Chrome only, desktop and phone |
| `npm run test:a11y` | Accessibility only |
| `npm run release` | A regression run in Chrome, reported as a release check |
| `npm run perf:smoke` | The k6 smoke run of the live site |
| `npm run report:build` | Remakes the PDF and CSV report from the last run |

Every run reports to `tests/reports/test-report-<date>.pdf` and
`test-results-<date>.csv`, compared with the run before.

### Safe against the live site

The tests open the real site, but `tests/support/test.ts` fences the network
around it:

- the map data and `/api/communities` come from the test data;
- every form post is answered in the browser, so **nothing is ever submitted
  to the site**; any other `/api/` call answers 404;
- OpenStreetMap, the address search and every other site are blocked or
  answered locally, and New Recruit is never called.

What the runs do cost is bandwidth: each test downloads the site (about
1.5 MB), against the Netlify account's monthly allowance. So Chrome only is
the usual choice, and the only performance run allowed against the live site
is the smoke run (`--yes` confirms it). Load, spike and soak runs belong to
the site's repository, against a local copy.

`BASE_URL` points everything at another deployed copy instead:
`node run-packs.mjs --base-url=https://deploy-preview-1--t9a-community.netlify.app`.

## Not here

The Netlify Functions' own tests (the `server` project) and the local server
stay in the site's repository: they need the site's code.
`tests/support/site-slug.js` is a copy of the site's `slug()` (from
`js/ids.js`), so the tests build the same element IDs as the page; when the
site changes it, copy the new one.
