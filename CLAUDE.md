# World of Ninth Age: test suite

This project holds only the tests for the live site https://t9a-community.com
(see README.md). The site's code is in its own private repository
(AdamRzymowski/WorldOfNInthAgers); never copy it here.

## Kept in step with the site's repository

The tests are **mirrored** from the site's repository: on every push there,
`tools/sync-test-suite.mjs` copies its changed tests here, commits, and tags
the commit `site-vX.Y` (the site's version). So:

- **Change tests in the site's repository**, not here: the next sync
  overwrites mirrored files.
- The **adapted** files are this project's own versions (they test the
  live site and need none of the site's code): the Playwright configs,
  `run-packs.mjs`, `perf/run.mjs`, `package.json`, `tsconfig.json`,
  `support/ids.ts`, `manual tests/build.mjs`, and the agents and skills in
  `.claude/`. The sync flags them when the site's versions change, for a
  change by hand. `support/site-slug.js`, README.md, this file, `docs/`,
  `LICENSE`, `.github/`, `tests/quality/`, `tests/playwright.quality.config.ts`,
  `tests/eslint.config.mjs` and the Prettier files belong to this project
  alone. `.sync.json` records the last sync.
- `npm run check` (type-check and lint) runs in CI on every push. Fix what it
  finds in mirrored files in the site's repository; it reaches here with the
  next sync.

Project board: https://github.com/users/AdamRzymowski/projects/1 (issues in
this repository). Reference issues in commits and PRs (`Closes #n`).

## Running tests: only when asked

- **Run tests only when the user says so, in so many words**: never on your
  own, never after a change unasked, and don't ask "run the tests now?".
  At most mention that they haven't been run.
- **Before every run, ask which packs** with `AskUserQuestion`, a
  multi-select question: "Which test packs should run?" with UI Web, Mobile,
  Accessibility (these three marked as the default) and Performance. Then
  ask which browsers: **Chrome only (Recommended)**, or Chrome, Edge and
  Firefox. Every test downloads the live site, against the Netlify account's
  monthly allowance.
- Run the chosen packs from `tests/`, in the background:
  `node run-packs.mjs --packs=web,mobile,a11y --browsers=chrome`.
- **Performance** only when the user ticks or names it, and only the smoke
  run (`--packs=perf`, 1 visitor, 30 s). Never load, spike or soak against
  the live site.
- When a run ends, **send the user its PDF report in the chat**
  (`tests/reports/test-report-<date>.pdf`), with per pack what passed and
  failed, new failures compared with the previous run, and the
  accessibility rules broken. Commit the new PDF (the two newest are kept).
- **Release tests** (a sanity and a regression run after a site release):
  follow the **release-tests** skill.

## Writing and changing tests

- **IDs only**: tests find every element by its ID (built IDs through
  `tests/support/ids.ts`); never by class, text, role or XPath.
- Tests use `tests/fixtures/communities.json`, never the live map's data.
- Phone and desktop views are switched by the site's `<html data-view>`, not
  by window width.
- **Keep the manual cases in step**: when a UI spec is added or changed,
  add or change its case in `tests/manual tests/cases.mjs` in the same
  change.
- **Never fix accessibility tests** (the user's rule); report what they
  find.
- When the site changes `slug()` in its `js/ids.js`, copy it into
  `tests/support/site-slug.js`.

## Safety

- The network fence in `tests/support/test.ts` must stay: no test may post
  a form to the live site, call its functions, or reach New Recruit or
  OpenStreetMap. Never loosen it.
- **Never call New Recruit** (newrecruit.eu) in any way: not from tests,
  scripts or the browser.
- Never open the site's private Netlify forms (`change-request`,
  `bug-report`, `community-tip`, `private-alert`), never enter credentials,
  and never submit anything on the live site unless the user asks for that
  one submission.

## The test agents

- **The Playwright Sceptic** (`.claude/skills/playwright-sceptic/`): when the
  user asks to check the tests' validity. Reads only; findings are checked,
  shown as tick boxes, and nothing is fixed until the user picks.
- **The Sanity Checker** (`.claude/skills/sanity-checker/`): whenever an
  answer states how something is on the live site, check it the way a user
  would, in Chrome (the user's default browser), and log it in
  `docs/sanity-checks.md`.
- **The Quality Checker** (`.claude/skills/quality-checker/`): with a test
  run the user asked for when they tick or name it, or when asked for by
  name. Runs `npm run quality` (inside the network fence), checks findings on
  their screenshots and files defects in `docs/known-issues/`.
- **The security and legal scan** (`.claude/skills/security-legal-scan/`):
  when the user asks. The repository is public: the agent looks for personal
  data, secrets, gaps in the fence, risky CI and licence problems. Reads only.

## Git

Commit or push only when the user asks. Use they/them for everyone.
