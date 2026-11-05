/* v1.1 2026-11-03: what the walkthrough teaches. LABS admin v4.0 — 2026-10-20. Sellers: who can take money, which kind of
   Stripe account they got (the short signup with Stripe carrying the risk ·
   the short signup with LABS carrying it · the old full signup), who started
   and never finished, and a nudge for them. Reads /api/admin/sellers. */
LOADERS.sellers = async () => { const r = await req("/api/admin/sellers"); D.sellers = r.sellers; D.learned = r.learned; };
/* What the sell walkthrough teaches (2026-11-03): who lists, by type and department, and how far people get. Counts only. */
const WTYPE = { brand: "Brands", vintage: "Vintage", custom: "One of one", unsaid: "Not said" };
const WSTEP = { what: "What are you selling?", who: "Who's selling it?", photos: "Photos", words: "Title & description", stock: "Size & stock", details: "Details", price: "Price & shipping", review: "Review", listed: "Listed" };
function learnedHTML(L) {
  if (!L) return "";
  const w = L.walk, who = L.whoLists;
  const types = who.byType.map((r) => ({ label: `${WTYPE[r.k] || r.k} · ${num(r.sellers)} seller${r.sellers === 1 ? "" : "s"}`, n: r.listings }));
  const depts = who.byDept.map((r) => ({ label: `${r.k} · ${num(r.sellers)} seller${r.sellers === 1 ? "" : "s"}`, n: r.listings }));
  const steps = w.steps.map((s) => ({ label: WSTEP[s.step] || s.step, n: s.n }));
  const byType = w.byType.filter((t) => t.walks).map((t) => `${WTYPE[t.k]}: ${num(t.listed)} of ${num(t.walks)} listed`).join(" · ");
  return `<div class="two" style="margin-top:12px">
    ${card("Who's listing", `<div class="body">${who.byType.length ? breakHTML(types) + `<p class="mono" style="margin:10px 0 6px">BY DEPARTMENT · live listings</p>` + breakHTML(depts) : `<div class="empty">No listings yet.</div>`}</div>`, "live listings, by who's selling")}
    ${card("How far the walkthrough takes people", `<div class="body">${w.walks ? funnelHTML(steps) + `<p class="mono" style="margin-top:10px">${num(w.walks)} started · ${num(w.listed)} listed · ${num(w.skippedDetails)} skipped Details${byType ? "<br>" + esc(byType) : ""}</p>` : `<div class="empty">Nobody has started a listing in the last ${L.days} days.</div>`}</div>`, `last ${L.days} days`)}
  </div>`;
}
const KIND = { express_stripe: ["Short signup", "Stripe carries the risk"], express: ["Short signup", "LABS carries the risk"], standard: ["Full signup", "their own Stripe"], "": ["—", "no payouts yet"] };
VIEWS.sellers = () => {
  const S = D.sellers; if (!S) return askel();
  const ready = S.filter((s) => s.ready), stuck = S.filter((s) => s.started && !s.ready), none = S.filter((s) => !s.started);
  const byKind = ["express_stripe", "express", "standard"].map((k) => ({ label: KIND[k][0] + " · " + KIND[k][1], n: ready.filter((s) => s.kind === k).length }));
  const stateOf = (s) => s.ready ? `<span class="st ok"><i></i>Can sell</span>` : s.started ? `<span class="st warn"><i></i>Started, not finished</span>` : `<span class="st off"><i></i>No payouts yet</span>`;
  const row = (s) => `<tr><td><button class="pdb-name" data-person="${esc(s.username)}">${av(s)}<span><b>${esc(s.displayName)}</b><span class="dim">@${esc(s.username)}${s.isAdmin ? " · admin" : ""}</span></span></button></td>
    <td>${stateOf(s)}</td><td>${esc(KIND[s.kind][0])}<div class="mono">${esc(KIND[s.kind][1])}</div></td><td class="num">${s.fee}%</td><td class="num">${num(s.listings)}</td><td class="num">${num(s.sales)}</td><td class="num">${money(s.gross)}</td>
    <td>${s.started && !s.ready ? `<button class="btn ghost sm" data-dm="${esc(s.username)}">Nudge ${I.msg}</button>` : ""}</td></tr>`;
  const cardRow = (s) => `<div class="c2">${av(s)}<div class="c2b"><b>${esc(s.displayName)}</b><span>@${esc(s.username)} · ${esc(KIND[s.kind][0])} · ${num(s.listings)} listed · ${money(s.gross)}</span>${stateOf(s)}</div>${s.started && !s.ready ? `<button class="btn ghost sm c2a" data-dm="${esc(s.username)}">Nudge</button>` : ""}</div>`;
  const table = (rows) => rows.length ? `<div class="scroll"><table class="tbl"><thead><tr><th>Seller</th><th>Payouts</th><th>Stripe account</th><th class="num">Fee</th><th class="num">Listed</th><th class="num">Sales</th><th class="num">Gross</th><th></th></tr></thead><tbody>${rows.map(row).join("")}</tbody></table></div><div class="cards2">${rows.map(cardRow).join("")}</div>` : `<div class="empty">Nobody here.</div>`;
  return `
  ${pageHead("Sellers", "Who can take money, and who got stuck on the way")}
  <div class="grid g2 g4">
    ${kpiHTML("Can sell", num(ready.length), { share: `${pct(ready.length, S.length)} of ${S.length} who tried or listed` })}
    ${kpiHTML("Stuck in setup", num(stuck.length), { share: "started payouts, never finished" })}
    ${kpiHTML("Listing without payouts", num(none.length), { share: "buyers can't pay them yet" })}
    ${kpiHTML("Short signup", num(ready.filter((s) => /^express/.test(s.kind)).length), { share: `${ready.filter((s) => s.kind === "standard").length} on the full signup` })}
  </div>
  ${learnedHTML(D.learned)}
  ${card("Which kind of Stripe account", `<div class="body">${breakHTML(byKind)}<p class="mono" style="margin-top:10px">Stripe is asked to carry the risk first; if it won't, LABS does and pays the card fee; the full signup is what sellers had before Oct 19.</p></div>`)}
  ${stuck.length ? card("Stuck in setup", `<div class="body toc">${table(stuck)}</div>`, "a nudge opens a chat with them in the app") : ""}
  ${card("Can sell", `<div class="body toc">${table(ready)}</div>`)}
  ${none.length ? card("Listed, but no payouts", `<div class="body toc">${table(none)}</div>`) : ""}`;
};
WIRES.sellers = () => {};
