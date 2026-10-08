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
import { spawn, execSync, execFileSync } from "node:child_process";
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
const UPLOAD_PNG2 = join(TMP, "upload2.png"), UPLOAD_PNG3 = join(TMP, "upload3.png");
/* A 6-second clip for the video editor — WebM, because this Chromium has no H.264. */
const UPLOAD_WEBM = join(TMP, "clip.webm");
execFileSync((await import("ffmpeg-static")).default, ["-hide_banner", "-loglevel", "error", "-y", "-f", "lavfi", "-i", "testsrc=size=320x240:rate=25:duration=6",
  "-f", "lavfi", "-i", "sine=frequency=440:duration=6", "-c:v", "libvpx", "-b:v", "300k", "-c:a", "libvorbis", "-shortest", UPLOAD_WEBM]);
writeFileSync(UPLOAD_PNG2, Buffer.from(PNG[1], "base64")); writeFileSync(UPLOAD_PNG3, Buffer.from(PNG[2], "base64"));

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
// friend's session, so the poll step needn't sign in again (logins are rate-limited)
db.prepare("INSERT INTO sessions (token,user_id,created_at) VALUES (?,?,?)").run("e2e-friend-session", friend, now);
for (let i = 0; i < 6; i++) post.run(friend, "graphic-design", "Piece " + (i + 1), "/uploads/e2e-p" + i + ".png", "/uploads/e2e-p" + i + ".png", 800, 1000, now - i * 60000);
// Piece 1 is a six-frame series (a carousel)
db.prepare("UPDATE posts SET images = ? WHERE body = 'Piece 1'").run(JSON.stringify([0, 1, 2, 3, 4, 5].map((i) => ({ url: "/uploads/e2e-p" + i + ".png", thumb: "/uploads/e2e-p" + i + ".png", w: 800, h: 1000 }))));
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
  await step(d, "the door is white with the black mark, then opens into the Showroom", async () => {
    await p.goto(B + "/");
    await p.waitForSelector("#enterOv .enter-m", { timeout: 8000 });
    const door = await p.evaluate(() => ({ bg: getComputedStyle(document.querySelector("#enterOv")).backgroundColor,
      mark: getComputedStyle(document.querySelector("#enterOv .enter-m")).filter }));
    ok(door.bg === "rgb(255, 255, 255)" && door.mark === "invert(1)", "door: " + JSON.stringify(door));
    await throughDoor(p);
    await fast(p, 4000, () => p.waitForSelector("#sr-grid .sr-card"), "Showroom cards");
  });
  await step(d, "night mode: the moon switches to night, the sun back to day, and it sticks", async () => {
    const th = () => p.evaluate(() => ({ attr: document.documentElement.dataset.theme, bg: getComputedStyle(document.body).backgroundColor,
      saved: localStorage.getItem("tnl-theme"), btn: document.querySelector("[data-theme-set]")?.dataset.themeSet }));
    const t0 = await th();
    ok(t0.attr === "light" && t0.btn === "dark", "didn't start in day mode: " + JSON.stringify(t0));
    await p.locator(".top [data-theme-set]").tap(); await p.waitForTimeout(200);
    const t1 = await th();
    ok(t1.attr === "dark" && t1.bg === "rgb(0, 0, 0)" && t1.saved === "dark" && t1.btn === "light", "night didn't switch on: " + JSON.stringify(t1));
    await p.reload(); await p.waitForTimeout(600);
    ok((await th()).attr === "dark", "night didn't survive a reload");
    await throughDoor(p);
    await p.locator(".top [data-theme-set]").tap(); await p.waitForTimeout(200);
    const t2 = await th();
    ok(t2.attr === "light" && t2.bg === "rgb(255, 255, 255)" && t2.saved === "light", "day didn't come back: " + JSON.stringify(t2));
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
  await step(d, "carousel: starts on 1, counter follows the swipe, a refresh keeps your slide", async () => {
    await p.evaluate(() => { POSTOPEN = null; TAB = "showroom"; render(); });
    const sel = "#sr-grid [data-caro] .caro-t";
    await p.waitForSelector(sel); await p.locator(sel).first().scrollIntoViewIfNeeded(); await p.waitForTimeout(500);
    const at = () => p.evaluate((s) => { const t = document.querySelector(s), c = t.closest("[data-caro]");
      return { i: Math.round(t.scrollLeft / t.clientWidth), n: c.querySelector(".caro-n").textContent }; }, sel);
    let a = await at(); ok(a.i === 0 && a.n.startsWith("1/"), `didn't start on slide 1 (${JSON.stringify(a)})`);
    // the layout moving it, with no finger on it, must not leave it on another slide
    await p.evaluate((s) => { const t = document.querySelector(s); t.scrollLeft = t.clientWidth * 4; }, sel); await p.waitForTimeout(300);
    a = await at(); ok(a.i === 0 && a.n.startsWith("1/"), `a scroll nobody made moved it to ${JSON.stringify(a)}`);
    // a swipe: the counter must change while the frames move, not after they stop
    const seen = await p.evaluate((s) => new Promise((done) => {
      const t = document.querySelector(s), w = t.clientWidth, n = t.closest("[data-caro]").querySelector(".caro-n"), out = [];
      t.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true })); t.style.scrollSnapType = "none";
      let x = 0; const tick = () => { x += w / 12; t.scrollLeft = x;
        requestAnimationFrame(() => { out.push(n.textContent); if (x < w * 2.2) requestAnimationFrame(tick); else { t.style.scrollSnapType = ""; done(out); } }); };
      tick(); }), sel);
    ok(seen.slice(0, 10).includes("2/6"), `the counter lagged the swipe (${seen.slice(0, 10).join(" ")})`);
    await p.waitForTimeout(300); a = await at(); ok(a.n === "3/6" && a.i === 2, `landed wrong (${JSON.stringify(a)})`);
    await p.evaluate(() => render()); await p.waitForTimeout(400);
    a = await at(); ok(a.n === "3/6" && a.i === 2, `a refresh threw it back (${JSON.stringify(a)})`);
    const id = await p.evaluate((s) => document.querySelector(s).closest("[data-caro]").dataset.caro.replace(/^s/, ""), sel);
    await p.evaluate((id) => openPostById(Number(id)), id); await p.waitForSelector("#poov [data-caro]"); await p.waitForTimeout(400);
    const o = await p.evaluate(() => { const t = document.querySelector("#poov [data-caro] .caro-t"); return { i: Math.round(t.scrollLeft / t.clientWidth), n: t.closest("[data-caro]").querySelector(".caro-n").textContent }; });
    ok(o.i === 0 && o.n.startsWith("1/"), `the opened post didn't start on slide 1 (${JSON.stringify(o)})`);
    await p.evaluate(() => { POSTOPEN = null; render(); });
  });
  /* Fluid (app-09-motion.js): places are kept, the tab glides you up,
     double-tap likes, screens move. */
  const srTop = () => p.evaluate(() => document.getElementById("showroom")?.scrollTop ?? -1);
  await step(d, "back from a profile lands where you were in the feed", async () => {
    await p.evaluate(() => { TAB = "showroom"; PROFILE = null; render(); });
    await p.waitForSelector("#sr-grid .sr-card");
    await p.evaluate(() => { document.getElementById("showroom").scrollTop = 1200; }); await p.waitForTimeout(150);
    const y = await srTop(); ok(y > 600, "couldn't scroll the Showroom");
    ok(await p.evaluate(() => { openProfile("friend"); return !!document.querySelector("#app .sheet.mv-in"); }), "the profile didn't slide in");
    await p.waitForFunction(() => PROFILE && PROFILE.user, null, { timeout: 5000 });
    await p.evaluate(() => history.back()); await p.waitForFunction(() => !PROFILE, null, { timeout: 4000 }); await p.waitForTimeout(200);
    ok(Math.abs((await srTop()) - y) < 3, `came back at ${await srTop()}, was at ${y}`);
  });
  await step(d, "switching tabs and back keeps your place too", async () => {
    const y = await srTop();
    await p.locator('.nav [data-tab="labs"]').tap(); await p.waitForSelector(".lx-list");
    await p.locator('.nav [data-tab="showroom"]').tap(); await p.waitForSelector("#sr-grid");
    ok(Math.abs((await srTop()) - y) < 3, `came back at ${await srTop()}, was at ${y}`);
  });
  await step(d, "tapping the tab you're on glides to the top", async () => {
    ok((await srTop()) > 0, "not scrolled");
    await p.locator('.nav [data-tab="showroom"]').tap(); await p.waitForTimeout(900);
    ok((await srTop()) === 0, "still at " + (await srTop()));
  });
  await step(d, "double-tap a picture: liked, with the heart; one tap still opens the artist", async () => {
    const card = p.locator("#sr-grid .sr-card").nth(1);
    const img = card.locator(".sr-img, .caro-i").first();
    await img.scrollIntoViewIfNeeded();
    const id = await card.locator("[data-like]").getAttribute("data-like");
    const before = (await serverPost(id)).likedByMe;
    if (before) { await card.locator("[data-like]").tap(); await p.waitForTimeout(800); }
    await img.dblclick(); await p.waitForTimeout(150);
    ok(await p.locator(".mv-heart").count() === 1, "no heart");
    await p.waitForTimeout(900);
    ok((await serverPost(id)).likedByMe === true, "the double-tap didn't like it");
    ok(await card.locator("[data-like]").evaluate((b) => b.classList.contains("on")), "the heart button isn't on");
    ok(!(await p.evaluate(() => !!PROFILE)), "the double-tap opened the profile");
    await img.click(); await p.waitForFunction(() => PROFILE, null, { timeout: 2000 });
    await p.evaluate(() => { PROFILE = null; render(); });
  });
  /* The recording of 2026-09-30: tap comment mid-feed → the whole app
     repainted, pictures collapsed, the Showroom reshuffled, the feed jumped. */
  const underThumb = () => p.evaluate(() => { const e = document.elementFromPoint(innerWidth / 2, innerHeight * 0.3);
    const c = e && e.closest(".sr-card"); const b = c && c.querySelector("[data-like]"); return b ? b.dataset.like : null; });
  await step(d, "comment opens in place: the feed doesn't rebuild or jump, and a comment posts", async () => {
    await p.evaluate(() => { TAB = "showroom"; PROFILE = null; POSTOPEN = null; OPENCOMMENTS = null; render(); });
    await p.waitForSelector("#sr-grid .sr-card");
    const btn = p.locator("#sr-grid [data-comments]").nth(3);
    await btn.scrollIntoViewIfNeeded(); await p.waitForTimeout(200);
    await p.evaluate(() => document.querySelectorAll("#sr-grid .sr-card").forEach((c) => (c.dataset.mark = "keep")));
    const y = await srTop(), who = await underThumb();
    await btn.tap();
    await p.waitForSelector("#sr-grid #cdraft", { timeout: 4000 }); await p.waitForTimeout(400);
    ok(await p.evaluate(() => document.querySelectorAll('#sr-grid .sr-card:not([data-mark="keep"])').length) === 0, "cards were rebuilt");
    ok(await underThumb() === who, `the card under your thumb changed (${who} → ${await underThumb()})`);
    ok(Math.abs((await srTop()) - y) < 40, `the feed jumped: ${y} → ${await srTop()}`);
    await p.locator("#cdraft").fill("clean comment");
    await p.locator("#csend").tap();
    await p.waitForFunction(() => [...document.querySelectorAll("#sr-grid .ctext")].some((e) => /clean comment/.test(e.textContent)), null, { timeout: 5000 });
    ok(await p.evaluate(() => document.querySelectorAll('#sr-grid .sr-card:not([data-mark="keep"])').length) === 0, "sending rebuilt the cards");
    ok(await underThumb() === who, "sending moved the feed");
    await btn.tap(); await p.waitForTimeout(300);
    ok(!(await p.locator("#sr-grid #cdraft").count()), "tapping comment again didn't close it");
    ok(await p.locator("#sr-grid .ig-viewc").filter({ hasText: /View all \d+ comment/ }).count() > 0, "no View all after closing");
  });
  await step(d, "a background refresh that re-ranks the Showroom doesn't move the feed", async () => {
    const y = await srTop(), who = await underThumb();
    ok(who, "no card under the thumb");
    await p.evaluate(() => { window.__showroom = api.showroom; api.showroom = async () => { const d = await window.__showroom(); return { ...d, posts: [...d.posts].reverse() }; }; });
    await p.evaluate(() => loadShowroom(true)); await p.waitForTimeout(700);
    await p.evaluate(() => { api.showroom = window.__showroom; });   // the real ranking again
    ok(await underThumb() === who && Math.abs((await srTop()) - y) < 3, `moved: ${who}@${y} → ${await underThumb()}@${await srTop()}`);
    ok(await p.evaluate(() => document.querySelectorAll('#sr-grid .sr-card:not([data-mark="keep"])').length) === 0, "the grid was rebuilt");
    ok(await p.locator("#sr-new").isHidden(), "a reorder alone shouldn't offer new work");
  });
  await step(d, "new work waits behind New work; tapping it shows it at the top", async () => {
    const { token: ft } = await login("friend");
    const made = await api("/api/posts", ft, { channel: "graphic-design", body: "Fresh one", imageUrl: "/uploads/e2e-p2.png", thumbUrl: "/uploads/e2e-p2.png", mediaW: 800, mediaH: 1000, isWork: true });
    const newId = String((made.post || made).id);
    const y = await srTop(), who = await underThumb();
    await p.evaluate(() => loadShowroom(true)); await p.waitForTimeout(700);
    ok(await p.locator("#sr-new").isVisible(), "no New work pill");
    ok(await underThumb() === who && Math.abs((await srTop()) - y) < 3, "new work pushed the feed");
    ok(!(await p.locator('#sr-grid [data-like="' + newId + '"]').count()), "new work slipped in under you");
    await p.locator("#sr-new").tap(); await p.waitForTimeout(900);
    ok((await srTop()) === 0, "didn't go to the top");
    ok(await p.locator('#sr-grid [data-like="' + newId + '"]').count() === 1, "the new work isn't there");
    ok(await p.locator("#sr-new").isHidden(), "the pill stayed");
  });
  /* ---- the shop: sizes and colours, the listing page (2026-09-30) ---- */
  const toMarket = () => p.evaluate(async () => { PROFILE = null; TAB = "market"; MKTVIEW = "browse"; render(); await loadMarket(); render(); });
  await step(d, "sell form: pick sizes, set stock per size, publish", async () => {
    await toMarket();
    await p.locator('[data-mv="sell"]').first().tap();
    await p.waitForSelector("#sfile", { state: "attached" });
    await p.locator("#sfile").setInputFiles(UPLOAD_PNG);
    await p.waitForSelector(".pf-img", { timeout: 8000 });
    await p.locator("#s-title").fill("E2E Tee"); await p.locator("#s-price").fill("40");
    await p.locator("#s-hasvar").tap();
    for (const s of ["S", "M", "L"]) await p.locator(`[data-pvq="${s}"]`).tap();
    await p.locator("#pvrows .pv-row").nth(1).locator('[data-pvqty="1"]').tap();
    ok((await p.locator("#pvtot").textContent()).startsWith("4 in stock"), "running total: " + (await p.locator("#pvtot").textContent()));
    await p.locator("#s-post").tap();
    await p.waitForFunction(() => MKTVIEW === "detail" && MKTONE && MKTONE.title === "E2E Tee", null, { timeout: 8000 });
    const v = await p.evaluate(() => MKTONE.variants.map((x) => x.size + ":" + x.qty).join());
    ok(v === "S:1,M:2,L:1", "saved as " + v);
    ok(await p.evaluate(() => MKTONE.quantity) === 4, "total stock isn't 4");
  });
  let dropId;
  await step(d, "listing page: swipe photos, readable heart saves in place, Buy bar stays pinned", async () => {
    const { token: ft } = await login("friend");
    dropId = (await api("/api/market", ft, { title: "Drop Tee", price: 50, category: "Tops",
      images: ["/uploads/e2e-p0.png", "/uploads/e2e-p1.png", "/uploads/e2e-p2.png"],
      variants: [{ size: "S", qty: 0 }, { size: "M", qty: 1 }, { size: "L", qty: 3 }] })).id;
    ok(dropId, "couldn't list");
    await toMarket();
    await p.locator(`[data-mopen="${dropId}"]`).first().tap();
    await p.waitForSelector("#lgtrack");
    await p.evaluate(() => { document.querySelector(".lg").dataset.mark = "e2e"; });
    ok(await p.locator("#lgdots i").count() === 3, "no dots for 3 photos");
    await p.evaluate(() => { const t = document.querySelector("#lgtrack"); t.scrollLeft = t.clientWidth; }); await p.waitForTimeout(400);
    ok(await p.evaluate(() => document.querySelectorAll("#lgdots i")[1].classList.contains("on")), "dots didn't follow the swipe");
    const heart = p.locator(".mlike.big");
    const look = await heart.evaluate((b) => { const s = getComputedStyle(b); return s.color + " on " + s.backgroundColor; });
    ok(!/^rgb\(255, 255, 255\) on rgb\(2[0-9]{2}/.test(look), "heart is white on light: " + look);
    await heart.tap(); await p.waitForTimeout(700);
    ok(await heart.evaluate((b) => b.classList.contains("on")), "heart didn't fill");
    ok((await api("/api/market/" + dropId, token)).listing.likedByMe === true, "server doesn't have the save");
    ok(await p.evaluate(() => !!document.querySelector('.lg[data-mark="e2e"]')), "saving repainted the page");
    const pinned = async () => p.evaluate(() => { const b = document.querySelector(".lbar").getBoundingClientRect(), n = document.querySelector(".app > .nav").getBoundingClientRect();
      return Math.abs(b.bottom - n.top) < 2; });
    ok(await pinned(), "Buy bar isn't sitting on the nav at the top of the page");
    await p.evaluate(() => { const s = document.querySelector("#mktscroll"); s.scrollTop = s.scrollHeight; }); await p.waitForTimeout(200);
    ok(await pinned(), "Buy bar moved when scrolled");
    await p.evaluate(() => { document.querySelector("#mktscroll").scrollTop = 0; });
  });
  await step(d, "sizes: sold-out one crossed out, can't buy without a pick, buying takes stock off that size", async () => {
    ok(await p.locator('.lv-o.out[data-lvs="S"]').count() === 1, "S isn't shown sold out");
    const before = (await api("/api/orders", token)).buying.length;
    ok((await p.locator(".lbar-buy").textContent()).trim() === "Pick size", "button: " + (await p.locator(".lbar-buy").textContent()));
    /* Every button in the Buy bar whole (it used to squash Offer to "O"
       and clip "Select a colour"), and the "pick first" toast above the
       bar, not over Offer / Buy (2026-10-07). */
    const barWhole = () => p.evaluate(() => [...document.querySelectorAll(".lbar .btn, .lbar-p b")].every((e) => e.scrollWidth <= e.clientWidth + 1));
    ok(await barWhole(), "a Buy bar button is clipped");
    await p.locator(".lbar-buy").tap(); await p.waitForTimeout(500);
    ok(await p.evaluate(() => { const t = document.querySelector(".toast"), b = document.querySelector(".lbar").getBoundingClientRect();
      if (!t) return true; const r = t.getBoundingClientRect(); return r.bottom <= b.top + 1 || r.top >= b.bottom - 1 || innerWidth >= 1024; }), "the toast covers the Buy bar");
    ok((await api("/api/orders", token)).buying.length === before, "bought without a size");
    const r = await api("/api/market/" + dropId + "/buy", token, {});
    ok(/Pick a size/.test(r.error || ""), "server let a size-less buy through: " + JSON.stringify(r));
    await p.locator('[data-lvs="M"]').tap(); await p.waitForTimeout(150);
    ok(await p.evaluate(() => !!document.querySelector('.lg[data-mark="e2e"]')), "picking a size repainted the page");
    ok((await p.locator(".lbar-buy").textContent()).trim() === "Buy now", "button didn't become Buy now");
    ok(await barWhole(), "a Buy bar button is clipped after picking a size");
    ok(/Only 1 left/.test(await p.locator(".lv-left").textContent()), "no low-stock line");
    await p.locator(".lbar-buy").tap();
    await p.locator(".ui-ok").tap({ timeout: 6000 });
    await p.waitForFunction(() => MKTVIEW === "orders" && ORDERS, null, { timeout: 6000 });
    const o = (await api("/api/orders", token)).buying[0];
    ok(o.variant === "M", "order doesn't say M: " + o.variant);
    const l = (await api("/api/market/" + dropId, token)).listing;
    ok(l.variants.map((x) => x.size + ":" + x.qty).join() === "S:0,M:0,L:3" && l.quantity === 3 && l.status === "active", "stock after: " + JSON.stringify(l.variants));
    ok(await p.locator(".ordvar", { hasText: "M" }).count() > 0, "the order row doesn't show the size");
    await p.evaluate(() => { TAB = "showroom"; MKTVIEW = "browse"; render(); });
  });
  /* ---- the bag, saved, recently viewed, price drops, seller tools (2026-09-30) ---- */
  await step(d, "bag: two things from one seller, combined shipping, one checkout reserves both", async () => {
    const { token: ft } = await login("friend");
    const cap = (await api("/api/market", ft, { title: "Cap", price: 30, shipping: 12, category: "Accessories", images: ["/uploads/e2e-p2.png"] })).id;
    await api("/api/market/" + dropId, ft, undefined);   // (a view)
    await toMarket();
    await p.locator(`[data-mopen="${dropId}"]`).first().tap(); await p.waitForSelector(".lbar-bag");
    await p.locator(".lbar-bag").tap();
    ok(await p.evaluate(() => bagList().length) === 0, "added without a size");
    await p.locator('[data-lvs="L"]').tap(); await p.locator(".lbar-bag").tap();
    await toMarket();
    await p.locator(`[data-mopen="${cap}"]`).first().tap(); await p.waitForSelector(".lbar-bag");
    await p.locator(".lbar-bag").tap();
    ok(await p.evaluate(() => bagList().length) === 2, "bag doesn't have 2");
    await toMarket();
    ok((await p.locator(".shop-bag [data-bagn]").textContent()) === "2", "no 2 on the bag button");
    await p.locator(".shop-bag").tap();
    await p.waitForSelector(".bag-g");
    const tot = await p.locator(".bag-tot b").textContent();
    ok(tot.replace(/\s/g, "") === "$92.00", "total should be 50 + 30 + 12 shipping (combined): " + tot);
    const before = (await api("/api/orders", token)).buying.length;
    await p.locator(".bag-co").tap();
    await p.locator(".ui-ok").tap({ timeout: 6000 });
    await p.waitForFunction(() => MKTVIEW === "orders" && ORDERS, null, { timeout: 6000 });
    const b = (await api("/api/orders", token)).buying;
    ok(b.length === before + 2, `orders ${before} → ${b.length}`);
    ok(await p.evaluate(() => bagList().length) === 0, "bag not emptied");
    await p.evaluate(() => { MKTVIEW = "browse"; render(); });
  });
  await step(d, "Saved works (it used to say 'no listing'); Recently viewed shows on the Market", async () => {
    await p.evaluate(async () => { MKTRECENT = null; MKT = null; });
    await toMarket();
    await p.waitForSelector("#mktrecent .simcard", { timeout: 5000 });
    ok(await p.locator(`#mktrecent [data-mopen="${dropId}"]`).count() === 1, "the tee isn't in Recently viewed");
    await p.locator('.shop-link[data-mv="saved"]').tap();
    await p.waitForSelector(".mkt-grid .mcard", { timeout: 5000 });
    ok(await p.locator(`.mkt-grid [data-mopen="${dropId}"]`).count() === 1, "the saved tee isn't on Saved");
  });
  await step(d, "price drop: the seller cuts it, you're told, it's tagged with the old price", async () => {
    const { token: ft } = await login("friend");
    const r = await fetch(B + "/api/market/" + dropId, { method: "PATCH", headers: { "content-type": "application/json", authorization: "Bearer " + ft }, body: JSON.stringify({ price: 40 }) });
    ok(r.ok, "patch failed");
    ok((await api("/api/notifications", token)).notifications.some((n) => n.kind === "price_drop" && /now \$40\.00 \(was \$50\.00\)/.test(n.body)), "no price-drop notification");
    await p.evaluate(() => { MKT = null; }); await toMarket();
    const card = p.locator(`.mkt-grid [data-mopen="${dropId}"]`).first();
    ok(await card.locator(".mdrop").count() === 1 && /\$50\.00/.test(await card.locator(".mwas").textContent()), "card isn't tagged");
  });
  await step(d, "seller tools: shop stats on Selling, Duplicate prefills a new listing, the sell form keeps a draft", async () => {
    await p.locator('.shop-link[data-mv="orders"]').tap();
    await p.locator('[data-ot="selling"]').tap();
    await p.waitForFunction(() => SHOPSTATS && document.querySelectorAll("#shopstats .sst b").length === 6, null, { timeout: 5000 });
    const mine = (await api("/api/market?seller=tester", token)).listings[0];
    await p.evaluate(async (id) => { MKTVIEW = "detail"; const d = await api.mktOne(id); MKTONE = d.listing; MKTOFFERS = d.offers || []; MKTSELLER = d.seller; MKTSIMILAR = []; render(); }, mine.id);
    await p.locator("[data-mdup]").tap();
    await p.waitForSelector("#s-title");
    ok(await p.evaluate(() => MKTVIEW === "sell" && !MKTEDIT && SELLFORM.hasVariants && SELLFORM.variants.every((v) => !v.id)), "duplicate isn't a fresh listing");
    ok((await p.locator("#s-title").inputValue()) === mine.title, "title not copied");
    await p.locator("#s-title").fill("Half-made listing"); await p.locator("#s-title").blur();
    await p.reload(); await throughDoor(p);                      // the app was closed and opened again
    await p.waitForFunction(() => typeof ME !== "undefined" && ME);
    await toMarket();
    await p.locator('[data-mv="sell"]').first().tap();
    ok((await p.locator("#s-title").inputValue()) === "Half-made listing" && await p.locator(".sdraft").count() === 1, "draft not restored");
    await p.locator("#sdraftx").tap();
    ok((await p.locator("#s-title").inputValue()) === "", "Start over didn't clear it");
    await p.evaluate(() => { MKTVIEW = "browse"; SELLFORM = null; TAB = "showroom"; render(); });
  });
  /* ---- the post creator v3 (2026-09-30) ---- */
  const openCreator = async () => { await p.locator('.nav [data-tab="post"]').tap(); await p.waitForSelector("#pcfile", { state: "attached" }); };
  const myPosts = async () => (await api("/api/users/tester", token)).posts || [];
  await step(d, "creator: never slides sideways; drag a thumbnail to reorder", async () => {
    await openCreator();
    const side = await p.evaluate(() => { const b = document.querySelector(".pc-body"); b.scrollLeft = 40; return { sl: b.scrollLeft, ox: getComputedStyle(b).overflowX }; });
    ok(side.sl === 0 && side.ox === "hidden", "the form can slide sideways: " + JSON.stringify(side));
    await p.locator("#pcfile").setInputFiles([UPLOAD_PNG, UPLOAD_PNG2, UPLOAD_PNG3]);
    await p.waitForFunction(() => PCOMPOSE && PCOMPOSE.imgs.length === 3 && !PCOMPOSE.upN, null, { timeout: 10000 });
    const order0 = await p.evaluate(() => PCOMPOSE.imgs.map((i) => i.url));
    const th = await p.locator('.pc-th[data-pci="0"]').boundingBox(), step2 = (await p.locator('.pc-th[data-pci="1"]').boundingBox()).x - th.x;
    await p.mouse.move(th.x + th.width / 2, th.y + th.height / 2); await p.mouse.down();
    for (let k = 1; k <= 8; k++) await p.mouse.move(th.x + th.width / 2 + (step2 * 2 * k) / 8, th.y + th.height / 2);
    await p.mouse.up(); await p.waitForTimeout(200);
    const order1 = await p.evaluate(() => PCOMPOSE.imgs.map((i) => i.url));
    ok(order1[2] === order0[0] && order1[0] === order0[1], "drag didn't move the first photo to the end: " + JSON.stringify({ order0, order1 }));
  });
  await step(d, "photo editor: square crop + a filter make a new square image", async () => {
    await p.evaluate(() => { PCOMPOSE.idx = 0; render(); });
    await p.locator("[data-pcedit]").tap();
    await p.waitForSelector(".ped #pedc");
    await p.locator('[data-pedf="mono"]').tap();
    await p.locator('[data-pedt="crop"]').tap(); await p.locator('[data-peda="1:1"]').tap();
    await p.locator('[data-pedt="adjust"]').tap();
    await p.locator('[data-pedj="b"]').fill("40");
    const before = await p.evaluate(() => PCOMPOSE.imgs[0].url);
    await p.locator("#pedok").tap();
    await p.waitForFunction((u) => !PED && PCOMPOSE.imgs[0].url !== u && !PCOMPOSE.upN, before, { timeout: 8000 });
    const im = await p.evaluate(() => PCOMPOSE.imgs[0]);
    ok(im.w === im.h && im.edit.filter === "mono" && im.edit.aspect === "1:1" && im.edit.b === 40 && im.orig === before, "edit: " + JSON.stringify(im));
    await p.locator("[data-pcedit]").tap(); await p.waitForSelector(".ped");
    ok(await p.locator('[data-pedf="mono"].on').count() === 1, "reopening forgot the edit");
    await p.locator("#pedx").tap();
    ok(await p.evaluate(() => !document.querySelector(".ped")), "Cancel didn't close the editor");
  });
  await step(d, "drafts: Cancel → Save draft, then Drafts brings it back", async () => {
    await p.locator("#pcbody").fill("draft from e2e");
    await p.locator("#pccancel").tap();
    await p.locator(".ui-choose [data-uic='0']").tap();
    await p.waitForFunction(() => !PCOMPOSE);
    ok(await p.evaluate(() => pdList().length) === 1, "no draft saved");
    await openCreator();
    await p.locator("#pcdrafts").tap();
    await p.locator(".pickrow").filter({ hasText: "draft from e2e" }).first().tap();
    await p.waitForFunction(() => PCOMPOSE && PCOMPOSE.body === "draft from e2e" && PCOMPOSE.imgs.length === 3);
    ok(await p.locator("#pcbody").inputValue() === "draft from e2e", "caption not restored");
  });
  await step(d, "share closes at once and posts in the background; tags, place and comments-off land", async () => {
    const before = (await myPosts()).length;
    await p.evaluate(() => { PCOMPOSE.tags = [{ username: "friend", displayName: "Friend" }]; PCOMPOSE.location = "Brooklyn"; render(); });
    await p.locator("#pccoff").check();
    await p.locator("#pcgo").tap();
    ok(await p.evaluate(() => !PCOMPOSE), "the creator didn't close straight away");
    await p.waitForSelector("#pql .pq", { timeout: 2000 });
    await p.waitForFunction(() => PQ.length && PQ.every((c) => c.state === "done"), null, { timeout: 10000 });
    ok(/Posted/.test(await p.locator("#pql .pq").textContent()), "strip doesn't say Posted");
    const posts = await myPosts();
    ok(posts.length === before + 1, `profile posts ${before} → ${posts.length}`);
    const np = posts[0];
    ok(np.tags.join() === "friend" && np.location === "Brooklyn" && np.commentsOff === true && np.images.length === 3, "extras: " + JSON.stringify({ t: np.tags, l: np.location, c: np.commentsOff }));
    ok(await p.evaluate(() => pdList().length) === 0, "the draft wasn't cleared after posting");
    const r = await api("/api/posts/" + np.id + "/comments", token, { body: "hi" });
    ok(/Comments are off/.test(r.error || ""), "a comment got through: " + JSON.stringify(r));
    const { token: ft } = await login("friend");
    ok((await api("/api/notifications", ft)).notifications.some((n) => n.kind === "tag" && n.postId === np.id), "friend wasn't told they're tagged");
    await p.locator("#pql [data-pqview]").tap();
    await p.waitForFunction((id) => PROFILE && PROFILE.user && PROFILE.user.username === "tester" && (PROFILE.posts || []).some((x) => x.id === id), np.id, { timeout: 5000 });
    await p.evaluate((id) => openPost(PROFILE.posts.find((x) => x.id === id)), np.id);
    await p.waitForSelector("#poov .px-with", { timeout: 5000 });
    ok(/with @friend/.test(await p.locator("#poov .px-with").first().textContent()), "no 'with @friend' on the post");
    ok(/BROOKLYN/.test(await p.locator("#poov .post-meta").first().textContent()), "no place on the post");
    ok(await p.locator('#poov .igact[data-comments]').isHidden(), "comment button still showing");
    await p.evaluate(() => { POSTOPEN = null; OPENCOMMENTS = null; PROFILE = null; TAB = "showroom"; render(); });
  });
  await step(d, "artwork quality: a transparent PNG is kept exactly, an oversized JPEG is capped at 3000px; sharp feed copies; the opened post shows the full size", async () => {
    const make = (w, h, type = "image/png") => p.evaluate(([w, h, type]) => { const c = document.createElement("canvas"); c.width = w; c.height = h; const x = c.getContext("2d");
      x.strokeStyle = "#111"; x.lineWidth = 1; for (let i = 0; i < h; i += 6) { x.beginPath(); x.moveTo(0, i); x.lineTo(w, i + 40); x.stroke(); }
      x.fillStyle = "#98FC68"; x.fillRect(w / 4, h / 4, w / 2, h / 2); x.clearRect(w / 3, h / 3, w / 4, h / 4);   // a see-through hole
      if (type === "image/jpeg") { const g = x.createLinearGradient(0, 0, w, h); g.addColorStop(0, "#ff7a45"); g.addColorStop(1, "#18c6a0"); x.globalCompositeOperation = "destination-over"; x.fillStyle = g; x.fillRect(0, 0, w, h); }
      return c.toDataURL(type, .98).split(",")[1]; }, [w, h, type]).then((b) => Buffer.from(b, "base64"));
    const big = await make(4000, 5000, "image/jpeg"), art = await make(2400, 3000);
    await openCreator();
    await p.locator("#pcfile").setInputFiles([{ name: "print.jpg", mimeType: "image/jpeg", buffer: big }, { name: "poster.png", mimeType: "image/png", buffer: art }]);
    await p.waitForFunction(() => PCOMPOSE.imgs.length === 2 && !PCOMPOSE.upN, null, { timeout: 45000 });
    const [capped, im] = await p.evaluate(() => PCOMPOSE.imgs);
    ok(capped.w === 2400 && capped.h === 3000, "a 4000×5000 upload wasn't capped at 3000: " + JSON.stringify(capped));
    const cb = Buffer.from(await (await fetch(B + capped.url)).arrayBuffer());
    ok(cb[0] === 0xff && cb[1] === 0xd8 && cb.length < big.length, "the capped copy isn't a smaller JPEG");
    console.log(`       (sizes: 4000×5000 JPEG ${(big.length / 1e6).toFixed(1)}MB → stored ${(cb.length / 1e6).toFixed(1)}MB; 2400×3000 PNG kept ${(art.length / 1e6).toFixed(1)}MB)`);
    ok(im.w === 2400 && im.h === 3000 && im.tw === 1440 && im.sw === 480, "sizes: " + JSON.stringify(im));
    const orig = Buffer.from(await (await fetch(B + im.url)).arrayBuffer());
    ok(orig.equals(art), `the original wasn't kept byte for byte (${orig.length} vs ${art.length})`);
    const th = Buffer.from(await (await fetch(B + im.thumb)).arrayBuffer());
    ok(th[0] === 0x89 && th[1] === 0x50, "the feed copy of a transparent design isn't a PNG (it would go black)");
    await p.evaluate(() => { PCOMPOSE.imgs.shift(); PCOMPOSE.idx = 0; render(); });
    await p.locator("#pcbody").fill("Tournament entry");
    await p.locator("#pcgo").tap();
    await p.waitForFunction(() => PQ.length && PQ.every((c) => c.state === "done"), null, { timeout: 15000 });
    const np = (await myPosts())[0];
    ok(np.images && np.images[0].tw === 1440 && np.images[0].sm, "the post didn't keep its copies: " + JSON.stringify(np.images));
    await p.evaluate(async () => { TAB = "showroom"; SRPOSTS = []; render(); await loadShowroom(true); });
    const img = p.locator(`#sr-grid img[src="${np.images[0].thumb}"]`).first();
    await img.waitFor({ timeout: 6000 });
    ok(/480w.*1440w.*2400w/.test(await img.getAttribute("srcset")), "no srcset on the feed picture");
    await p.evaluate((id) => openPostById(id), np.id);
    await p.waitForSelector("#poov img[data-zoom]", { timeout: 5000 });
    ok((await p.locator("#poov img[data-zoom]").first().getAttribute("src")) === np.images[0].url, "the opened post isn't showing the original");
    await p.locator("#poov img[data-zoom]").first().tap();
    await p.waitForSelector("#lb img", { timeout: 3000 });
    ok((await p.locator("#lb img").getAttribute("src")) === np.images[0].url, "zoom isn't the original");
    await p.evaluate(() => { LIGHTBOX = null; POSTOPEN = null; OPENCOMMENTS = null; TAB = "showroom"; render(); });
  });
  await step(d, "shoppable post: tag a product from your shop, it shows under the work, tapping it opens the listing", async () => {
    const tee = (await api("/api/market?seller=tester", token)).listings.find((l) => l.title === "E2E Tee");
    ok(tee, "no E2E Tee to tag");
    await openCreator();
    await p.locator("#pcfile").setInputFiles(UPLOAD_PNG);
    await p.locator("#pcshop").tap();
    await p.locator(".pickrow", { hasText: "E2E Tee" }).first().tap();
    ok(await p.evaluate(() => PCOMPOSE.products.length === 1), "product not tagged");
    await p.waitForFunction(() => !PCOMPOSE.upN, null, { timeout: 8000 });
    await p.locator("#pcgo").tap();
    await p.waitForFunction(() => PQ.length && PQ.every((c) => c.state === "done"), null, { timeout: 10000 });
    const np = (await myPosts())[0];
    ok(np.products.length === 1 && np.products[0].id === tee.id && np.products[0].title === "E2E Tee", "post products: " + JSON.stringify(np.products));
    await p.evaluate(async (id) => { TAB = "showroom"; SRPOSTS = []; render(); await loadShowroom(true); }, np.id);
    const chip = p.locator(`#sr-grid .px-prod[data-pxshop="${tee.id}"]`).first();
    await chip.waitFor({ timeout: 6000 }); await chip.scrollIntoViewIfNeeded();
    await chip.tap();
    await p.waitForFunction((id) => TAB === "market" && MKTVIEW === "detail" && MKTONE && MKTONE.id === id, tee.id, { timeout: 6000 });
    await p.evaluate(() => { TAB = "showroom"; MKTVIEW = "browse"; render(); });
  });
  /* "Update the post maker to simple video editing, cover etc like Instagram" (2026-10-08). */
  await step(d, "video editor: a cover arrives by itself; trim, sound off and 4:5 ride on the post and the feed honours them", async () => {
    await openCreator();
    await p.locator("#pcfile").setInputFiles(UPLOAD_WEBM);
    await p.waitForFunction(() => PCOMPOSE && PCOMPOSE.vid && !PCOMPOSE.vidbusy, null, { timeout: 15000 });
    ok(await p.evaluate(() => /^\/uploads\/.+-poster\.jpg$/.test(PCOMPOSE.cover || "")), "no automatic cover: " + await p.evaluate(() => PCOMPOSE.cover));
    await p.locator("[data-pcvedit]").tap();
    await p.waitForSelector(".ved");
    await p.waitForFunction(() => VED && VED.dur > 5000, null, { timeout: 8000 });
    const set = (sel, v) => p.locator(sel).evaluate((el, v) => { el.value = v; el.dispatchEvent(new Event("input", { bubbles: true })); }, v);
    await set('[data-vedh="start"]', 1000); await set('[data-vedh="end"]', 4000);
    ok((await p.locator("#vedlen").textContent()) === "0:03", "trim length shows " + await p.locator("#vedlen").textContent());
    await set('[data-vedh="start"]', 3800);
    ok(await p.evaluate(() => VED.e.start === 3000), "the handles crossed / went under a second: " + await p.evaluate(() => VED.e.start));
    await set('[data-vedh="start"]', 1000);
    await p.locator('[data-vedt="sound"]').tap(); await p.locator("#vedsnd").uncheck();
    await p.locator('[data-vedt="frame"]').tap(); await p.locator('[data-vedr="4:5"]').tap();
    ok(await p.evaluate(() => getComputedStyle(document.querySelector(".ved-frame")).aspectRatio.replace(/\s/g, "") === "4/5"), "the preview isn't 4:5");
    await p.locator("#vedok").tap();
    ok((await p.locator("#pcved .pc-v").textContent()) === "Trimmed · Sound off · 4:5", "summary: " + await p.locator("#pcved .pc-v").textContent());
    await p.locator("#pcgo").tap();
    await p.waitForFunction(() => PQ.length && PQ.every((c) => c.state === "done"), null, { timeout: 10000 });
    const np = (await myPosts())[0];
    ok(JSON.stringify(np.video) === JSON.stringify({ start: 1000, end: 4000, muted: true, ratio: "4:5" }) && /-poster\.jpg$/.test(np.thumbUrl), "post: " + JSON.stringify({ v: np.video, th: np.thumbUrl }));
    await p.evaluate(async () => { TAB = "showroom"; SRPOSTS = []; render(); await loadShowroom(true); });
    const v = p.locator(`#sr-grid video[src*="${np.videoUrl.replace(/\.[^.]+$/, "")}"]`).first();   // the original or its light feed copy
    await v.waitFor({ state: "attached", timeout: 6000 });
    const f = await v.evaluate((el) => ({ fill: el.classList.contains("vfill"), ve: el.dataset.ve, silent: "vsilent" in el.dataset, poster: el.getAttribute("poster"),
      mute: !!el.parentElement.querySelector("[data-vmute]") }));
    ok(f.fill && f.ve === "4000" && f.silent && !f.mute && /-poster\.jpg$/.test(f.poster || ""), "feed video: " + JSON.stringify(f));
    /* "Video still not playing" (2026-10-08): every repaint rebuilt the player, so on a slow
       signal it restarted loading every few seconds. The same player must survive a repaint. */
    await v.evaluate((el) => { el.dataset.e2eKeep = "1"; });
    await p.evaluate(() => { render(); srPaint(); });
    ok(await p.locator('#sr-grid video[data-e2e-keep="1"]').count() === 1, "a repaint threw the video player away (it starts loading from scratch)");
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
  await step(d, "signed in, the top bar has the moon: Night on, the sun brings Day back", async () => {
    await p.evaluate(() => { DMOPENPANEL = false; CHAT = null; paintLayer(); PROFILE = null; TAB = "showroom"; render(); });
    const moon = p.locator('.top [data-theme-set="dark"]');
    ok(await moon.count() === 1, "no night-mode button in the signed-in top bar");
    await moon.tap(); await p.waitForTimeout(200);
    ok(await p.evaluate(() => document.documentElement.dataset.theme === "dark" && localStorage.getItem("tnl-theme") === "dark"), "night didn't switch on");
    await p.locator('.top [data-theme-set="light"]').tap(); await p.waitForTimeout(200);
    ok(await p.evaluate(() => document.documentElement.dataset.theme) === "light", "day didn't come back");
  });
  /* ---- profile v2 (2026-10-07) ---- */
  await step(d, "edit profile: Instagram-style rows; a half-typed bio survives the Links screen; Done saves pronouns, bio, links", async () => {
    await p.evaluate(() => { DMOPENPANEL = false; CHAT = null; paintLayer(); });
    await p.locator('.nav [data-tab="profile"]').tap();
    await p.locator("#editb").tap();
    await p.locator("#ed-bio").fill("Beats with @friend.");
    await p.locator("#ed-pro").fill("he/him");
    await p.locator("#ed-links").tap();
    await p.locator('[data-k="url"]').first().fill("tnllabs.com");
    await p.locator('[data-k="title"]').first().fill("Site");
    await p.locator("#pe-addlink").tap();
    await p.locator('[data-k="url"]').nth(1).fill("javascript:alert(1)");
    await p.locator("#pe-back").tap();
    ok(await p.locator("#ed-bio").inputValue() === "Beats with @friend.", "the Links screen wiped the bio");
    await p.locator("#ed-roles").tap();
    await p.locator("#pe-rq").fill("dj");
    await p.locator('#pe-rlist [data-er="DJ"]').tap();
    await p.locator("#pe-back").tap();
    await p.locator("#ed-save").tap();
    await p.waitForFunction(() => !EDITING && PROFILE && PROFILE.user.pronouns === "he/him", null, { timeout: 6000 });
    const u = (await api("/api/users/tester")).user;
    ok(u.bio === "Beats with @friend." && u.pronouns === "he/him" && u.roles.includes("DJ"), "not saved: " + JSON.stringify({ b: u.bio, p: u.pronouns, r: u.roles }));
    ok(u.links.length === 1 && u.links[0].url === "https://tnllabs.com/" && u.links[0].title === "Site", "links: " + JSON.stringify(u.links));
    ok(!("email" in u), "a public profile still carries the email");
    ok((await p.locator(".pig .plink").textContent()).includes("Site") && (await p.locator(".pig-pro").textContent()) === "he/him", "the profile doesn't show them");
    ok(await p.locator('.pbio .mention[data-u="friend"]').count() === 1, "the @mention isn't a link (or took the full stop)");
  });
  await step(d, "profile: no level bar or ladder on the page; ≡ has Night mode; the level pill opens the short Levels sheet", async () => {
    ok(await p.locator(".plvl, .ladder, [data-ptab=ladder], #logoutb, #blockb").count() === 0, "old clutter still on the profile");
    await p.locator("#profmenu").tap();
    await p.locator(".c-ma", { hasText: "Night mode" }).tap(); await p.waitForTimeout(200);
    ok(await p.evaluate(() => document.documentElement.dataset.theme) === "dark", "Night didn't switch from ≡");
    await p.locator("#profmenu").tap();
    await p.locator(".c-ma", { hasText: "Day mode" }).tap(); await p.waitForTimeout(200);
    ok(await p.evaluate(() => document.documentElement.dataset.theme) === "light", "Day didn't come back");
    await p.locator("#lvlpill").tap();
    await p.waitForSelector(".lv2");
    ok(await p.locator(".lv2-r").count() === 5 && await p.locator(".cbars, .crung").count() === 0, "Levels isn't the short version");
    await p.locator("#climbx").tap();
  });
  /* "Share button isn't working" (2026-10-08): when the phone refuses the
     share sheet, the tap used to do nothing at all. Now it copies the link,
     or puts it in front of you to copy. */
  await step(d, "Share profile when the phone refuses the share sheet: the link is copied or shown, never nothing", async () => {
    await p.evaluate(() => { window.__gl = []; window.__glReal = window.glitch; window.glitch = (k, x) => window.__gl.push(k + " " + x); });
    await p.evaluate(() => { window.__shareTried = 0; navigator.share = () => { window.__shareTried++; return Promise.reject(new DOMException("blocked", "NotAllowedError")); };
      navigator.clipboard.writeText = () => Promise.reject(new Error("no clipboard")); });
    await p.locator("#shareprof").tap();
    await p.waitForSelector(".ui-ov .ui-in", { timeout: 4000 });
    ok(await p.evaluate(() => window.__shareTried) === 1, "didn't try the share sheet first");
    ok((await p.locator(".ui-ov .ui-in").inputValue()).endsWith("/u/tester"), "the link offered isn't the profile");
    await p.locator(".ui-ok").tap();
    await p.evaluate(() => { navigator.share = () => Promise.reject(new DOMException("closed", "AbortError")); });
    await p.locator("#shareprof").tap(); await p.waitForTimeout(400);
    ok(await p.locator(".ui-ov").count() === 0, "closing the sheet yourself shouldn't pop anything up");
    const gl = await p.evaluate(() => { const g = window.__gl; window.glitch = window.__glReal; return g; });
    ok(gl.length === 1 && /share sheet → NotAllowedError/.test(gl[0]), "the refusal wasn't reported (once) for the Glitches page: " + JSON.stringify(gl));
  });
  await step(d, "followers / following open as lists; Tagged shows posts you're tagged in; ⋯ on someone else has Block and Report", async () => {
    await p.locator('[data-flist="following"]').tap();
    await p.waitForSelector(".pick .pickrow, .pick .empty", { timeout: 5000 });
    await p.evaluate(() => { PICKER = null; render(); });
    await p.evaluate(() => openProfile("friend"));
    await p.waitForFunction(() => PROFILE && PROFILE.user.username === "friend" && !PROFILE.loading);
    await p.locator('[data-ptab="tagged"]').tap();
    await p.waitForFunction(() => Array.isArray(PROFTAGGED), null, { timeout: 5000 });
    ok(await p.evaluate(() => PROFTAGGED.length) >= 1 && await p.locator(".worklist .work").count() >= 1, "friend's Tagged tab is empty (tester tagged them earlier)");
    await p.locator("#profmore").tap();
    ok(await p.locator(".c-ma", { hasText: "Block" }).count() === 1 && await p.locator(".c-ma", { hasText: "Report" }).count() === 1, "⋯ is missing Block/Report");
    await p.evaluate(() => { CMENU = null; paintLayer(); EDITING = false; PROFILE = null; TAB = "showroom"; render(); });
  });
  /* Glitch signals (app-19-glitch.js). Everything above is normal use, so it
     must have recorded nothing: no jumps, no slow screens, no failed saves. */
  const glitches = async () => { await p.evaluate(() => glFlush()); await p.waitForTimeout(600); return api("/api/admin/glitches", token); };
  await step(d, "event: the Showroom banner opens the tournament, its gallery and the enter sheet", async () => {
    const mk = await fetch(B + "/api/admin/events", { method: "POST", headers: { "content-type": "application/json", authorization: "Bearer " + token },
      body: JSON.stringify({ slug: "e2e-poster", title: "E2E Poster Tournament", brief: "A poster.", format: "bracket", published: true, opensAt: Date.now() - 1000, submitDays: 7 }) });
    ok(mk.ok, "couldn't create the event (" + mk.status + ")");
    // no extra sign-in here: logins are rate-limited, and the computer run needs one
    await p.evaluate(async () => { await loadEvents(); POSTOPEN = null; TAB = "showroom"; render(); });
    await p.waitForSelector(".ev-banner", { timeout: 4000 });
    await p.locator(".ev-banner .ev-go").tap(); await p.waitForSelector(".ev-h", { timeout: 4000 });
    ok(/0 entries so far/i.test(await p.locator(".ev").innerText()), "the gallery should say there are no entries yet");
    await p.locator("#eventer").tap(); await p.waitForSelector("#evsheet");
    ok(await p.locator("#evsend").isDisabled(), "Enter should wait for a piece and the rules box");
    /* An entry goes up at full quality: the original kept, sharp copies, srcset in the gallery. */
    const art = await p.evaluate(() => { const c = document.createElement("canvas"); c.width = 2000; c.height = 2500; const x = c.getContext("2d");
      for (let i = 0; i < 2500; i += 5) { x.fillStyle = i % 10 ? "#111" : "#98FC68"; x.fillRect(0, i, 2000, 2); }
      return c.toDataURL("image/png").split(",")[1]; }).then((b) => Buffer.from(b, "base64"));
    await p.locator("#evfile").setInputFiles({ name: "entry.png", mimeType: "image/png", buffer: art });
    await p.waitForSelector(".ev-drop img");
    await p.locator("#evagree").check();
    await p.locator("#evsend").tap();
    await p.waitForFunction(() => !EVENTER && EV && EV.me && EV.me.entry, null, { timeout: 30000 });
    const en = await p.evaluate(() => EV.me.entry);
    ok(en.w === 2000 && en.h === 2500 && en.tw === 1440 && en.sm && en.sw === 480, "entry copies: " + JSON.stringify(en));
    ok(Buffer.from(await (await fetch(B + en.imageUrl)).arrayBuffer()).equals(art), "the entry's original wasn't kept byte for byte");
    await p.waitForSelector(`.ev img[srcset*="1440w"]`, { timeout: 5000 });
    await fetch(B + "/api/events/e2e-poster/entry", { method: "DELETE", headers: { authorization: "Bearer " + token } });   // withdraw: the next steps enter elsewhere
    await p.evaluate(() => { EVENTER = null; TAB = "showroom"; render(); });
  });
  await step(d, "poll: an Instagram vote link lands on the piece, Vote counts once and moves the scoreboard, Share makes the Story card", async () => {
    const mk = await api("/api/admin/events", token, { slug: "e2e-art", title: "E2E Art Tournament", format: "poll", picks: 1, finalists: 2, judgeWeight: 0, minAccountDays: 0, published: true, opensAt: Date.now() - 1000, submitDays: 1, voteDays: 3 });
    ok(mk.event && mk.event.format === "poll", "couldn't create the poll: " + JSON.stringify(mk).slice(0, 200));
    const fe = await api("/api/events/e2e-art/enter", "e2e-friend-session", { imageUrl: "/uploads/e2e-p3.png", thumbUrl: "/uploads/e2e-p3.png", w: 800, h: 1000, agree: true });
    await api("/api/events/e2e-art/enter", token, { imageUrl: "/uploads/e2e-p4.png", thumbUrl: "/uploads/e2e-p4.png", agree: true });
    const fid = fe.me && fe.me.entry && fe.me.entry.id;
    ok(fid, "friend couldn't enter: " + JSON.stringify(fe).slice(0, 200));
    await api(`/api/admin/events/${mk.event.id}/advance`, token, {});
    // what someone tapping a link sticker on Instagram sees
    await p.goto(B + "/e/e2e-art/" + fid);
    await p.locator("a.btn.block").tap();
    await throughDoor(p);   // the door, as on any fresh load
    await p.waitForSelector(".ev-focus [data-evpick]", { timeout: 6000 });
    ok(await p.evaluate(() => EVFOCUS && location.search === ""), "the vote link didn't open that piece");
    const y0 = await p.evaluate(() => document.querySelector("#evscroll").scrollTop);
    await p.locator(".ev-focus [data-evpick]").tap();
    await p.waitForFunction((id) => EV.me.myVotes.includes(id) && EV.board.rows.find((r) => r.entryId === id).votes === 1, fid, { timeout: 4000 });
    ok(await p.locator(".ev-focus .ev-vote.on").count() === 1 && await p.locator(`.ev-row .ev-vote.on`).count() === 1, "the button and the board row should both say Voted");
    ok(await p.evaluate(() => document.querySelector("#evscroll").scrollTop) === y0, "voting jumped the screen");
    ok(await p.locator(".ev-row .ev-mine-s").count() === 1, "your own piece should say Yours, not Vote");
    const srv = await api("/api/events/e2e-art", token);
    ok(srv.board.rows.find((r) => r.entryId === fid).votes === 1, "the server doesn't have the vote");
    await p.locator("#evshare").tap(); await p.waitForSelector("#evshsheet");
    await p.waitForFunction(() => { const i = document.querySelector("#evshpic"); return i && i.complete && i.naturalWidth > 0; }, null, { timeout: 15000 });
    await p.locator("#evshx").tap();
    ok(await p.locator("#evshsheet").count() === 0, "the share sheet didn't close");
    await p.evaluate(() => { EVFOCUS = null; TAB = "showroom"; render(); });
  });
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
