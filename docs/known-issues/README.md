# Known issues

Defects found on https://t9a-community.com by the test suite, the Quality
Checker (`.claude/agents/quality-checker.md`) or by hand. Each has its own
note, `KI-<n>-<short-slug>.md`, numbered in order and never reused, with its
screenshot in `img/`. Defects are fixed in the site's repository; this list
tracks them until they are.

## Open

| ID | Title | Severity | Found | Where |
|---|---|---|---|---|

## Fixed

| ID | Title | Fixed in (site version) |
|---|---|---|

## Template

Copy this into a new note, every heading in this order.

```markdown
# KI-<n>: <what's wrong, where, in one line>

- **Found:** <date>, commit <short sha>, by <the Quality Checker / a test / by hand> (<which run>)
- **Status:** open
- **Severity:** <high: looks broken or blocks something | medium: clearly wrong but usable | low: polish>

## Where

- **View:** <view, and the URL or hash>
- **Layout:** <phone / desktop>, <widths>
- **Languages:** <…>
- **Elements:** <#ids>

## Steps to reproduce

1. Open <URL> in a <width>×<height> window, language <…>.
2. …

## Expected

<what a visitor should see>

## Actual

<what's on screen, with the measured numbers>

## Screenshot

![<what it shows>](img/KI-<n>-<width>-<lang>.png)

## Likely cause

<the CSS or code in the site's repository, file:line, with the rule's values>

## Proposed fix

<one or two lines>

## Seen

- <date>, commit <short sha>: <where it showed again>
```
