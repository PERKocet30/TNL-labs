
/* ================================================================
   PROFILE CARD v3.1 — 2026-10-11 (the Story cards' look). v3.0 2026-09-29. The link preview for a shared
   profile: who they are on the left —
   profile picture, name, @username, bio, how much they've made — and
   their latest work as a grid on the right. The TNL mark and LABS ®
   sit bottom-left, their accent rings the picture. 1200×630, colours from
   src/palette.js, Archivo (assets/fonts, OFL), text
   drawn by libass because the ffmpeg npm installs has no drawtext.

   Built with the ffmpeg the server already ships (ffmpeg-static), on
   the first request, and kept on the volume under og/. The page asks
   for card.jpg?v=<hash of everything drawn on it>, so a new piece, a new
   picture or an edited bio gives a new URL and Instagram / iMessage
   fetch a fresh card instead of their cached copy.

   Nothing here can take the page down: if text can't be drawn the card
   is rebuilt as the grid alone, and with no ffmpeg, no fonts or a failed
   build the page falls back to the single-image preview it used before.
================================================================ */
const ffc = (hex) => "0x" + hex.replace("#", "").toUpperCase();   // #RRGGBB → ffmpeg colour
const CARD = { w: 1200, h: 630, gap: 6, bg: ffc(PALETTE.light.bg), el: ffc(PALETTE.light.el), ink: ffc(PALETTE.light.tx), ink2: ffc(PALETTE.light.dim),
  version: 6, panel: 440, pad: 48, avatar: 128, mark: 40 };
/* v6 (2026-10-11): one look with the Story cards — their first piece, blurred
   behind the panel, white type, the mark in white. */
const CARDW = { ink: ffc(PALETTE.dark.tx), shade: ffc(PALETTE.dark.bg), el: ffc(PALETTE.dark.el) };
const CARD_DIR = join(DATA_DIR, "og");
const CARD_FONT = { bold: join(__dirname, "..", "assets", "fonts", "Archivo-Bold.ttf"), reg: join(__dirname, "..", "assets", "fonts", "Archivo-Regular.ttf") };
const CARD_MARK = join(__dirname, "..", "public", "icon-white-512.png");

/* The grid to the right of the panel, by how much work there is: [columns, rows]. */
const cardShape = (n) => (n >= 6 ? [3, 2] : n >= 4 ? [2, 2] : n >= 1 ? [Math.min(n, 3), 1] : null);

/* A file on our own disk for an /uploads/ URL — or null. Never follows
   anything else: a URL from the database is still not a path. */
function cardFile(url) {
  if (typeof url !== "string" || !url.startsWith("/uploads/")) return null;
  const name = url.slice(9).split(/[?#]/)[0];
  if (!name || name.includes("/") || name.includes("\\") || name.includes("..")) return null;
  const f = join(UPLOAD_DIR, name);
  return existsSync(f) ? f : null;
}

/* Archivo has no emoji; drawn, they'd be empty boxes. */
const cardClean = (s) => String(s ?? "").replace(/\p{Extended_Pictographic}|[\u200d\ufe0e\ufe0f\u20e3]|[\u{1F3FB}-\u{1F3FF}]/gu, "").replace(/[ \t]+/g, " ").trim();

/* Word-wrap to a character budget; the last line gets an ellipsis if cut. */
function cardWrap(text, per, maxLines) {
  const lines = [];
  for (const para of cardClean(text).split(/\n+/)) {
    let line = "";
    for (const word of para.split(" ").filter(Boolean)) {
      const w = word.length > per ? word.slice(0, per - 1) + "…" : word;
      if (!line) line = w;
      else if ((line + " " + w).length <= per) line += " " + w;
      else { lines.push(line); line = w; }
    }
    if (line) lines.push(line);
  }
  if (lines.length > maxLines) { const cut = lines.slice(0, maxLines); cut[maxLines - 1] = cut[maxLines - 1].replace(/\s*\S*$/, "") + "…"; return cut; }
  return lines;
}

/* Everything drawn on someone's card, and a hash of it. */
function profileCardTiles(u) {
  const rows = db.prepare(`SELECT id, image_url, images, thumb_url, video_url FROM posts
    WHERE author_id = ? AND is_work = 1 AND shared_from IS NULL ORDER BY created_at DESC LIMIT 40`).all(u.id);
  const tiles = [];
  for (const r of rows) {
    let first = null;
    try { const im = r.images ? JSON.parse(r.images) : null; first = Array.isArray(im) && im.length ? (im[0].url || im[0]) : null; } catch {}
    const still = cardFile(r.image_url) || cardFile(first) || cardFile(r.thumb_url);
    const video = !still && cardFile(r.video_url);
    if (still) tiles.push({ id: r.id, file: still, video: false });
    else if (video) tiles.push({ id: r.id, file: video, video: true });
    if (tiles.length >= 6) break;
  }
  const shape = cardShape(tiles.length);
  const use = shape ? tiles.slice(0, shape[0] * shape[1]) : [];
  const pieces = db.prepare(`SELECT COUNT(*) n FROM posts WHERE author_id = ? AND is_work = 1 AND shared_from IS NULL`).get(u.id).n;
  const collabs = db.prepare(`SELECT COUNT(*) n FROM collaborators WHERE user_id = ? AND status = 'accepted'`).get(u.id).n;
  const name = cardClean(u.display_name) || u.username;
  const text = {
    name: name.length > 22 ? name.slice(0, 21) + "…" : name,
    handle: "@" + u.username,
    bio: cardWrap(u.bio || "", 27, 4),
    stats: [`${pieces} ${pieces === 1 ? "piece" : "pieces"}`, collabs ? `${collabs} ${collabs === 1 ? "collab" : "collabs"}` : null].filter(Boolean).join(" · "),
    initials: cardClean(u.display_name || u.username).slice(0, 2).toUpperCase() || "TN",
  };
  const avatar = cardFile(u.avatar_url);
  const accent = ffc(accentHex(u.accent));   // their colour, as in the app
  const hash = createHash("sha1").update(JSON.stringify([CARD.version, use.map((t) => t.file), avatar, text, accent])).digest("hex").slice(0, 12);
  return { tiles: use, shape, avatar, text, accent, hash };
}

/* ASS colours are &HBBGGRR&; text can't open an override block or
   escape a line break — braces and backslashes are swapped out. */
const assColor = (hex) => { const c = hex.replace(/^0x|^#/, "").padStart(6, "0"); return `&H${c.slice(4, 6)}${c.slice(2, 4)}${c.slice(0, 2)}&`; };
const assText = (s) => String(s).replace(/\\/g, "/").replace(/\{/g, "(").replace(/\}/g, ")").replace(/[\r\n]+/g, " ");

/* ffmpeg's filter language: text goes in files (no escaping games), and
   paths only need : and ' escaped. */
const fpath = (p) => p.replace(/\\/g, "/").replace(/:/g, "\\:").replace(/'/g, "\\'");

/* The ffmpeg command. Pure arithmetic plus the text files it names, so the
   layout is tested without running ffmpeg. textDir null = no text at all. */
function profileCardArgs(card, out, textDir) {
  const { w, h, gap, panel, pad, avatar: A, mark: M } = CARD;
  const args = ["-nostdin", "-y", "-loglevel", "error"];
  const f = [`color=c=${CARDW.shade}:s=${w}x${h}:d=1[c0]`];
  let last = "c0", k = 0, n = 0;
  const lay = (label, x, y) => { f.push(`[${last}][${label}]overlay=${x}:${y}[s${++n}]`); last = `s${n}`; };
  // the ground: their first piece, blurred edge to edge and dimmed — as on their Story card
  if (textDir && card.shape) {
    const g0 = card.tiles[0];
    args.push(...(g0.video ? ["-ss", "1"] : []), "-i", g0.file);
    f.push(`[${k++}:v]scale=${w / 4}:${Math.round(h / 4)}:force_original_aspect_ratio=increase,crop=${w / 4}:${Math.round(h / 4)},boxblur=14:3,scale=${w}:${h},eq=brightness=-0.3:saturation=1.25,vignette=PI/4,setsar=1,format=rgb24[gnd]`);
    lay("gnd", 0, 0);
  }

  // the grid, right of the panel
  const gx = textDir ? panel : 0, gw = w - gx;
  if (card.shape) {
    const [cols, rows] = card.shape;
    const cw = Math.floor((gw - gap * (cols - 1)) / cols), ch = Math.floor((h - gap * (rows - 1)) / rows);
    card.tiles.forEach((t, i) => {
      args.push(...(t.video ? ["-ss", "1"] : []), "-i", t.file);
      f.push(`[${k}:v]scale=${cw}:${ch}:force_original_aspect_ratio=increase,crop=${cw}:${ch},setsar=1,format=rgb24[t${i}]`);
      lay(`t${i}`, gx + (i % cols) * (cw + gap), Math.floor(i / cols) * (ch + gap)); k++;
    });
  } else {
    f.push(`color=c=${CARDW.el}:s=${gw}x${h}:d=1[g]`); lay("g", gx, 0);
  }
  // the mark, bottom-left (and big in the middle of an empty grid)
  const hasMark = existsSync(CARD_MARK);
  if (hasMark) {
    args.push("-i", CARD_MARK); const mi = k++;
    // the mark is black on solid white: key the white out so it sits on the card, not in a box
    // black on white: turned white and the black keyed out, so it sits on the work in white
    f.push(`[${mi}:v]negate,split=2[m0][m1]`, `[m0]scale=${M}:${M},format=rgba,colorkey=0x000000:0.3:0.2[m]`, `[m1]scale=160:160,format=rgba,colorkey=0x000000:0.3:0.2[mb]`);
    lay("m", pad, h - pad - M);
    if (!card.shape) lay("mb", gx + Math.round((gw - 160) / 2), Math.round((h - 160) / 2));
    else f.push(`[mb]nullsink`);
  }
  if (textDir) {
    // the profile picture: a circle, drawn at 2× and scaled down so the edge is smooth
    const circle = `format=rgba,geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='if(lte(hypot(X-${A - 0.5},Y-${A - 0.5}),${A}),255,0)',scale=${A}:${A}`;
    // their accent as a ring, a white gap, then the picture — as on their profile
    const disc = (color, size, label) => { const r = size; f.push(`color=c=${color}:s=${r * 2}x${r * 2}:d=1,format=rgba,geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='if(lte(hypot(X-${r - 0.5},Y-${r - 0.5}),${r}),255,0)',scale=${r}:${r}[${label}]`); };
    disc(card.accent || ffc(PALETTE.accent), A + 12, "ring"); lay("ring", pad - 6, 50);
    disc(CARDW.shade, A + 4, "gap"); lay("gap", pad - 2, 54);
    if (card.avatar) { args.push("-i", card.avatar); f.push(`[${k++}:v]scale=${A * 2}:${A * 2}:force_original_aspect_ratio=increase,crop=${A * 2}:${A * 2},${circle}[av]`); }
    else f.push(`color=c=${CARDW.el}:s=${A * 2}x${A * 2}:d=1,${circle}[av]`);
    lay("av", pad, 56);

    /* Text is one subtitle script rendered by libass, from the Archivo files
       in assets/fonts. (The ffmpeg that npm installs has no drawtext; libass
       it has.) Every line is positioned by its top-left corner, px for px. */
    const T = card.text, lines = [];
    const at = (s, x, y, size, bold, color, an = 7) =>
      lines.push(`Dialogue: 0,0:00:00.00,0:00:10.00,Card,,0,0,0,,{\\an${an}\\pos(${x},${y})\\fs${size}\\b${bold ? 1 : 0}\\c${assColor(color)}}${assText(s)}`);
    if (!card.avatar) at(T.initials, pad + A / 2, 56 + A / 2, 56, true, CARDW.ink, 5);
    const nameSize = T.name.length <= 14 ? 54 : T.name.length <= 18 ? 43 : 36;
    let y = 56 + A + 24;
    at(T.name, pad, y, nameSize, true, CARDW.ink); y += Math.round(nameSize * 1.05) + 6;
    at(T.handle, pad, y, 29, false, CARDW.ink); y += 29 + 20;
    T.bio.forEach((line) => { at(line, pad, y, 30, false, CARDW.ink); y += 35; });
    if (T.bio.length) y += 12;
    at(T.stats, pad, y, 27, true, CARDW.ink);
    if (hasMark) at("LABS ®", pad + M + 12, h - pad - M / 2, 30, true, CARDW.ink, 4);
    const script = join(textDir, "card.ass");
    writeFileSync(script, [
      "[Script Info]", "ScriptType: v4.00+", `PlayResX: ${w}`, `PlayResY: ${h}`, "WrapStyle: 2", "ScaledBorderAndShadow: yes", "",
      "[V4+ Styles]",
      "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
      "Style: Card,Archivo,24,&H00000000,&H00000000,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,0,0,7,0,0,0,1", "",
      "[Events]", "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text", ...lines, "",
    ].join("\n"));
    f.push(`[${last}]ass=filename='${fpath(script)}':fontsdir='${fpath(dirname(CARD_FONT.bold))}'[s${++n}]`);
    last = `s${n}`;
  }
  args.push("-filter_complex", f.join(";"), "-map", `[${last}]`, "-frames:v", "1", "-q:v", "3", out);
  return args;
}

const cardRm = (name) => new Promise((ok) => rm(join(CARD_DIR, name), { recursive: true, force: true }, () => ok()));
const runFfmpeg = (args) => new Promise((resolve, reject) =>
  execFile(FFMPEG, args, { timeout: 30000, maxBuffer: 1024 * 1024 }, (err, _o, stderr) => (err ? reject(new Error(String(stderr || err).slice(0, 300))) : resolve())));

/* One build at a time, and never the same card twice at once — a link
   dropped in a 200-person chat is 200 crawlers asking together. */
const CARD_BUILDS = new Map();
let CARD_CHAIN = Promise.resolve();
function buildProfileCard(userId, card) {
  const out = join(CARD_DIR, `u${userId}-${card.hash}.jpg`);
  if (existsSync(out)) return Promise.resolve(out);
  if (CARD_BUILDS.has(out)) return CARD_BUILDS.get(out);
  const job = (CARD_CHAIN = CARD_CHAIN.catch(() => {}).then(async () => {
    if (!FFMPEG) throw new Error("no ffmpeg");
    const dir = join(CARD_DIR, `tmp-${userId}-${card.hash}`);
    mkdirSync(dir, { recursive: true });
    const tmp = join(dir, "card.jpg");
    try {
      try { await runFfmpeg(profileCardArgs(card, tmp, dir)); }
      catch (e) {
        // text is the fragile part (fonts, filters): the grid alone still beats one image
        logError("card", "text failed, grid only: " + e.message, "", "", "");
        if (!card.shape) throw e;
        await runFfmpeg(profileCardArgs(card, tmp, null));
      }
      if (!existsSync(tmp)) throw new Error("no output");
      await new Promise((ok, no) => rename(tmp, out, (e) => (e ? no(e) : ok())));
      // older cards for this person are dead weight on the volume — gone
      // before this build reports done, so nothing races the next request
      await Promise.all(readdirSync(CARD_DIR).filter((f) => f.startsWith(`u${userId}-`) && f !== `u${userId}-${card.hash}.jpg`).map(cardRm));
      return out;
    } finally { await cardRm(dir.slice(CARD_DIR.length + 1)); }
  }));
  CARD_BUILDS.set(out, job);
  job.finally(() => CARD_BUILDS.delete(out)).catch(() => {});
  return job;
}

/* For the profile page's <head>: the card's URL and size, or null. */
function profileCardMeta(u, base) {
  if (!FFMPEG || !existsSync(CARD_FONT.bold) || !existsSync(CARD_FONT.reg)) return null;
  const card = profileCardTiles(u);
  return { url: `${base}/u/${encodeURIComponent(u.username)}/card.jpg?v=${card.hash}`, w: CARD.w, h: CARD.h };
}

app.get("/u/:username/card.jpg", rateLimit({ max: 120, windowMs: 60000 }), async (req, res) => {
  const u = q.userByName.get(req.params.username);
  if (!u) return res.status(404).end();
  const fallback = () => res.redirect(302, u.avatar_url || "/icon-white-512.png");
  if (!FFMPEG) return fallback();
  try {
    const file = await buildProfileCard(u.id, profileCardTiles(u));
    res.set("Cache-Control", "public, max-age=86400, immutable");
    res.type("jpg").sendFile(file);
  } catch (e) {
    logError("card", e.message || "card build failed", "", req.path, "");
    fallback();
  }
});
