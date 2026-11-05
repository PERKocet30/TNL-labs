// FOREIGN ERRORS v1.0 (2026-11-05): "40 app crashes on members' screens in the last hour" — all 40 were
// one visitor's browser extension (chrome-extension://…/executors/200.js) throwing on our page. An error
// from someone else's code is kept as "foreign": Health still lists it, but it never sets off the crash
// email or the error counts. Its bare "unhandled promise rejection" twins follow it. Our own crashes
// still count. Also: the tournament share picture failing after the sheet closed (EVSHARE null).
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdirSync, rmSync, readFileSync } from "node:fs";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(ROOT, "test/.tmp/foreign-errors");
rmSync(DATA, { recursive: true, force: true }); mkdirSync(DATA, { recursive: true });
process.env.TNL_DATA = DATA; process.env.TNL_NO_WATCH = "1";
let pass = 0, fail = 0;
const t = (n, ok) => { ok ? pass++ : fail++; console.log("  " + (ok ? "✓" : "✗") + "  " + n); };
const { db, logError } = await import("../src/db.js");
const cb = readFileSync(join(ROOT, "src/server/admin/controls-backups.js"), "utf8");
const a = cb.indexOf("const FOREIGN_ERR"), z = cb.indexOf("\n});", cb.indexOf('app.post("/api/client-error"')) + 4;
const routes = {};
new Function("db", "app", "maybeAuth", "rateLimit", "logError", cb.slice(a, z))(db, { post: (p, ...h) => routes[p] = h.at(-1) }, null, () => null, logError);
const send = (message, detail) => routes["/api/client-error"]({ body: { message, detail, path: "/" } }, { json: () => {} });
const kinds = () => db.prepare(`SELECT kind, COUNT(*) n FROM error_log GROUP BY kind`).all().reduce((o, r) => (o[r.kind] = r.n, o), {});
send("Cannot read properties of undefined (reading 'M_ID')", "TypeError: Cannot read properties of undefined (reading 'M_ID')\n    at Y (chrome-extension://eppiocemhmnlbhjplcgkofciiegomcon/executors/200.js:1:761)");
t("an error from a browser extension is kept as foreign", kinds().foreign === 1 && !kinds().client);
for (let i = 0; i < 39; i++) send("Cannot read properties of undefined (reading 'M_ID')", "unhandled promise rejection");
t("…and its 39 bare 'unhandled promise rejection' twins follow it", kinds().foreign === 40 && !kinds().client);
send("Uncaught Error: Error invoking postMessage: Java object is gone", "at sendDataToNative (iabjs://navigation_performance_logger_android:1:11722)");
send("TypeError: undefined is not an object (evaluating 'window._META.IABInnerFrame')", "@https://tnllabs.com/:1:51");
send("TypeError: undefined is not an object (evaluating 'window.ethereum.selectedAddress = undefined')", "global code@https://tnllabs.com/:1:16");
t("Instagram's and Facebook's in-app scripts and crypto wallets are foreign too", kinds().foreign === 43 && !kinds().client);
send("Uncaught TypeError: Cannot set properties of null (setting 'failed')", "at pic.onerror (https://tnllabs.com/?e=art-tournament&v=10:9601:65)");
send("Something of ours", "unhandled promise rejection");
t("our own crashes still count as crashes — a bare rejection with no foreign twin included", kinds().client === 2);
t("'Script error.' is still dropped", (send("Script error.", ""), kinds().client === 2 && kinds().foreign === 43));
const watch = readFileSync(join(ROOT, "src/server/admin/watch.js"), "utf8");
t("the crash email counts only ours", watch.includes(`"SELECT COUNT(*) n FROM error_log WHERE kind = 'client' AND created_at >= ?"`));
t("the headline counts (Needs you, the digest, the week, Health) leave foreign out", ["network.js", "admin.js", "weekly.js", "watch.js", "report.js", "controls-backups.js"].every((f) => readFileSync(join(ROOT, "src/server/admin/" + f), "utf8").includes("kind != 'foreign'")));
t("the tournament share picture failing after the sheet closed does nothing (no crash)", readFileSync(join(ROOT, "src/app/events/poll.js"), "utf8").includes("pic.onerror=()=>{if(!EVSHARE)return;EVSHARE.failed=true;render()}"));
console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
