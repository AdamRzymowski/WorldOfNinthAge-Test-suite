---
name: security-legal-scan
description: Security and legal scan of this public test-suite repository. Sends the sceptic-agent-security-legal-scan agent over the files, git history, CI and published reports to find personal data, secrets, gaps in the network fence, risky CI and licence problems. Reads and reports only. Use when the user asks to "scan for security and legal issues", a "security scan", a "legal check", a "privacy/personal data check", or similar.
---

# Scan for security and legal issues

A **sceptical second look** at this repository, by the
[`sceptic-agent-security-legal-scan`](../../agents/sceptic-agent-security-legal-scan.md)
agent, which assumes something is wrong until it has checked. The repository
is public, so personal data, secrets and the site's private code must never
be in it or its history. It reads and reports; it changes nothing.

## When

When the user asks for it, in any words. Never on your own.

## Steps

1. **Note the scope**: the branch and commit, and whether it's pushed.
2. **Start the agent** with the `Agent` tool (`subagent_type:
   "sceptic-agent-security-legal-scan"`), in the background:

   > Review the World of Ninth Age test suite: the repository at
   > `<repository path>`, branch `<branch>`, commit `<commit>` (pushed:
   > yes/no). Report your findings as your brief says.

3. **While it runs, don't change files it's reading.**
4. **Check every finding yourself** before passing it on: open the file and
   line, or the commit, and confirm it. Drop what doesn't hold up, and say
   how many were dropped and why.
5. **Report to the user**, most serious first (format below).
6. **Write it down** in `docs/scans/scan-<date>.md` (findings, what was
   checked, the commit). Commit only when the user asks (CLAUDE.md).
7. **Fix nothing unasked.** Show the findings as tick boxes (a multi-select
   `AskUserQuestion`) so the user picks what to fix. A secret found in the
   history must be revoked at its source first; rewriting history comes
   after, and only if the user asks.

## Report format

```
Security and legal scan, <date>, commit <short sha> (<branch>; pushed: yes/no)

High
1. <title>: <file:line, commit or URL>. <what's wrong>. <why it matters>. Fix: <proposal>.

Medium
…

Low
…

Checked and fine: <short list>.
Dropped after checking: <n> (<why>).
```
