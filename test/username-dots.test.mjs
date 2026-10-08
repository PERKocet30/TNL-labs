// A username ending in "." (2026-10-08): Instagram and iMessage drop a
// link's final "." as punctuation, so /u/xstart. arrived as /u/xstart and
// showed "Not found". Old links still find the person, links we make keep
// the dot (as %2E), and new usernames can't end in "." any more.
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { rmSync, mkdirSync, readFileSync } from "node:fs";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(ROOT, "test/.tmp/username-dots");
rmSync(DATA, { recursive: true, force: true }); mkdirSync(DATA, { recursive: true });
process.env.TNL_DATA = DATA;
const { db } = await import(join(ROOT, "src/db.js"));
const now = Date.now();
const U = (n) => db.prepare(`INSERT INTO users (username,display_name,email,role,password_hash,email_verified,rep,created_at) VALUES (?,?,?,?,?,1,0,?)`).run(n, "N", n.replace(/\W/g, "") + Math.random() + "@x.com", "Model", "h", now);
U("xstart."); U("twin"); U("twin."); U("a_b.");
const PORT = 8874, BASE = `http://localhost:${PORT}`;
let pass = 0, fail = 0;
const t = (n, ok) => { ok ? pass++ : fail++; console.log("  " + (ok ? "✓" : "✗") + "  " + n); };
const srv = spawn(process.execPath, ["--experimental-sqlite", "--no-warnings", "src/server.runtime.js"], {
  cwd: ROOT, env: { ...process.env, TNL_DATA: DATA, PORT: String(PORT), STRIPE_SECRET_KEY: "" }, stdio: "ignore" });
try {
  for (let i = 0; i < 100; i++) { try { if ((await fetch(BASE + "/api/health")).ok) break; } catch {} await new Promise((r) => setTimeout(r, 100)); }
  const get = (p) => fetch(BASE + p, { redirect: "manual" });

  console.log("\nOLD LINKS THAT LOST THE DOT");
  let r = await get("/u/xstart");
  t("/u/xstart sends you to xstart.'s page", r.status === 301 && r.headers.get("location") === "/u/xstart%2E");
  r = await get("/u/xstart%2E");
  const html = await r.text();
  t("…which opens, with a canonical link that keeps the dot", r.status === 200 && html.includes('href="http://localhost:8874/u/xstart%2E"'));
  t("/u/xstart. still works as typed", (await get("/u/xstart.")).status === 200);
  t("the app's profile lookup finds them too", (await (await get("/api/users/xstart")).json()).user?.username === "xstart.");
  t("an exact name always wins (twin isn't sent to twin.)", (await get("/u/twin")).status === 200);
  t("a name that isn't anyone's is still not found", (await get("/u/nobody")).status === 404);
  t("an underscore name isn't confused by LIKE", (await (await get("/api/users/a_b")).json()).user?.username === "a_b.");
  t("…and a_x doesn't match a_b.", (await get("/u/a_x")).status === 404);

  console.log("\nNEW USERNAMES");
  const chk = await (await get("/api/auth/username?u=newname.")).json();
  t("the name check says a final dot isn't valid", chk.valid === false);
  const reg = await (await fetch(BASE + "/api/auth/register", { method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: "newname.", displayName: "N", email: "n@x.com", password: "longpassword123", roles: ["Model"] }) })).json();
  t("signup refuses it", /bad username|invite-only/.test(reg.error || ""));

  console.log("\nLINKS THE APP SHARES");
  const app = readFileSync(join(ROOT, "public/index.html"), "utf8");
  const profileLink = new Function("location", app.match(/const profileLink=[^;]+;/)[0] + "return profileLink;")({ origin: "https://labs.tnllabs.com" });
  t("share / copy links spell a final dot as %2E", profileLink("xstart.") === "https://labs.tnllabs.com/u/xstart%2E" && profileLink("tnllabs") === "https://labs.tnllabs.com/u/tnllabs");
  t("every share and copy uses it", (app.match(/location\.origin\+"\/u\/"\+/g) || []).length === 1);
  t("an opened %2E link is decoded before routing", app.includes("path=decodeURIComponent(path)"));
} finally { srv.kill(); }
console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
