# Bug reports

Defects found in the **test code** (the site's own defects are in
[known-issues](../known-issues/README.md)). Each report follows the same
format: where, steps to reproduce, expected, actual with evidence, likely
cause and a proposed fix. Both below are real, found on 21 Nov 2026 when
the type-check was added to CI.

| ID | Title | Severity | Status |
|---|---|---|---|
| [BR-001](BR-001-major-events-phone-test-has-no-selector.md) | Phone test for major-event links calls `page.locator()` with no selector | high | open |
| [BR-002](BR-002-i18n-fit-check-message-type.md) | Language test passes a possibly-null button text as an assertion message | low | open |

The tests are written in the site's repository and mirrored here, so fixes
are made there and arrive with the next sync.
