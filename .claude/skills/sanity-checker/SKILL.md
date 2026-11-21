---
name: sanity-checker
description: The Sanity Checker. After answering the user with a claim about how something is on t9a-community.com or in Netlify (an entry, link, logo, event or card is or isn't there, a submission is or isn't live, a held update changes nothing), sends an independent agent to check it the way a real user would, in the live site in Chrome, before the answer is trusted. Use whenever such an answer is given, and when the user asks to "sanity check", "verify that", "is that really so", or names the Sanity Checker.
---

# The Sanity Checker

An **independent check of answers**, by the
[`sanity-checker`](../../agents/sanity-checker.md) agent: it goes where the
user would look (the live site in Chrome, Netlify's dashboard) and does
what they'd do, to see whether the answer is really so. It reads and looks;
it changes nothing.

Why: on 19 Nov 2026 the user asked why BUGMAN's website wasn't on its card.
The answer, reasoned from `data/communities.json` and the rendering code,
said it was there. The user's screenshot of the card showed it wasn't (an
approved update applied in the browser removed it: KD-11). The Sanity
Checker exists so that such an answer is checked on the real page first.

## When

- **Whenever an answer to the user states how something is** that a
  visitor or the user could look at: what's on the live site (an entry, a
  card's contents, a link, a logo, an event, a gallery photo, a language),
  what's live after a push, what's in Netlify (a submission, a held
  update, a form's count). The user's rule (19 Nov 2026): "whenever I ask
  and get a response, verify independently whether the answer I am
  getting is true".
- **When the user asks** in any words ("sanity check", "verify that", "is
  that really so", "the Sanity Checker").
- **Not** for plans, opinions, explanations of how code works, or work not
  pushed yet that the live site can't show (say so instead).

## Steps

1. **Write down the claims**, each one line, word for word as given or
   about to be given to the user, with where they can be seen (e.g. "On
   t9a-community.com, Poland, Klub Gier Bitewnych BUGMAN's card lists the
   website bugman.netlify.app under 'Contact us here'"). Leave out how you
   reached them: the agent must not lean on your reasoning.
2. **Start the agent** with the `Agent` tool (`subagent_type:
   "sanity-checker"`), with this prompt:

   > Check these claims about t9a-community.com as the user would see
   > them: <numbered claims>. Report as your brief says.

   For one or two quick claims, wait for it; for more, run it in the
   background and tell the user the check is running.
3. **Don't trust it blindly either:** read its report; a *wrong* verdict
   needs what it saw (the text or a screenshot). If it couldn't check
   something, say so; never report that as confirmed.
4. **Tell the user** after the answer, briefly: "Sanity check: confirmed
   (opened BUGMAN's card in Chrome, desktop)", or, when *wrong*, correct
   the answer plainly first ("I was wrong: …"), then what it saw and why.
   A wrong answer about a bug is reported to the user, for the site's
   known defects list (in the site's repository).
5. **Log it** in [`docs/sanity-checks.md`](../../../docs/sanity-checks.md):
   date, the user's question, the claim, the verdict, and what was seen.
   Commit the log with the next commit in this project (no push unless
   asked).

## Limits (from the agent's brief)

It never submits, sends, deletes or marks anything, never opens the
private forms, never calls New Recruit, never enters credentials, and
never runs the automated tests. A claim that needs any of these is
reported as *couldn't check*.
