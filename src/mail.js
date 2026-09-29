/* ================================================================
   MAIL v2.0 — 2026-09-29. Verification and password-reset emails,
   in the app's design language (see THE LOOK below).

   Uses Resend's HTTP API (https://resend.com) via plain fetch, so
   there is no SMTP library and nothing to install. Free tier covers
   3,000 emails/month, which is plenty to launch.

   Set two environment variables to turn real sending on:
     RESEND_API_KEY=re_xxxxxxxx
     MAIL_FROM="TNL LABS <noreply@tnllabs.com>"   (domain must be verified in Resend)

   If RESEND_API_KEY is absent, we DO NOT pretend the mail was sent.
   The link is logged to the server console and returned to the client
   in dev mode, so you can still test the whole flow.
================================================================ */

const KEY = process.env.RESEND_API_KEY || "";
const FROM = process.env.MAIL_FROM || "TNL LABS <onboarding@resend.dev>";
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
        MAIL_FROM=TNL LABS <noreply@tnllabs.com>
`);
}

/* ----------------------------------------------------------------
   THE LOOK — v2.0 2026-09-29. Every email is the app's design language:
   Paper by default (#F7F1F1, ink #000), Black where the mail app is in
   dark mode, Helvetica Neue / Archivo, a square card ("paper is square"),
   an inverted pill for the one action ("glass is round"), and the //
   mark as the only touch of Reagent. No monospace, no emoji, no images
   that the email depends on — the logo is a bonus if images load.
   Inline styles carry the Paper look (Gmail and Outlook keep those); the
   <style> block only adds dark mode for clients that honour it.
---------------------------------------------------------------- */
const C = {
  paper: "#F7F1F1", card: "#FBF8F8", ink: "#000000", ink2: "#5E5856", line: "#E3DADA", mark: "#3A5A26",
};
const FONT = `'Helvetica Neue',Helvetica,Archivo,Arial,sans-serif`; // single quotes: it sits inside style="…"

/** One layout for every email. Returns { html, text }. */
export function renderEmail({ eyebrow, title, lines, cta, url, note, preheader }) {
  const origin = (() => { try { return new URL(url).origin; } catch { return "https://labs.tnllabs.com"; } })();
  const href = escapeHtml(url);
  const body = lines.map((l) => `<p class="t2" style="margin:0 0 12px;color:${C.ink2};font-size:15px;line-height:21px">${escapeHtml(l)}</p>`).join("");
  const html = `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark"><meta name="supported-color-schemes" content="light dark">
<title>${escapeHtml(title)}</title>
<style>
  @media (prefers-color-scheme: dark) {
    .bg { background:#000000 !important; }
    .card { background:#000000 !important; border-color:#262424 !important; }
    .t1 { color:#F7F1F1 !important; }
    .t2 { color:#9A9392 !important; }
    .mk { color:#98FC68 !important; }
    .btn { background:#F7F1F1 !important; color:#000000 !important; }
    .rule { border-color:#262424 !important; }
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
      <img src="${origin}/icon-512.png" width="28" height="28" alt="TNL" style="vertical-align:middle;border-radius:50%;border:0">
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
      <p class="t2" style="margin:0;color:${C.ink2};font-size:12px;line-height:16px">Social media by creatives, for creatives.<br><a class="t2" href="${origin}" style="color:${C.ink2};text-decoration:none">${escapeHtml(origin.replace(/^https?:\/\//, ""))}</a></p>
    </td></tr>
  </table>
</td></tr></table>
</body></html>`;
  const text = [`LABS ®`, ``, `// ${eyebrow.toUpperCase()}`, title, ``, ...lines, ``, `${cta}: ${url}`, ``, note, ``, `Social media by creatives, for creatives.`, origin].join("\n");
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

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/** Returns { sent: boolean, error?: string }. Never throws. */
export async function sendVerifyEmail(to, name, url) {
  return send(to, "Confirm your email — TNL LABS", verifyEmail(name, url), `verify link: ${url}`);
}

/** Password reset. Same honest fallback as verification. */
export async function sendResetEmail(to, name, url) {
  return send(to, "Reset your password — TNL LABS", resetEmail(name, url), `reset link: ${url}`);
}

async function send(to, subject, { html, text }, logLine) {
  if (!KEY) {
    console.log(`\n[mail] NOT CONFIGURED — no email sent to ${to}`);
    console.log(`[mail] ${logLine}\n`);
    return { sent: false, error: "mail not configured", reason: "no_key" };
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM, to: [to], subject, html, text }),
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
