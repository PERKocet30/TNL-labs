// A public profile never carries private account fields (2026-10-07: the
// profile route handed every member's email to anyone, signed in or not).
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { readFileSync } from "node:fs";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
let pass = 0, fail = 0;
const t = (n, ok) => { ok ? pass++ : fail++; console.log("  " + (ok ? "✓" : "✗") + "  " + n); };
const rt = readFileSync(join(ROOT, "src/server.runtime.js"), "utf8");
const pick = (name) => { const i = rt.indexOf("function " + name + "("); let d = 0, j = rt.indexOf("{", i); for (; j < rt.length; j++) { if (rt[j] === "{") d++; else if (rt[j] === "}" && !--d) break; } return rt.slice(i, j + 1); };
const fields = rt.slice(rt.indexOf("const PRIVATE_FIELDS"), rt.indexOf(";", rt.indexOf("const PRIVATE_FIELDS")) + 1);
const F = new Function("publicUser", fields + pick("profileUser") + "\nreturn profileUser;")(
  (u) => ({ username: u.username, displayName: "X", email: "x@y.com", emailVerified: true, payoutsReady: true, hasStripe: true, isAdmin: true, published: true, bio: "hi" }));
const me = { id: 1, username: "me" };
console.log("\nPROFILE PRIVACY");
const anon = F(me, null), other = F(me, { id: 2 }), self = F(me, { id: 1 });
for (const k of ["email", "emailVerified", "payoutsReady", "hasStripe", "isAdmin", "published"]) t(`${k}: hidden from visitors and other members`, !(k in anon) && !(k in other));
t("the public parts are still there", anon.username === "me" && anon.bio === "hi");
t("you still see your own email", self.email === "x@y.com" && self.payoutsReady === true);
const route = rt.slice(rt.indexOf('app.get("/api/users/:username"'), rt.indexOf("/* Following feed"));
t("the profile route sends profileUser, not publicUser", route.includes("user: profileUser(u, req.user)") && !route.includes("publicUser("));
console.log(`\n  ${pass} passed, ${fail} failed`);
