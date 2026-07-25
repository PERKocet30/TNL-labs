/* TNL LABS — production canary.

   READ-ONLY BY CONSTRUCTION. Every request here is a GET against a public
   route, and none of them write. That is not a convention to be relaxed
   later: this runs against the live database that holds real members'
   accounts, work and rep. If a check ever needs to create something, it
   belongs in the test environment suite, not in this file.

   What it exists to catch: the class of bug that unit tests structurally
   cannot see — a wrong status code, a wrong Content-Type, a shell that
   stops loading, an edge/proxy layer that starts mangling responses.
   Patch 051 shipped because /api/auth/verify was answering with
   application/octet-stream and Safari was saving it as a file. A single
   assertion here would have caught that the day it landed.

   Usage:  BASE=https://labs.tnllabs.com node canary.mjs
   Exit 0 = all green. Exit 1 = at least one failure (fails the cron run).
*/

const BASE = (process.env.BASE || "https://labs.tnllabs.com").replace(/\/+$/, "");
const TIMEOUT_MS = Number(process.env.CANARY_TIMEOUT || 15000);

const results = [];
let failed = 0;

function record(name, ok, detail) {
  results.push({ name, ok, detail });
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`);
}

async function get(path, opts = {}) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    return await fetch(`${BASE}${path}`, {
      signal: ctl.signal,
      redirect: "manual",
      headers: { "accept-encoding": "gzip", "user-agent": "tnl-canary/1", ...(opts.headers || {}) },
    });
  } finally {
    clearTimeout(t);
  }
}

/* A check is: fetch a public GET, assert the status and the content-type.
   Content-type is checked on purpose and everywhere — it is the exact
   thing that broke, and it is invisible to anything that only reads the
   response body. */
async function check(name, path, { status, type, contains } = {}) {
  try {
    const res = await get(path);
    const ct = (res.headers.get("content-type") || "").toLowerCase();
    if (status != null && res.status !== status)
      return record(name, false, `expected ${status}, got ${res.status}`);
    if (type && !ct.includes(type))
      return record(name, false, `expected content-type ~ ${type}, got "${ct || "(none)"}"`);
    if (contains) {
      const body = await res.text();
      if (!body.includes(contains))
        return record(name, false, `body missing marker ${JSON.stringify(contains)}`);
    }
    record(name, true, `${res.status} ${ct.split(";")[0] || "-"}`);
  } catch (e) {
    record(name, false, e.name === "AbortError" ? `timeout after ${TIMEOUT_MS}ms` : e.message);
  }
}

const started = Date.now();
console.log(`[canary] ${BASE} — ${new Date().toISOString()}`);

/* 1. The shell. If this is not HTML, nobody sees anything at all. */
await check("app shell loads as HTML", "/", { status: 200, type: "text/html" });

/* 2. The bug that cost us a rapper. An invalid token hits the same
      res.send(page(...)) path a real one does, so it proves the response
      is a rendered page and not a download — without consuming a token
      or writing a row. This is the whole reason the file exists. */
await check("verify page renders (not a download)", "/api/auth/verify?token=canary-not-a-real-token",
  { status: 400, type: "text/html" });

/* 3. Liveness, and the JSON surfaces a new arrival actually loads. */
await check("health responds", "/api/health", { status: 200, type: "json" });
await check("showroom feed serves JSON", "/api/feed/showroom", { status: 200, type: "json" });
await check("levels ladder serves JSON", "/api/levels", { status: 200, type: "json" });
await check("market browse serves JSON", "/api/market", { status: 200, type: "json" });
await check("builders list serves JSON", "/api/builders", { status: 200, type: "json" });

/* 4. A missing profile must 404 cleanly, not 500. A stranger following a
      dead link is a first impression too. */
await check("unknown profile 404s cleanly", "/api/users/canary-nobody-here", { status: 404 });

const ms = Date.now() - started;
console.log(`\n[canary] ${results.length - failed}/${results.length} passed in ${ms}ms`);

if (failed) {
  console.error(`[canary] FAILING CHECKS:\n` +
    results.filter((r) => !r.ok).map((r) => `  - ${r.name}: ${r.detail}`).join("\n"));
  process.exit(1);
}
process.exit(0);
