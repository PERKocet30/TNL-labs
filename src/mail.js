/* ================================================================
   MAIL v2.2 — 2026-10-23. Verification and password-reset emails,
   in the app's design language (see THE LOOK below).
   v2.2: the weekly "finish your page" reminder (nudgeEmail): one email
   a week to a member whose page has gaps, saying exactly which — a
   photo, their colour, a line about what they make, their first piece,
   music if they're a producer — with one button to the first of them.
   The unsubscribe link now covers every LABS email, not just tournaments.
   v2.1: the "entries are open" email that goes to every member when a
   tournament opens, with an unsubscribe link (and the one-click
   List-Unsubscribe headers mail apps show as a button).

   Uses Resend's HTTP API (https://resend.com) via plain fetch, so
   there is no SMTP library and nothing to install. Free tier covers
   3,000 emails/month, which is plenty to launch.

   Set two environment variables to turn real sending on:
     RESEND_API_KEY=re_xxxxxxxx
     MAIL_FROM="LABS <noreply@tnllabs.com>"   (domain must be verified in Resend)

   If RESEND_API_KEY is absent, we DO NOT pretend the mail was sent.
   The link is logged to the server console and returned to the client
   in dev mode, so you can still test the whole flow.
================================================================ */

import { PALETTE, inkFor } from "./palette.js";

const KEY = process.env.RESEND_API_KEY || "";
const FROM = process.env.MAIL_FROM || "LABS <onboarding@resend.dev>";
/* Replies go to a real inbox (2026-10-18, "optimize"): mail from noreply@ that
   people can answer is better mail — a reply is the strongest "this isn't spam"
   a mailbox sees. SUPPORT_EMAIL is the inbox the public pages already show. */
const REPLY_TO = (process.env.SUPPORT_EMAIL || "").trim();
/* Where Resend lives. Only the tests change it, to a stand-in on localhost. */
const API = (process.env.RESEND_API_BASE || "https://api.resend.com").replace(/\/+$/, "");
export const MAIL_ENABLED = !!KEY;

/* Resend's test sender delivers ONLY to the address that owns the Resend
   account. Everyone else gets nothing — and Resend still returns 200, so
   nothing in the logs looks wrong. It is the single most confusing failure
   in this whole stack, so we call it out at boot rather than let you find
   out when a friend says "I never got an email". */
export const MAIL_TEST_SENDER = /@resend\.dev/i.test(FROM);
if (KEY && MAIL_TEST_SENDER) {
  console.warn(`
⚠  MAIL_FROM is Resend's test sender (${FROM}).
   It will ONLY deliver to the email that owns your Resend account.
   Everyone else gets nothing — silently, with no error.
   Fix: verify tnllabs.com in Resend, then set
        MAIL_FROM=LABS <noreply@tnllabs.com>
`);
}

/* ----------------------------------------------------------------
   THE LOOK — v2.1 2026-09-29. Every email is the app's design language:
   white by default (#FFFFFF, ink #000), Black where the mail app is in
   dark mode, Helvetica Neue / Archivo, a square card ("paper is square"),
   an inverted pill for the one action ("glass is round"), and the //
   mark as the only touch of Reagent. No monospace, no emoji, no images
   that the email depends on — the logo is a bonus if images load.
   Inline styles carry the Paper look (Gmail and Outlook keep those); the
   <style> block only adds dark mode for clients that honour it.
---------------------------------------------------------------- */
/* Email can't use CSS variables, so the colours are read straight from
   src/palette.js — inline for the day look, <style> for dark-mode clients. */
const L = PALETTE.light, D = PALETTE.dark;
const C = { paper: L.bg, card: L.card, ink: L.tx, ink2: L.dim, line: L.line, mark: inkFor(PALETTE.accent, "light") };
const FONT = `'Helvetica Neue',Helvetica,Archivo,Arial,sans-serif`; // single quotes: it sits inside style="…"

/** One layout for every email. Returns { html, text }. */
export function renderEmail({ eyebrow, title, lines, cta, url, note, preheader, unsub }) {
  const origin = (() => { try { return new URL(url).origin; } catch { return "https://tnllabs.com"; } })();
  const href = escapeHtml(url);
  const body = lines.map((l) => `<p class="t2" style="margin:0 0 12px;color:${C.ink2};font-size:15px;line-height:21px">${escapeHtml(l)}</p>`).join("");
  const html = `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark"><meta name="supported-color-schemes" content="light dark">
<title>${escapeHtml(title)}</title>
<style>
  @media (prefers-color-scheme: dark) {
    .bg { background:${D.bg} !important; }
    .card { background:${D.bg} !important; border-color:${D.line} !important; }
    .t1 { color:${D.tx} !important; }
    .t2 { color:${D.dim} !important; }
    .mk { color:${inkFor(PALETTE.accent, "dark")} !important; }
    .btn { background:${D.tx} !important; color:${D.bg} !important; }
    .rule { border-color:${D.line} !important; }
  }
  a { color:inherit; }
</style>
</head>
<body class="bg" style="margin:0;padding:0;background:${C.paper};-webkit-text-size-adjust:100%">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(preheader || lines[0] || "")}</div>
<table role="presentation" class="bg" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.paper}">
<tr><td align="center" style="padding:32px 16px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:480px">
    <tr><td style="padding:0 4px 18px;font-family:${FONT}">
      <img src="${origin}/icon-white-512.png" width="28" height="28" alt="LABS" style="vertical-align:middle;border-radius:50%;border:0">
      <span class="t1" style="vertical-align:middle;margin-left:8px;color:${C.ink};font-size:15px;font-weight:700;letter-spacing:.04em">LABS &reg;</span>
    </td></tr>
    <tr><td class="card" style="background:${C.card};border:1px solid ${C.line};padding:32px 28px;font-family:${FONT}">
      <div class="t2" style="margin:0 0 14px;color:${C.ink2};font-size:12px;line-height:16px;font-weight:700;letter-spacing:.08em;text-transform:uppercase"><span class="mk" style="color:${C.mark}">//</span> ${escapeHtml(eyebrow)}</div>
      <h1 class="t1" style="margin:0 0 16px;color:${C.ink};font-size:30px;line-height:34px;font-weight:700;letter-spacing:-.02em">${escapeHtml(title)}</h1>
      ${body}
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:22px 0 26px"><tr>
        <td class="btn" style="background:${C.ink};border-radius:999px">
          <a class="btn" href="${href}" style="display:inline-block;padding:14px 26px;border-radius:999px;background:${C.ink};color:${C.paper};font-family:${FONT};font-size:15px;line-height:18px;font-weight:700;text-decoration:none">${escapeHtml(cta)}</a>
        </td></tr></table>
      <div class="rule" style="border-top:1px solid ${C.line};padding-top:16px">
        <p class="t2" style="margin:0 0 6px;color:${C.ink2};font-size:12px;line-height:16px">Button not working? Paste this into your browser:</p>
        <p style="margin:0 0 14px;font-size:12px;line-height:16px;word-break:break-all"><a class="t1" href="${href}" style="color:${C.ink};text-decoration:underline">${href}</a></p>
        <p class="t2" style="margin:0;color:${C.ink2};font-size:12px;line-height:16px">${escapeHtml(note)}</p>
      </div>
    </td></tr>
    <tr><td style="padding:18px 4px 0;font-family:${FONT}">
      <p class="t2" style="margin:0;color:${C.ink2};font-size:12px;line-height:16px">Social media by creatives, for creatives.<br><a class="t2" href="${origin}" style="color:${C.ink2};text-decoration:none">${escapeHtml(origin.replace(/^https?:\/\//, ""))}</a>${unsub ? `<br><a class="t2" href="${escapeHtml(unsub)}" style="color:${C.ink2};text-decoration:underline">Unsubscribe from LABS emails</a>` : ""}</p>
    </td></tr>
  </table>
</td></tr></table>
</body></html>`;
  const text = [`LABS ®`, ``, `// ${eyebrow.toUpperCase()}`, title, ``, ...lines, ``, `${cta}: ${url}`, ``, note, ``, `Social media by creatives, for creatives.`, origin, ...(unsub ? [``, `Unsubscribe from LABS emails: ${unsub}`] : [])].join("\n");
  return { html, text };
}

export function verifyEmail(name, url) {
  return renderEmail({
    eyebrow: "Welcome", title: "Confirm your email",
    lines: [`${name ? name + ", one" : "One"} tap and you're in.`, "This link works for 24 hours."],
    cta: "Verify email", url, note: "Didn't sign up? Ignore this email.",
    preheader: "One tap and you're in.",
  });
}

export function resetEmail(name, url) {
  return renderEmail({
    eyebrow: "Account", title: "Reset your password",
    lines: [`${name ? name + ", tap" : "Tap"} below to set a new one.`, "This link works for 1 hour and only once."],
    cta: "Set new password", url, note: "Didn't ask for this? Ignore this email. Nothing changes.",
    preheader: "Set a new password. The link works for 1 hour.",
  });
}

/** A tournament has opened for entries. Goes to every member who hasn't
    unsubscribed; `unsub` is their own one-tap unsubscribe link. */
export function eventOpenEmail({ name, title, brief, prize, closes, url, unsub }) {
  return renderEmail({
    eyebrow: "Tournament", title,
    lines: [`${name ? name + ", entries" : "Entries"} are open.`, brief, prize ? `Prize: ${prize}` : "", `One piece each. Entries close ${closes}.`].filter(Boolean),
    cta: "Enter now", url, unsub,
    note: "You're getting this because you're a member of LABS.",
    preheader: `Entries are open. One piece each, until ${closes}.`,
  });
}
export const eventOpenSubject = (title) => `${title}: entries are open`;

/** The morning voting opens (2026-10-26): `at` is the start time in words
    ("3 PM ET"), `entries` how many pieces are in, `rules` the who-can-vote line. */
export function voteOpenEmail({ name, title, at, entries, picks, rules, url, unsub }) {
  return renderEmail({
    eyebrow: "Tournament", title,
    lines: [`${name ? name + ", voting" : "Voting"} opens today at ${at}.`,
      `${entries} piece${entries === 1 ? " is" : "s are"} in. Pick your favourites — ${picks === 1 ? "one vote" : picks + " votes"} a day, resetting at midnight ET.`,
      "Votes only count in the LABS app, not on Instagram.", rules].filter(Boolean),
    cta: "See the entries", url, unsub,
    note: "You're getting this because you're a member of LABS.",
    preheader: `Voting opens today at ${at}. ${entries} pieces are in.`,
  });
}
export const voteOpenSubject = (title, at) => `${title}: voting opens today at ${at}`;

/** The weekly reminder. `items` are the gaps, first the one the button
    goes to; `done`/`total` are the Get started numbers. The words for
    each gap live here so the email and the admin preview agree. */
export const NUDGE_ITEMS = {
  photo:  { title: "Add a profile photo", line: "People follow faces. A photo makes the page yours.", cta: "Add a photo" },
  music:  { title: "Upload your music", line: "Your page says {role}, but there's no music on it yet. One track is enough to start.", cta: "Upload a track" },
  piece:  { title: "Post your first piece", line: "Your page is empty until you post. One piece is enough.", cta: "Post a piece" },
  bio:    { title: "Say what you make", line: "One line under your name tells people why to follow you.", cta: "Write your line" },
  love:   { title: "Say what you love", line: "One line under your name tells artists what you're into.", cta: "Write your line" },
  support: { title: "Like 3 pieces you love", line: "Every like counts for the artist who made it. Three is a start.", cta: "Find pieces" },
  colour: { title: "Pick your colour", line: "Every member has one. It wraps your avatar and colours your page.", cta: "Pick a colour" },
  follow: { title: "Follow 3 people", line: "Your feed is built from who you follow. Three is a start.", cta: "Find people" },
  market: { title: "List a piece in the Market", line: "Your page says {role}. List one piece and it's on your page and in the Market.", cta: "List a piece" },
};
export function nudgeEmail({ name, items, role, done, total, url, unsub }) {
  const [top, ...rest] = items.map((k) => ({ k, ...NUDGE_ITEMS[k] })).filter((i) => i.title);
  const said = (s) => s.replace("{role}", role || "you make things");
  return renderEmail({
    eyebrow: "Your page", title: top.title,
    lines: [`${name ? name + ", your" : "Your"} page is ${done} of ${total} done.`, said(top.line),
      rest.length ? `Also still open: ${rest.map((i) => i.title.toLowerCase()).join(", ")}.` : ""].filter(Boolean),
    cta: top.cta, url, unsub,
    note: "One of these a week at most, and none once your page is done. You're getting this because you're a member of LABS.",
    preheader: `${done} of ${total} done. ${said(top.line)}`,
  });
}
export const nudgeSubject = (k) => `${NUDGE_ITEMS[k]?.title || "Finish your page"} — LABS`;
export async function sendNudgeEmail(to, subject, mail, unsub) {
  return send(to, subject, mail, `${subject} — ${to}`, {
    "List-Unsubscribe": `<${unsub}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  });
}
export async function sendEventOpenEmail(to, subject, mail, unsub) {
  return send(to, subject, mail, `${subject} — ${to}`, {
    "List-Unsubscribe": `<${unsub}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  });
}

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/** Returns { sent: boolean, error?: string }. Never throws. */
export async function sendVerifyEmail(to, name, url) {
  return send(to, "Confirm your email — LABS", verifyEmail(name, url), `verify link: ${url}`);
}

/** Alerts and the morning digest, to the admin. Same layout as every other
    email: a heading, a few lines, one button to Admin → System. */
export function alertEmail(heading, lines, url) {
  return renderEmail({
    eyebrow: "Watch", title: heading, lines, cta: "Open Admin", url,
    note: "Sent to the admin address by the app's watch.", preheader: lines[0] || heading,
  });
}
export async function sendAlertEmail(to, subject, heading, lines, url) {
  return send(to, subject, alertEmail(heading, lines, url), `${subject} — ${lines.join(" / ")}`);
}

/** The week, to the admin (server-10-weekly.js, 2026-10-26): section headings
    as their own lines, the rest as sentences — same layout as every email. */
export function weeklyEmail(subject, lines, url) {
  return renderEmail({
    eyebrow: "This week", title: subject.replace(/^LABS this week:\s*/, "")   /* the eyebrow says "This week"; the title is the three numbers */, lines, cta: "Open Admin", url,
    note: "Every Monday morning. Counts and patterns only — never a member's name.", preheader: lines.find((l) => !l.startsWith("—")) || subject,
  });
}
export async function sendWeeklyEmail(to, subject, lines, url) {
  return send(to, subject, weeklyEmail(subject, lines, url), `${subject} — ${lines.length} lines`);
}

/** Password reset. Same honest fallback as verification. */
export async function sendResetEmail(to, name, url) {
  return send(to, "Reset your password — LABS", resetEmail(name, url), `reset link: ${url}`);
}

async function send(to, subject, { html, text }, logLine, headers = null) {
  if (!KEY) {
    console.log(`\n[mail] NOT CONFIGURED — no email sent to ${to}`);
    console.log(`[mail] ${logLine}\n`);
    return { sent: false, error: "mail not configured", reason: "no_key" };
  }
  try {
    const res = await fetch(API + "/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM, to: [to], subject, html, text, ...(REPLY_TO ? { reply_to: REPLY_TO } : {}), ...(headers ? { headers } : {}) }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      /* A status code alone sends you hunting. Name the actual cause —
         these three account for essentially every failure, and they need
         completely different fixes. */
      const why =
        res.status === 401 ? "RESEND_API_KEY is wrong or was regenerated — Railway still has the old one"
        : res.status === 403 ? `Resend won't send from "${FROM}" — the domain isn't verified for this account`
        : res.status === 422 ? `Resend rejected the payload — usually a malformed MAIL_FROM ("${FROM}")`
        : res.status === 429 ? "rate limited by Resend"
        : `Resend returned ${res.status}`;
      console.error(`[mail] FAILED -> ${to}`);
      console.error(`[mail]   why: ${why}`);
      console.error(`[mail]   from: ${FROM}`);
      console.error(`[mail]   resend said: ${body.slice(0, 300)}`);
      console.error(`[mail]   the link, since they won't get it: ${logLine}`);
      return { sent: false, error: why, status: res.status, raw: body.slice(0, 300) };
    }
    const out = await res.json().catch(() => ({}));
    console.log(`[mail] sent -> ${to} (resend id ${out.id || "?"})`);
    return { sent: true, id: out.id };
  } catch (e) {
    // DNS, network, Railway egress — the send never left the building
    console.error(`[mail] THREW before reaching Resend: ${e.message}`);
    console.error(`[mail]   the link: ${logLine}`);
    return { sent: false, error: `couldn't reach Resend: ${e.message}`, reason: "network" };
  }
}
