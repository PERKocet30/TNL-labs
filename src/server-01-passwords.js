/* ================================================================
   PASSWORDS v1.0 — 2026-10-19. "Passwords should be more complicated."
   A new password (joining, or a reset) needs 8+ characters, a letter and
   a number, and mustn't be a well-known password or the member's own
   username or email name. Existing passwords keep working; the rule
   applies the next time one is chosen. The join screen shows the same
   checklist live (pwRules in app-11-gate-screens.js); this is the one
   that counts. test/passwords.test.mjs.
================================================================ */
const PW_COMMON = new Set(["password", "password1", "password12", "password123", "passw0rd", "12345678", "123456789", "1234567890",
  "qwerty123", "qwertyuiop", "1q2w3e4r", "1qaz2wsx", "abc12345", "abcd1234", "iloveyou1", "letmein1", "welcome1", "admin123",
  "football1", "baseball1", "monkey123", "dragon123", "sunshine1", "princess1", "trustno1", "11111111", "00000000", "asdf1234",
  "zaq12wsx", "tnllabs1", "tnllabs123", "labs1234"]);
function pwProblem(pw, { username = "", email = "" } = {}) {
  const p = String(pw || ""), low = p.toLowerCase();
  if (p.length < 8) return "Use at least 8 characters.";
  if (p.length > 200) return "That password is too long.";
  if (!/[a-z]/i.test(p) || !/[0-9]/.test(p)) return "Use at least one letter and one number.";
  if (PW_COMMON.has(low)) return "That password is too common. Pick something only you would use.";
  const name = String(email || "").split("@")[0].toLowerCase();
  if ((username && low.includes(String(username).toLowerCase())) || (name.length >= 4 && low.includes(name)))
    return "Don't use your username or email in your password.";
  return null;
}
