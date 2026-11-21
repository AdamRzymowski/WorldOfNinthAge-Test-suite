---
name: playwright-sceptic
description: The Playwright Sceptic. Sends a sceptical review agent over t9a-community.com's Playwright tests and manual cases to find tests that can't fail, prove less than their titles claim, hide the behaviour behind mocks, are flaky, or break the project's test rules (IDs only, fixtures, data-view). Reads only; never runs the tests. Use when the user asks for "the Playwright Sceptic", to "check the tests' validity", "review the tests critically", or similar.
---

# The Playwright Sceptic

A **sceptical second look at the automated tests**, by the
[`playwright-sceptic`](../../agents/playwright-sceptic.md) agent: for each
test, would it fail if the behaviour its title names were broken? It reads
the tests and the live site's own files and reports; it runs and changes
nothing.

## When

When the user asks for it, in any words ("Playwright Sceptic", "check the
tests' validity", "are these tests any good"). Never on your own.

## Steps

1. **Note the scope**: the current branch and commit, and which tests the
   user means: all of them (the default), some spec files, or the tests a
   change or change request touched (list their files).
2. **Start the agent** with the `Agent` tool (`subagent_type:
   "playwright-sceptic"`), in the background, with this prompt (it starts
   with no context):

   > Review the Playwright tests of t9a-community.com: the test project at
   > `<repository path>`, branch `<branch>`, commit `<commit>`. Scope:
   > `<all tests | these files: …>`. The site's code isn't here: fetch
   > its static files from the live site as your brief says. Report as your
   > brief says.

   One agent; for the whole suite it may take a while.
3. **While it runs, don't change the tests or the code it's reading.**
4. **When it reports, check every finding yourself** before passing it on:
   open the file and line, read the test and the live site's code it
   exercises,
   and confirm the concrete break it says would go unnoticed. For a false
   pass, trace its mutation through the test yourself; for a "catches it",
   spot-check a few of the most important ones the same way. Drop what
   doesn't hold up, and say how many were dropped and why. **Don't run the
   tests to check** (the user's rule: tests run only when asked by name).
5. **Report to the user**, most serious first, grouped by spec file: what's
   wrong, where (file:line and the test's title), how it could pass while
   the site is broken, and a proposed fix. Then what was checked and found
   sound.
6. **Write it down**: `docs/scans/tests-<date>.md` (findings, scope, the
   commit), committed in this project.
7. **Fix nothing unasked.** Show the findings as **tick boxes** (a
   multi-select `AskUserQuestion`, as for the known defects) so the user
   picks what to fix. Accessibility test findings are report only: the user
   doesn't want accessibility tests fixed. When fixing, keep the manual
   cases (`tests/manual tests/cases.mjs`) in step, and don't run the tests
   unless the user asks.

## Proving it: the mutation check (only when the user asks)

The site's code isn't in this project, so a mutation check is done **in the
site's repository**, where the code can be changed in a worktree. From here,
pass the mutations on (the agent's table) for that.

Reading can only show that a test *should* fail on a break. The proof is to
make the break and watch the test go red. That's a test run, so **only when
the user asks for it by name** ("run the mutation check", "prove it"), and
after asking which packs as for any test run (CLAUDE.md, "Tests"). Then:

1. Take the agent's mutations for the tests the user picks (by default its
   *unsure* verdicts and the most important *catches it* ones).
2. Work in a separate git worktree of the current commit, never in the
   working copy: apply **one mutation at a time**, run **only the tests it
   targets** (Chrome or the `server` project, `--retries=0`), note red or
   green, and undo the mutation before the next.
3. Also run each targeted test once on the unmutated code: it must be green
   there, or the result means nothing.
4. A test that stays **green with its mutation is a proven false pass**
   (high). A test that goes red proves it catches that break.
5. Report a table: test, mutation, red/green, verdict. Remove the worktree
   afterwards. Nothing from it is committed; fixes go through the tick
   boxes as above.

## Report format

```
Playwright Sceptic, <date>, commit <short sha> (<branch>), scope <…>

High (passes while the behaviour is broken)
1. <spec file> › <test title>: <file:line>. <what's wrong>. Unnoticed break: <…>. Fix: <proposal>.

Medium (weak, flaky or against the test rules)
…

Low
…

False pass check (every test in scope)
| Test | Claim | Mutation | Verdict |
|---|---|---|---|
| <spec> › <title> | <what it promises> | <the break> | catches it / misses it / unsure |
Totals: <n> catch, <n> miss, <n> unsure.

Checked and sound: <spec files>.
Dropped after checking: <n> (<why>).
```
