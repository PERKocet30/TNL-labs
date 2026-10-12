/* TNL LABS admin v2.2 — 2026-10-12. People: find anyone, see their story, act.
   v2.1: who's in the tournament; posts say which lab they're in.
   v2.2: "a database of all members and account information" — List | Database
   (every member, a column each, tap a heading to sort), Download CSV, and an
   Account section in each person's drawer. */
let PQ = "", PFILTER = "all", PSORT = "joined", PERSON = null, PVIEW = "list", PDB = { k: "joined", up: false };
try { PVIEW = localStorage.getItem("tnl-admin-pview") === "db" ? "db" : "list"; } catch (e) {}
const PFILTERS = [["all", "Everyone"], ["new", "New this week"], ["silent", "Never posted"], ["quiet", "Gone quiet"],
  ["tournament", "In the tournament"], ["sellers", "Sellers"], ["unverified", "Unverified"], ["suspended", "Suspended"], ["admins", "Admins"]];
const PSORTS = [["joined", "Newest"], ["active", "Last active"], ["rep", "Rep"], ["posts", "Posts"], ["sales", "Sales"]];

LOADERS.people = async () => {
  const r = await req(`/api/admin/people?q=${encodeURIComponent(PQ)}&filter=${PFILTER}&sort=${PSORT}${PVIEW === "db" ? "&all=1" : ""}`);
  D.people = r.people; D.peopleTotal = r.total;
};
/* ---- the Database view: one row per member, a column per fact ---- */
const PCOLS = [
  ["name", "Member", (u) => u.displayName.toLowerCase()], ["email", "Email", (u) => (u.email || "").toLowerCase()],
  ["verified", "Email ✓", (u) => +u.verified], ["joined", "Joined", (u) => u.joined], ["active", "Last active", (u) => u.lastActive || 0],
  ["rep", "Level", (u) => u.rep], ["posts", "Posts", (u) => u.posts], ["followers", "Followers", (u) => u.followers],
  ["collabs", "Collabs", (u) => u.collabs], ["listings", "Listings", (u) => u.listings], ["gross", "Sold", (u) => u.gross],
  ["payouts", "Payouts", (u) => +u.payouts], ["status", "Status", (u) => (u.suspended ? 2 : u.isAdmin ? 1 : 0)]];
const pday = (t) => (t ? new Date(t).toLocaleDateString([], { month: "short", day: "numeric", year: "2-digit" }) : "—");
function peopleDbHTML() {
  const col = PCOLS.find(([k]) => k === PDB.k) || PCOLS[3], f = col[2];
  const rows = [...D.people].sort((a, b) => { const x = f(a), y = f(b); return (x < y ? -1 : x > y ? 1 : 0) * (PDB.up ? 1 : -1); });
  const cell = {
    name: (u) => `<td><div class="pdb-name">${av(u)}<span><b>${esc(u.displayName)}</b><span class="dim">@${esc(u.username)}</span></span></div></td>`,
    email: (u) => `<td class="pdb-mail">${esc(u.email || "")}</td>`, verified: (u) => `<td>${u.verified ? "yes" : `<span class="tag warn">no</span>`}</td>`,
    joined: (u) => `<td class="num">${pday(u.joined)}</td>`, active: (u) => `<td class="num">${u.lastActive ? ago(u.lastActive) : "—"}</td>`,
    rep: (u) => `<td>L${u.level} <span class="dim">${u.rep}</span></td>`, posts: (u) => `<td class="num">${u.posts}</td>`, followers: (u) => `<td class="num">${u.followers}</td>`,
    collabs: (u) => `<td class="num">${u.collabs}</td>`, listings: (u) => `<td class="num">${u.listings}</td>`, gross: (u) => `<td class="num">${u.gross ? money(u.gross) : "—"}</td>`,
    payouts: (u) => `<td>${u.payouts ? "on" : "—"}</td>`,
    status: (u) => `<td>${u.suspended ? `<span class="tag warn">suspended</span>` : u.isAdmin ? `<span class="tag on">admin</span>` : "member"}</td>`,
  };
  return `<div class="pdb-wrap"><table class="tbl pdb"><thead><tr>${PCOLS.map(([k, l]) => `<th><button class="pdb-h${PDB.k === k ? " on" : ""}" data-pdbk="${k}">${l}${PDB.k === k ? (PDB.up ? " ↑" : " ↓") : ""}</button></th>`).join("")}</tr></thead>
    <tbody>${rows.map((u) => `<tr class="clk" data-person="${esc(u.username)}">${PCOLS.map(([k]) => cell[k](u)).join("")}</tr>`).join("")}</tbody></table></div>`;
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
  <div class="row sp wrapx"><h1 style="font-size:22px">People</h1><span class="mono">${D.people ? D.people.length + " shown" + (D.peopleTotal ? " of " + D.peopleTotal + " members" : "") : ""}</span></div>
  <div class="row sp wrapx" style="margin-top:10px;gap:8px"><div class="row" style="gap:6px"><button class="pill sm ${PVIEW === "list" ? "on" : ""}" data-pview="list">List</button><button class="pill sm ${PVIEW === "db" ? "on" : ""}" data-pview="db">Database</button></div>
    <button class="btn ghost sm" id="pcsv">${I.out} Download CSV</button></div>
  <div class="row" style="margin:12px 0 8px;gap:8px"><input class="in" id="pq" placeholder="Search name, username or email" value="${esc(PQ)}" autocomplete="off">
    <select class="sel" id="psort" aria-label="Sort">${PSORTS.map(([k, l]) => `<option value="${k}" ${PSORT === k ? "selected" : ""}>${l}</option>`).join("")}</select></div>
  <div class="filters">${PFILTERS.map(([k, l]) => `<button class="pill sm ${PFILTER === k ? "on" : ""}" data-pf="${k}">${l}</button>`).join("")}</div>
  <div class="list" style="margin-top:10px">${!D.people ? `<div class="empty">Loading…</div>` : !D.people.length ? `<div class="empty">Nobody matches.</div>`
    : PVIEW === "db" ? peopleDbHTML() : D.people.map((u) => `<button class="li" data-person="${esc(u.username)}">${av(u)}
      <span class="b"><b>${esc(u.displayName)}${u.isAdmin ? `<span class="tag on">admin</span>` : ""}${u.suspended ? `<span class="tag warn">suspended</span>` : ""}${!u.verified ? `<span class="tag">unverified</span>` : ""}${u.note ? `<span class="tag">note</span>` : ""}</b>
        <span>@${esc(u.username)} · L${u.level} ${esc(u.levelName)} · ${u.posts} post${u.posts === 1 ? "" : "s"}${u.collabs ? ` · ${u.collabs} collab${u.collabs === 1 ? "" : "s"}` : ""}${u.gross ? ` · ${money(u.gross)} sold` : ""}</span></span>
      <span class="r">${u.lastActive ? "active " + ago(u.lastActive) : "joined " + ago(u.joined)}</span></button>`).join("")}</div>

  <details class="more"><summary>${I.msg} Message a group</summary>
    <p class="dim" style="font-size:13px;margin-bottom:10px">Lands as a DM from you — one chat per person. Use it rarely; it's your loudest tool.</p>
    <select class="sel" id="bcto"><option value="silent">Everyone who's never posted</option><option value="quiet">Everyone quiet for 2+ weeks</option><option value="all">Everyone</option></select>
    <textarea class="in" id="bcbody" rows="3" style="margin-top:8px" placeholder="Say something worth opening the app for…"></textarea>
    <button class="btn" id="bcsend" style="margin-top:8px">Send</button>
  </details>`;

WIRES.people = () => {
  const q = $("#pq");
  if (q) { let t; q.oninput = () => { PQ = q.value; clearTimeout(t); t = setTimeout(async () => { await load(); const f = $("#pq"); if (f) { f.focus(); f.setSelectionRange(f.value.length, f.value.length); } }, 250); }; }
  $$("[data-pf]").forEach((b) => b.onclick = () => { PFILTER = b.dataset.pf; D.people = null; paint(); load(); });
  const s = $("#psort"); if (s) s.onchange = () => { PSORT = s.value; load(); };
  $$("[data-pview]").forEach((b) => b.onclick = () => { PVIEW = b.dataset.pview; try { localStorage.setItem("tnl-admin-pview", PVIEW); } catch (e) {} D.people = null; paint(); load(); });
  $$("[data-pdbk]").forEach((b) => b.onclick = () => { const k = b.dataset.pdbk; PDB = { k, up: PDB.k === k ? !PDB.up : k === "name" || k === "email" }; paint(); });
  const cv = $("#pcsv"); if (cv) cv.onclick = downloadMembers;
  const bc = $("#bcsend"); if (bc) bc.onclick = async () => {
    const body = $("#bcbody").value.trim(), target = $("#bcto").value;
    if (!body) return toast("Write something first");
    const who = { all: "everyone", silent: "everyone who's never posted", quiet: "everyone who's gone quiet" }[target];
    if (!(await confirmIt(`Message ${who}?`, `"${body.slice(0, 140)}"\n\nOne DM each, from you. This can't be undone.`, { ok: "Send" }))) return;
    const r = await act(() => req("/api/admin/broadcast", { method: "POST", body: { body, target } }), (d) => "Sent to " + d.sent);
    if (r) $("#bcbody").value = "";
  };
};

/* ---- one person ---- */
async function openPerson(username) {
  PERSON = { username, data: null }; paintPerson();
  try { PERSON.data = await req("/api/admin/people/" + encodeURIComponent(username)); } catch (e) { toast(e.message); PERSON = null; }
  paintPerson();
}
function closePerson() { PERSON = null; paintPerson(); }
function paintPerson() {
  let el = $("#person");
  if (!PERSON) { if (el) el.remove(); document.body.style.overflow = ""; return; }
  if (!el) { el = document.createElement("div"); el.id = "person"; el.className = "scrim"; $("#layer").appendChild(el); }
  document.body.style.overflow = "hidden";
  el.innerHTML = `<aside class="drawer" role="dialog" aria-modal="true">${personHTML()}</aside>`;
  el.onclick = (e) => { if (e.target === el) closePerson(); };
  wirePerson(el);
}
function personHTML() {
  const d = PERSON.data;
  const head = `<div class="row sp"><button class="ib" data-close aria-label="Close">${I.x}</button>
    ${d ? `<a class="btn ghost sm" href="/u/${encodeURIComponent(d.person.username)}" target="_blank">Profile ${I.out}</a>` : ""}</div>`;
  if (!d) return head + `<div class="empty">Loading…</div>`;
  const p = d.person, s = d.stats;
  const stat = (v, l) => `<div><b>${v}</b><span>${l}</span></div>`;
  return head + `
    <div class="hd">${av(p, "lg")}<div><b>${esc(p.displayName)}</b><span class="dim">@${esc(p.username)} · ${esc(p.role || "")}</span>
      <div style="margin-top:4px">${p.isAdmin ? `<span class="tag on">admin</span>` : ""}${p.suspended ? `<span class="tag warn">suspended</span>` : ""}${p.verified ? `<span class="tag">email confirmed</span>` : `<span class="tag warn">email not confirmed</span>`}${p.payouts ? `<span class="tag">payouts on</span>` : ""}</div></div></div>
    <p class="mono">Joined ${new Date(p.joined).toLocaleDateString()} · last opened the app ${p.lastSeen ? ago(p.lastSeen) + " ago" : "— not since Sep 29"} · ${s.sessions} signed-in device${s.sessions === 1 ? "" : "s"}</p>
    <div class="stats">
      ${stat(p.rep, "rep · L" + p.level + " " + esc(p.levelName))}${stat(p.fee + "%", "their commission")}${stat(s.collabs, "collabs" + (s.pendingCollabs ? ` · ${s.pendingCollabs} pending` : ""))}
      ${stat(s.posts, s.work + " published")}${stat(s.likesGot + s.commentsGot, "feedback received")}${stat(s.feedbackGiven, "feedback given")}
      ${stat(s.votes, "tournament votes" + (s.entered ? " · entered" : ""))}${stat(s.messages, "messages sent")}${stat(s.followers, "followers · " + s.following + " following")}${stat(money(s.gross), s.sold + " sold · " + s.bought + " bought")}
    </div>
    ${s.reportsAgainst || s.blockedBy ? `<div class="warnbox">${s.reportsAgainst} report${s.reportsAgainst === 1 ? "" : "s"} involving them · blocked by ${s.blockedBy}</div>` : ""}
    <div class="acts">
      <button class="btn sm" data-dm="${esc(p.username)}">${I.msg} Message</button>
      ${!p.verified ? `<button class="btn ghost sm" data-pa="verify">Confirm email</button>` : ""}
      <button class="btn ghost sm" data-pa="rep">Adjust rep</button>
      <button class="btn ghost sm" data-pa="feature">Feature +40</button>
      <button class="btn ghost sm" data-pa="signout">Sign out everywhere</button>
      ${p.isAdmin ? "" : `<button class="btn ${p.suspended ? "ghost" : "danger"} sm" data-pa="suspend">${p.suspended ? "Restore account" : "Suspend"}</button>`}
    </div>
    <h2 class="sec">Account</h2>
    <table class="tbl acct"><tbody>
      <tr><td class="dim">Email</td><td>${esc(p.email || "—")} ${p.email ? `<button class="btn ghost sm" data-copy="${esc(p.email)}">Copy</button>` : ""}</td></tr>
      <tr><td class="dim">Email confirmed</td><td>${p.verified ? "Yes" : "No"}</td></tr>
      <tr><td class="dim">Member no.</td><td>#${p.id}</td></tr>
      <tr><td class="dim">Joined</td><td>${new Date(p.joined).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</td></tr>
      <tr><td class="dim">Last opened the app</td><td>${p.lastSeen ? new Date(p.lastSeen).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : "—"}</td></tr>
      <tr><td class="dim">Signed in on</td><td>${s.sessions} device${s.sessions === 1 ? "" : "s"}</td></tr>
      <tr><td class="dim">What they make</td><td>${esc((p.roles && p.roles.length ? p.roles : [p.role]).filter(Boolean).join(" · ") || "—")}</td></tr>
      <tr><td class="dim">Pronouns</td><td>${esc(p.pronouns || "—")}</td></tr>
      <tr><td class="dim">Links</td><td>${(p.links && p.links.length ? p.links.map((l) => l.url || l) : p.link ? [p.link] : []).map((u) => /^https?:\/\//i.test(u) ? `<a href="${esc(u)}" target="_blank" rel="noopener noreferrer">${esc(u.replace(/^https?:\/\//, ""))}</a>` : esc(u)).join("<br>") || "—"}</td></tr>
      <tr><td class="dim">Bio</td><td>${esc(p.bio || "—")}</td></tr>
      <tr><td class="dim">Payouts</td><td>${p.payouts ? "On — Stripe is set up" : p.stripeConnected ? "Started, not finished" : "Not set up"}</td></tr>
      <tr><td class="dim">Commission</td><td>${p.fee}% (L${p.level} ${esc(p.levelName)})</td></tr>
      <tr><td class="dim">Account</td><td>${p.suspended ? "Suspended" : p.isAdmin ? "Admin" : "Member"}</td></tr>
    </tbody></table>
    <label class="l" for="pnote">Private note — only admins see this</label>
    <textarea class="in" id="pnote" rows="3" maxlength="2000" placeholder="How you know them, what they make, what they need…">${esc(d.note ? d.note.body : "")}</textarea>
    <div class="row sp" style="margin-top:6px"><span class="mono">${d.note && d.note.at ? "saved " + ago(d.note.at) + " ago" + (d.note.by ? " by @" + esc(d.note.by) : "") : ""}</span><button class="btn sm ghost" data-pa="note">Save note</button></div>
    <h2 class="sec">Recent posts</h2>
    ${d.posts.length ? `<div class="thumbs">${d.posts.map((x) => `<div title="${esc(x.labName === "Profile" ? "Profile" : "// " + x.labName)} · ${x.likes} likes">${x.thumbUrl ? `<img src="${esc(x.thumbUrl)}" alt="" loading="lazy">` : esc(x.body || (x.video ? "Video" : "Post"))}</div>`).join("")}</div>` : `<div class="empty">Hasn't posted yet.</div>`}
    <h2 class="sec">Rep history</h2>
    ${d.rep.length ? `<table class="tbl"><tbody>${d.rep.map((r) => `<tr><td>${esc(r.kind.replace(/_/g, " "))}</td><td class="num">${r.amount > 0 ? "+" : ""}${r.amount}</td><td class="num dim">${ago(r.at)}</td></tr>`).join("")}</tbody></table>` : `<div class="empty">No rep yet.</div>`}`;
}
function wirePerson(el) {
  const u = PERSON && PERSON.username;
  $("[data-close]", el).onclick = closePerson;
  $$("[data-copy]", el).forEach((b) => b.onclick = async () => { try { await navigator.clipboard.writeText(b.dataset.copy); toast("Copied"); } catch (e) { toast(b.dataset.copy); } });
  $$("[data-dm]", el).forEach((b) => b.onclick = () => window.open("/?dm=" + encodeURIComponent(b.dataset.dm), "_blank"));
  $$("[data-pa]", el).forEach((b) => b.onclick = async () => {
    const a = b.dataset.pa, base = "/api/admin/members/" + encodeURIComponent(u), p = PERSON.data.person;
    if (a === "note") return act(() => req("/api/admin/people/" + encodeURIComponent(u) + "/note", { method: "POST", body: { body: $("#pnote").value } }), "Note saved").then(refreshPerson);
    if (a === "verify") return act(() => req(base + "/verify", { method: "POST" }), "Email confirmed").then(refreshPerson);
    if (a === "feature") { if (!(await confirmIt(`Feature @${u}?`, "+40 rep, and they're told you featured their work. Logged and permanent.", { ok: "Feature" }))) return;
      return act(() => req(base + "/feature", { method: "POST" }), "Featured — +40 rep").then(refreshPerson); }
    if (a === "rep") {
      const v = await promptIt(`Adjust @${u}'s rep`, { body: `Now ${p.rep}. Use + or − (up to 500). Written to the rep log with your name.`, placeholder: "+25 or -10", inputmode: "numeric" });
      if (v == null || !v.trim()) return;
      const delta = Math.round(Number(v.replace(/[^\d+-]/g, "")));
      if (!delta) return toast("Enter a number like +25 or -10");
      const reason = await promptIt("Why?", { placeholder: "e.g. ran the workshop", body: "Kept in the admin log." });
      if (reason == null) return;
      return act(() => req(base + "/rep", { method: "POST", body: { delta, reason } }), (r) => `@${u} now has ${r.rep} rep`).then(refreshPerson);
    }
    if (a === "signout") { if (!(await confirmIt(`Sign @${u} out everywhere?`, "Every device they're signed in on. They can sign straight back in.", { ok: "Sign out" }))) return;
      return act(() => req("/api/admin/people/" + encodeURIComponent(u) + "/signout", { method: "POST" }), (r) => `Signed out of ${r.sessions} device${r.sessions === 1 ? "" : "s"}`).then(refreshPerson); }
    if (a === "suspend") {
      const on = !p.suspended;
      if (!(await confirmIt(on ? `Suspend @${u}?` : `Restore @${u}?`, on ? "They're signed out now and can't sign back in. Their work stays up." : "They can sign in again.", { ok: on ? "Suspend" : "Restore", danger: on }))) return;
      return act(() => req(base + "/suspend", { method: "POST", body: { suspended: on } }), on ? "Suspended" : "Restored").then(refreshPerson);
    }
  });
}
async function refreshPerson() {
  if (!PERSON) return;
  try { PERSON.data = await req("/api/admin/people/" + encodeURIComponent(PERSON.username)); } catch (e) {}
  paintPerson(); if (TAB === "people") { await LOADERS.people(); paint(); }
}
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && PERSON && !$(".modal")) closePerson(); });
