# Test plan: a site release

A template for testing one release of https://t9a-community.com. Copy it
into the release's PR or issue and fill in the brackets. The approach and
risks behind it are in the [test strategy](test-strategy.md).

## 1. Release

- **Site version:** [e.g. 1.98]
- **Changes:** [change requests and fixes in this release, e.g. CR-19]
- **Specs changed:** [spec files the sync brought in]
- **Deployed:** [date], confirmed live by [a changed file or text]

## 2. Scope

| In scope | Out of scope |
|---|---|
| The views and forms the release changed, and a full regression | Server functions' internals (site repository) |
| Desktop and phone, Chrome (Edge and Firefox when layout changed) | Load, spike and soak runs on the live site |
| Accessibility of the changed views | Real form submissions (only by explicit request) |
| Languages: English plus [languages whose texts changed] | Third-party services (OpenStreetMap, New Recruit) |

## 3. Runs

| # | Run | Command | Expected |
|---|---|---|---|
| 1 | Static checks | `npm run check` | Passes |
| 2 | Sanity: previous release's tests for the changed areas | release-tests skill, sanity | Fails exactly where this release changed things |
| 3 | Regression: this release's full suite | `npm run release` (Chrome) or Actions → Tests | All pass except known issues |
| 4 | Accessibility | included in 3 (`a11y` pack) | No new violations |
| 5 | Visual quality (if layout or texts changed) | quality-checker skill | No new defects, or filed in `docs/known-issues/` |
| 6 | Performance smoke (only if asked) | `npm run perf:smoke` | All checks pass, p95 within the usual range |
| 7 | Manual spot checks | `Manual tests.pdf`, cases for the changed areas | As described in each case |

## 4. Environment

- Live site, Chrome [version]; phone view = Pixel 7 emulation.
- Test data: `tests/fixtures/communities.json`; clock fixed at 10 Nov 2026.
- Network fence on (`tests/support/test.ts`).

## 5. Exit criteria

- Runs 1, 3 and 4 pass, apart from issues listed in `docs/known-issues/`.
- Run 2 failed only where expected.
- Every new defect is filed with steps and a screenshot.

## 6. Results

| Run | Result | Report | Notes |
|---|---|---|---|
| 1 | [pass/fail] | [CI link] | |
| 2 | | [PDF] | |
| 3 | | [Pages link] | |
| 4 | | | |
| 5 | | | |

**Sign-off:** [name, date]
