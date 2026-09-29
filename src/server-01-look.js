
/* ================================================================
   THE LOOK v1.2 — 2026-09-29. Pages the server builds itself: the
   "email verified" page, the password reset page, and the public post
   and profile pages that open from shared links (IG DMs, iMessage).
   Same design language as the app and the emails: white by default,
   Black if this browser chose dark in the app (the tnl-theme key),
   Helvetica Neue / Archivo, square cards, pill buttons, the // mark as
   the only Reagent, drawn icons with 2px square-capped strokes. No
   monospace, no emoji. Every page calls lookPage(); change it here.
================================================================ */
/* Colours come from src/palette.js (paletteCss(), inlined by lookPage). */
const LOOK_CSS = `*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--tx);font-family:"Helvetica Neue",Helvetica,Archivo,Arial,sans-serif;font-size:15px;line-height:21px;-webkit-font-smoothing:antialiased;font-variant-numeric:tabular-nums}
body.center{min-height:100vh;display:flex;align-items:center}
.wrap{width:100%;max-width:560px;margin:0 auto;padding:24px 16px 56px}
body.center .wrap{max-width:400px}
a{color:inherit}
.top{display:inline-flex;align-items:center;gap:8px;text-decoration:none;color:var(--tx);font-weight:700;letter-spacing:.04em}
.top img{width:28px;height:28px;border-radius:50%}
.eyebrow{font-size:12px;line-height:16px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--dim);margin:32px 0 12px}
.mk{color:var(--green)}
h1{font-size:30px;line-height:34px;font-weight:700;letter-spacing:-.02em;margin:0 0 12px}
.p{color:var(--dim);margin:0 0 20px}
.cap{font-size:12px;line-height:16px;color:var(--dim)}
.ic{display:block;margin:0 0 4px;color:var(--tx)}
.btn{display:inline-flex;align-items:center;justify-content:center;background:var(--tx);color:var(--bg);border:0;border-radius:999px;padding:14px 26px;font-family:inherit;font-size:15px;line-height:18px;font-weight:700;text-decoration:none;cursor:pointer}
.btn.acc{background:var(--fill);color:var(--on-fill)}
.av.ring{box-shadow:0 0 0 2px var(--bg),0 0 0 4px var(--fill)}
.btn.block{display:flex;width:100%;margin-top:28px}
.in{width:100%;background:var(--el);border:1px solid var(--line);border-radius:999px;color:var(--tx);padding:13px 18px;font-family:inherit;font-size:15px;margin:4px 0 10px;outline:none}
.in:focus{border-color:var(--tx)}
.msg{font-size:12px;line-height:16px;min-height:16px;margin:0 0 14px;color:var(--err)}
.msg.ok{color:var(--tx)}
.who{display:flex;align-items:center;gap:12px;text-decoration:none;color:var(--tx);margin:28px 0 16px}
.av{width:56px;height:56px;border-radius:50%;object-fit:cover;background:var(--el);display:flex;align-items:center;justify-content:center;font-weight:700;flex:none}
.name{font-size:20px;line-height:24px;font-weight:700}
.chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:14px}
.chip{border:1px solid var(--line);border-radius:999px;padding:5px 11px;font-size:12px;line-height:16px}
.bio{margin:16px 0 8px;white-space:pre-wrap}
.stats{display:flex;border-top:1px solid var(--line);border-bottom:1px solid var(--line);padding:14px 0;margin:18px 0 20px}
.stats div{flex:1}.stats b{display:block;font-size:17px;line-height:21px}
.card{background:var(--card);border:1px solid var(--line);padding:14px;margin-bottom:10px}
.media{display:block;width:100%;max-height:420px;object-fit:cover;margin-top:10px;background:var(--el)}
.body{margin:10px 0 0;white-space:pre-wrap}
.meta{margin-top:10px}
.empty{text-align:center;padding:28px 0}`;

const lookEsc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/* Drawn icons: 24px box, 2px stroke, square caps — same as the app. */
const LOOK_ICONS = {
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  alert: '<path d="M12 3L2.5 20h19z"/><path d="M12 10v4.5M12 17v.5"/>',
  lock: '<path d="M5 11h14v10H5z"/><path d="M8 11V7.5a4 4 0 018 0V11"/>',
};
const lookIcon = (k, size = 40) => `<svg class="ic" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true">${LOOK_ICONS[k] || ""}</svg>`;

/* "1 like", "3 likes". */
const lookCount = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;

/* A lab or section label: "// Welcome". */
const lookEyebrow = (t) => `<div class="eyebrow"><span class="mk">//</span> ${lookEsc(t)}</div>`;

/** The whole page. title and head are trusted HTML (callers escape). */
function lookPage({ title, head = "", body, center = false, accent = null }) {
  return `<!doctype html><html lang="en" data-theme="light"${accent ? ` style="${accentVars(accent)}"` : ""}><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<meta name="theme-color" content="${PALETTE.light.bg}">
${head}
<script>try{if(localStorage.getItem("tnl-theme")==="dark"){document.documentElement.setAttribute("data-theme","dark");document.querySelector('meta[name=theme-color]').content="${PALETTE.dark.bg}"}}catch(e){}</script>
<style>${paletteCss()}
${LOOK_CSS}</style></head>
<body${center ? ' class="center"' : ""}><main class="wrap">
<a class="top" href="/"><img src="/icon-512.png" alt="">LABS &reg;</a>
${body}
</main></body></html>`;
}

/* The one 404 shape for public pages. */
const lookNotFound = (what) => lookPage({
  title: "Not found — TNL LABS", center: true,
  body: `${lookEyebrow("Not found")}<h1>Nothing here</h1><p class="p">${lookEsc(what)}</p><a class="btn" href="/">Enter the lab</a>`,
});

/* The palette as a stylesheet, for pages that aren't built here (/admin). */
app.get("/palette.css", (_req, res) => {
  res.set("Cache-Control", "public, max-age=300");
  res.type("css").send(paletteCss());
});
