// Moodboards came out (2026-10-11, "I want to simplify — remove moodboards
// for now"). The archive stays as a plain search; nothing in the app makes,
// opens or fills a board — and the boards people already made stay in the
// database, untouched (member data), with their routes still answering.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
let pass = 0, fail = 0;
const t = (n, ok) => { ok ? pass++ : fail++; console.log("  " + (ok ? "✓" : "✗") + "  " + n); };
const app = readFileSync(join(ROOT, "public/index.html"), "utf8");
const server = readFileSync(join(ROOT, "src/server.runtime.js"), "utf8");
console.log("\nNO MOODBOARDS IN THE APP");
t("no Moodboards button, drawer or board page", !/New moodboard|Which moodboard|> Moodboards/.test(app) && !app.includes("boardsHTML") && !app.includes('id="myboards"') && !app.includes('id="bbg"'));
t("no paste-a-link Pull, no embedded boards, no + on archive images", !app.includes('id="pastego"') && !app.includes("pinit.js") && !app.includes("📌") && !app.includes("data-asave"));
t("the archive is still there: sorts and the grid (no search box since 2026-10-21 — pictures aren't labelled)", !app.includes('id="archq"') && app.includes("data-asort") && app.includes('class="archgrid"'));
t("the Visual lab's Archive chip just says the archive", app.includes('id="plarchive">Archive</button>') && !app.includes("your boards"));
console.log("\nNOTHING DELETED");
t("boards and pins tables, and their routes, are kept", server.includes('app.get("/api/boards"') && server.includes('app.post("/api/boards/:id/pin"'));
console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
