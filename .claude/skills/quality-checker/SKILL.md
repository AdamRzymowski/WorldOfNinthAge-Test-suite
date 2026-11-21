---
name: quality-checker
description: The Quality Checker. Alongside a test run the user asked for, sends the quality-checker agent to measure each view of t9a-community.com in several languages at phone and desktop widths (tests/quality/, inside the network fence) for text that doesn't fit, text over text, overlapping controls, plain browser buttons, sideways scrolling, broken images and small tap targets, check each finding on its screenshot, and file the real defects as bug reports in docs/known-issues/. Also when the user asks for a "quality check", a "UI check" or names the Quality Checker.
---

# The Quality Checker

A **visual quality check**, by the [`quality-checker`](../../agents/quality-checker.md)
agent: it runs `npm run quality` (`tests/quality/`), looks at each finding on
its screenshot, and files the real ones in
[`docs/known-issues/`](../../../docs/known-issues/README.md). It changes no
test or site code.

## When

- **With a test run the user asked for** (CLAUDE.md, "Running tests: only
  when asked"), when they tick it or name it, for the same layouts (phone,
  desktop or both).
- When the user asks for a quality check by name.
- Never on its own: every view it opens downloads the live site, against the
  Netlify account's monthly allowance.

## Steps

1. **Note the scope**: the commit, the layouts (phone `412`, desktop `1366`,
   or both), and the languages (default `en,de,pl,el`; more only if asked).
2. **Start the agent** with the `Agent` tool (`subagent_type:
   "quality-checker"`), in the background:

   > Run the quality check for t9a-community.com: the repository at
   > `<repository path>`, commit `<commit>`, layouts `<phone | desktop |
   > both>`, languages `<…>`. Report as your brief says.

3. **When it reports, check what it filed**: open each new note in
   `docs/known-issues/` and its screenshot. A note without a screenshot or
   steps to reproduce isn't finished. Correct or remove what doesn't hold up,
   and say so.
4. **Tell the user**: the new and updated defects (id, title, severity) and
   the open total.
5. **Fix nothing unasked.** Show the open defects as tick boxes (a
   multi-select `AskUserQuestion`). Defects are fixed in the site's
   repository; when one is fixed, move it to **Fixed** in the README with
   the site's version.
