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
  if (!KEY) {
    console.log(`\n[mail] NOT CONFIGURED — no email sent to ${to}`);
    console.log(`[mail] verification link: ${url}\n`);
    return { sent: false, error: "mail not configured" };
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: FROM,
        to: [to],
        subject: "Confirm your email — TNL LABS",
        html: verifyTemplate(name, url),
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error("[mail] send failed:", res.status, body);
      return { sent: false, error: `provider returned ${res.status}` };
    }
    return { sent: true };
  } catch (e) {
    console.error("[mail] send threw:", e.message);
    return { sent: false, error: e.message };
  }
}
