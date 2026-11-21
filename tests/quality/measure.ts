// The Quality Checker's measurements (tests/quality/views.spec.ts). Both functions run inside the page
// (pass them to page.evaluate), so they use only the DOM. Adapted for t9a-community.com from the measuring
// tool of T9A Compatible Miniatures.

export type Box = { x: number; y: number; w: number; h: number };
export type Finding = {
  check: string;
  severity: "high" | "medium" | "low";
  element: string;
  text: string;
  box?: Box;
  other?: string;
  otherText?: string;
  otherBox?: Box;
  detail: string;
};

/**
 * Measures one view (the whole page, or the pop-up `scope`) and returns what a careful eye would catch:
 * text that doesn't fit its control (text-overflow, text-clipped; text-cut is an intended "…"), controls
 * that overlap (overlap), plain browser buttons (button-style), sideways scrolling and elements off the
 * screen (sideways-scroll, off-screen), broken images (broken-image) and small tap targets on phones (tap-target).
 */
export function measure({ scope, phone }: { scope: string | null; phone: boolean }): Finding[] {
  const root = (scope ? document.querySelector(scope) : document.body) as HTMLElement | null;
  if (!root) return [{ check: "view-failed", severity: "high", element: scope ?? "body", text: "", detail: "the view's element is not on the page" }];
  const vis = (el: Element) => {
    const s = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return s.display !== "none" && s.visibility !== "hidden" && +s.opacity > 0.05 && r.width > 1 && r.height > 1 && el.closest("[hidden]") === null;
  };
  const label = (el: Element) =>
    el.id ? `#${el.id}` : el.tagName.toLowerCase() + (typeof el.className === "string" && el.className.trim() ? "." + el.className.trim().split(/\s+/).join(".") : "");
  const text = (el: Element) =>
    ((el as HTMLElement).innerText || (el as HTMLInputElement).value || el.getAttribute("aria-label") || "").replace(/\s+/g, " ").trim().slice(0, 80);
  const box = (el: Element): Box => {
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.x), y: Math.round(r.y + scrollY), w: Math.round(r.width), h: Math.round(r.height) };
  };
  const out: Finding[] = [];
  const add = (check: string, severity: Finding["severity"], el: Element, detail: string) => out.push({ check, severity, element: label(el), text: text(el), box: box(el), detail });
  const all = [...root.querySelectorAll("*")].filter(vis);
  const fixed = (el: Element) => {
    for (let x: Element | null = el; x; x = x.parentElement) if (getComputedStyle(x).position === "fixed") return true;
    return false;
  };

  // 1. Text that doesn't fit its control or heading.
  const FIT = "button, a, label, summary, [role=button], input, select, h1, h2, h3, h4";
  for (const el of all.filter((e) => e.matches(FIT))) {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    if (s.textOverflow === "ellipsis" && el.scrollWidth > el.clientWidth + 1) {
      add("text-cut", "low", el, "shortened with … (intended where space is short)");
      continue;
    }
    const range = document.createRange();
    range.selectNodeContents(el);
    const rects = [...range.getClientRects()].filter((q) => q.width > 0 && q.height > 0);
    if (!rects.length) continue;
    const t = rects.reduce((a, q) => ({ l: Math.min(a.l, q.left), r: Math.max(a.r, q.right), t: Math.min(a.t, q.top), b: Math.max(a.b, q.bottom) }), {
      l: Infinity,
      r: -Infinity,
      t: Infinity,
      b: -Infinity,
    });
    if (t.l < r.left - 1 || t.r > r.right + 1 || t.t < r.top - 1 || t.b > r.bottom + 1) {
      add("text-overflow", "high", el, `text ${Math.round(t.r - t.l)}×${Math.round(t.b - t.t)}px spills out of its ${Math.round(r.width)}×${Math.round(r.height)}px box`);
    } else if ((s.overflow.includes("hidden") || s.overflow.includes("clip")) && (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1)) {
      add("text-clipped", "high", el, `content ${el.scrollWidth}×${el.scrollHeight}px cut to ${el.clientWidth}×${el.clientHeight}px`);
    }
  }

  // 2. Controls and headings that overlap (not parent and child; fixed ones only against other fixed ones,
  //    since the page scrolls under them by design). Markers on the map are left out: they may cluster.
  const BLOCK = "button, a, input, select, textarea, h1, h2, h3, [role=button]";
  const blocks = all.filter((e) => e.matches(BLOCK) && !e.closest("#world-map, .leaflet-container"));
  for (let i = 0; i < blocks.length; i++)
    for (let j = i + 1; j < blocks.length; j++) {
      const a = blocks[i];
      const b = blocks[j];
      if (a.contains(b) || b.contains(a) || fixed(a) !== fixed(b)) continue;
      const p = a.getBoundingClientRect();
      const q = b.getBoundingClientRect();
      const w = Math.min(p.right, q.right) - Math.max(p.left, q.left);
      const h = Math.min(p.bottom, q.bottom) - Math.max(p.top, q.top);
      if (w > 3 && h > 3)
        out.push({
          check: "overlap",
          severity: w * h > 400 ? "high" : "medium",
          element: label(a),
          text: text(a),
          box: box(a),
          other: label(b),
          otherText: text(b),
          otherBox: box(b),
          detail: `overlap ${Math.round(w)}×${Math.round(h)}px`,
        });
    }

  // 3. A button left in the browser's own look.
  for (const e of all.filter((x) => x.matches("button"))) {
    const s = getComputedStyle(e);
    if (/^rgb\(2(39|40), 2(39|40), 2(39|40)\)$/.test(s.backgroundColor) && s.backgroundImage === "none") add("button-style", "medium", e, "looks like a plain browser button");
  }

  // 4. Sideways scrolling, and controls running off the screen.
  if (!scope && document.documentElement.scrollWidth > innerWidth + 1)
    out.push({ check: "sideways-scroll", severity: "high", element: "html", text: "", detail: `page is ${document.documentElement.scrollWidth}px wide in a ${innerWidth}px window` });
  for (const e of all.filter((x) => x.matches("button, a, input, select, img, h1, h2, h3") && !x.closest("#world-map, .leaflet-container"))) {
    const r = e.getBoundingClientRect();
    if (r.right > innerWidth + 2 || r.left < -2) add("off-screen", "high", e, `runs from ${Math.round(r.left)} to ${Math.round(r.right)}px in a ${innerWidth}px window`);
  }

  // 5. Broken images (images from other sites are blocked by the network fence, so only the site's own count).
  for (const img of all.filter((x): x is HTMLImageElement => x.tagName === "IMG")) {
    const src = img.getAttribute("src");
    if (img.complete && img.naturalWidth === 0 && src && new URL(src, location.href).origin === location.origin) add("broken-image", "high", img, `cannot load ${src}`);
  }

  // 6. Tap targets on phones (WCAG 2.5.8 asks for 24×24; aim for 44×44).
  if (phone)
    for (const e of all.filter((x) => x.matches("button, a, select, input:not([type=hidden]), [role=button]") && !x.closest(".leaflet-container"))) {
      const r = e.getBoundingClientRect();
      if (r.width < 24 || r.height < 24) add("tap-target", "medium", e, `${Math.round(r.width)}×${Math.round(r.height)}px, under WCAG 2.5.8's 24×24`);
      else if (r.width < 32 || r.height < 32) add("tap-target", "low", e, `${Math.round(r.width)}×${Math.round(r.height)}px (aim for at least 44×44 on phones)`);
    }
  return out;
}

/**
 * Text drawn over other text: two lines of text from different elements covering each other by more than a
 * third of a line height (and 3px across), so one or both can't be read. Fixed text is only compared with
 * other fixed text. Returns one finding per pair of elements.
 */
export function findTextOverlaps(scope: string | null): Finding[] {
  const root = (scope ? document.querySelector(scope) : document.body) as HTMLElement | null;
  if (!root) return [];
  const label = (el: Element) =>
    el.id ? `#${el.id}` : el.tagName.toLowerCase() + (typeof el.className === "string" && el.className.trim() ? "." + el.className.trim().split(/\s+/).join(".") : "");
  const shown = (el: Element) => {
    for (let x: Element | null = el; x && x !== document.documentElement; x = x.parentElement) {
      const s = getComputedStyle(x);
      if (s.display === "none" || s.visibility === "hidden" || +s.opacity < 0.05 || (x as HTMLElement).hidden) return false;
      const r = x.getBoundingClientRect();
      if ((s.clip && s.clip !== "auto") || (r.width <= 1 && r.height <= 1 && s.overflow !== "visible")) return false; // visually hidden
    }
    return true;
  };
  const control = (el: Element) => el.closest("button, a, label, h1, h2, h3");
  const fixed = (el: Element) => {
    for (let x: Element | null = el; x; x = x.parentElement) if (getComputedStyle(x).position === "fixed") return true;
    return false;
  };
  const owner = (el: Element) => {
    for (let x: Element | null = el; x && x !== root.parentElement; x = x.parentElement) if (x.id) return x;
    return el;
  };
  type Run = { el: Element; own: Element; fixed: boolean; text: string; rects: DOMRect[] };
  const runs: Run[] = [];
  const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => (n.nodeValue?.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT),
  });
  const cache = new Map<Element, boolean>();
  for (let n = walk.nextNode(); n; n = walk.nextNode()) {
    const el = n.parentElement;
    if (!el || el.closest("script, style, noscript, option, .leaflet-container")) continue;
    if (!cache.has(el)) cache.set(el, shown(el));
    if (!cache.get(el)) continue;
    const range = document.createRange();
    range.selectNodeContents(n);
    const rects = [...range.getClientRects()].filter((r) => r.width > 1 && r.height > 1);
    if (rects.length) runs.push({ el, own: owner(el), fixed: fixed(el), text: (n.nodeValue ?? "").replace(/\s+/g, " ").trim().slice(0, 60), rects });
  }
  const pairs = new Map<string, Finding>();
  for (let i = 0; i < runs.length; i++)
    for (let j = i + 1; j < runs.length; j++) {
      const a = runs[i];
      const b = runs[j];
      if (a.own === b.own || a.own.contains(b.own) || b.own.contains(a.own) || a.fixed !== b.fixed) continue;
      const ca = control(a.el);
      if (ca && ca === control(b.el)) continue;
      for (const p of a.rects)
        for (const q of b.rects) {
          const w = Math.min(p.right, q.right) - Math.max(p.left, q.left);
          const h = Math.min(p.bottom, q.bottom) - Math.max(p.top, q.top);
          const key = `${label(a.own)}|${label(b.own)}`;
          if (w > 3 && h > Math.max(3, Math.min(p.height, q.height) / 3) && !pairs.has(key))
            pairs.set(key, {
              check: "text-overlap",
              severity: "high",
              element: label(a.own),
              text: a.text,
              other: label(b.own),
              otherText: b.text,
              box: { x: Math.round(Math.max(p.left, q.left)), y: Math.round(Math.max(p.top, q.top) + scrollY), w: Math.round(w), h: Math.round(h) },
              detail: `text of ${label(a.own)} and ${label(b.own)} overlaps ${Math.round(w)}×${Math.round(h)}px`,
            });
        }
    }
  return [...pairs.values()];
}
