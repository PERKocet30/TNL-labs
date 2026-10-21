/* LABS admin v4.0 — 2026-10-20. Sellers: who can take money, which kind of
   Stripe account they got (the short signup with Stripe carrying the risk ·
   the short signup with LABS carrying it · the old full signup), who started
   and never finished, and a nudge for them. Reads /api/admin/sellers. */
LOADERS.sellers = async () => { D.sellers = (await req("/api/admin/sellers")).sellers; };
const KIND = { express_stripe: ["Short signup", "Stripe carries the risk"], express: ["Short signup", "LABS carries the risk"], standard: ["Full signup", "their own Stripe"], "": ["—", "no payouts yet"] };
VIEWS.sellers = () => {
  const S = D.sellers; if (!S) return `<div class="empty">Loading…</div>`;
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
  ${card("Which kind of Stripe account", `<div class="body">${breakHTML(byKind)}<p class="mono" style="margin-top:10px">Stripe is asked to carry the risk first; if it won't, LABS does and pays the card fee; the full signup is what sellers had before Oct 19.</p></div>`)}
  ${stuck.length ? card("Stuck in setup", `<div class="body toc">${table(stuck)}</div>`, "a nudge opens a chat with them in the app") : ""}
  ${card("Can sell", `<div class="body toc">${table(ready)}</div>`)}
  ${none.length ? card("Listed, but no payouts", `<div class="body toc">${table(none)}</div>`) : ""}`;
};
WIRES.sellers = () => {};
