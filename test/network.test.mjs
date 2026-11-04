// THE NETWORK v1.0 — 2026-11-04: "Make the whole admin dashboard interactive", organised like the LABS Blueprint.
// GET /api/admin/network — a member's path (arrive → talk) with each stage's numbers and what needs you there, the outside
// services and the foundations. Admins only; counts only; never a key or a name.
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { rmSync, mkdirSync } from "node:fs";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(ROOT, "test/.tmp/network");
rmSync(DATA, { recursive: true, force: true }); mkdirSync(DATA, { recursive: true });
process.env.TNL_DATA = DATA;
const { db } = await import(join(ROOT, "src/db.js"));
let pass = 0, fail = 0;
const t = (n, ok) => { ok ? pass++ : fail++; console.log("  " + (ok ? "✓" : "✗") + "  " + n); };
const now = Date.now();
const mk = (u, admin = 0) => { const id = Number(db.prepare(`INSERT INTO users (username, display_name, email, password_hash, created_at, email_verified, is_admin) VALUES (?,?,?,?,?,1,?)`)
  .run(u, u, u + "@x.test", "x", now, admin).lastInsertRowid); db.prepare(`INSERT INTO sessions (token, user_id, created_at) VALUES (?,?,?)`).run("tok-" + u, id, now); return id; };
mk("boss", 1); const ana = mk("ana"), ben = mk("ben");
const post = Number(db.prepare(`INSERT INTO posts (author_id, channel, body, image_url, is_work, created_at) VALUES (?,?,?,?,1,?)`).run(ana, "graphic-design", "piece", "/uploads/x.png", now).lastInsertRowid);
db.prepare(`INSERT INTO reports (reporter_id, post_id, reason, created_at) VALUES (?,?,?,?)`).run(ben, post, "spam", now);
db.close();

const PORT = 8933;
const srv = spawn(process.execPath, ["--experimental-sqlite", "--no-warnings", "src/server.runtime.js"], {
  cwd: ROOT, stdio: "ignore", env: { ...process.env, TNL_DATA: DATA, PORT: String(PORT), TNL_NO_VIDEO_FIX: "1", TNL_NO_WATCH: "1", PUBLIC_URL: `http://localhost:${PORT}`,
    STRIPE_SECRET_KEY: "sk_test_SECRETSTRIPE", RESEND_API_KEY: "", ECHO_AI_KEY: "sk-ant-SECRETCLAUDE" } });
const get = async (tok) => { const r = await fetch(`http://localhost:${PORT}/api/admin/network`, { headers: tok ? { Authorization: "Bearer " + tok } : {} }); return { s: r.status, text: await r.text() }; };
try {
  for (let i = 0; i < 100; i++) { try { if ((await fetch(`http://localhost:${PORT}/api/health`)).ok) break; } catch {} await new Promise((r) => setTimeout(r, 100)); }
  console.log("\nWHO MAY SEE IT");
  t("signed out: 401", (await get()).s === 401);
  t("a member: 403", (await get("tok-ana")).s === 403);
  const r = await get("tok-boss"); t("an admin: 200", r.s === 200);
  const j = JSON.parse(r.text), S = Object.fromEntries(j.stages.map((s) => [s.id, s])), O = Object.fromEntries(j.outside.map((s) => [s.id, s])), F = Object.fromEntries(j.base.map((s) => [s.id, s]));

  console.log("\nA MEMBER'S PATH (the Blueprint's order)");
  t("eight stages, in order: arrive → join → see → make → respond → earn → trade → talk", j.stages.map((s) => s.id).join(" ") === "arrive join see make respond earn trade talk");
  t("each has a number now, the one before, what it counts, its needs and the page that runs it", j.stages.every((s) => typeof s.value === "number" && typeof s.before === "number" && s.label && s.says && Array.isArray(s.needs) && Array.isArray(s.facts) && s.go && s.goName));
  t("Join: 3 new members in the window", S.join.value === 3);
  t("Make: 1 piece of work posted", S.make.value === 1);
  t("the open report needs you on Respond", S.respond.needs.some((n) => /1 open report/.test(n.text)));
  t("new members who haven't posted need you on Join", S.join.needs.some((n) => /haven't posted/.test(n.text)));
  t("Trade is money, and nothing there needs you", S.trade.money === true && S.trade.needs.length === 0);
  console.log("\nTHE TO-DO (Echo Home's model)");
  const SC = Object.fromEntries((j.sections || []).map((s) => [s.id, s]));
  t("every section of the dashboard, each with a number and its needs", ["people", "market", "content", "events", "instagram", "knowledge", "echo", "analytics", "health", "settings"].every((id) => SC[id] && typeof SC[id].value === "number" && Array.isArray(SC[id].needs)));
  t("the open report sits on Content, the new members on Members, the backups on Health; Market is clear", SC.content.needs.some((n) => /open report/.test(n.text)) && SC.people.needs.some((n) => /haven't posted/.test(n.text)) && SC.health.needs.some((n) => /backup/i.test(n.text)) && SC.market.needs.length === 0);
  t("the date range moves the window", JSON.parse((await (await fetch(`http://localhost:${PORT}/api/admin/network?days=7`, { headers: { Authorization: "Bearer tok-boss" } })).text())).days === 7);

  console.log("\nOUTSIDE AND UNDERNEATH");
  t("outside: the services, with their states", ["stripe", "resend", "claude", "railway", "github", "cloudflare", "meta"].every((id) => O[id] && ["on", "warn", "wait", "off"].includes(O[id].state)));
  t("Stripe and Claude keys set: on; Resend's not: off", O.stripe.state === "on" && O.claude.state === "on" && O.resend.state === "off");
  t("foundations: the server (named Server), the database, phones and trust", F.labs && F.labs.name === "Server" && F.data && F.members && F.trust);
  t("no backups: the server needs a look", F.labs.state === "warn" && /backup/i.test(F.labs.line));
  t("never a key, an email or a report's words", !/SECRETSTRIPE|SECRETCLAUDE|x\.test|"spam"/.test(r.text) && !/"reason"/.test(r.text));
} finally { srv.kill(); }
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
