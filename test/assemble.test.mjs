// THE FLATTEN v1.0 (2026-10-31): parts live in feature folders and the two order
// files decide the build. This checks the joiner keeps its promises: the order
// file and the disk must agree (a part silently left out is worse than a loud
// failure), nothing is added between parts, and a wrong order file stops the boot.
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdirSync, rmSync, writeFileSync, readFileSync } from "node:fs";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const TMP = join(ROOT, "test", ".tmp", "assemble");
rmSync(TMP, { recursive: true, force: true }); mkdirSync(join(TMP, "a"), { recursive: true }); mkdirSync(join(TMP, "b"));
let pass = 0, fail = 0;
const t = (n, ok) => { ok ? pass++ : fail++; console.log("  " + (ok ? "✓" : "✗") + "  " + n); };

const { TARGETS, partsFor, assemble } = await import("../src/assemble.mjs");
const { APP } = await import("../src/app/order.mjs");
const { SERVER } = await import("../src/server/order.mjs");

console.log("\nTHE REAL THING");
const built = assemble({ quiet: true });
t("the app and the server both build", built["public/index.html"].parts === APP.length && built["src/server.runtime.js"].parts === SERVER.length);
t("the app order starts with the page head and ends with the tail", APP[0] === "shell/head.html" && APP[APP.length - 1] === "shell/tail.html");
t("every CSS part comes before every script part (styles can't follow the app's code)", APP.findIndex((f) => f.endsWith(".js")) > APP.map((f) => f.endsWith(".css")).lastIndexOf(true));
t("the server starts with boot", SERVER[0] === "core/boot.js");
t("no file is listed twice", new Set(APP).size === APP.length && new Set(SERVER).size === SERVER.length);
t("every listed file sits in a feature folder (feature/name.ext)", [...APP, ...SERVER].every((f) => /^[a-z-]+\/[a-z0-9.-]+\.(html|css|js)$/.test(f)));
const html = readFileSync(join(ROOT, "public/index.html"), "utf8");
t("parts are joined with nothing between them", html.startsWith(readFileSync(join(ROOT, "src/app/shell/head.html"), "utf8")) && html.endsWith(readFileSync(join(ROOT, "src/app/shell/tail.html"), "utf8")));
t("the colours went in where the marker was", !html.includes("/*@palette*/") && /--bg:/.test(html));
/* v2.1: a part's opening comment block (its version history) stays out of the page */
const opener = (f) => { const m = /^\s*(\/\*[\s\S]*?\*\/)/.exec(readFileSync(join(ROOT, "src/app", f), "utf8")); return m && m[1]; };
const openers = APP.filter((f) => /\.(js|css)$/.test(f)).map(opener).filter((x) => x && x.length > 40 && !x.includes("@palette"));
t("the parts' opening doc blocks are not in the page (" + openers.length + " of them)", openers.length > 50 && !openers.some((o) => html.includes(o)));
t("…but the first line of code after them is", html.includes("function uiModal(") && html.includes(".ui-ov .ui-btn{"));
t("the page is well under its gzipped budget", (await import("node:zlib")).gzipSync(html, { level: 9 }).length < 245 * 1024);

console.log("\nTHE ORDER FILE AND THE DISK MUST AGREE");
writeFileSync(join(TMP, "a", "one.js"), "const ONE=1;\n"); writeFileSync(join(TMP, "b", "two.js"), "const TWO=2;\n");
const fake = (order) => ({ name: "fake", out: join(TMP, "out.js"), dir: TMP, order, ext: /\.js$/ });
t("the parts come back in the order given, not alphabetical", partsFor(fake(["b/two.js", "a/one.js"])).join() === "b/two.js,a/one.js");
const refuses = (order, why) => { try { partsFor(fake(order)); return false; } catch (e) { return why.test(e.message); } };
t("a file on disk that the order file doesn't list stops the build", refuses(["a/one.js"], /on disk but not in the order file: b\/two\.js/));
t("a listed file that isn't on disk stops the build", refuses(["a/one.js", "b/two.js", "c/three.js"], /listed but not on disk: c\/three\.js/));
t("a file listed twice stops the build", refuses(["a/one.js", "b/two.js", "a/one.js"], /listed twice: a\/one\.js/));
t("the real targets pass that check", TARGETS.every((x) => partsFor(x).length > 0));

rmSync(TMP, { recursive: true, force: true });
console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
