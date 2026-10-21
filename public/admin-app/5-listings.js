/* LABS admin v4.0 — 2026-10-20. Listings: what's for sale, by whom, with
   stock, views, saves and sales; filter tabs; the ones nobody looks at. */
let LSTAT = "active", LQ = "";
LOADERS.listings = async () => { const [l, m] = await Promise.all([req("/api/admin/listings"), req("/api/admin/market")]); D.listings = l.listings; D.market = m; };
VIEWS.listings = () => {
  const L = D.listings, m = D.market; if (!L || !m) return `<div class="empty">Loading…</div>`;
  const q = LQ.trim().toLowerCase();
  const rows = L.filter((l) => (LSTAT === "all" || l.status === LSTAT) && (!q || (l.title + " " + l.seller).toLowerCase().includes(q)));
  const count = (s) => L.filter((l) => s === "all" || l.status === s).length;
  const stale = (l) => l.status === "active" && Date.now() - l.createdAt > 14 * 86400000 && l.views < 5;
  const TYPE = { brand: "Brand", vintage: "Vintage", custom: "One of one" };
  const row = (l) => `<tr><td><div class="pdb-name"><span class="pic" style="width:34px;height:34px;border-radius:6px;background:var(--el);overflow:hidden;flex-shrink:0">${l.img ? `<img src="${esc(l.img)}" alt="" style="width:100%;height:100%;object-fit:cover">` : ""}</span><span><b>${esc(l.title)}</b><span class="dim">${esc(TYPE[l.sellType] || l.kind || "")}</span></span></div></td>
    <td><button data-person="${esc(l.seller)}">@${esc(l.seller)}</button></td><td class="num">${money(l.price)}</td><td class="num">${l.status === "active" ? num(l.qty) : "—"}</td>
    <td class="num">${num(l.views)}</td><td class="num">${num(l.saves)}</td><td class="num">${num(l.sales)}</td>
    <td><span class="st ${l.status === "active" ? (stale(l) ? "warn" : "ok") : "off"}"><i></i>${l.status === "active" ? (stale(l) ? "No one's looking" : "Live") : esc(l.status)}</span></td>
    <td class="num dim">${ago(l.createdAt)}</td><td><a class="btn ghost sm" href="/m/${l.id}" target="_blank">${I.out}</a> <button class="btn danger sm" data-dellist="${l.id}" aria-label="Remove">${I.trash}</button></td></tr>`;
  const cardRow = (l) => `<div class="c2"><div class="pic">${l.img ? `<img src="${esc(l.img)}" alt="">` : ""}</div><div class="c2b"><b>${esc(l.title)}</b><span>@${esc(l.seller)} · ${money(l.price)} · ${num(l.views)} views · ${num(l.sales)} sold</span>
    <span class="st ${l.status === "active" ? (stale(l) ? "warn" : "ok") : "off"}"><i></i>${l.status === "active" ? (stale(l) ? "No one's looking" : "Live") : esc(l.status)}</span></div><a class="btn ghost sm c2a" href="/m/${l.id}" target="_blank">${I.out}</a></div>`;
  return `
  ${pageHead("Listings", "What's for sale, by whom, and what's moving")}
  <div class="grid g2 g4">
    ${kpiHTML("Live now", num(m.active), { share: `${m.sellers} seller${m.sellers === 1 ? "" : "s"}` })}
    ${kpiHTML("Sold", num(m.sold), { share: "listings that sold out" })}
    ${kpiHTML("No one's looking", num(L.filter(stale).length), { share: "live 2+ weeks, under 5 views" })}
    ${kpiHTML("Saved", num(sum(L.map((l) => l.saves))), { share: "across every listing" })}
  </div>
  ${card("Listings", `<div class="tb" style="margin:10px 14px 0"><div class="srch">${di('<circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5"/>', 16)}<input id="lq" placeholder="Search title or seller" value="${esc(LQ)}"></div></div>
    ${subTabs([["active", `Live <em>${count("active")}</em>`], ["sold", `Sold <em>${count("sold")}</em>`], ["all", `All <em>${count("all")}</em>`]], LSTAT, "data-ls")}
    <div class="body toc">${!rows.length ? `<div class="empty">Nothing here.</div>` : `<div class="scroll"><table class="tbl"><thead><tr><th>Listing</th><th>Seller</th><th class="num">Price</th><th class="num">Stock</th><th class="num">Views</th><th class="num">Saves</th><th class="num">Sold</th><th>Status</th><th class="num">Listed</th><th></th></tr></thead>
      <tbody>${rows.map(row).join("")}</tbody></table></div><div class="cards2">${rows.map(cardRow).join("")}</div>`}</div>`)}
  ${card("Top sellers", `<div class="body"><div class="list">${m.topSellers.length ? m.topSellers.map((s) => `<button class="li" data-person="${esc(s.username)}">${av({ displayName: s.display_name, avatarUrl: s.avatar_url })}
    <span class="b"><b>${esc(s.display_name)}</b><span>@${esc(s.username)} · ${s.sales} sale${s.sales === 1 ? "" : "s"}</span></span><span class="r">${money(s.gross)}</span></button>`).join("") : `<div class="empty">No sales yet.</div>`}</div></div>`, "all time")}`;
};
WIRES.listings = () => {
  $$("[data-ls]").forEach((b) => b.onclick = () => { LSTAT = b.dataset.ls; paint(); });
  const q = $("#lq"); if (q) q.oninput = () => { LQ = q.value; paint(); };
  $$("[data-dellist]").forEach((b) => b.onclick = async () => {
    if (!(await confirmIt("Remove this listing?", "It comes down from the Market and the seller is told.", { ok: "Remove", danger: true }))) return;
    await act(() => req("/api/admin/listings/" + b.dataset.dellist, { method: "DELETE" }), "Removed"); load();
  });
};
