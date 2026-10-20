// PNG (2026-10-20): "Is image quality still at the highest possible
// quality?" A piece of work already keeps a PNG as PNG (uploadWork,
// app-08-images). Now a listing photo goes through the same pipeline
// instead of an 1800px JPEG, and the photo editor keeps a PNG as PNG.
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { readFileSync } from "node:fs";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
let pass = 0, fail = 0;
const t = (n, ok) => { ok ? pass++ : fail++; console.log("  " + (ok ? "✓" : "✗") + "  " + n); };
const part = (f) => readFileSync(join(ROOT, "src", f), "utf8");
const img = part("app-08-images.js"), mkt = part("app-17-market.js"), ped = part("app-18-photo-edit.js");
t("a piece of work keeps a PNG original (≤6MB) untouched", /image\/png"&&file\.size<=6\*1024\*1024\)full=await cleanPng/.test(img));
t("…and its 3000px copy and feed copies are PNG when it has see-through parts", img.includes('const copyType=alpha?"image/png":"image/jpeg"') && img.includes("canvasBlob(tc,copyType"));
t("a listing photo now takes the same path (not an 1800px JPEG)", mkt.includes("await uploadWork(f)") && !mkt.includes("compressImage(f,1800"));
t("the photo editor keeps a PNG as PNG", /T=\/png\$\/\.test\(String\(im\.url\|\|""\)\)\?"image\/png":"image\/jpeg"/.test(ped) && ped.includes("canvasBlob(src,T,q(.92))"));
t("the server accepts PNG by its bytes", /ext: "png", kind: "image", bytes: \[0x89, 0x50, 0x4e, 0x47\]/.test(part("server-03-upload-dm-notifications.js")));
console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
