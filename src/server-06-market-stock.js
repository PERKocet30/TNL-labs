/* ---- STOCK · sizes and colours · 2026-09-30 ----
   A listing can carry variants: [{id, size, colour, qty}]. None = one item
   with a quantity, as it always was. Every unit that leaves goes through
   takeStock(), so the arrange path and the paid path can't drift. */
const variantLabel = (v) => (v ? [v.size, v.colour].filter(Boolean).join(" / ") : "");
function parseVariants(r) {
  try { const v = JSON.parse(r?.variants || "[]"); return Array.isArray(v) ? v : []; } catch { return []; }
}
const stockOf = (vs) => vs.reduce((n, v) => n + (v.qty || 0), 0);

/* What a seller sends → what we store. Ids are kept when a row is edited
   (an order points at one), made up for new rows. Blank rows and repeats
   are dropped. */
function cleanVariants(list) {
  if (!Array.isArray(list)) return [];
  const out = [], seen = new Set();
  for (const x of list.slice(0, 40)) {
    const size = String(x?.size ?? "").trim().slice(0, 20), colour = String(x?.colour ?? "").trim().slice(0, 30);
    if (!size && !colour) continue;
    const key = (size + "|" + colour).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    let id = String(x?.id ?? "").replace(/[^a-z0-9]/gi, "").slice(0, 12);
    if (!id || out.some((o) => o.id === id)) id = randomBytes(4).toString("hex");
    out.push({ id, size, colour, qty: Math.min(500, Math.max(0, Math.round(Number(x?.qty)) || 0)) });
  }
  return out;
}

/* Which variant a buyer asked for. null when the listing has none;
   { error } when it has some and the pick is missing or sold out. */
function pickVariant(l, variantId) {
  const vs = parseVariants(l);
  if (!vs.length) return null;
  const v = vs.find((x) => x.id === String(variantId || ""));
  if (!v) return { error: "Pick a size first" };
  if (v.qty < 1) return { error: `${variantLabel(v)} is sold out` };
  return v;
}

/* One unit leaves. Returns false when there was nothing left to take (the
   caller tells the seller it oversold). The listing closes at zero. */
function takeStock(listingId, variantId) {
  const l = db.prepare(`SELECT * FROM listings WHERE id=?`).get(listingId);
  if (!l || l.status !== "active") return false;
  const vs = parseVariants(l), now = Date.now();
  let left;
  if (vs.length) {
    const v = vs.find((x) => x.id === variantId);
    if (!v || v.qty < 1) return false;
    v.qty--;
    left = stockOf(vs);
    db.prepare(`UPDATE listings SET variants=?, updated_at=? WHERE id=?`).run(JSON.stringify(vs), now, l.id);
  } else left = Math.max(0, (l.quantity ?? 1) - 1);
  if (left === 0) db.prepare(`UPDATE listings SET quantity=0, status='sold', sold_at=?, updated_at=? WHERE id=?`).run(now, now, l.id);
  else db.prepare(`UPDATE listings SET quantity=?, updated_at=? WHERE id=?`).run(left, now, l.id);
  return true;
}

/* Market search by size: the listing's own size, or a variant that's still
   in stock in that size. */
const SIZE_MATCH = `(l.size = ? OR EXISTS (SELECT 1 FROM json_each(l.variants) v
  WHERE json_extract(v.value,'$.size') = ? AND json_extract(v.value,'$.qty') > 0))`;
