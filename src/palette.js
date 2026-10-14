/* ================================================================
   PALETTE v1.0 — 2026-09-29. Every colour TNL LABS uses, in one place.

   Change a colour here and it changes everywhere:
     • the app          — assemble.mjs writes paletteCss() into index.html
                          at the @palette marker in app-02-styles-base.css
     • /admin           — admin.html links /palette.css (served from here)
     • server pages     — lookPage() (server-01-look.js) inlines paletteCss()
     • emails           — mail.js reads PALETTE directly (email can't use CSS vars)
     • the share card   — server-10-profile-card.js reads PALETTE directly
     • member accents   — ACCENTS lives here; db.js re-exports it

   The brand is white, black and green: true white and neutral greys by
   day, black by night, Reagent green as the app's accent. Each member can
   pick their own accent; accentSet() makes any accent readable the same
   way the app does it (inkFor / onAccent in app-08-state-ui.js — a test
   keeps the two in step).

   CSS variable names are the app's. Pages that need a member's colour set
   --acc / --on-acc / --acc-l / --acc-d on <html> (accentVars()).
================================================================ */

export const PALETTE = {
  light: {
    bg: "#FFFFFF",      // the ground
    card: "#FFFFFF",    // cards sit on white, told apart by their line
    el: "#F2F2F2",      // raised: inputs, chips, empty avatars
    tx: "#000000",      // ink
    tx2: "#333333",     // secondary ink
    dim: "#5C5C5C",     // captions, meta — the quiet grey
    line: "#E6E6E6",    // hairlines, as a solid (email, images)
    fgRgb: "0,0,0",     // ink as r,g,b — the app draws lines as rgba(ink, .12)
    scrim: "rgba(0,0,0,.45)",
    red: "#C9302C",
    err: "#B42318",
  },
  dark: {
    bg: "#000000",
    card: "#0A0A0A",
    el: "#141414",
    tx: "#FFFFFF",
    tx2: "#D9D9D9",
    dim: "#9A9A9A",
    line: "#262626",
    fgRgb: "255,255,255",
    scrim: "rgba(0,0,0,.72)",
    red: "#FF6B66",
    err: "#F87171",
  },
  accent: "#98FC68",    // Reagent — the flask. The app's one accent.
  onAccent: "#152C09",  // Reagent ink: text that sits on the green
};

/* The accents members can pick (Profile → edit). Keys are stored on the
   user row; never rename one. */
export const ACCENTS = {
  /* v2 (2026-10-14, "colors aren't matching up — a better selection"): nine
     colours evenly round the wheel, all as vivid as the flask, in order.
     Crimson (a second red) and Bone (barely a colour) are kept for the
     members who chose them, but no longer offered (legacy). */
  lab:    { name: "Lab",    hex: "#98FC68" },   // the flask. the default.
  mint:   { name: "Mint",   hex: "#2EE6B4" },
  ice:    { name: "Ice",    hex: "#38BDF8" },
  cobalt: { name: "Cobalt", hex: "#4F63FF" },
  violet: { name: "Violet", hex: "#A855F7" },
  bloom:  { name: "Bloom",  hex: "#EC4899" },
  blood:  { name: "Red",    hex: "#EF4444" },
  heat:   { name: "Heat",   hex: "#FF5A1F" },
  gold:   { name: "Gold",   hex: "#FBBF24" },
  crimson:{ name: "Crimson",hex: "#DC143C", legacy: true },
  bone:   { name: "Bone",   hex: "#E7E1D2", legacy: true },
};
export const accentHex = (key) => (ACCENTS[key] || ACCENTS.lab).hex;

/* ---- accent maths: identical to the app's inkFor / onAccent ---- */
const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const lum = (c) => { const v = c.map((x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); }); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
const hexOf = (c) => "#" + c.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("").toUpperCase();
const isHex = (h) => /^#[0-9a-f]{6}$/i.test(h || "");

/** An accent as text: the same colour, only darker (day) or lighter
    (night) until it reads at 4.5:1 — moved in OKLCH, so lime stays a green
    and gold stays gold, not olive and mud (v2, 2026-10-14). The app's copy
    in app-08-state-ui.js is the same maths; test/palette.test.mjs checks. */
export function inkFor(hex, theme) {
  if (!isHex(hex)) return hex;
  const lin = (x) => { x /= 255; return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); };
  const gam = (x) => (x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055) * 255;
  const [r, g, b] = rgb(hex).map(lin);
  const l_ = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b), m_ = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b), s_ = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_, A = 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_, B = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_;
  const back = (L2, k) => { const l = (L2 + 0.3963377774 * A * k + 0.2158037573 * B * k) ** 3, m = (L2 - 0.1055613458 * A * k - 0.0638541728 * B * k) ** 3, q = (L2 - 0.0894841775 * A * k - 1.291485548 * B * k) ** 3;
    return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * q, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * q, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * q]; };
  const at = (L2) => { let k = 1, c = back(L2, k); while (k > 0 && c.some((v) => v < 0 || v > 1)) { k -= 0.02; c = back(L2, k); } return c.map((v) => Math.min(1, Math.max(0, v))); };
  const Y = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  const ok = (c) => (theme === "light" ? 0.86 / (Y(c) + 0.05) : (Y(c) + 0.05) / 0.05) >= 4.5;
  let c = [r, g, b];
  if (ok(c)) return hex.toUpperCase();
  for (let L2 = L; L2 > 0 && L2 < 1 && !ok(c); L2 += theme === "light" ? -0.005 : 0.005) c = at(L2);
  return hexOf(c.map(gam));
}
/** The ink for text sitting ON an accent fill. */
export const onAccent = (hex) => (!isHex(hex) ? PALETTE.onAccent : lum(rgb(hex)) > 0.3 ? PALETTE.onAccent : "#FFFFFF");

/** Everything a page needs to wear one accent. */
export function accentSet(hex) {
  const fill = isHex(hex) ? hex.toUpperCase() : PALETTE.accent;
  return { fill, on: onAccent(fill), light: inkFor(fill, "light"), dark: inkFor(fill, "dark") };
}
/** …as CSS variables for a style="" attribute. */
export const accentVars = (hex) => { const a = accentSet(hex); return `--acc:${a.fill};--on-acc:${a.on};--acc-l:${a.light};--acc-d:${a.dark}`; };

/** The theme variables every stylesheet uses. Day by default; [data-theme]
    picks either explicitly. The accent can be overridden per page (--acc…)
    or per person in the app (applyAccent sets --green / --accent-fill). */
export function paletteCss() {
  const block = (t, mode) => [
    `--bg:${t.bg}`, `--card:${t.card}`, `--el:${t.el}`, `--tx:${t.tx}`, `--tx2:${t.tx2}`, `--dim:${t.dim}`,
    `--fg-rgb:${t.fgRgb}`, `--line:rgba(var(--fg-rgb),.12)`, `--line2:rgba(var(--fg-rgb),.28)`, `--hair:${t.line}`,
    `--green:var(--acc-${mode === "light" ? "l" : "d"},${inkFor(PALETTE.accent, mode)})`,
    `--accent-fill:var(--acc,${PALETTE.accent})`, `--on-accent:var(--on-acc,${PALETTE.onAccent})`,
    `--fill:var(--accent-fill)`, `--on-fill:var(--on-accent)`,
    `--scrim:${t.scrim}`, `--red:${t.red}`, `--err:${t.err}`,
  ].join(";");
  return `/* palette.js v1.0 — generated; edit src/palette.js, not this */
:root,[data-theme="light"]{${block(PALETTE.light, "light")}}
[data-theme="dark"]{${block(PALETTE.dark, "dark")}}`;
}
