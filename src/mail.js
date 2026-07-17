/* ================================================================
   MAIL — verification emails.

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

function verifyTemplate(name, url) {
  return `<!doctype html>
<html><body style="margin:0;background:#000;font-family:Helvetica,Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#000;padding:36px 16px">
    <tr><td align="center">
      <table width="100%" style="max-width:460px;background:#0A0A0A;border:1px solid rgba(255,255,255,.12);border-radius:14px;padding:30px">
        <tr><td>
          <div style="color:#22C55E;font-size:11px;letter-spacing:.16em;font-family:monospace">TNLLABS &#129514;</div>
          <h1 style="color:#fff;font-size:24px;margin:16px 0 10px;text-transform:uppercase;letter-spacing:-.5px">Confirm your email</h1>
          <p style="color:#8A8A8A;font-size:14px;line-height:1.6;margin:0 0 22px">
            ${escapeHtml(name)} — one tap and you're in. This link works for 24 hours.
          </p>
          <a href="${url}" style="display:inline-block;background:#fff;color:#000;text-decoration:none;font-weight:700;font-size:14px;padding:13px 22px;border-radius:9px">Verify email</a>
          <p style="color:#5A5A5A;font-size:11px;line-height:1.6;margin:22px 0 0;font-family:monospace;word-break:break-all">
            Or paste this link:<br>${url}
          </p>
          <p style="color:#5A5A5A;font-size:11px;margin:20px 0 0">Didn't sign up? Ignore this email.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/** Returns { sent: boolean, error?: string }. Never throws. */
export async function sendVerifyEmail(to, name, url) {
  return send(to, "Confirm your email — TNL LABS",
    verifyTemplate(name, url), `verify link: ${url}`);
}

/** Password reset. Same honest fallback as verification. */
export async function sendResetEmail(to, name, url) {
  return send(to, "Reset your password — TNL LABS",
    resetTemplate(name, url), `reset link: ${url}`);
}

function resetTemplate(name, url) {
  return `<!doctype html>
<html><body style="margin:0;background:#000;font-family:Helvetica,Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#000;padding:36px 16px">
    <tr><td align="center">
      <table width="100%" style="max-width:460px;background:#0A0A0A;border:1px solid rgba(255,255,255,.12);border-radius:14px;padding:30px">
        <tr><td>
          <div style="color:#22C55E;font-size:11px;letter-spacing:.16em;font-family:monospace">TNLLABS &#129514;</div>
          <h1 style="color:#fff;font-size:24px;margin:16px 0 10px;text-transform:uppercase;letter-spacing:-.5px">Reset your password</h1>
          <p style="color:#8A8A8A;font-size:14px;line-height:1.6;margin:0 0 22px">
            ${escapeHtml(name)} — tap below to set a new one. This link works for 1 hour and can only be used once.
          </p>
          <a href="${url}" style="display:inline-block;background:#fff;color:#000;text-decoration:none;font-weight:700;font-size:14px;padding:13px 22px;border-radius:9px">Set new password</a>
          <p style="color:#5A5A5A;font-size:11px;line-height:1.6;margin:22px 0 0;font-family:monospace;word-break:break-all">
            Or paste this link:<br>${url}
          </p>
          <p style="color:#5A5A5A;font-size:11px;margin:20px 0 0">Didn't ask for this? Ignore this email — nothing changes.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

async function send(to, subject, html, logLine) {
  if (!KEY) {
    console.log(`\n[mail] NOT CONFIGURED — no email sent to ${to}`);
    console.log(`[mail] ${logLine}\n`);
    return { sent: false, error: "mail not configured", reason: "no_key" };
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM, to: [to], subject, html }),
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
