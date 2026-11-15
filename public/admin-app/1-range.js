/* LABS admin — THE PERIOD and DOWNLOADS v1.0 — 2026-11-15 ("meet Google level analytics"). Loads after 1-core.js.
   · The date range every page with time on it shows: 7 · 30 · 90 days, or any dates (Dates opens two day
     pickers). The server reads it the one way the dictionary says (mWindow: days=, or from= & to=, in your
     own time); RANGE stays the number of days, so "vs the N days before" is always true.
   · A card's numbers as a spreadsheet: csvBtn(name, head, rows) draws the button and remembers the rows;
     the download is made here, in the browser — nothing extra is asked of the server. */
let RFROM = "", RTO = "", RPICK = false;
const CSVS = {};
const rangeQ = () => (RFROM && RTO ? `from=${RFROM}&to=${RTO}` : `days=${RANGE}`) + `&tz=${new Date().getTimezoneOffset()}`;
const pulseURL = () => `/api/admin/pulse?${rangeQ()}`;
const rDay = (d) => { const p = (n) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; };
const rShow = (s) => new Date(s + "T12:00:00").toLocaleDateString([], { month: "short", day: "numeric" });
const rangeHTML = () => { const today = rDay(new Date()), custom = !!(RFROM && RTO);
  return `<div class="rng"><div class="seg" role="group" aria-label="Date range">${[7, 30, 90].map((d) => `<button class="${!custom && RANGE === d ? "on" : ""}" data-range="${d}">${d} days</button>`).join("")}<button class="${custom || RPICK ? "on" : ""}" data-range-pick aria-expanded="${RPICK}">${custom ? `${rShow(RFROM)} – ${rShow(RTO)}` : "Dates"}</button></div>
    ${RPICK ? `<div class="rpick"><label>From <input type="date" id="rfrom" max="${today}" value="${RFROM || rDay(new Date(Date.now() - (RANGE - 1) * 86400000))}"></label><label>To <input type="date" id="rto" max="${today}" value="${RTO || today}"></label><button class="btn sm" id="rgo">Show</button></div>` : ""}</div>`; };
/* a new period: everything that was counted over the old one is asked for again */
function rangeSet() { for (const k of ["pulse", "series", "dir", "topwork", "audience", "network", "visits", "globe"]) D[k] = null; load(); }
function wireRange() {
  $$("[data-range]").forEach((b) => b.onclick = () => { RANGE = +b.dataset.range; RFROM = RTO = ""; RPICK = false; try { localStorage.setItem("tnl-admin-range", RANGE); } catch (e) {} rangeSet(); });
  $$("[data-range-pick]").forEach((b) => b.onclick = () => { RPICK = !RPICK; paint(); });
  const go = $("#rgo"); if (go) go.onclick = () => { const a = $("#rfrom").value, b = $("#rto").value;
    if (!a || !b || a > b) return toast("Pick a first day and a last day.");
    const days = Math.round((new Date(b + "T12:00:00") - new Date(a + "T12:00:00")) / 86400000) + 1;
    if (days > 366) return toast("A year at most.");
    RFROM = a; RTO = b; RANGE = days; RPICK = false; rangeSet(); };
  $$("[data-csv]").forEach((b) => b.onclick = (e) => { e.stopPropagation(); csvSave(b.dataset.csv); });
}
/* a card's rows, kept for its download */
const csvBtn = (name, head, rows) => { if (!rows || !rows.length) return ""; CSVS[name] = [head, ...rows];
  return `<button class="csvb" data-csv="${esc(name)}" title="Download as a spreadsheet" aria-label="Download ${esc(name)} as a spreadsheet">${I.down} CSV</button>`; };
/* a cell a spreadsheet would run as a formula is kept as text */
const csvCell = (v) => { let s = v == null ? "" : String(v); if (/^[=+\-@\t\r]/.test(s) && typeof v !== "number") s = "'" + s; return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
function csvSave(name) {
  const rows = CSVS[name]; if (!rows) return;
  const blob = new Blob(["﻿" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
  a.download = `labs-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-${RFROM && RTO ? RFROM + "-to-" + RTO : RANGE + "-days"}.csv`;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  toast("Saved to your downloads.");
}
