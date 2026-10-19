// FEES v1.0 — 2026-10-18: "if an admin is selling on the app it doesn't make
// sense to be taxed a fee that will go back to me", and fees stay discreet —
// a seller's rate isn't handed to buyers.
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdirSync, rmSync, readFileSync } from "node:fs";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const TMP = join(ROOT, "test", ".tmp", "fees");
rmSync(TMP, { recursive: true, force: true }); mkdirSync(TMP, { recursive: true });
process.env.TNL_DATA = TMP;
const { feeFor, feeForSeller, feeForRep, FEE_BY_LEVEL } = await import(join(ROOT, "src/db.js"));
let pass = 0, fail = 0;
const t = (n, ok) => { ok ? pass++ : fail++; console.log("  " + (ok ? "✓" : "✗") + "  " + n); };
const read = (f) => readFileSync(join(ROOT, "src", f), "utf8");

console.log("\nWHO PAYS WHAT");
t("an admin sells at 0%, whatever their level", feeFor({ rep: 0, is_admin: 1 }) === 0 && feeFor({ rep: 99999, is_admin: 1 }) === 0);
t("everyone else by level, as before", feeFor({ rep: 0, is_admin: 0 }) === FEE_BY_LEVEL[1] && feeFor({ rep: 99999 }) === feeForRep(99999));
t("no user → the starting rate", feeFor(null) === FEE_BY_LEVEL[1]);
t("feeForSeller agrees (for queries with rep + is_admin)", feeForSeller(500, 1) === 0 && feeForSeller(500, 0) === feeForRep(500));

console.log("\nWIRED IN");
t("checkout (one item and the bag) charges the seller's fee via feeFor", read("server-07-orders-sharing.js").includes("feePct: feeFor(seller)") && read("server-07-cart.js").includes("feePct: feeFor(seller), collectShipping: true"));
t("the seller's own numbers and the form use it too", read("server-07-cart.js").includes("const fee = feeFor(req.user);") && read("server-06-settings-payouts-market.js").includes("feePct: req.user ? feeFor(req.user)"));
t("admin estimates don't count a commission on admins' sales", read("server-10-admin.js").includes("feeForSeller(o.seller_rep, o.seller_admin)") && read("server-04-admin-dashboard.js").includes("feeForSeller(r.rep, r.is_admin)"));
t("nothing money-related still uses the level alone", !/feeForRep\(/.test(["server-06-settings-payouts-market.js", "server-07-cart.js", "server-07-orders-sharing.js", "server-04-admin-dashboard.js", "server-10-admin.js", "server-10-admin2-members.js"].map(read).join("\n")));
t("a seller's rate isn't sent to buyers with their profile", !/fee: fee/.test(read("server-08-trust-library.js")));
console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
