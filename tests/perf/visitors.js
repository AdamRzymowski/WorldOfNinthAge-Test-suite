// Performance (k6): virtual visitors loading the site's own files the way a
// browser does, and how fast they come back. Started by perf/run.mjs, which
// serves the site locally unless given another address (see README.md,
// "Performance tests").
//
// Only the site's own files are requested: never the CDNs, Google Fonts or
// OpenStreetMap's map tiles, whose rules don't allow load tests.
import http from "k6/http";
import { check, group, sleep } from "k6";
import exec from "k6/execution";

const BASE = (__ENV.BASE_URL || "http://localhost:8092").replace(/\/$/, "");
const PROFILE = __ENV.PROFILE || "smoke";
const LOCAL = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(BASE);

const PROFILES = {
  // One visitor for half a minute: does everything answer, and how fast.
  smoke: { vus: 1, duration: "30s" },
  // Quick and busy: up to 100 visitors at once, 5 minutes.
  load: {
    stages: [
      { duration: "1m", target: 100 },
      { duration: "3m", target: 100 },
      { duration: "1m", target: 0 },
    ],
  },
  // A crowd arriving (like a post on the Ninth Age forum): 0 to 200 visitors
  // in 2 minutes, half a minute at the peak, then down to 10 over 3 minutes.
  spike: {
    stages: [
      { duration: "2m", target: 200 },
      { duration: "30s", target: 200 },
      { duration: "3m", target: 10 },
    ],
  },
  // Long and quiet: 20 visitors for about 2 hours, to see that nothing wears
  // down. Never part of a usual run: npm run perf:soak only.
  soak: {
    stages: [
      { duration: "2m", target: 20 },
      { duration: "116m", target: 20 },
      { duration: "2m", target: 0 },
    ],
  },
};
// Soak: the first and last 20 minutes at full strength, compared in the
// report, so a slow creep shows (report/build.mjs).
const SOAK_EARLY = [2, 22];
const SOAK_LATE = [98, 118];

if (!PROFILES[PROFILE]) throw new Error(`Unknown profile "${PROFILE}": smoke, load or spike`);

export const options = {
  ...PROFILES[PROFILE],
  thresholds: {
    // Almost nothing may fail…
    http_req_failed: ["rate<0.01"],
    checks: ["rate>0.99"],
    // …and 95 in 100 answers come back within these times (milliseconds).
    "http_req_duration{kind:page}": ["p(95)<800"],
    "http_req_duration{kind:asset}": ["p(95)<1500"],
    "http_req_duration{kind:data}": ["p(95)<2000"],
    ...(PROFILE === "soak" ? { "http_req_duration{phase:early}": ["p(95)<2000"], "http_req_duration{phase:late}": ["p(95)<2000"] } : {}),
  },
};

const LANGUAGES = ["es", "fr", "de", "it", "pl", "sv", "nb", "da", "fi", "el", "cs", "uk"];
const DATA = ["data/communities.json", "data/countries-50m.json", "data/hitmap.json", "data/hitmap.png", "data/territories.json"];
const IMAGES = ["assets/ninth-age-logo.webp", "assets/banner.webp", "assets/world-map.webp", "assets/banner-logo.webp", "assets/knight-logo.webp", "assets/store-logo.webp"];

// Once, before the visitors: the site's scripts (app.js and everything it
// imports, followed through the files) and every logo on the map, so new ones
// are included without editing this file.
export function setup() {
  const home = http.get(`${BASE}/`);
  if (home.status !== 200) throw new Error(`${BASE}/ answered ${home.status}: is the site running?`);
  const scripts = new Set(["js/view.js", "js/app.js"]);
  for (const file of scripts) {
    const source = http.get(`${BASE}/${file}`).body || "";
    for (const [, name] of source.matchAll(/from\s+"\.\/([\w-]+\.js)"/g)) scripts.add(`js/${name}`);
  }
  const data = http.get(`${BASE}/data/communities.json`).json();
  const logos = Object.values(data.countries)
    .flat()
    .map((entry) => entry.logo)
    .filter((logo) => logo && !/^https?:/.test(logo));
  return { scripts: [...scripts], logos: [...new Set(logos)] };
}

// In a soak, which part of the run this is (see SOAK_EARLY and SOAK_LATE).
function phase() {
  if (PROFILE !== "soak") return {};
  const minute = exec.instance.currentTestRunDuration / 60000;
  if (minute >= SOAK_EARLY[0] && minute < SOAK_EARLY[1]) return { phase: "early" };
  if (minute >= SOAK_LATE[0] && minute < SOAK_LATE[1]) return { phase: "late" };
  return {};
}
const get = (path, kind) => ["GET", `${BASE}/${path}`, null, { tags: { kind, name: path.split("?")[0], ...phase() } }];
const allOk = (responses) => responses.every((r) => r.status === 200);
const pause = (min, max) => sleep(min + Math.random() * (max - min));

export default function ({ scripts, logos }) {
  // A new visitor: the page, then everything it loads, in parallel as a browser would.
  group("home page", () => {
    const page = http.get(`${BASE}/`, { tags: { kind: "page", name: "index.html", ...phase() } });
    check(page, {
      "home page answers": (r) => r.status === 200,
      "home page is the map": (r) => (r.body || "").includes("The World of Ninth Age Communities"),
    });
    const assets = http.batch([get("css/style.css", "asset"), get("css/phone.css", "asset"), ...scripts.map((s) => get(s, "asset"))]);
    check(assets, { "styles and scripts answer": allOk });
    const data = http.batch(DATA.map((d) => get(d, "data")));
    check(data, { "map data answers": allOk });
    const images = http.batch(IMAGES.map((i) => get(i, "asset")));
    check(images, { "images answer": allOk });
    // The approved submissions only exist on Netlify (a function).
    if (!LOCAL) check(http.get(`${BASE}/api/communities`, { tags: { kind: "data", name: "api/communities" } }), { "approved submissions answer": (r) => r.status === 200 });
  });
  pause(1, 3);

  // Most open a country: its logos; some in another language first.
  if (Math.random() < 0.7) {
    group("a country", () => {
      const requests = logos.slice(0, 12).map((l) => get(l, "asset"));
      if (Math.random() < 0.5) {
        const lang = LANGUAGES[Math.floor(Math.random() * LANGUAGES.length)];
        requests.push(get(`i18n/${lang}.json`, "data"), get("data/country-codes.json", "data"));
      }
      check(http.batch(requests), { "a country's files answer": allOk });
    });
    pause(2, 5);
  }

  // A few read the privacy page.
  if (Math.random() < 0.1) {
    group("privacy page", () => {
      check(http.get(`${BASE}/privacy.html`, { tags: { kind: "page", name: "privacy.html" } }), { "privacy page answers": (r) => r.status === 200 });
    });
    pause(1, 2);
  }
}
