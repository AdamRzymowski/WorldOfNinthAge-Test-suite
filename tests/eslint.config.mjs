// Lint for the test suite: TypeScript rules plus Playwright's own (eslint-plugin-playwright).
// Most specs are mirrored from the site's repository (see CLAUDE.md), so fix findings there, not here.
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import playwright from "eslint-plugin-playwright";
import globals from "globals";

export default tseslint.config(
  { ignores: ["node_modules/", "reports/", "test-results/", "playwright-report/", "manual tests/out/"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
    rules: {
      // Fixtures are often asked for only to set the page up ({ page, joinForm }), so unused arguments are fine.
      // Unused variables are shown, not failed: they mostly mark leftovers to tidy in the site's repository.
      "@typescript-eslint/no-unused-vars": ["warn", { args: "none", caughtErrors: "none" }],
      // The scripts use short-circuit and ternary statements and comma sequences on purpose.
      "@typescript-eslint/no-unused-expressions": ["error", { allowShortCircuit: true, allowTernary: true }],
      "@typescript-eslint/no-explicit-any": "warn",
      // Stripping terminal colours (\x1b) and a byte-order mark are deliberate.
      "no-control-regex": "off",
      "no-irregular-whitespace": ["error", { skipRegExps: true, skipStrings: true, skipTemplates: true }],
    },
  },
  {
    files: ["specs/**/*.ts", "a11y/**/*.ts"],
    ...playwright.configs["flat/recommended"],
    rules: {
      ...playwright.configs["flat/recommended"].rules,
      // The suite's own expect...() helpers count as assertions.
      "playwright/expect-expect": [
        "warn",
        {
          assertFunctionNames: [
            "expectAccessible",
            "expectButton",
            "expectFitsScreen",
            "expectFitsSideways",
            "expectIds",
            "expectInfo",
            "expectNoSidewaysScroll",
            "expectOpen",
          ],
        },
      ],
      // The suite switches tests off per view (phone / desktop) on purpose.
      "playwright/no-skipped-test": "off",
      // Several checks are measured in the page and asserted in a loop.
      "playwright/no-conditional-in-test": "off",
      "playwright/no-conditional-expect": "off",
    },
  },
  {
    // The report builder's CSV parser is written with comma sequences ((field += c), i++).
    files: ["report/**/*.mjs"],
    rules: { "@typescript-eslint/no-unused-expressions": "off" },
  },
  {
    // k6 scripts run in k6, not Node.
    files: ["perf/visitors.js"],
    languageOptions: { globals: { __ENV: "readonly", __VU: "readonly", __ITER: "readonly" } },
  },
);
