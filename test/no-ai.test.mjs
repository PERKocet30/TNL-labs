// Members' work is not AI training data (2026-10-07). robots.txt turns the AI
// training crawlers away and every response carries noai + TDMRep headers —
// while search engines and link previews (Instagram, iMessage, X) still work.
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { spawn } from "node:child_process";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(ROOT, "test/.tmp/no-ai");
rmSync(DATA, { recursive: true, force: true }); mkdirSync(join(DATA, "uploads"), { recursive: true });
writeFileSync(join(DATA, "uploads", "work.jpg"), Buffer.from([0xff, 0xd8, 0xff, 0xd9]));
let pass = 0, fail = 0;
const t = (n, ok) => { ok ? pass++ : fail++; console.log("  " + (ok ? "✓" : "✗") + "  " + n); };

const PORT = 18700 + (process.pid % 200);
const srv = spawn(process.execPath, ["--experimental-sqlite", "src/server.js"], { cwd: ROOT, env: { ...process.env, PORT: String(PORT), TNL_DATA: DATA }, stdio: ["ignore", "pipe", "pipe"] });
let log = ""; srv.stdout.on("data", (d) => log += d); srv.stderr.on("data", (d) => log += d);
for (let i = 0; i < 100 && !/listening/.test(log); i++) await new Promise((r) => setTimeout(r, 100));
const get = (path) => fetch(`http://127.0.0.1:${PORT}` + path);

/* Which user-agents robots.txt shuts out of "/" — the groups a crawler would match. */
const blocked = (txt, ua) => {
  const groups = []; let cur = null, lastWasAgent = false;
  for (const raw of txt.split("\n")) {
    const line = raw.replace(/#.*/, "").trim(); if (!line) continue;
    const [k, ...v] = line.split(":"); const key = k.trim().toLowerCase(), val = v.join(":").trim();
    if (key === "user-agent") { if (!lastWasAgent) groups.push(cur = { agents: [], rules: [] }); cur.agents.push(val.toLowerCase()); lastWasAgent = true; }
    else { lastWasAgent = false; if (cur) cur.rules.push([key, val]); }
  }
  const g = groups.find((x) => x.agents.includes(ua.toLowerCase())) || groups.find((x) => x.agents.includes("*"));
  return !!g && g.rules.some(([k, v]) => k === "disallow" && v === "/");
};

try {
  console.log("\nROBOTS.TXT");
  const r = await get("/robots.txt"), txt = await r.text();
  t("is served", r.ok && /User-agent/.test(txt));
  for (const ua of ["GPTBot", "ClaudeBot", "Google-Extended", "CCBot", "meta-externalagent", "Bytespider", "Applebot-Extended"])
    t(`${ua} is turned away`, blocked(txt, ua));
  for (const ua of ["Googlebot", "Bingbot", "facebookexternalhit", "Twitterbot", "Slackbot"])
    t(`${ua} still gets in (search and link previews)`, !blocked(txt, ua));

  console.log("\nHEADERS ON EVERYTHING");
  for (const path of ["/", "/uploads/work.jpg", "/api/feed/showroom"]) {
    const res = await get(path);
    t(`${path} says noai`, /noai/.test(res.headers.get("x-robots-tag") || "") && /noimageai/.test(res.headers.get("x-robots-tag") || ""));
    t(`${path} reserves text-and-data mining`, res.headers.get("tdm-reservation") === "1");
  }
  t("…and never noindex — people can still find TNL", !/noindex/.test((await get("/")).headers.get("x-robots-tag") || ""));
} catch (e) {
  fail++; console.log("  ✗  threw: " + e.message); console.log(log.slice(-1500));
} finally { srv.kill(); }
console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
