/* TAP-THROUGH TESTS v1.0 — 2026-09-29
   A real browser walks the app the way a new member does, at phone size and
   at computer size, against a throwaway copy of the app (test/.tmp/e2e). It
   fails on crashes AND on glitches: a feed that repaints under your thumb, a
   count that moves twice, a menu that opens behind something, a screen that
   takes too long. Every bug we've fixed by hand gets a step here so it can't
   come back.

   Run:  npm run e2e        (needs Playwright + Chromium; CI installs them)
   On a failure the screenshot is in test/.tmp/e2e/shots/. */
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { spawn, execSync } from "node:child_process";
import { createRequire } from "node:module";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const TMP = join(ROOT, "test", ".tmp", "e2e"), DATA = join(TMP, "data"), SHOTS = join(TMP, "shots");
rmSync(TMP, { recursive: true, force: true });
mkdirSync(join(DATA, "uploads"), { recursive: true });
mkdirSync(SHOTS, { recursive: true });
const PORT = 8800 + Math.floor(Math.random() * 150), B = `http://localhost:${PORT}`;
const PASS = "longpassword123";

/* ---- Playwright: the project's copy (CI) or a global one (a dev box) ---- */
async function loadPlaywright() {
  try { return await import("playwright"); } catch {}
  const g = execSync("npm root -g").toString().trim();
  return createRequire(pathToFileURL(join(g, "noop.js")))("playwright");
}
const { chromium } = await loadPlaywright();
const exe = process.env.CHROMIUM_PATH || (process.env.PLAYWRIGHT_BROWSERS_PATH === "/opt/pw-browsers" ? "/opt/pw-browsers/chromium" : undefined);

/* ---- test media, made here: no fixtures to keep in git ---- */
// 1×1 PNGs in a few colours (browsers stretch them; the layout is what's tested)
const PNG = ["iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGNgYPgPAAEDAQAIicLsAAAAAElFTkSuQmCC",
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC",
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGNg+M8AAAICAQB7CYF4AAAAAElFTkSuQmCC"];
function wav(seconds, hz) {   // a sine tone, 16-bit mono 22.05kHz
  const rate = 22050, n = Math.floor(seconds * rate), buf = Buffer.alloc(44 + n * 2);
  buf.write("RIFF", 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write("WAVEfmt ", 8); buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22); buf.writeUInt32LE(rate, 24); buf.writeUInt32LE(rate * 2, 28);
  buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34); buf.write("data", 36); buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) buf.writeInt16LE(Math.round(Math.sin(2 * Math.PI * hz * i / rate) * 8000), 44 + i * 2);
  return buf;
}
for (let i = 0; i < 6; i++) writeFileSync(join(DATA, "uploads", `e2e-p${i}.png`), Buffer.from(PNG[i % 3], "base64"));
for (let i = 0; i < 3; i++) writeFileSync(join(DATA, "uploads", `e2e-t${i}.wav`), wav(3, 330 + 110 * i));
const UPLOAD_PNG = join(TMP, "upload.png");
writeFileSync(UPLOAD_PNG, Buffer.from(PNG[0], "base64"));

/* ---- seed: two members, published work, three tracks ---- */
writeFileSync(join(TMP, "seed.mjs"), `
process.env.TNL_DATA=${JSON.stringify(DATA)};
const { db } = await import(${JSON.stringify(pathToFileURL(join(ROOT, "src", "db.js")).href)});
const bcrypt = (await import("bcryptjs")).default;
const h = bcrypt.hashSync(${JSON.stringify(PASS)}, 4), now = Date.now();
const ins = db.prepare("INSERT INTO users (username,display_name,email,role,roles,password_hash,email_verified,created_at) VALUES (?,?,?,?,?,?,1,?)");
const me = Number(ins.run("tester","Tester","tester@example.com","Producer",'["Producer"]',h,now).lastInsertRowid);
const friend = Number(ins.run("friend","Friend","friend@example.com","Graphic Designer",'["Graphic Designer"]',h,now).lastInsertRowid);
const post = db.prepare("INSERT INTO posts (author_id,channel,body,image_url,thumb_url,media_w,media_h,is_work,created_at) VALUES (?,?,?,?,?,?,?,1,?)");
for (let i = 0; i < 6; i++) post.run(friend, "graphic-design", "Piece " + (i + 1), "/uploads/e2e-p" + i + ".png", "/uploads/e2e-p" + i + ".png", 800, 1000, now - i * 60000);
const tr = db.prepare("INSERT INTO tracks (user_id,title,url,artwork_url,description,duration_ms,bytes,created_at) VALUES (?,?,?,?,?,?,?,?)");
["Night Drive","Reagent","Paper Mode"].forEach((t, i) => tr.run(friend, t, "/uploads/e2e-t" + i + ".wav", "", "", 3000, 1000, now - i * 1000));
`);
execSync(`node --experimental-sqlite ${JSON.stringify(join(TMP, "seed.mjs"))}`, { cwd: ROOT, stdio: "pipe" });

/* ---- the app ---- */
const server = spawn(process.execPath, ["--experimental-sqlite", "src/server.js"], {
  cwd: ROOT, env: { ...process.env, TNL_DATA: DATA, PORT: String(PORT), PUBLIC_URL: B, SENTRY_DSN: "", ADMIN_EMAIL: "tester@example.com" }, stdio: ["ignore", "pipe", "pipe"] });
let serverLog = ""; server.stdout.on("data", (d) => (serverLog += d)); server.stderr.on("data", (d) => (serverLog += d));
const stop = () => { try { server.kill(); } catch {} };
process.on("exit", stop);
for (let i = 0; ; i++) {
  try { if ((await fetch(B + "/api/health")).ok) break; } catch {}
  if (i > 60) { console.log(serverLog); throw new Error("server didn't start"); }
  await new Promise((r) => setTimeout(r, 250));
}
const api = async (path, token, body) => (await fetch(B + path, {
  method: body ? "POST" : "GET", headers: { "content-type": "application/json", ...(token ? { authorization: "Bearer " + token } : {}) },
  body: body ? JSON.stringify(body) : undefined })).json();
const login = (u) => api("/api/auth/login", null, { identifier: u, username: u, password: PASS });

/* ---- runner ---- */
let pass = 0, fail = 0;
const browser = await chromium.launch({ executablePath: exe, args: ["--autoplay-policy=no-user-gesture-required"] });
async function device(name, opts) {
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  const problems = [];
  page.on("pageerror", (e) => problems.push("page error: " + e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) problems.push("console: " + m.text()); });
  return { name, ctx, page, problems };
}
async function step(d, title, fn) {
  const before = d.problems.length;
  try {
    await fn(d.page);
    if (d.problems.length > before) throw new Error(d.problems.slice(before).join(" | "));
    pass++; console.log(`  ✓  [${d.name}] ${title}`);
  } catch (e) {
    fail++; console.log(`  ✗  [${d.name}] ${title}\n       ${String(e.message || e).split("\n")[0]}`);
    await d.page.screenshot({ path: join(SHOTS, `${d.name}-${title.replace(/[^a-z0-9]+/gi, "-")}.png`) }).catch(() => {});
  }
}
const ok = (cond, msg) => { if (!cond) throw new Error(msg); };
async function throughDoor(p) {
  await p.waitForSelector("#enterOv", { timeout: 8000 }).catch(() => {});
  for (let k = 0; k < 25 && (await p.locator("#enterOv").count()); k++) {
    await p.locator("#enterOv").getByText("Enter the lab").click({ timeout: 1500 }).catch(() => {});
    await p.waitForTimeout(300);
  }
  ok(!(await p.locator("#enterOv").count()), "the door never opened");
}
async function signedIn(d, user) {
  const { token } = await login(user);
  await d.page.addInitScript((t) => { localStorage.setItem("tnl-token", t); localStorage.setItem("tnl-intro-seen", "1"); }, token);
  await d.page.goto(B + "/");
  await throughDoor(d.page);
  await d.page.waitForFunction(() => typeof ME !== "undefined" && ME && SITE && "studioOpen" in SITE, null, { timeout: 8000 });
  return token;
}
const fast = async (p, ms, fn, what) => { const t = Date.now(); await fn(); const took = Date.now() - t; ok(took < ms, `${what} took ${took}ms (limit ${ms}ms)`); };

/* ================= 1. A new member, on a phone ================= */
console.log("\nNEW MEMBER · PHONE");
{
  const d = await device("phone-new", { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const p = d.page;
  await step(d, "the door opens into the Showroom", async () => {
    await p.goto(B + "/");
    await throughDoor(p);
    await fast(p, 4000, () => p.waitForSelector("#sr-grid .sr-card"), "Showroom cards");
  });
  await step(d, "sign up: email → password → name → username → what you make", async () => {
    await p.locator("#joinBtn").tap();
    const nextOn = async () => { await p.waitForSelector("#gxnext:not([disabled])", { timeout: 4000 }); await p.locator("#gxnext").tap(); };
    await p.locator("#em").fill("newbie@example.com"); await nextOn();
    await p.locator("#pw").fill("a-good-password"); await nextOn();
    await p.locator("#dn").fill("New Member"); await nextOn();
    await p.locator("#un").fill("newmember"); await nextOn();   // waits for the live username check
    await p.locator(".gx-roles [data-r]").first().tap(); await nextOn();
    await p.waitForFunction(() => typeof ME !== "undefined" && ME && ME.username === "newmember", null, { timeout: 6000 });
  });
  await step(d, "photo and follow steps can be skipped, welcome lands in the app", async () => {
    for (let k = 0; k < 4 && (await p.locator("#gxskip").count()); k++) { await p.locator("#gxskip").tap(); await p.waitForTimeout(250); }
    if (await p.locator("#gxnext").count()) { await p.locator("#gxnext").tap(); await p.waitForTimeout(250); }
    await p.locator("#gxdone").tap({ timeout: 4000 });
    await p.waitForSelector(".app > .nav", { timeout: 4000 });
    ok(await p.evaluate(() => !GATE), "still inside the sign-up screens");
  });
  await d.ctx.close();
}

/* ================= 2. A member, on a phone ================= */
console.log("\nMEMBER · PHONE");
{
  const d = await device("phone", { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const p = d.page;
  const token = await signedIn(d, "tester");
  const card = () => p.evaluate(() => { const b = document.querySelector("#sr-grid [data-like]");
    return { id: b.dataset.like, on: b.classList.contains("on"), n: b.querySelector(".igact-n").textContent }; });
  const serverPost = async (id) => (await api("/api/feed/showroom", token)).posts.find((x) => String(x.id) === id);

  await step(d, "like: counts once, matches the server, feed doesn't repaint or jump", async () => {
    await p.evaluate(() => { TAB = "showroom"; render(); });
    await p.waitForSelector("#sr-grid [data-like]"); await p.waitForTimeout(600);
    await p.evaluate(() => { document.querySelector("#sr-grid .sr-card").dataset.mark = "e2e"; });
    await p.locator("#sr-grid [data-like]").first().scrollIntoViewIfNeeded(); await p.waitForTimeout(200);
    const scroll0 = await p.evaluate(() => document.getElementById("showroom").scrollTop);
    const c0 = await card();
    await p.locator("#sr-grid [data-like]").first().tap();
    await p.waitForTimeout(1200);
    const c1 = await card(), s = await serverPost(c0.id);
    ok(c1.id === c0.id, `the card under your thumb changed (${c0.id} → ${c1.id})`);
    ok(c1.on && Number(c1.n || 0) === Number(c0.n || 0) + 1, `count went ${c0.n || 0} → ${c1.n || 0}`);
    ok(s.likedByMe === true && s.likeCount === Number(c1.n), "screen and server disagree");
    ok(await p.evaluate(() => !!document.querySelector('#sr-grid .sr-card[data-mark="e2e"]')), "the feed repainted after a like");
    ok(await p.evaluate(() => document.getElementById("showroom").scrollTop) === scroll0, "the feed scrolled by itself");
  });
  await step(d, "five fast taps end where the server is", async () => {
    await p.evaluate(() => { const b = document.querySelector("#sr-grid [data-like]"); for (let i = 0; i < 5; i++) b.click(); });
    await p.waitForTimeout(1500);
    const c = await card(), s = await serverPost(c.id);
    ok(c.on === s.likedByMe && Number(c.n || 0) === s.likeCount, `screen ${c.on}/${c.n} vs server ${s.likedByMe}/${s.likeCount}`);
  });
  await step(d, "share keeps your place in the feed", async () => {
    await p.locator("#sr-grid [data-share]").nth(2).scrollIntoViewIfNeeded();
    const top = await p.evaluate(() => document.getElementById("showroom").scrollTop);
    ok(top > 0, "couldn't scroll the Showroom");
    await p.locator("#sr-grid [data-share]").nth(2).tap(); await p.waitForTimeout(400);
    ok(await p.evaluate(() => document.getElementById("showroom").scrollTop) === top, "share threw the feed to the top");
    await p.evaluate(() => closePicker()); await p.waitForTimeout(200);
  });
  await step(d, "share from an opened post: menu on top, Into a lab works", async () => {
    await p.evaluate(() => openPost(SRPOSTS[1])); await p.waitForSelector(".po-ov [data-share]");
    await p.locator(".po-ov [data-share]").first().tap(); await p.waitForTimeout(300);
    ok(await p.evaluate(() => { const e = document.elementFromPoint(innerWidth / 2, innerHeight * 0.7); return !!(e && e.closest(".pick")); }), "the share menu opened behind the post");
    await p.locator(".pick").getByText("Into a lab", { exact: true }).tap(); await p.waitForTimeout(300);
    await p.locator(".pick").getByText(/general/i).first().tap();
    await p.waitForFunction(() => /Shared to/.test(TOASTT || ""), null, { timeout: 4000 });
    await p.evaluate(() => { POSTOPEN = null; render(); });
  });
  await step(d, "post creator: add a photo, caption, share", async () => {
    const before = (await api("/api/users/tester", token)).posts?.length ?? 0;
    await p.locator('.nav [data-tab="post"]').tap();
    await p.waitForSelector("#pcfile", { state: "attached" });
    await p.locator("#pcfile").setInputFiles(UPLOAD_PNG);
    await p.locator("#pcbody").fill("Made in the e2e lab");
    await p.waitForSelector("#pcgo:not([disabled])", { timeout: 8000 });
    await p.locator("#pcgo").tap();
    await p.waitForFunction(() => !PCOMPOSE, null, { timeout: 8000 });
    const after = (await api("/api/users/tester", token)).posts?.length ?? 0;
    ok(after === before + 1, `profile posts ${before} → ${after}`);
  });
  await step(d, "Music: play, the bar shows, the sound moves, next track", async () => {
    await p.locator('.nav [data-tab="labs"]').tap();
    await p.locator('[data-lab="culture"]').first().tap();
    await fast(p, 3000, () => p.waitForSelector("[data-trkplay]"), "the Music lab's tracks");
    await p.locator("[data-trkplay]").first().tap(); await p.waitForTimeout(900);
    const s = await p.evaluate(() => ({ t: NOWPLAYING && NOWPLAYING.title, playing: !!AUDIO && !AUDIO.paused, at: AUDIO && AUDIO.currentTime,
      bar: getComputedStyle(document.querySelector(".nowbar")).display }));
    ok(s.t && s.playing && s.at > 0 && s.bar !== "none", "playback: " + JSON.stringify(s));
    await p.locator("[data-nownext]").tap(); await p.waitForTimeout(400);
    ok(await p.evaluate(() => NOWPLAYING && NOWPLAYING.title) !== s.t, "next didn't move on");
    await p.locator("[data-nowclose]").tap();
  });
  await step(d, "DM: open a chat, send a message, it arrives", async () => {
    await p.evaluate(() => openDM("friend")); await p.waitForSelector("#cxdraft");
    await p.locator("#cxdraft").fill("hey from e2e");
    await p.locator("#cxsend").tap(); await p.waitForTimeout(800);
    ok(await p.locator(".cx").getByText("hey from e2e").count() > 0, "the message isn't on screen");
    const { token: ft } = await login("friend");
    ok(JSON.stringify(await api("/api/chats", ft)).includes("hey from e2e") || JSON.stringify(await api("/api/dm", ft)).includes("hey from e2e"), "friend's inbox doesn't have it");
  });
  /* Glitch signals (app-19-glitch.js). Everything above is normal use, so it
     must have recorded nothing: no jumps, no slow screens, no failed saves. */
  const glitches = async () => { await p.evaluate(() => glFlush()); await p.waitForTimeout(600); return api("/api/admin/glitches", token); };
  await step(d, "normal use records no glitches", async () => {
    const g = await glitches();
    ok(!g.recent.length, "recorded: " + g.recent.map((x) => x.kind + " @ " + x.place + " " + x.detail).join(" | "));
  });
  await step(d, "rage taps are reported, with where they happened", async () => {
    await p.evaluate(() => { document.querySelector("#cxclose,#cxback")?.click(); DMOPENPANEL = false; CHAT = null; paintLayer(); TAB = "showroom"; PROFILE = null; render(); });
    await p.waitForSelector("#sr-grid [data-like]");
    const like = p.locator("#sr-grid [data-like]").last();
    await like.scrollIntoViewIfNeeded();
    for (let i = 0; i < 4; i++) await like.tap();          // the same button, still on screen, hammered
    const g = await glitches();
    ok(g.recent.some((x) => x.kind === "rage_tap" && x.detail === "[like]" && x.username === "tester" && x.device === "phone"), "no rage tap: " + JSON.stringify(g.recent));
    ok(g.byKind.some((k) => k.kind === "rage_tap" && k.day >= 1) && g.last24h >= 1, "the admin summary doesn't count it");
  });
  await d.ctx.close();
}

/* ================= 3. A member, on a computer ================= */
console.log("\nMEMBER · COMPUTER");
{
  const d = await device("computer", { viewport: { width: 1440, height: 900 } });
  const p = d.page;
  await signedIn(d, "tester");
  await step(d, "sidebar instead of a bottom bar", async () => {
    ok(await p.locator(".side").count() === 1 && (await p.locator(".app > .nav").count()) === 0, "wrong frame for a computer");
  });
  await step(d, "sidebar navigation: Labs, Market, Profile, Showroom", async () => {
    for (const [tab, sel] of [["labs", ".lx-list"], ["market", "#mktscroll"], ["profile", ".sheet.astab"], ["showroom", "#sr-grid"]]) {
      await p.locator(`.side [data-tab="${tab}"]`).click();
      await fast(p, 3000, () => p.waitForSelector(sel), tab);
    }
  });
  await step(d, "an opened post sits beside the sidebar", async () => {
    await p.evaluate(() => openPost(SRPOSTS[0])); await p.waitForSelector(".po-ov");
    const left = await p.evaluate(() => document.querySelector(".po-ov").getBoundingClientRect().left);
    ok(left >= 200, "the post covers the sidebar");
    await p.evaluate(() => { POSTOPEN = null; render(); });
  });
  await step(d, "admin → System shows the Glitches panel with the phone's rage tap", async () => {
    await p.goto(B + "/admin#system");
    await fast(p, 5000, () => p.locator("h2.sec", { hasText: "Glitches" }).first().waitFor(), "the admin System page");
    ok(await p.getByText(/× rage taps · /).count() > 0, "the rage tap isn't listed");
    ok(await p.getByText(/Glitches, 24h/).count() > 0, "no Glitches KPI");
    await p.screenshot({ path: join(SHOTS, "admin-glitches.png"), fullPage: false });
    await p.goto(B + "/"); await p.waitForFunction(() => typeof ME !== "undefined" && ME, null, { timeout: 8000 });
  });
  await step(d, "resizing to phone width switches to the phone frame", async () => {
    await p.setViewportSize({ width: 700, height: 900 }); await p.waitForTimeout(300);
    ok(await p.locator(".side").count() === 0 && (await p.locator(".app > .nav").count()) === 1, "didn't switch to the phone frame");
  });
  await d.ctx.close();
}

await browser.close();
stop();
console.log(`\n  ${pass} passed, ${fail} failed`);
if (fail) console.log("  screenshots of each failure: test/.tmp/e2e/shots/");
process.exit(fail ? 1 : 0);
