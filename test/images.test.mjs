// Image quality v2 (2026-10-07): the original kept with its colour profile
// and pixels, its hidden data (GPS, camera) stripped; feed/grid copies
// described to the browser so it picks the sharp one.
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { readFileSync } from "node:fs";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
let pass = 0, fail = 0;
const t = (n, ok) => { ok ? pass++ : fail++; console.log("  " + (ok ? "✓" : "✗") + "  " + n); };
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const part = readFileSync(join(ROOT, "src/app-08-images.js"), "utf8");
const I = new Function("esc", part + "\nreturn {imgAttrs,pxImgs,imgSmall,cleanJpeg,cleanPng,jpegOrientation};")(esc);

const seg = (m, body) => { const b = Buffer.from(body); const h = Buffer.from([0xff, m, (b.length + 2) >> 8, (b.length + 2) & 255]); return Buffer.concat([h, b]); };
const exif = (orient, extra = "") => {   // Exif\0\0 + little-endian TIFF with one IFD entry: Orientation
  const tiff = Buffer.alloc(26); tiff.write("II", 0); tiff.writeUInt16LE(42, 2); tiff.writeUInt32LE(8, 4);
  tiff.writeUInt16LE(1, 8); tiff.writeUInt16LE(0x0112, 10); tiff.writeUInt16LE(3, 12); tiff.writeUInt32LE(1, 14); tiff.writeUInt16LE(orient, 18);
  return Buffer.concat([Buffer.from("Exif\0\0"), tiff, Buffer.from(extra)]);
};
const pixels = Buffer.from([0x12, 0x34, 0xff, 0x00, 0x56, 0x78, 0x9a]);   // stand-in scan data (incl. a stuffed FF00)
const jpeg = (orient) => Buffer.concat([Buffer.from([0xff, 0xd8]), seg(0xe0, "JFIF\0\x01\x01"), seg(0xe1, exif(orient, "GPS 40.7128N 74.0060W")),
  seg(0xe1, "http://ns.adobe.com/xap/1.0/\0<x:xmpmeta>Lens</x:xmpmeta>"), seg(0xe2, "ICC_PROFILE\0\x01\x01Display P3"), seg(0xed, "Photoshop 3.0\0IRB"),
  seg(0xfe, "made on my phone"), seg(0xe6, "GoPro GPS5 34.05N"), seg(0xe2, "MPF\0 preview index"), seg(0xee, "Adobe\0"),
  seg(0xdb, "\0quant"), seg(0xc0, "\x08\x00\x10\x00\x10\x03"), seg(0xda, "\x03scan"), pixels, Buffer.from([0xff, 0xd0, 0x11, 0x22]), Buffer.from([0xff, 0xd9]),
  Buffer.from("ftypmp42 motion photo video with GPS 51.5N")]);
const blob = (buf, type) => new Blob([buf], { type });
const bytes = async (b) => Buffer.from(await b.arrayBuffer());

console.log("\nJPEG: KEEP THE PICTURE, DROP WHAT IT GIVES AWAY");
const out = await bytes(await I.cleanJpeg(blob(jpeg(1), "image/jpeg")));
const s = out.toString("latin1");
t("GPS / EXIF gone", !s.includes("Exif") && !s.includes("40.7128"));
t("other camera blocks (APP6 GPS, MPF) gone; Adobe colour flag kept", !s.includes("GoPro") && !s.includes("MPF") && s.includes("Adobe"));
t("a video or second picture tacked on after the end is cut off", !s.includes("motion photo") && !s.includes("51.5N"));
t("XMP, Photoshop data and comments gone", !s.includes("xmpmeta") && !s.includes("Photoshop") && !s.includes("my phone"));
t("the colour profile stays", s.includes("ICC_PROFILE") && s.includes("Display P3"));
const src = jpeg(1), sos = src.indexOf(Buffer.from([0xff, 0xda])), eoi = src.indexOf(Buffer.from([0xff, 0xd9]), sos) + 2;
t("the image data (scan, restart markers, end) is byte-for-byte the same", out.subarray(out.indexOf(Buffer.from([0xff, 0xda]))).equals(src.subarray(sos, eoi)));
t("no end marker → not trusted (canvas instead)", (await I.cleanJpeg(blob(src.subarray(0, eoi - 2), "image/jpeg"))) === null);
t("still a JPEG (starts FFD8, ends FFD9)", out[0] === 0xff && out[1] === 0xd8 && out.at(-2) === 0xff && out.at(-1) === 0xd9);
t("a photo turned by its EXIF tag goes through the canvas instead (null)", (await I.cleanJpeg(blob(jpeg(6), "image/jpeg"))) === null);
t("not a JPEG → null", (await I.cleanJpeg(blob(Buffer.from("hello"), "image/jpeg"))) === null);

console.log("\nPNG");
const chunk = (type, data) => { const d = Buffer.from(data, "latin1"), h = Buffer.alloc(8); h.writeUInt32BE(d.length, 0); h.write(type, 4, "latin1"); return Buffer.concat([h, d, Buffer.alloc(4)]); };
const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", "x".repeat(13)), chunk("iCCP", "P3 profile"),
  chunk("tEXt", "Author\0me"), chunk("eXIf", "GPS"), chunk("IDAT", "pixels"), chunk("IEND", "")]);
const ps = (await bytes(await I.cleanPng(blob(png, "image/png")))).toString("latin1");
t("text and EXIF chunks gone", !ps.includes("tEXt") && !ps.includes("eXIf") && !ps.includes("Author"));
t("profile and pixels stay", ps.includes("iCCP") && ps.includes("IDAT") && ps.includes("pixels") && ps.endsWith("IEND" + "\0\0\0\0"));

console.log("\nTHE BROWSER PICKS THE SHARP COPY");
const old = I.imgAttrs({ url: "/uploads/full.jpg", thumb: "/uploads/th.jpg", w: 1800, h: 2400 });
t("an old post says its copy is only 525 wide, so a phone fetches the original", old.includes('srcset="/uploads/th.jpg 525w, /uploads/full.jpg 1800w"') && old.includes("sizes="));
const neu = I.imgAttrs({ url: "/uploads/o.png", thumb: "/uploads/t.png", sm: "/uploads/s.png", w: 4000, h: 5000, tw: 1440, sw: 480 });
t("a new post offers grid, feed and original", neu.includes("/uploads/s.png 480w, /uploads/t.png 1440w, /uploads/o.png 4000w"));
t("the opened post shows the original", I.imgAttrs({ url: "/uploads/o.png", thumb: "/uploads/t.png", w: 4000, h: 5000 }, true) === 'src="/uploads/o.png"');
t("no size known → just the copy", I.imgAttrs({ url: "/uploads/o.jpg", thumb: "/uploads/t.jpg" }) === 'src="/uploads/t.jpg"');
t("a one-picture post without a list still works", I.pxImgs({ imageUrl: "/a.jpg", thumbUrl: "/b.jpg", mediaW: 10, mediaH: 20 })[0].w === 10);
t("grids use the small copy when there is one", I.imgSmall({ url: "/o", thumb: "/t", sm: "/s" }) === "/s" && I.imgSmall({ url: "/o", thumb: "/t" }) === "/t");
t("names in srcset are escaped", !I.imgAttrs({ url: '/uploads/"x', thumb: "/uploads/t", w: 9000, h: 9000 }).includes('"x'));

console.log("\nWIRED IN");
const app = readFileSync(join(ROOT, "public/index.html"), "utf8"), rt = readFileSync(join(ROOT, "src/server.runtime.js"), "utf8");
t("the creator uploads the original + copies", app.includes("const im=await uploadWork(file);"));
t("feed copies are 1440 wide; grid copies 480", app.includes("drawFit(img,1440,2400),sc=drawFit(img,480,800)"));
t("transparency stays transparent (PNG copies)", app.includes('const copyType=alpha?"image/png":"image/jpeg"'));
t("Showroom and posts use srcset", (app.match(/\$\{imgAttrs\(/g) || []).length >= 4);
t("the server keeps the copies' widths, only for files uploaded here", rt.includes("if (own(i.sm) && px(i.sw))") && rt.includes("/^\\/uploads\\/[A-Za-z0-9._-]+$/.test(i.url)"));
console.log(`\n  ${pass} passed, ${fail} failed`);
