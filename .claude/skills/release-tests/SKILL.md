---
name: release-tests
description: Release tests for t9a-community.com, the live site after the site's repository pushed a release. A sanity run (the suite as it was for the previous release, only the spec files changed since, which should fail where the release changed things, proving the changes are live) and a regression run (the current full suite, where everything but known issues should pass). Use only when the user explicitly asks for release tests, a sanity run or a regression run; never on your own.
---

# Release tests

Two runs against the **live site** (https://t9a-community.com), each with its
own PDF report, after a release of the site has deployed:

1. **Sanity run (small).** This project's specs **as they were for the
   previous site release**, only the spec files changed since, against the
   new live site. Where the release changed things they **should fail**:
   that proves the changes are really live.
2. **Regression run.** The current full suite against the live site.
   **Everything should pass except known issues** (below).

## Versions of the suite

The site's code and its releases live in the site's own repository. Here,
each site release the suite is updated for gets a tag on this project's
commit: `site-v1.97`, `site-v1.98`, … (`git tag site-vX.Y`, then
`git push origin site-vX.Y`, when the user says the suite matches that
release). The sanity run uses the tag of the release before the one being
checked.

## When

**Only when the user says so**: "release tests", "sanity run", "regression
run", "run the tests against production". Run only what they picked (sanity,
regression or both). Never start it yourself.

## Before running

1. **Ask which packs**, with `AskUserQuestion`, two questions:
   - "Which test packs should run?" (multi-select): UI Web, Mobile and
     Accessibility, all ticked by default. **No Performance** here.
   - "Which browsers?": **Chrome only (Recommended)**, desktop and phone,
     about 0.8 GB of Netlify bandwidth per run; or **Chrome, Edge and
     Firefox**, about 2.4 GB per run. A release check is two runs. Each test
     loads the site (the map alone is about 0.5 MB), against the account's
     monthly allowance.
2. **Which release is live, and which came before?** Ask the user, or take
   them from what they said (the site's push). Find the previous release's
   tag here (`git tag -l "site-v*"`); without one, there's no sanity run:
   say so and run only the regression.
3. **List what changed in the suite since then**:
   `git diff --name-only <previous tag> HEAD -- tests/specs tests/a11y`, and
   what the release changed on the site, as the user tells it.

## Safety (built into the harness)

`tests/support/test.ts` fences the network around the site tested: the map
data and `/api/communities` come from the fixtures, **every form post is
answered locally (never sent to Netlify)**, any other `/api/` call answers
404, and nothing else leaves the browser. So a run never sends the live
site a submission, a report or a function call, and never asks New Recruit
or OpenStreetMap anything.

## The sanity run

1. `git worktree add ../prev-suite <previous tag>` (from this project), then
   link the dependencies into it (PowerShell, from the folder above):
   `New-Item -ItemType Junction -Path prev-suite\tests\node_modules -Target WorldOfNinthAge-Test-suite\tests\node_modules`.
2. **Pick the files**: the spec files changed since the tag, as they were
   at the tag. Leave out files the tag didn't have (new specs: nothing old
   to compare). Only these run, never the whole suite.
3. Run them in the background, from `prev-suite/tests`:

   ```bash
   node run-packs.mjs --packs=web,mobile --kind=sanity --browsers=chrome specs/world.spec.ts specs/join.spec.ts
   ```

   (the changed files; the packs and browsers chosen; drop `--browsers` for
   all three). Only if `a11y/views.spec.ts` changed too, a second run with
   `--packs=a11y` and no spec files.
4. Copy its report (`tests/reports/release-sanity-report-*.pdf` and
   `release-sanity-results-*.csv`) into this project's `tests/reports/`,
   and **send the PDF in the chat**.
5. Sort every failure:
   - **Expected:** it checks something the release changed. It proves the
     change is live.
   - **Unexpected:** it checks something the release didn't touch. Rerun it
     once (`-g "its name"`, same flags) to rule out a flake; if it still
     fails, it's a **regression in production**: say so first.
   - Also list **changes with no failing test**: the change may not be live
     (or the old test didn't look at it). Check it in the browser.
6. Remove the worktree: **first the junction** (`cmd /c rmdir
   prev-suite\tests\node_modules`), check it's gone, then delete
   `prev-suite` with Node (`fs.rmSync(path, { recursive: true, force: true
   })`) and `git worktree prune`. Never delete it while the junction is
   there: it would delete the real `node_modules` through it.

## The regression run

From this project's `tests/`, in the background:

```bash
node run-packs.mjs --packs=web,mobile,a11y --kind=regression --browsers=chrome
```

Send its PDF in the chat. Every failure is either:

- **a known issue:** on the site's known defects list (the user knows it),
  an accessibility rule already failing in the last run (the user's rule:
  accessibility tests aren't fixed), or a test known to be flaky (rerun it
  once to show it passes);
- **or a regression in production.** Say so first, with what fails and
  where. Don't fix anything unasked.

## Reporting

One message after both runs, with the two PDFs already sent:

- the live and previous releases (and this project's tags and commit);
- **Sanity:** the spec files run, passed / failed; the expected failures,
  grouped by the change each proves; unexpected failures; changes with no
  failing test;
- **Regression:** passed / failed; the known issues among the failures;
  anything else, as regressions;
- the bandwidth used (roughly: tests × 1.5 MB).

Commit the two newest reports of each kind (`report/build.mjs` keeps only
those) in this project. Don't push unless asked.
