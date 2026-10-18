/* TNL LABS — the scientist.
   v2.0 — 2026-10-11: from "is it up" to "is it working". Checks the data is
   there (not a fresh empty volume), the pages Instagram visitors land on,
   that admin and /api stay locked and uncached, that the shell's scripts
   compile, the files the installed app needs, how long each answer takes,
   and the certificate. A failure prints the URL and what came back.

   READ-ONLY BY CONSTRUCTION. Every request here is a GET against a public
   route, and none of them write. That is not a convention to be relaxed
   later: this runs against the live database that holds real members'
   accounts, work and rep. If a check ever needs to create something, it
   belongs in the test environment suite, not in this file.

   What it exists to catch: the class of bug that unit tests structurally
   cannot see — a wrong status code, a wrong Content-Type, a shell that
   stops loading, Railway's edge or a proxy starting to mangle responses, a
   volume that came up empty. Patch 051 shipped because /api/auth/verify
   was answering with application/octet-stream and Safari was saving it as
   a file. A single assertion here would have caught that the day it landed.

   Usage:  BASE=https://www.tnllabs.com node scripts/scientist.mjs
   Exit 0 = all green. Exit 1 = at least one failure (fails the run).
   test/scientist.test.mjs runs it against a local copy, full and empty.
*/
import vm from "node:vm";
import tls from "node:tls";

const BASE = (process.env.BASE || "https://www.tnllabs.com").replace(/\/+$/, "");
const TIMEOUT_MS = Number(process.env.SCIENTIST_TIMEOUT || 15000);
const SLOW_MS = Number(process.env.SCIENTIST_SLOW || 2500);   // warn: a person notices
const TOO_SLOW_MS = Number(process.env.SCIENTIST_TOO_SLOW || 8000); // fail: a person leaves

const results = [];
const warnings = [];
let failed = 0;

function record(name, ok, detail) {
  results.push({ name, ok, detail });
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`);
}

async function get(path, headers = {}) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  const url = /^https?:/.test(path) ? path : `${BASE}${path}`;
  const t0 = Date.now();
  try {
    const res = await fetch(url, {
      signal: ctl.signal,
      redirect: "manual",
      headers: { "accept-encoding": "gzip", "user-agent": "tnl-scientist/2", ...headers },
    });
    const buf = Buffer.from(await res.arrayBuffer());
    return { url, res, status: res.status, buf, ms: Date.now() - t0,
      ct: (res.headers.get("content-type") || "").toLowerCase(), h: (k) => (res.headers.get(k) || "").toLowerCase() };
  } finally {
    clearTimeout(t);
  }
}

/* Enough of what came back to see why, without opening a browser. */
const why = (r) => `${r.url} → ${r.status} ${r.ct.split(";")[0] || "-"}` +
  ` "${r.buf.toString("utf8", 0, 160).replace(/\s+/g, " ")}"` +
  (r.h("x-railway-request-id") ? ` railway-request=${r.h("x-railway-request-id")}` : "");

/* A check is: fetch a public GET, assert status and content-type (checked on
   purpose and everywhere — it is the exact thing that broke, and invisible
   to anything that only reads the body), then any `test(r)` which returns
   an error string or nothing. Returns the response for checks that follow. */
async function check(name, path, { status, type, test, headers } = {}) {
  let r;
  try { r = await get(path, headers); }
  catch (e) { record(name, false, `${BASE}${path} — ${e.name === "AbortError" ? `timeout after ${TIMEOUT_MS}ms` : e.message}`); return null; }
  if (status != null && (Array.isArray(status) ? !status.includes(r.status) : r.status !== status))
    { record(name, false, `expected ${status}, got: ${why(r)}`); return r; }
  if (type && !r.ct.includes(type))
    { record(name, false, `expected content-type ~ ${type}, got: ${why(r)}`); return r; }
  if (r.ms > TOO_SLOW_MS) { record(name, false, `took ${r.ms}ms (limit ${TOO_SLOW_MS}ms): ${r.url}`); return r; }
  if (test) {
    let err;
    try { err = test(r); } catch (e) { err = `couldn't read it (${e.message}): ${why(r)}`; }
    if (err) { record(name, false, err); return r; }
  }
  if (r.ms > SLOW_MS) warnings.push(`${name}: ${r.ms}ms`);
  record(name, true, `${r.status} ${r.ct.split(";")[0] || "-"} ${r.ms}ms`);
  return r;
}

const json = (r) => JSON.parse(r.buf.toString("utf8"));
const html = (r) => r.buf.toString("utf8");
const meta = (s, k) => { const m = new RegExp(`<meta (?:property|name)="${k}" content="([^"]*)"`).exec(s); return m && m[1].replace(/&amp;/g, "&"); };

const started = Date.now();
console.log(`[scientist] ${BASE} — ${new Date().toISOString()}`);

/* 1. The shell. If this is not the app, nobody sees anything at all. A 200
      HTML page from a proxy would pass a status check, so look for the app
      itself, and compile its scripts: parts are joined byte for byte, and a
      syntax error at a seam is a blank screen behind a perfect 200. */
await check("app shell loads as HTML", "/", { status: 200, type: "text/html", test: (r) => {
  const s = html(r);
  if (!s.includes('id="app"')) return `no id="app" in the page — not the app: ${why(r)}`;
  if (!/must-revalidate|no-cache|no-store/.test(r.h("cache-control")))
    return `cache-control "${r.h("cache-control")}" — after a deploy, people would keep the old app`;
  const inline = [...s.matchAll(/<script(?![^>]*\b(?:src|type)=)[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]).filter((x) => x.trim());
  if (!inline.length) return "no inline scripts in the shell";
  for (const [i, code] of inline.entries()) {
    try { new vm.Script(code, { filename: `shell-script-${i}.js` }); }
    catch (e) { return `the app's script #${i} doesn't compile: ${e.message}`; }
  }
}});

/* 2. The bug that cost us a rapper. An invalid token hits the same
      res.send(page(...)) path a real one does, so it proves the response
      is a rendered page and not a download — without consuming a token
      or writing a row. This is the whole reason the file exists. */
await check("verify page renders (not a download)", "/api/auth/verify?token=scientist-not-a-real-token",
  { status: 400, type: "text/html" });

/* 3. Health, and what's behind it. "Up" isn't "working": a volume that
      didn't mount boots a fresh, empty database and every page still 200s. */
await check("health responds", "/api/health", { status: 200, type: "json", test: (r) => {
  const c = json(r).checks;
  if (!c) return "health doesn't report checks (old server?)";
  const bad = Object.entries({
    db: "the database doesn't answer",
    members: "no members — this is an empty database, not ours",
    volume: "TNL_DATA isn't set — data is going to the container, and is lost on the next deploy",
    uploads: "the uploads folder is missing",
    backup: "no backup in the last 36 hours",
  }).filter(([k]) => !c[k]).map(([, msg]) => msg);
  if (bad.length) return bad.join("; ");
}});

/* 4. /api never cached, and the session never leaks. If any cache in front
      of the app ever stored /api/me, one person's account would be served
      to the next. An Age header means a cache answered, not the app. */
await check("signed out, /api/me says no", "/api/me", { status: 401, type: "json", test: (r) => {
  if (!r.h("cache-control").includes("no-store")) return `cache-control "${r.h("cache-control")}" — /api must be no-store`;
  if (r.h("age")) return `a cache in front of the app answered /api/me (age ${r.h("age")})`;
}});
for (const p of ["/api/admin/overview", "/api/admin/members", "/api/admin/backups"])
  await check(`admin stays locked: ${p}`, p, { status: [401, 403], type: "json" });
// the morning report: 401 without its key (404 where no key is set) — never open
await check("the morning report stays locked", "/api/report/daily", { status: [401, 404], type: "json" });

/* 5. What a new arrival loads — and that there's something in it. */
const show = await check("showroom has work in it", "/api/feed/showroom", { status: 200, type: "json", test: (r) => {
  const j = json(r);
  if (!Array.isArray(j.posts) || !j.posts.length) return "the front page is empty";
}});
await check("levels ladder serves JSON", "/api/levels", { status: 200, type: "json", test: (r) => {
  const j = json(r);
  if (!Array.isArray(j.levels) || !j.levels.length) return "no levels";
  if (!j.site) return "no site settings";
}});
await check("market browse serves JSON", "/api/market", { status: 200, type: "json",
  test: (r) => Array.isArray(json(r).listings) ? null : "no listings array" });
await check("builders list serves JSON", "/api/builders", { status: 200, type: "json",
  test: (r) => Array.isArray(json(r).builders) ? null : "no builders array" });
await check("events serve JSON", "/api/events", { status: 200, type: "json",
  test: (r) => Array.isArray(json(r).events) ? null : "no events array" });

/* 6. Where Instagram sends people: a profile and a post, as a link preview
      sees them (crawlers don't run JS — the tags must be in the HTML), the
      preview image itself, and the profile card people share. Picked from
      the live showroom, so nothing here is hardcoded to one member. */
let post = null;
try { post = show && json(show).posts?.find((p) => p.author?.username); } catch {}
if (post) {
  const who = encodeURIComponent(post.author.username);
  const ig = { "user-agent": "facebookexternalhit/1.1" };
  const page = async (name, path, back) => {
    let img = null;
    await check(name, path, { status: 200, type: "text/html", headers: ig, test: (r) => {
      const s = html(r);
      img = meta(s, "og:image");
      if (!img) return "no og:image — the link shows no preview card";
      if (!/^https?:\/\//.test(img)) return `og:image isn't a full address: ${img}`;
      if (!meta(s, "og:title")) return "no og:title";
      if (!s.includes(`href="${back}"`)) return `"Open in the app" doesn't go to ${back}`;
    }});
    if (img) await check(`${name}: preview image loads`, img, { status: 200, type: "image/" });
  };
  await page("a profile page previews", `/u/${who}`, `/?u=${post.author.username}`);
  await page("a post page previews", `/p/${post.id}`, `/?p=${post.id}`);
  await check("the profile card renders", `/u/${who}/card.jpg`, { status: 200, type: "image/jpeg" });
  await check("the app opens on a shared profile", `/?u=${who}`, { status: 200, type: "text/html",
    test: (r) => html(r).includes('id="app"') ? null : "not the app" });
} else {
  record("a profile and a post to check", false, "the showroom gave none — visitor pages unchecked");
}

/* 7. A missing thing must 404 cleanly, not 500. A stranger following a
      dead link is a first impression too. */
await check("unknown profile 404s cleanly", "/api/users/scientist-nobody-here", { status: 404 });
await check("unknown post 404s cleanly", "/api/posts/999999999", { status: 404 });

/* 8. The files the installed app and the admin need. A broken service
      worker strands people on an old copy of the app. */
await check("service worker", "/sw.js", { status: 200, type: "javascript",
  test: (r) => /must-revalidate|no-cache|no-store/.test(r.h("cache-control")) ? null : `cache-control "${r.h("cache-control")}" — the old worker would stick` });
await check("app manifest", "/manifest.webmanifest", { status: 200, test: (r) => json(r).name ? null : "no name in the manifest" });
await check("palette stylesheet", "/palette.css", { status: 200, type: "text/css" });
await check("door script", "/door.js", { status: 200, type: "javascript" });
await check("app icon", "/icon-512.png", { status: 200, type: "image/png" });
await check("robots.txt", "/robots.txt", { status: 200, type: "text/plain" });
await check("sitemap for search engines", "/sitemap.xml", { status: 200, type: "application/xml" });

/* 9. The certificate. When it lapses every browser shows a red warning page
      and no check above can say why. Fail with two weeks to spare. */
if (BASE.startsWith("https://")) {
  const host = new URL(BASE).hostname;
  try {
    const days = await new Promise((ok, no) => {
      const s = tls.connect({ host, port: 443, servername: host, timeout: TIMEOUT_MS }, () => {
        const c = s.getPeerCertificate(); s.end();
        ok(Math.floor((new Date(c.valid_to) - Date.now()) / 86400000));
      });
      s.on("error", no); s.on("timeout", () => { s.destroy(); no(new Error("timeout")); });
    });
    record("certificate has time left", days >= 14, `${days} days`);
  } catch (e) { record("certificate has time left", false, e.message); }
}

const ms = Date.now() - started;
console.log(`\n[scientist] ${results.length - failed}/${results.length} passed in ${ms}ms`);
if (warnings.length) console.log(`[scientist] slow (over ${SLOW_MS}ms):\n` + warnings.map((w) => `  - ${w}`).join("\n"));

if (failed) {
  console.error(`[scientist] FAILING CHECKS:\n` +
    results.filter((r) => !r.ok).map((r) => `  - ${r.name}: ${r.detail}`).join("\n"));
  process.exit(1);
}
process.exit(0);
