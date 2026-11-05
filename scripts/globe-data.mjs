/* Makes public/admin-app/3-globe-data.js — the land and the country centres the admin's globe draws
   (3-globe.js, 2026-11-04). Run once by hand; the app never needs these packages:

     npm pack world-atlas@2.0.2 i18n-iso-countries@7.11.3   (in a scratch folder, then untar both)
     node scripts/globe-data.mjs <world-atlas folder> <i18n-iso-countries codes.json>

   The map is Natural Earth (public domain) by way of world-atlas. Land is a 1° grid, one bit a cell,
   row 0 at 90°N, column 0 at 180°W — a cell is land if its middle is on land, or a small island has a
   point in it. A country's centre is the middle of its largest piece (so the US sits on the 48 states,
   France in Europe), as [lat, lon] to a tenth of a degree. */
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const [wa, codesPath] = process.argv.slice(2);
if (!wa || !codesPath) { console.error("node scripts/globe-data.mjs <world-atlas folder> <codes.json>"); process.exit(1); }

/* TopoJSON → rings of [lon, lat] */
function topo(file, name) {
  const t = JSON.parse(readFileSync(file, "utf8")), [sx, sy] = t.transform.scale, [tx, ty] = t.transform.translate;
  const arcs = t.arcs.map((a) => { let x = 0, y = 0; return a.map(([dx, dy]) => [(x += dx) * sx + tx, (y += dy) * sy + ty]); });
  const arc = (i) => (i < 0 ? arcs[~i].slice().reverse() : arcs[i]);
  const ring = (ids) => ids.flatMap((i, k) => (k ? arc(i).slice(1) : arc(i)));
  const polys = (g) => (g.type === "Polygon" ? [g.arcs.map(ring)] : g.type === "MultiPolygon" ? g.arcs.map((p) => p.map(ring)) : []);
  return t.objects[name].geometries.map((g) => ({ id: g.id, name: g.properties?.name || "", polys: polys(g) }));
}
const area = (r) => { let a = 0; for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += (r[j][0] + r[i][0]) * (r[j][1] - r[i][1]); return a / 2; };

/* land: a scanline fill of every ring (even-odd), then each small island's points */
const W = 360, H = 180, bits = new Uint8Array(W * H);
const land = topo(join(wa, "land-50m.json"), "land").flatMap((g) => g.polys);
const rings = land.flat();
for (let row = 0; row < H; row++) {
  const lat = 90 - row - 0.5, xs = [];
  for (const r of rings) for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [x1, y1] = r[j], [x2, y2] = r[i];
    if ((y1 > lat) !== (y2 > lat)) xs.push(x1 + ((lat - y1) / (y2 - y1)) * (x2 - x1));
  }
  xs.sort((a, b) => a - b);
  for (let k = 0; k + 1 < xs.length; k += 2) for (let col = 0; col < W; col++) { const lon = -180 + col + 0.5; if (lon >= xs[k] && lon < xs[k + 1]) bits[row * W + col] = 1; }
}
for (const p of land) if (Math.abs(area(p[0])) < 3) for (const [lon, lat] of p[0]) {
  const col = Math.min(W - 1, Math.max(0, Math.floor(lon + 180))), row = Math.min(H - 1, Math.max(0, Math.floor(90 - lat))); bits[row * W + col] = 1;
}
const bytes = new Uint8Array(W * H / 8);
bits.forEach((b, i) => { if (b) bytes[i >> 3] |= 1 << (7 - (i & 7)); });

/* centres */
const num2a = new Map(JSON.parse(readFileSync(codesPath, "utf8")).map(([a2, , n]) => [n, a2]));
const BY_NAME = { Kosovo: "XK", "N. Cyprus": "", Somaliland: "", "Indian Ocean Ter.": "", "Ashmore and Cartier Is.": "", "Siachen Glacier": "" };
const centre = {};
for (const g of topo(join(wa, "countries-10m.json"), "countries")) {
  const a2 = g.id && num2a.get(String(g.id).padStart(3, "0")) || BY_NAME[g.name]; if (!a2 || centre[a2]) continue;
  /* a ring that crosses the date line, made continuous: each point within 180° of the one before */
  const unwrap = (r) => r.reduce((o, [x, y]) => { const px = o.length ? o[o.length - 1][0] : x; while (x - px > 180) x -= 360; while (x - px < -180) x += 360; o.push([x, y]); return o; }, []);
  const big = g.polys.map((p) => unwrap(p[0])).sort((a, b) => Math.abs(area(b)) - Math.abs(area(a)))[0]; if (!big) continue;
  let cx = 0, cy = 0, a = 0;
  for (let i = 0, j = big.length - 1; i < big.length; j = i++) { const f = big[j][0] * big[i][1] - big[i][0] * big[j][1]; a += f; cx += (big[j][0] + big[i][0]) * f; cy += (big[j][1] + big[i][1]) * f; }
  const lon = a ? cx / (3 * a) : big[0][0], lat = a ? cy / (3 * a) : big[0][1];
  centre[a2] = [Math.round(lat * 10) / 10, Math.round((((lon + 540) % 360) - 180) * 10) / 10];
}
/* Russia's largest piece runs over the date line, which pulls the middle into the Pacific: its centre by hand */
centre.RU = [61.5, 96];

const out = `/* LABS admin — the globe's map v1.0, 2026-11-04. Made by scripts/globe-data.mjs from Natural Earth (public domain, via
   world-atlas); don't edit by hand. GLOBE_LAND: land on a 1° grid, a bit a cell, row 0 at 90°N, column 0 at 180°W.
   GLOBE_AT: each country's centre, [lat, lon]. Used by 3-globe.js. */
const GLOBE_LAND = "${Buffer.from(bytes).toString("base64")}";
const GLOBE_AT = ${JSON.stringify(centre)};
`;
const dest = join(dirname(fileURLToPath(import.meta.url)), "../public/admin-app/3-globe-data.js");
writeFileSync(dest, out);
console.log(`land cells ${bits.reduce((a, b) => a + b, 0)} / ${W * H}, countries ${Object.keys(centre).length}, ${out.length} bytes → ${dest}`);
