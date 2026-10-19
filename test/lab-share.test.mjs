// Lab sharing (2026-10-15): "I need every lab to have a share button with
// captions that describe what to do inside each lab. Like visuals can be
// upload your art. Music can be upload your songs. Brief explanation I can
// send to people." The caption is the same in the app and on /l/:id, the
// page a shared link opens, and that page sends people into the lab.
// v2 (same day): links name the lab — /l/visual, /l/music — and old /l/<id> links forward.
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { rmSync, mkdirSync, readFileSync, copyFileSync } from "node:fs";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(ROOT, "test/.tmp/lab-share");
rmSync(DATA, { recursive: true, force: true }); mkdirSync(join(DATA, "uploads"), { recursive: true });
for (const f of ["art.jpg", "new.jpg"]) copyFileSync(join(ROOT, "public/icon-512.png"), join(DATA, "uploads", f));   // placeholder pictures the cards can draw
process.env.TNL_DATA = DATA;
const { db } = await import(join(ROOT, "src/db.js"));
const now = Date.now();
const U = (n, sus = 0) => Number(db.prepare(`INSERT INTO users (username, display_name, email, password_hash, created_at, email_verified, suspended) VALUES (?,?,?,?,?,1,?)`).run(n, n, n + "@x.com", "h", now, sus).lastInsertRowid);
const ana = U("ana"), gone = U("gone", 1);
const P = (u, ch, img, work = 1) => Number(db.prepare(`INSERT INTO posts (author_id, channel, body, is_work, image_url, created_at) VALUES (?,?,?,?,?,?)`).run(u, ch, "a piece", work, img, now).lastInsertRowid);
const art = P(ana, "creators", "/uploads/art.jpg"), hidden = P(gone, "creators", "/uploads/hidden.jpg"), talk = P(ana, "creators", "/uploads/talk.jpg", 0);

let pass = 0, fail = 0;
const t = (n, ok) => { ok ? pass++ : fail++; console.log("  " + (ok ? "✓" : "✗") + "  " + n); };
const part = (f) => readFileSync(join(ROOT, "src", f), "utf8");
const grab = (src, name) => new Function(src.slice(src.indexOf(name), src.indexOf("};", src.indexOf(name)) + 2).replace(/^const /, "var ") + `\nreturn ${name.split(/[ =]/)[1]};`)();
const PORT = 8878, B = `http://localhost:${PORT}`;
const srv = spawn(process.execPath, ["--experimental-sqlite", "--no-warnings", "src/server.runtime.js"], {
  cwd: ROOT, env: { ...process.env, TNL_DATA: DATA, PORT: String(PORT), STRIPE_SECRET_KEY: "", TNL_NO_VIDEO_FIX: "1", TNL_NO_WATCH: "1" }, stdio: "ignore" });
try {
  for (let i = 0; i < 100; i++) { try { if ((await fetch(B + "/api/health")).ok) break; } catch {} await new Promise((r) => setTimeout(r, 100)); }

  console.log("\nTHE CAPTIONS");
  const app = grab(part("app-11-places.js"), "const LAB_PITCH="), server = grab(part("server-12-labs.js"), "const LAB_PITCH = ");
  const ids = [...part("app-07-theme-labs-api.js").matchAll(/^\s*\{id:"([a-z]+)",name:"/gm)].map((m) => m[1]);
  t("every lab has one", ids.length === 7 && ids.every((id) => app[id] && app[id].length > 30));
  t("…the same in the app and on the shared page", JSON.stringify(app) === JSON.stringify(server));
  t("Visual says upload your art, Music says upload your songs", /^Upload your art/.test(app.pharmacy) && /^Upload your songs/.test(app.culture));
  t("each is brief enough to send (one line, under 120 characters)", Object.values(app).every((c) => c.length < 120 && !c.includes("\n")));

  console.log("\nIN THE APP");
  t("each lab's header has a Share button", /id="labshare"/.test(part("app-12-archive-posts.js")) && /\$\("#labshare"\).*shareLab\(LAB\)/.test(part("app-16-wire.js")));
  t("a shared /l/ link opens the lab (?l=), or join first and then the lab", /qs\.get\("l"\)/.test(part("app-19-feed-boot.js")) && /LABNEXT=qlab\.id/.test(part("app-19-feed-boot.js"))
    && (part("app-11-gate-logic.js").match(/labNext\(\)/g) || []).length === 2);

  console.log("\nTHE PAGE A SHARED LINK OPENS");
  const r = await fetch(B + "/l/visual"), h = await r.text();
  t("/l/visual is a page", r.status === 200 && /text\/html/.test(r.headers.get("content-type")));
  t("…named for the lab, with what to do there", h.includes("<h1>// Visual</h1>") && h.includes(app.pharmacy.replace(/'/g, "&#39;")));
  t("…and its preview says the same (Instagram DMs, texts)", h.includes(`property="og:title" content="// Visual on LABS"`) && h.includes(`property="og:description" content="${app.pharmacy.replace(/'/g, "&#39;")}"`));
  t("…its #tags", h.includes("#painting") && h.includes("#photography"));
  t("…recent finished work, never a suspended member's or a chat message", h.includes(`/p/${art}`) && !h.includes(`/p/${hidden}`) && !h.includes(`/p/${talk}`));
  t("…one button into the lab", h.includes(`href="/?l=visual"`) && /Join and step into \/\/ Visual/.test(h));
  t("Music's page says upload your songs", (await (await fetch(B + "/l/music")).text()).includes("Upload your songs"));
  t("a lab that doesn't exist is a 404", (await fetch(B + "/l/nope")).status === 404);

  console.log("\nTHE PICTURE A SHARED LAB LINK SHOWS");
  const ogImg = (/property="og:image" content="([^"]+)"/.exec(h) || [])[1] || "";
  t("each lab's link shows its own square card, not a member's picture or the site's", /\/l\/visual\/card\.jpg\?v=[0-9a-f]{8}$/.test(ogImg) && h.includes('og:image:width" content="1080"'));
  let cards = 0;
  for (const n of ["general", "visual", "music", "fashion", "anime", "news", "business"]) {
    const c = await fetch(B + `/l/${n}/card.jpg`), b = Buffer.from(await c.arrayBuffer());
    if (c.status === 200 && /jpeg/.test(c.headers.get("content-type")) && b[0] === 0xff && b[1] === 0xd8) cards++;
  }
  t("every lab's card is drawn (7 of 7)", cards === 7);
  t("no card for a lab that doesn't exist", (await fetch(B + "/l/nope/card.jpg")).status === 404);
  db.prepare(`INSERT INTO posts (author_id, channel, body, is_work, image_url, created_at) VALUES (?,?,?,1,?,?)`).run(ana, "photography", "new", "/uploads/new.jpg", now + 1000);
  const after = (/property="og:image" content="([^"]+)"/.exec(await (await fetch(B + "/l/visual")).text()) || [])[1] || "";
  t("new work in the lab: a new card link, so previews refresh", /card\.jpg\?v=/.test(after) && after !== ogImg);
  const xml = await (await fetch(B + "/sitemap.xml")).text();
  t("every lab's page is in the sitemap, by name", ["general", "visual", "music", "fashion", "anime", "news", "business"].every((n) => xml.includes(`<loc>${B}/l/${n}</loc>`)) && !xml.includes(`/l/pharmacy`));

  console.log("\nLINKS NAME THE LAB");
  const slugApp = grab(part("app-11-places.js"), "const LAB_SLUG="), slugSrv = grab(part("server-12-labs.js"), "const LAB_SLUG = ");
  t("every lab's link is its name (visual, music…), the same in the app and on the server", JSON.stringify(slugApp) === JSON.stringify(slugSrv)
    && ids.every((id) => slugApp[id]) && slugApp.pharmacy === "visual" && slugApp.culture === "music" && slugApp.akatsuki === "anime" && slugApp.casino === "news" && slugApp.tna === "business" && slugApp.hq === "general");
  const old = await fetch(B + "/l/pharmacy", { redirect: "manual" });
  t("a link sent before the rename still works: /l/pharmacy forwards to /l/visual", old.status === 301 && /\/l\/visual$/.test(old.headers.get("location")));
  t("the app's Share sends the named link, and ?l= takes the name (or an old id)", /"\/l\/"\+\(LAB_SLUG\[l\.id\]/.test(part("app-11-places.js")) && /labBySlug\(ql\)/.test(part("app-19-feed-boot.js")));
} finally { srv.kill(); }
console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
