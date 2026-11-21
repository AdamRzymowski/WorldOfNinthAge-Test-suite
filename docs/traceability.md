# Traceability matrix

Each feature of https://t9a-community.com, the spec that covers it, how many
automated tests it has (per browser project), and how many manual cases
describe it (`tests/manual tests/cases.mjs`, built into `Manual tests.pdf`).
Every manual case names its automated test; `npm run manual:pdf` lists any
test without a case and any case whose test is gone.

Counts as of site version 1.97 (`.sync.json`). Manual cases can be fewer than
tests where one case covers a test repeated per language (`*`).

| Feature | Spec | Automated tests | Manual cases | Also covered by |
|---|---|---:|---:|---|
| World map: countries, join button, country search | `world.spec.ts` | 18 | 18 | a11y: home page, join list |
| World map: upcoming events filter | `world-events.spec.ts` | 10 | 10 | a11y: events shown |
| World map: stores filter | `world-stores.spec.ts` | 6 | 6 | a11y: stores shown |
| Major global community events | `major.spec.ts` | 5 | 5 | a11y: major events |
| Country window | `country.spec.ts` | 14 | 14 | a11y: a country, empty country |
| Country sections | `sections.spec.ts` | 6 | 6 | |
| Country filter | `filter.spec.ts` | 10 | 10 | |
| Plant your banner (join form) | `join.spec.ts` | 29 | 29 | a11y: banner form, town check, store form, which country |
| Update a banner | `update.spec.ts` | 9 | 9 | a11y: update your banner |
| Request deletion | `change.spec.ts` | 5 | 5 | |
| Events (event form and listings) | `events.spec.ts` | 45 | 45 | a11y: event form |
| Gallery (photo upload) | `gallery.spec.ts` | 6 | 6 | |
| Drag and drop images | `drop.spec.ts` | 4 | 4 | |
| Know one? Tell us. (tip form) | `tip.spec.ts` | 4 | 4 | a11y: tip form |
| Report a bug | `bug.spec.ts` | 5 | 5 | a11y: bug report, sent |
| Languages | `i18n.spec.ts` | 40 | 18 | quality run (en, de, pl, el) |
| Phone layout | `mobile.spec.ts` | 25 | 23 | a11y: phone menu |
| Phone and desktop views | `view.spec.ts` | 5 | 5 | |
| One look (consistent styling) | `look.spec.ts` | 15 | 15 | quality run |
| Test IDs (every control has a unique ID) | `ids.spec.ts` | 5 | 5 | |
| Security (input handling, links, headers) | `security.spec.ts` | 13 | 13 | security & legal scan agent |
| **Total** | 21 files | **279** | **255** | |

## Packs

| Pack | Config | Projects | Tests per project | Runs in a full pass |
|---|---|---|---:|---:|
| UI Web | `playwright.config.ts` | chrome, edge, firefox | 279 | 837 |
| Mobile | `playwright.config.ts` | chrome-mobile, edge-mobile, firefox-mobile | 279 | 837 |
| Accessibility | `playwright.a11y.config.ts` | a11y-desktop, a11y-phone | 29 | 58 |
| Quality | `playwright.quality.config.ts` | quality-phone-412, quality-desktop-1366 | 13 views × 4 languages | 104 |
| Performance | `perf/run.mjs` (k6) | smoke | 1 visitor, 30 s | 1 |

## Open coverage work

Tracked as issues on the [project board](https://github.com/users/AdamRzymowski/projects/1):
keyboard-only form flows (#10), screen-reader checks (#11), API checks (#12,
#13), Web Vitals budget (#14), visual regression (#15), WebKit (#16),
remaining manual cases (#17).
