// A copy of slug() from the site's js/ids.js (t9a-community.com, version 1.97),
// so tests build the same IDs as the page. The site's code isn't in this
// project: when the site changes its slug, copy the new one here.

// "Klub Gier Bitewnych BUGMAN" → "klub-gier-bitewnych-bugman"; "Łódź" → "lodz".
// Other alphabets keep their letters, without accents: "Ελλάδα" → "ελλαδα".
export function slug(text) {
  return (
    String(text ?? "")
      .replace(/[łŁ]/g, "l")
      .replace(/[øØ]/g, "o")
      .replace(/ı/g, "i")
      .replace(/ß/g, "ss")
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60)
      .replace(/-+$/, "") || "item"
  );
}
