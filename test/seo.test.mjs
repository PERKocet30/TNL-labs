// Search (2026-10-13): "Optimize the app SEO". A sitemap of every public
// page (and nothing private), structured data on each public page type,
// and a home page that says what it is.
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { rmSync, mkdirSync, readFileSync } from "node:fs";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(ROOT, "test/.tmp/seo");
rmSync(DATA, { recursive: true, force: true }); mkdirSync(DATA, { recursive: true });
process.env.TNL_DATA = DATA;
const { db } = await import(join(ROOT, "src/db.js"));
const now = Date.now();
const U = (n, o = {}) => Number(db.prepare(`INSERT INTO users (username, display_name, email, password_hash, created_at, email_verified, suspended, bio, links) VALUES (?,?,?,?,?,1,?,?,?)`)
  .run(n, o.name || n, n + "@x.com", "h", now, o.suspended ? 1 : 0, o.bio || "", JSON.stringify(o.links || [])).lastInsertRowid);
const artist = U("artist", { name: "Ana Artist", bio: "I paint", links: [{ url: "https://ana.studio" }] }), quiet = U("quiet"), banned = U("banned", { suspended: true });
const P = (u, body, work, img) => Number(db.prepare(`INSERT INTO posts (author_id, channel, body, is_work, image_url, media_w, media_h, created_at) VALUES (?,?,?,?,?,800,1000,?)`).run(u, "graphic-design", body, work ? 1 : 0, img, now).lastInsertRowid);
const work = P(artist, `A piece </script><script>alert(1)</script>`, 1, "/uploads/a.jpg"), chat = P(artist, "just chatting", 0, null), bannedWork = P(banned, "x", 1, "/uploads/b.jpg");
const song = Number(db.prepare(`INSERT INTO tracks (user_id, title, url, duration_ms, created_at) VALUES (?,?,?,?,?)`).run(artist, "Night Song", "/uploads/s.mp3", 185000, now).lastInsertRowid);
const L = (title, status) => Number(db.prepare(`INSERT INTO listings (seller_id, title, description, price_cents, condition, images, status, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?)`)
  .run(artist, title, "Heavy cotton", 4500, "Like new", '["/uploads/t.jpg"]', status, now, now).lastInsertRowid);
const tee = L("Tee", "active"), gone = L("Gone", "removed"), sold = L("Sold one", "sold");


let pass = 0, fail = 0;
const t = (n, ok) => { ok ? pass++ : fail++; console.log("  " + (ok ? "✓" : "✗") + "  " + n); };
const PORT = 8876, B = `http://localhost:${PORT}`;
const srv = spawn(process.execPath, ["--experimental-sqlite", "--no-warnings", "src/server.runtime.js"], {
  cwd: ROOT, env: { ...process.env, TNL_DATA: DATA, PORT: String(PORT), STRIPE_SECRET_KEY: "", TNL_NO_VIDEO_FIX: "1", TNL_NO_WATCH: "1" }, stdio: "ignore" });
const html = async (p) => (await fetch(B + p)).text();
const lds = (h) => [...h.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
try {
  for (let i = 0; i < 100; i++) { try { if ((await fetch(B + "/api/health")).ok) break; } catch {} await new Promise((r) => setTimeout(r, 100)); }
  // the event tables are made when the server starts
  db.prepare(`INSERT INTO events (slug, title, brief, prize, published, schedule, created_at, updated_at) VALUES ('art-cup','Art Cup','Enter your best piece','$100',1,?,?,?)`)
    .run(JSON.stringify([{ phase: "submit", start: now - 1000, end: now + 86400000 }, { phase: "results", start: now + 86400000, end: null }]), now, now);
  db.prepare(`INSERT INTO events (slug, title, published, created_at, updated_at) VALUES ('draft-cup','Draft',0,?,?)`).run(now, now);
  console.log("\nTHE SITEMAP");
  const r = await fetch(B + "/sitemap.xml"), xml = await r.text();
  t("/sitemap.xml is XML", r.status === 200 && /xml/.test(r.headers.get("content-type")) && xml.startsWith("<?xml") && xml.includes("<urlset"));
  const has = (p) => xml.includes(`<loc>${B}${p}</loc>`);
  t("it lists the home page, the event, the artist, their work, their song and what's for sale", has("/") && has("/e/art-cup") && has("/u/artist") && has(`/p/${work}`) && has(`/s/${song}`) && has(`/m/${tee}`));
  t("…and never chat, a draft event, a member with no work, a suspended member, or removed / sold listings",
    !has(`/p/${chat}`) && !has("/e/draft-cup") && !has("/u/quiet") && !has("/u/banned") && !has(`/p/${bannedWork}`) && !has(`/m/${gone}`) && !has(`/m/${sold}`));
  t("robots.txt points to it, and still turns AI crawlers away", /Sitemap: https:\/\/tnllabs\.com\/sitemap\.xml/.test(readFileSync(join(ROOT, "public/robots.txt"), "utf8")) && /GPTBot/.test(readFileSync(join(ROOT, "public/robots.txt"), "utf8")));

  console.log("\nWHAT EACH PAGE IS (schema.org)");
  const home = await html("/");
  t("the home page's title says what it is", /<title>LABS — Social media for artists, designers &amp; musicians<\/title>/.test(home));
  t("…and it's LABS the website, linked to its Instagram", (lds(home)[0]["@graph"] || []).some((x) => x["@type"] === "WebSite") && home.includes("instagram.com/tnl.labs"));
  const prof = lds(await html("/u/artist"))[0];
  t("a profile is a ProfilePage about a Person, with their bio and links", prof["@type"] === "ProfilePage" && prof.mainEntity["@type"] === "Person" && prof.mainEntity.name === "Ana Artist" && prof.mainEntity.description === "I paint" && prof.mainEntity.sameAs[0] === "https://ana.studio");
  const ph = await html(`/p/${work}`), post = lds(ph)[0];
  t("a piece is a SocialMediaPosting with its author, date and picture", post["@type"] === "SocialMediaPosting" && post.author[0].name === "Ana Artist" && post.datePublished && /\/uploads\/a\.jpg$/.test(post.image));
  t("…and a caption can't break out of it (</script> stays text)", !/<\/script><script>alert/.test(ph) && post.headline.includes("</script>"));
  const s = lds(await html(`/s/${song}`))[0];
  t("a song is a MusicRecording, with the artist and its length", s["@type"] === "MusicRecording" && s.name === "Night Song" && s.byArtist.name === "Ana Artist" && s.duration === "PT3M5S");
  const m = lds(await html(`/m/${tee}`)).find((x) => x["@type"] === "Product");
  t("a listing is a Product with its price and in stock", m && m.offers.price === "45.00" && m.offers.priceCurrency === "USD" && /InStock$/.test(m.offers.availability) && /UsedCondition$/.test(m.itemCondition));
  const eh = await html("/e/art-cup"), e = lds(eh)[0];
  t("the tournament is an online Event with its dates, at its own address", e["@type"] === "Event" && e.startDate && e.endDate && /OnlineEventAttendanceMode$/.test(e.eventAttendanceMode)
    && eh.includes(`<link rel="canonical" href="${B}/e/art-cup">`));
  t("the guest Showroom's tagline is the page's headline", readFileSync(join(ROOT, "src/app-11-showroom.js"), "utf8").includes('<h1 class="wi-tag">Social media by creatives, for creatives.</h1>'));
} finally { srv.kill(); }
console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
