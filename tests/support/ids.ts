// Every element the tests use is found by its ID (README.md, "Test IDs").
// The IDs of what the scripts build are made by js/ids.js; these helpers make
// the same ones, with the site's own slug, so a test and the page never differ.

// A copy of the site's slug (js/ids.js in the site's repository): keep it in
// step when the site changes it.
import { slug as siteSlug } from "./site-slug.js";

/** A name as the site puts it in an ID: "Klub Gier Bitewnych BUGMAN" → "klub-gier-bitewnych-bugman". */
export const slug = (text: string): string => siteSlug(text);

/** The ID of an item the scripts build: `itemId("community", "Gargulec")` → "community-gargulec". */
export const itemId = (prefix: string, ...parts: (string | undefined)[]): string =>
  [prefix, ...parts.filter((p): p is string => Boolean(p)).map(slug)].join("-");

/** A CSS selector for an ID: `byId("community-gargulec")` → "#community-gargulec". */
export const byId = (id: string): string => `#${id}`;

/** The selector of an item the scripts build: `item("community", "Gargulec")` → "#community-gargulec". */
export const item = (prefix: string, ...parts: (string | undefined)[]): string => byId(itemId(prefix, ...parts));

/** Every direct item of a list, by the ID prefix its items share: `items("community-list", "community")`. */
export const items = (listId: string, prefix: string): string => `#${listId} > [id^="${prefix}-"]`;
