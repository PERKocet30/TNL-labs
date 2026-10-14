/* TNL LABS admin v3.0 — 2026-10-14. People: the member directory.
   v2.1: who's in the tournament; posts say which lab they're in.
   v2.2: "a database of all members and account information" — List | Database, Download CSV.
   v3.0: "on par with Microsoft or Google" — one directory, two views of the same
   rows: Table (a data grid: summary numbers on top, choose columns, compact
   rows, sticky header and name column, sort by any heading, pages of 25/50/100)
   and Cards (for a phone). Search filters as you type, without a round trip.
   One person's record is in 3-person.js. */
let PQ = "", PFILTER = "all", PERSON = null, PPAGE = 0;
let PPREF = { view: "table", size: 50, dense: false, cols: null, k: "joined", up: false };
try { Object.assign(PPREF, JSON.parse(localStorage.getItem("tnl-admin-people") || "{}")); } catch (e) {}
const psave = () => { try { localStorage.setItem("tnl-admin-people", JSON.stringify(PPREF)); } catch (e) {} };
const PFILTERS = [["all", "Everyone"], ["new", "New this week"], ["silent", "Never posted"], ["quiet", "Gone quiet"],
  ["tournament", "In the tournament"], ["sellers", "Sellers"], ["unverified", "Unverified"], ["suspended", "Suspended"], ["admins", "Admins"]];

LOADERS.people = async () => {
  const r = await req(`/api/admin/people?filter=${PFILTER}&all=1`);
  D.people = r.people; D.peopleTotal = r.total;
};

/* ---- shared by the directory and the record ---- */
const ADAY_MS = 86400000;
const pday = (t) => (t ? new Date(t).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" }) : "—");
const pwhen = (t) => (t ? new Date(t).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : "—");
/* last active = the later of their last action and the last time they opened the app */
const plast = (u) => Math.max(u.lastActive || 0, u.lastSeen || 0) || null;
/* one word for where someone stands, the same everywhere */
function pstatus(u) {
  if (u.suspended) return ["Suspended", "bad"];
  const last = plast(u) || 0;
  if (last > Date.now() - 30 * ADAY_MS) return ["Active", "ok"];
  if (u.joined > Date.now() - 7 * ADAY_MS) return ["New", "ok"];
  return ["Inactive", "off"];
}
const badge = ([label, tone]) => `<span class="st ${tone}"><i></i>${label}</span>`;

/* ---- the columns: key, heading, sort value, cell, align, shown by default ---- */
const PCOLS = [
  ["name", "Member", (u) => u.displayName.toLowerCase(), (u) => `<div class="pdb-name">${av(u)}<span><b>${esc(u.displayName)}${u.isAdmin ? `<span class="tag on">admin</span>` : ""}</b><span class="dim">@${esc(u.username)}</span></span></div>`, "", 1],
  ["id", "ID", (u) => u.id, (u) => "#" + u.id, "num", 1],
  ["status", "Status", (u) => ["Suspended", "Inactive", "New", "Active"].indexOf(pstatus(u)[0]), (u) => badge(pstatus(u)), "", 1],
  ["email", "Email", (u) => (u.email || "").toLowerCase(), (u) => `<span class="pdb-mail">${esc(u.email || "—")}</span>`, "", 1],
  ["verified", "Email status", (u) => +u.verified, (u) => (u.verified ? "Confirmed" : `<span class="tag warn">Not confirmed</span>`), "", 1],
  ["role", "What they make", (u) => (u.role || "").toLowerCase(), (u) => esc(u.role || "—"), "", 0],
  ["joined", "Joined", (u) => u.joined, (u) => pday(u.joined), "num", 1],
  ["active", "Last active", (u) => plast(u), (u) => (plast(u) ? ago(plast(u)) + (/\d[mhd]$/.test(ago(plast(u))) ? " ago" : "") : "Never"), "num", 1],
  ["level", "Level", (u) => u.rep, (u) => `L${u.level} <span class="dim">${esc(u.levelName)}</span>`, "", 1],
  ["rep", "Rep", (u) => u.rep, (u) => num(u.rep), "num", 1],
  ["posts", "Posts", (u) => u.posts, (u) => num(u.posts), "num", 1],
  ["followers", "Followers", (u) => u.followers, (u) => num(u.followers), "num", 1],
  ["collabs", "Collabs", (u) => u.collabs, (u) => num(u.collabs), "num", 0],
  ["listings", "Listings", (u) => u.listings, (u) => num(u.listings), "num", 0],
  ["gross", "Sales", (u) => u.gross, (u) => (u.gross ? money(u.gross) : "—"), "num", 1],
  ["payouts", "Payouts", (u) => +u.payouts, (u) => (u.payouts ? "On" : "—"), "", 0],
  ["tournament", "Tournament", (u) => +u.tournament, (u) => (u.tournament ? "Taking part" : "—"), "", 0],
  ["note", "Admin note", (u) => +u.note, (u) => (u.note ? "Yes" : "—"), "", 0],
];
const pcolsOn = () => { const on = PPREF.cols && PPREF.cols.length ? PPREF.cols : PCOLS.filter((c) => c[5]).map((c) => c[0]); return PCOLS.filter((c) => c[0] === "name" || on.includes(c[0])); };

/* search, then sort — all in the browser, so typing never waits */
function prows() {
  const t = PQ.trim().toLowerCase(), col = PCOLS.find((c) => c[0] === PPREF.k) || PCOLS[6], f = col[2];
  const list = (D.people || []).filter((u) => !t || u.username.toLowerCase().includes(t) || u.displayName.toLowerCase().includes(t) || (u.email || "").toLowerCase().includes(t));
  return list.sort((a, b) => { const x = f(a), y = f(b); return (x < y ? -1 : x > y ? 1 : a.id - b.id) * (PPREF.up ? 1 : -1); });
}

/* the numbers above the grid, for whatever is filtered and searched */
function psummaryHTML(rows) {
  const n = rows.length, pct = (k) => (n ? Math.round((k / n) * 100) + "%" : "—");
  const active = rows.filter((u) => pstatus(u)[0] === "Active").length, confirmed = rows.filter((u) => u.verified).length;
  const tile = (k, v, d) => `<div class="sum-t"><span>${k}</span><b>${v}</b>${d ? `<i>${d}</i>` : ""}</div>`;
  return `<div class="sum">${tile("Members", num(n), PQ || PFILTER !== "all" ? "of " + num(D.peopleTotal) : "")}${tile("Active · 30 days", num(active), pct(active))}
    ${tile("Email confirmed", num(confirmed), pct(confirmed))}${tile("Have posted", num(rows.filter((u) => u.posts).length), "")}
    ${tile("Selling", num(rows.filter((u) => u.listings).length), num(rows.filter((u) => u.payouts).length) + " with payouts")}
    ${tile("Sales", money(rows.reduce((s, u) => s + (u.gross || 0), 0)), "")}${tile("Suspended", num(rows.filter((u) => u.suspended).length), "")}</div>`;
}

function ptableHTML(rows) {
  const cols = pcolsOn();
  return `<div class="pdb-wrap${PPREF.dense ? " dense" : ""}"><table class="tbl pdb"><thead><tr>${cols.map(([k, l, , , a]) =>
    `<th class="${a}" aria-sort="${PPREF.k === k ? (PPREF.up ? "ascending" : "descending") : "none"}"><button class="pdb-h${PPREF.k === k ? " on" : ""}" data-pdbk="${k}">${l}<span class="arr">${PPREF.k === k ? (PPREF.up ? "↑" : "↓") : ""}</span></button></th>`).join("")}</tr></thead>
    <tbody>${rows.map((u) => `<tr class="clk${u.suspended ? " off" : ""}" data-person="${esc(u.username)}">${cols.map(([, , , cell, a]) => `<td class="${a}">${cell(u)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
}
function pcardsHTML(rows) {
  return `<div class="list">${rows.map((u) => `<button class="li" data-person="${esc(u.username)}">${av(u)}
    <span class="b"><b>${esc(u.displayName)}${u.isAdmin ? `<span class="tag on">admin</span>` : ""}${!u.verified ? `<span class="tag">unverified</span>` : ""}${u.note ? `<span class="tag">note</span>` : ""}</b>
      <span>@${esc(u.username)} · #${u.id} · L${u.level} ${esc(u.levelName)} · ${u.posts} post${u.posts === 1 ? "" : "s"}${u.gross ? ` · ${money(u.gross)} sold` : ""}</span></span>
    <span class="r">${badge(pstatus(u))}<br>${plast(u) ? ago(plast(u)) : "joined " + ago(u.joined)}</span></button>`).join("")}</div>`;
}
function presultsHTML() {
  if (!D.people) return `<div class="empty">Loading members…</div>`;
  const rows = prows(), pages = Math.max(1, Math.ceil(rows.length / PPREF.size));
  PPAGE = Math.min(PPAGE, pages - 1);
  const from = PPAGE * PPREF.size, page = rows.slice(from, from + PPREF.size);
  return psummaryHTML(rows) + (!rows.length ? `<div class="empty">No one matches${PQ ? ` “${esc(PQ)}”` : ""}.</div>`
    : (PPREF.view === "table" ? ptableHTML(page) : pcardsHTML(page)) + `<div class="pager"><span class="mono">${num(from + 1)}–${num(from + page.length)} of ${num(rows.length)}</span>
      <label class="mono">Rows <select class="sel" id="psize">${[25, 50, 100].map((n) => `<option ${PPREF.size === n ? "selected" : ""}>${n}</option>`).join("")}</select></label>
      <button class="ib" data-pg="-1" aria-label="Previous page" ${PPAGE ? "" : "disabled"}>‹</button><span class="mono">Page ${PPAGE + 1} of ${pages}</span><button class="ib" data-pg="1" aria-label="Next page" ${PPAGE < pages - 1 ? "" : "disabled"}>›</button></div>`);
}

/* The whole database as a spreadsheet. Fetched with your admin sign-in, then saved. */
async function downloadMembers() {
  try {
    const r = await fetch("/api/admin/members.csv", { headers: TOKEN ? { Authorization: "Bearer " + TOKEN } : {} });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Couldn't make the file");
    const b = await r.blob(), a = document.createElement("a"), name = (/filename="([^"]+)"/.exec(r.headers.get("content-disposition") || "") || [])[1] || "tnl-labs-members.csv";
    a.href = URL.createObjectURL(b); a.download = name; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    toast("Downloaded — it has everyone's email, keep it somewhere safe");
  } catch (e) { toast(e.message); }
}

VIEWS.people = () => `
  ${pageHead("People", "Every member's account, activity and standing. Tap a row to open their record.", `<button class="btn ghost sm" id="pcsv">${I.down} Export CSV</button>`)}
  <div class="tb">
    <div class="srch">${di('<circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5"/>', 16)}<input id="pq" placeholder="Search name, username or email" value="${esc(PQ)}" autocomplete="off" aria-label="Search members"></div>
    <div class="seg" role="group" aria-label="View"><button class="${PPREF.view === "table" ? "on" : ""}" data-pview="table">Table</button><button class="${PPREF.view === "cards" ? "on" : ""}" data-pview="cards">Cards</button></div>
    ${PPREF.view === "table" ? `<details class="menu"><summary class="btn ghost sm">Columns</summary><div class="menu-b">${PCOLS.slice(1).map(([k, l]) =>
      `<label><input type="checkbox" data-pcol="${k}" ${pcolsOn().some((c) => c[0] === k) ? "checked" : ""}> ${l}</label>`).join("")}<button class="btn ghost sm" id="pcolreset">Reset</button></div></details>
      <button class="btn ghost sm${PPREF.dense ? " on" : ""}" id="pdense" aria-pressed="${PPREF.dense}">Compact</button>`
    : `<select class="sel" id="psort" aria-label="Sort">${PCOLS.map(([k, l]) => `<option value="${k}" ${PPREF.k === k ? "selected" : ""}>Sort: ${l}</option>`).join("")}</select>`}
  </div>
  <div class="filters">${PFILTERS.map(([k, l]) => `<button class="pill sm ${PFILTER === k ? "on" : ""}" data-pf="${k}">${l}</button>`).join("")}</div>
  <div id="pres">${presultsHTML()}</div>

  <details class="more"><summary>${I.msg} Message a group</summary>
    <p class="dim" style="font-size:13px;margin-bottom:10px">Lands as a DM from you — one chat per person. Use it rarely; it's your loudest tool.</p>
    <select class="sel" id="bcto"><option value="silent">Everyone who's never posted</option><option value="quiet">Everyone quiet for 2+ weeks</option><option value="all">Everyone</option></select>
    <textarea class="in" id="bcbody" rows="3" style="margin-top:8px" placeholder="Say something worth opening the app for…"></textarea>
    <button class="btn" id="bcsend" style="margin-top:8px">Send</button>
  </details>`;

/* only the results repaint while you search, sort or page — the search box keeps its place */
function paintPeopleResults() { const el = $("#pres"); if (!el) return; el.innerHTML = presultsHTML(); wirePeopleResults(); wireCommon(); }
function wirePeopleResults() {
  $$("[data-pdbk]").forEach((b) => b.onclick = () => { const k = b.dataset.pdbk; PPREF.up = PPREF.k === k ? !PPREF.up : k === "name" || k === "email" || k === "role"; PPREF.k = k; PPAGE = 0; psave(); paintPeopleResults(); });
  $$("[data-pg]").forEach((b) => b.onclick = () => { PPAGE += +b.dataset.pg; paintPeopleResults(); $("#pres").scrollIntoView({ block: "start" }); });
  const sz = $("#psize"); if (sz) sz.onchange = () => { PPREF.size = +sz.value; PPAGE = 0; psave(); paintPeopleResults(); };
}
WIRES.people = () => {
  const q = $("#pq"); if (q) q.oninput = () => { PQ = q.value; PPAGE = 0; paintPeopleResults(); };
  $$("[data-pf]").forEach((b) => b.onclick = () => { PFILTER = b.dataset.pf; PPAGE = 0; D.people = null; paint(); load(); });
  $$("[data-pview]").forEach((b) => b.onclick = () => { PPREF.view = b.dataset.pview; psave(); paint(); });
  const s = $("#psort"); if (s) s.onchange = () => { PPREF.k = s.value; PPREF.up = ["name", "email", "role"].includes(s.value); PPAGE = 0; psave(); paintPeopleResults(); };
  $$("[data-pcol]").forEach((c) => c.onchange = () => { PPREF.cols = $$("[data-pcol]").filter((x) => x.checked).map((x) => x.dataset.pcol); psave(); paintPeopleResults(); });
  const cr = $("#pcolreset"); if (cr) cr.onclick = () => { PPREF.cols = null; psave(); paint(); };
  const dn = $("#pdense"); if (dn) dn.onclick = () => { PPREF.dense = !PPREF.dense; psave(); paint(); };
  const cv = $("#pcsv"); if (cv) cv.onclick = downloadMembers;
  wirePeopleResults();
  const bc = $("#bcsend"); if (bc) bc.onclick = async () => {
    const body = $("#bcbody").value.trim(), target = $("#bcto").value;
    if (!body) return toast("Write something first");
    const who = { all: "everyone", silent: "everyone who's never posted", quiet: "everyone who's gone quiet" }[target];
    if (!(await confirmIt(`Message ${who}?`, `"${body.slice(0, 140)}"\n\nOne DM each, from you. This can't be undone.`, { ok: "Send" }))) return;
    const r = await act(() => req("/api/admin/broadcast", { method: "POST", body: { body, target } }), (d) => "Sent to " + d.sent);
    if (r) $("#bcbody").value = "";
  };
};
