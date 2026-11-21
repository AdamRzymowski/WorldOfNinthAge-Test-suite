# BR-002: Language test passes a possibly-null button text as an assertion message

- **Found:** 21 Nov 2026, test-suite commit 9510b2a (site version 1.97), by the new type-check (`npm run typecheck`, issue #4)
- **Status:** open (to be fixed in the site's repository, where the spec is written)
- **Severity:** low: the check still works; only its failure message can be empty, and the type-check fails
- **Type:** defect in the test code, not in the site

## Where

- **File:** `tests/specs/i18n.spec.ts`, line 146
- **Test:** the per-language check that the longest buttons' words stay inside them

## Steps to reproduce

1. In `tests/`, run `npm run typecheck`.

## Expected

The type-check passes. When a button's text doesn't fit, the failure names
the button.

## Actual

```
specs/i18n.spec.ts(146,22): error TS2345: Argument of type 'string | null' is not
assignable to parameter of type 'string | { message?: string | undefined; } | undefined'.
```

```ts
expect(fits, await button.textContent()).toBe(true);
```

`textContent()` can return `null`, which `expect`'s message doesn't accept.
If it ever did, the failure would come without the button's name.

## Proposed fix

In the site's repository: `expect(fits, (await button.textContent()) ?? (await button.getAttribute("id")) ?? "button").toBe(true);`
or name the button by its id, which the test already has.
