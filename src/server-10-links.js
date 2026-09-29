/* ================================================================
   LINK PREVIEWS — 2026-09-29 v1.0
   Paste a link in a chat or a lab and a card appears under it (title,
   site, image), fetched once by the server and stored on the message.

   Fetching a URL someone typed is how servers get turned against their
   own network (SSRF). So the guard sits in the socket's DNS lookup:
   every address a hostname resolves to must be public, checked at
   connect time, on every redirect hop. Checking the hostname text, or
   resolving first and fetching after, can both be dodged.
================================================================ */
import { lookup as dnsLookup } from "node:dns";
import { BlockList, isIP } from "node:net";
import http from "node:http";
import https from "node:https";

const NOT_PUBLIC = new BlockList();
for (const [a, p] of [["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8], ["169.254.0.0", 16],
  ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.0.2.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15],
  ["198.51.100.0", 24], ["203.0.113.0", 24], ["224.0.0.0", 4], ["240.0.0.0", 4]]) NOT_PUBLIC.addSubnet(a, p, "ipv4");
// IPv4-mapped IPv6 (::ffff:a.b.c.d) is checked against the IPv4 rules by BlockList itself.
for (const [a, p] of [["::", 96], ["64:ff9b::", 96], ["100::", 64], ["2001:db8::", 32],
  ["2002::", 16], ["fc00::", 7], ["fe80::", 10], ["ff00::", 8]]) NOT_PUBLIC.addSubnet(a, p, "ipv6");
const isPublicIp = (addr) => { const v = isIP(addr); return !!v && !NOT_PUBLIC.check(addr, v === 6 ? "ipv6" : "ipv4"); };

function publicLookup(hostname, options, cb) {
  if (typeof options === "function") { cb = options; options = {}; }
  dnsLookup(hostname, { all: true }, (err, addrs) => {
    if (err) return cb(err);
    // Every answer must be public — one private record is enough to refuse.
    if (!addrs.length || addrs.some((a) => !isPublicIp(a.address))) return cb(Object.assign(new Error("private address"), { blocked: true }));
    if (options && options.all) return cb(null, addrs);
    cb(null, addrs[0].address, addrs[0].family);
  });
}

/* GET a public page, reading at most maxBytes. Redirects are followed by
   hand (max 4), each hop checked like the first. */
function safeGet(url, { maxBytes = 120000, timeout = 6000, stopAt = /<\/head>/i } = {}, hops = 0) {
  return new Promise((resolve, reject) => {
    let u;
    try { u = new URL(url); } catch { return reject(Object.assign(new Error("bad link"), { blocked: true })); }
    const host = u.hostname.replace(/^\[|\]$/g, "");
    if (!/^https?:$/.test(u.protocol) || u.username || u.password || (u.port && !["80", "443"].includes(u.port))
      || /^localhost$|\.(local|localhost|internal|lan|home|arpa)$/i.test(host) || (isIP(host) && !isPublicIp(host)))
      return reject(Object.assign(new Error("not a public link"), { blocked: true }));
    let done = false;
    const finish = (fn, v) => { if (!done) { done = true; clearTimeout(timer); fn(v); } };
    const req = (u.protocol === "https:" ? https : http).get(u, {
      agent: false, lookup: publicLookup, timeout,
      headers: { "User-Agent": "TNLLabsBot/1.0 (+https://labs.tnllabs.com)", Accept: "text/html,application/xhtml+xml" },
    }, (r) => {
      if (r.statusCode >= 300 && r.statusCode < 400 && r.headers.location) {
        r.resume();
        if (hops >= 4) return finish(reject, new Error("too many redirects"));
        let next; try { next = new URL(r.headers.location, u).href; } catch { return finish(reject, new Error("bad redirect")); }
        return safeGet(next, { maxBytes, timeout, stopAt }, hops + 1).then((v) => finish(resolve, v), (e) => finish(reject, e));
      }
      if (r.statusCode !== 200) { r.resume(); return finish(reject, Object.assign(new Error(`returned ${r.statusCode}`), { status: r.statusCode })); }
      const chunks = []; let got = 0, tail = "";
      const out = () => finish(resolve, { url: u.href, type: String(r.headers["content-type"] || ""), body: Buffer.concat(chunks).toString("utf8") });
      r.on("data", (c) => {
        chunks.push(c); got += c.length; tail = (tail + c.toString("latin1")).slice(-4096);
        if (got >= maxBytes || (stopAt && stopAt.test(tail))) { out(); r.destroy(); }
      });
      r.on("end", out); r.on("close", out);
      r.on("error", (e) => finish(reject, e));
    });
    const timer = setTimeout(() => req.destroy(new Error("timeout")), timeout);
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", (e) => finish(reject, e));
  });
}

const unescapeHtml = (s) => String(s || "").replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|#39);/gi, (m, e) => {
  const k = e.toLowerCase();
  if (k[0] === "#") { const n = k[1] === "x" ? parseInt(k.slice(2), 16) : parseInt(k.slice(1), 10); return n > 0 && n < 0x110000 ? String.fromCodePoint(n) : ""; }
  return { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" }[k] ?? m;
}).replace(/\s+/g, " ").trim();

const siteOf = (url) => { try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; } };

/* Title, site, description and image for a link — or throws. */
async function previewFor(url) {
  if (/\.(jpe?g|png|gif|webp|avif)(\?|$)/i.test(url)) return { url, site: siteOf(url), title: "", description: "", image: url };
  const r = await safeGet(url);
  const html = /html|xml/i.test(r.type) || !r.type ? r.body : "";
  const meta = (prop) => {
    const m = new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']+)["']`, "i").exec(html)
      || new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${prop}["']`, "i").exec(html);
    return m ? unescapeHtml(m[1]) : "";
  };
  let image = meta("og:image") || meta("twitter:image") || meta("og:image:url");
  try { image = image ? new URL(image, r.url).href : ""; } catch { image = ""; }
  if (!/^https:\/\//i.test(image)) image = "";
  return {
    url, site: (meta("og:site_name") || siteOf(url)).slice(0, 60),
    title: (meta("og:title") || meta("twitter:title") || unescapeHtml((/<title[^>]*>([^<]+)<\/title>/i.exec(html) || [, ""])[1])).slice(0, 140),
    description: (meta("og:description") || meta("description")).slice(0, 200),
    image: image.slice(0, 600) || null,
  };
}

/* Previews happen after the message is sent — nobody waits on a slow
   site. At most 3 fetch at once; a flood is dropped, not queued forever.
   Results are cached for 30 minutes so a link pasted twice is fetched once. */
const LINK_RE = /https?:\/\/[^\s<>"'`]+/i;
const previewCache = new Map();
const previewQueue = [];
let previewBusy = 0;
function previewLater(kind, id, text) {
  const m = LINK_RE.exec(text || "");
  if (!m) return;
  const url = m[0].replace(/[.,;:!?)\]}'"]+$/, "");
  if (previewQueue.length > 60) return;
  previewQueue.push({ kind, id, url, text });
  pumpPreviews();
}
function pumpPreviews() {
  while (previewBusy < 3 && previewQueue.length) {
    const job = previewQueue.shift();
    previewBusy++;
    const hit = previewCache.get(job.url);
    const got = hit && Date.now() - hit.at < 1800000 ? Promise.resolve(hit.p) : previewFor(job.url).then((p) => {
      previewCache.set(job.url, { at: Date.now(), p });
      if (previewCache.size > 300) previewCache.delete(previewCache.keys().next().value);
      return p;
    });
    got.then((p) => { if (p && (p.title || p.image)) storePreview(job, p); })
      .catch(() => {})
      .finally(() => { previewBusy--; pumpPreviews(); });
  }
}
function storePreview(job, p) {
  const json = JSON.stringify(p);
  if (job.kind === "dm") {
    // Only if the message still says what it said — an edit or unsend wins.
    const info = db.prepare(`UPDATE dm_messages SET link_json = ? WHERE id = ? AND body = ? AND deleted_at IS NULL`).run(json, job.id, job.text);
    if (!info.changes) return;
    const row = DM.msg.get(job.id);
    sendTo(chatPeople({ id: row.thread_id }), "chat-update", { chatId: row.thread_id, message: shapeMessages([row])[0] });
  } else {
    const info = db.prepare(`UPDATE posts SET link_json = ? WHERE id = ? AND body = ?`).run(json, job.id, job.text);
    if (!info.changes) return;
    const row = feedRows({ postId: job.id, limit: 1 })[0];
    if (row) broadcast("post-edit", shapePost(row));
  }
}
